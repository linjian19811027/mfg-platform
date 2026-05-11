import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { WmsInventory } from '../entities/wms-inventory.entity.js';
import {
  WmsPickTask,
  WmsPickTaskLine,
} from '../entities/wms-pick-task.entity.js';
import { InventoryService } from './inventory.service.js';
import {
  LocationStrategyService,
  PickStrategy,
} from './location-strategy.service.js';
import { TenantContext } from '../../../shared/tenant/tenant.context.js';
import {
  MESSAGE_SERVICE,
  MessageService,
} from '../../../shared/message/message.interface.js';
import { EventTypes } from '../../event/event-types.constant.js';

export type IssueType = 'MES_ISSUE' | 'SALES' | 'TRANSFER_OUT' | 'OTHER';

export interface IssueRequest {
  issueType: IssueType;
  materialId: string;
  batchId?: string;
  quantity: number;
  uomId: string;
  warehouseId?: string;
  strategy?: PickStrategy;
  sourceType?: string;
  sourceId?: string;
  operatorId?: string;
}

@Injectable()
export class IssueService {
  constructor(
    @InjectRepository(WmsInventory)
    private readonly invRepo: Repository<WmsInventory>,
    @InjectRepository(WmsPickTask)
    private readonly pickRepo: Repository<WmsPickTask>,
    @InjectRepository(WmsPickTaskLine)
    private readonly pickLineRepo: Repository<WmsPickTaskLine>,
    private readonly inventorySvc: InventoryService,
    private readonly strategySvc: LocationStrategyService,
    @Inject(MESSAGE_SERVICE)
    private readonly messageSvc: MessageService,
  ) {}

  // ── 3.12 出库 ─────────────────────────────────────────────────────────────

  async issue(req: IssueRequest): Promise<{
    issuedQty: number;
    batches: { batchId?: string; locationId: string; qty: number }[];
  }> {
    const tenantId = TenantContext.requireCurrentTenant();

    const candidates = await this.strategySvc.recommend(
      req.materialId,
      req.quantity,
      req.strategy ?? 'FIFO',
      req.warehouseId,
      req.batchId,
    );

    if (candidates.length === 0)
      throw new BadRequestException('WMS_NO_STOCK_AVAILABLE');

    let remaining = req.quantity;
    const issued: { batchId?: string; locationId: string; qty: number }[] = [];

    for (const c of candidates) {
      if (remaining <= 0) break;
      const qty = Math.min(remaining, c.availableQty);

      await this.inventorySvc.issue({
        materialId: req.materialId,
        batchId: c.batchId,
        locationId: c.locationId,
        quantity: qty,
        uomId: req.uomId,
        sourceType: req.sourceType ?? req.issueType,
        sourceId: req.sourceId,
        operatorId: req.operatorId,
      });

      issued.push({ batchId: c.batchId, locationId: c.locationId, qty });
      remaining -= qty;
    }

    if (remaining > 0) throw new BadRequestException('WMS_INSUFFICIENT_STOCK');

    // 发布 MATERIAL_ISSUED 事件
    await this.messageSvc.publish({
      eventId: uuidv4(),
      eventType: EventTypes.MATERIAL_ISSUED,
      tenantId,
      sourceModule: 'WMS',
      payload: {
        issueType: req.issueType,
        materialId: req.materialId,
        issuedQty: req.quantity,
        batches: issued,
        sourceType: req.sourceType,
        sourceId: req.sourceId,
      },
      createdAt: new Date(),
    });

    return { issuedQty: req.quantity, batches: issued };
  }

  // ── 3.13 创建拣货任务 ─────────────────────────────────────────────────────

  async createPickTask(params: {
    sourceType: string;
    sourceId: string;
    lines: {
      materialId: string;
      batchId?: string;
      fromLocationId: string;
      requiredQty: number;
      uomId: string;
    }[];
    pickerId?: string;
  }): Promise<WmsPickTask> {
    const tenantId = TenantContext.requireCurrentTenant();
    const count = await this.pickRepo.count({ where: { tenantId } });
    const taskNo = `PICK-${Date.now()}-${String(count + 1).padStart(4, '0')}`;

    const task = await this.pickRepo.save(
      this.pickRepo.create({
        tenantId,
        taskNo,
        sourceType: params.sourceType,
        sourceId: params.sourceId,
        pickerId: params.pickerId,
        status: 'PENDING',
      }),
    );

    const lineEntities = params.lines.map((l) =>
      this.pickLineRepo.create({
        tenantId,
        pickTaskId: task.id,
        materialId: l.materialId,
        batchId: l.batchId,
        fromLocationId: l.fromLocationId,
        requiredQty: l.requiredQty,
        uomId: l.uomId,
        status: 'PENDING',
      }),
    );
    await this.pickLineRepo.save(lineEntities);

    return task;
  }

  // ── 3.14 拣货复核 ─────────────────────────────────────────────────────────

  async verifyPickTask(
    taskId: string,
    verifiedLines: { lineId: string; pickedQty: number }[],
  ): Promise<WmsPickTask> {
    const tenantId = TenantContext.requireCurrentTenant();
    const task = await this.pickRepo.findOne({
      where: { id: taskId, tenantId },
    });
    if (!task) throw new BadRequestException('WMS_PICK_TASK_NOT_FOUND');

    for (const v of verifiedLines) {
      await this.pickLineRepo.update(v.lineId, {
        pickedQty: v.pickedQty,
        status: 'COMPLETED',
      });
    }

    await this.pickRepo.update(taskId, {
      status: 'COMPLETED',
      completedAt: new Date(),
    });
    return { ...task, status: 'COMPLETED' };
  }
}
