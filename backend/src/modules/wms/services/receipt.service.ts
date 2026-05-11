import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { WmsInventory } from '../entities/wms-inventory.entity.js';
import { InventoryService } from './inventory.service.js';
import { LocationStrategyService } from './location-strategy.service.js';
import { TenantContext } from '../../../shared/tenant/tenant.context.js';
import {
  MESSAGE_SERVICE,
  MessageService,
} from '../../../shared/message/message.interface.js';
import { EventTypes } from '../../event/event-types.constant.js';

export type ReceiptType =
  | 'PURCHASE'
  | 'PRODUCTION'
  | 'RETURN'
  | 'TRANSFER_IN'
  | 'OTHER';

export interface ReceiptRequest {
  receiptType: ReceiptType;
  materialId: string;
  batchId?: string;
  locationId?: string; // 不传则自动推荐
  warehouseId?: string;
  quantity: number;
  uomId: string;
  sourceType?: string;
  sourceId?: string;
  operatorId?: string;
  qualityStatus?: string; // QUALIFIED | UNINSPECTED
  receiptLogId?: string; // 自动入库编排：关联入库日志 ID
  woId?: string; // 自动入库编排：关联工单 ID
}

@Injectable()
export class ReceiptService {
  constructor(
    @InjectRepository(WmsInventory)
    private readonly invRepo: Repository<WmsInventory>,
    private readonly inventorySvc: InventoryService,
    private readonly strategySvc: LocationStrategyService,
    @Inject(MESSAGE_SERVICE)
    private readonly messageSvc: MessageService,
  ) {}

  async receive(req: ReceiptRequest): Promise<WmsInventory> {
    const tenantId = TenantContext.requireCurrentTenant();

    // 自动推荐库位
    let locationId = req.locationId;
    if (!locationId && req.warehouseId) {
      const loc = await this.strategySvc.recommendPutaway(
        req.materialId,
        req.warehouseId,
      );
      if (!loc) throw new BadRequestException('WMS_NO_AVAILABLE_LOCATION');
      locationId = loc.id;
    }
    if (!locationId) throw new BadRequestException('WMS_LOCATION_REQUIRED');

    const inv = await this.inventorySvc.receipt({
      materialId: req.materialId,
      batchId: req.batchId,
      locationId,
      quantity: req.quantity,
      uomId: req.uomId,
      sourceType: req.sourceType ?? req.receiptType,
      sourceId: req.sourceId,
      operatorId: req.operatorId,
    });

    // 如果质检状态为 UNINSPECTED，冻结库存等待检验
    if (req.qualityStatus === 'UNINSPECTED') {
      await this.inventorySvc.lock({
        materialId: req.materialId,
        batchId: req.batchId,
        locationId,
        quantity: req.quantity,
        uomId: req.uomId,
        freezeReason: 'QC_HOLD',
      });
    }

    // 发布 STOCK_IN_COMPLETED 事件
    await this.messageSvc.publish({
      eventId: uuidv4(),
      eventType: EventTypes.STOCK_IN_COMPLETED,
      tenantId,
      sourceModule: 'WMS',
      payload: {
        receiptType: req.receiptType,
        materialId: req.materialId,
        batchId: req.batchId,
        locationId,
        quantity: req.quantity,
        sourceType: req.sourceType,
        sourceId: req.sourceId,
        // 透传 receiptLogId 和 woId 供 MES 回写
        receiptLogId: req.receiptLogId,
        woId: req.woId,
      },
      createdAt: new Date(),
    });

    return inv;
  }

  // ── 上架作业（3.11）──────────────────────────────────────────────────────

  async putaway(params: {
    materialId: string;
    batchId?: string;
    fromLocationId: string; // 收货暂存区
    toLocationId: string; // 目标库位
    quantity: number;
    uomId: string;
    operatorId?: string;
  }): Promise<void> {
    await this.inventorySvc.transfer({
      materialId: params.materialId,
      batchId: params.batchId,
      fromLocationId: params.fromLocationId,
      toLocationId: params.toLocationId,
      quantity: params.quantity,
      uomId: params.uomId,
      operatorId: params.operatorId,
      remark: 'PUTAWAY',
    });
  }
}
