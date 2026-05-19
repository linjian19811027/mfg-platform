import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { MesWorkOrder } from '../entities/mes-work-order.entity.js';
import { MesWorkOrderOperation } from '../entities/mes-work-order-operation.entity.js';
import { MesReceiptLog } from '../entities/mes-receipt-log.entity.js';
import { AutoReceiptConfigService } from './auto-receipt-config.service.js';
import { ReceiptLogService } from './receipt-log.service.js';
import {
  MESSAGE_SERVICE,
  MessageService,
  DomainEvent,
} from '../../../shared/message/message.interface.js';
import { EventTypes } from '../../event/event-types.constant.js';

@Injectable()
export class AutoReceiptOrchestratorService {
  private readonly logger = new Logger('AutoReceiptOrchestrator');

  constructor(
    @InjectRepository(MesWorkOrder)
    private readonly woRepo: Repository<MesWorkOrder>,
    @InjectRepository(MesWorkOrderOperation)
    private readonly wooRepo: Repository<MesWorkOrderOperation>,
    @InjectRepository(MesReceiptLog)
    private readonly logRepo: Repository<MesReceiptLog>,
    private readonly configSvc: AutoReceiptConfigService,
    private readonly logSvc: ReceiptLogService,
    @Inject(MESSAGE_SERVICE)
    private readonly messageSvc: MessageService,
  ) {}

  // ── 订阅 OPERATION_COMPLETED → 处理部分完工入库 ───────────────────────────

  async onOperationCompleted(event: DomainEvent): Promise<void> {
    const { tenantId, payload } = event;
    const wooId = String(payload['wooId'] ?? '');
    const woId = String(payload['woId'] ?? '');
    const completedQty = Number(payload['completedQty'] ?? 0);

    if (!wooId || !woId || completedQty <= 0) return;

    const woo = await this.wooRepo.findOne({ where: { id: wooId, tenantId } });
    if (!woo || !woo.partialReceiptEnabled) return;

    this.logger.log(
      `[Orchestrator] OPERATION_COMPLETED partial receipt: wooId=${wooId}, qty=${completedQty}`,
    );

    const wo = await this.woRepo.findOne({ where: { id: woId, tenantId } });
    if (!wo) return;

    await this.triggerReceiptFlow(tenantId, wo, completedQty, 'PARTIAL');
  }

  // ── 订阅 WORK_ORDER_ALL_COMPLETED → 处理全部完工入库 ─────────────────────

  async onWorkOrderAllCompleted(event: DomainEvent): Promise<void> {
    const { tenantId, payload } = event;
    const woId = String(payload['woId'] ?? '');
    if (!woId) return;

    const wo = await this.woRepo.findOne({ where: { id: woId, tenantId } });
    if (!wo) return;

    // 计算剩余未入库数量（避免重复入库已部分入库的数量）
    const alreadyReceived = Number(wo.actualReceiptQty ?? 0);
    const remainingQty =
      Number(wo.completedQty ?? wo.plannedQty) - alreadyReceived;

    if (remainingQty <= 0) {
      this.logger.log(
        `[Orchestrator] WO ${woId} already fully received, skipping`,
      );
      return;
    }

    this.logger.log(
      `[Orchestrator] WORK_ORDER_ALL_COMPLETED: woId=${woId}, remainingQty=${remainingQty}`,
    );
    await this.triggerReceiptFlow(tenantId, wo, remainingQty, 'FULL');
  }

  // ── 订阅 STOCK_IN_COMPLETED (sourceType=MES) → 回写 actualReceiptQty ─────

  async onStockInCompleted(event: DomainEvent): Promise<void> {
    const { tenantId, payload } = event;
    if (payload['sourceType'] !== 'MES') return;

    const receiptLogId = payload['receiptLogId']
      ? String(payload['receiptLogId'])
      : undefined;
    const woId = payload['woId'] ? String(payload['woId']) : undefined;
    const quantity = Number(payload['quantity'] ?? 0);

    if (!woId || quantity <= 0) return;

    this.logger.log(
      `[Orchestrator] STOCK_IN_COMPLETED: woId=${woId}, qty=${quantity}`,
    );

    try {
      // 累加 actualReceiptQty
      await this.woRepo
        .createQueryBuilder()
        .update(MesWorkOrder)
        .set({ actualReceiptQty: () => `actual_receipt_qty + ${quantity}` })
        .where('id = :woId AND tenant_id = :tenantId', { woId, tenantId })
        .execute();

      // 更新日志状态
      if (receiptLogId) {
        const wmsTxId = payload['wmsTxId']
          ? String(payload['wmsTxId'])
          : undefined;
        await this.logSvc.markSuccess(receiptLogId, wmsTxId);
      }

      // 发布 WO_RECEIPT_WRITEBACK 事件
      await this.messageSvc.publish({
        eventId: uuidv4(),
        eventType: EventTypes.WO_RECEIPT_WRITEBACK,
        tenantId,
        sourceModule: 'MES',
        payload: { woId, quantity, receiptLogId },
        createdAt: new Date(),
      });
    } catch (err) {
      this.logger.error(
        `[Orchestrator] Failed to writeback actualReceiptQty for WO ${woId}: ${err}`,
      );
      if (receiptLogId) {
        await this.logSvc.markFailed(receiptLogId, `Writeback failed: ${err}`);
      }
    }
  }

  // ── 订阅 INSPECTION_COMPLETED (FQC, FAILED) → 更新日志为 FAILED ──────────

  async onInspectionCompleted(event: DomainEvent): Promise<void> {
    const { tenantId, payload } = event;
    if (payload['inspectionType'] !== 'FQC') return;
    if (payload['result'] !== 'FAILED') return;

    const irId = payload['irId'] ? String(payload['irId']) : undefined;
    if (!irId) return;

    // 找到关联此 FQC 检验单的日志
    const log = await this.logRepo.findOne({
      where: { tenantId, fqcIrId: irId },
    });
    if (!log) return;

    this.logger.log(
      `[Orchestrator] FQC FAILED for irId=${irId}, marking log ${log.id} as FAILED`,
    );
    await this.logSvc.markFailed(log.id, `FQC inspection failed: irId=${irId}`);
  }

  // ── 核心：决定走 FQC 还是直接入库 ────────────────────────────────────────

  async triggerReceiptFlow(
    tenantId: string,
    wo: MesWorkOrder,
    qty: number,
    triggerType: 'FULL' | 'PARTIAL',
  ): Promise<void> {
    // 幂等检查：同一工单 FULL 类型不重复触发
    if (triggerType === 'FULL') {
      const existing = await this.logRepo.findOne({
        where: [
          { tenantId, woId: wo.id, triggerType: 'FULL', status: 'PENDING' },
          { tenantId, woId: wo.id, triggerType: 'FULL', status: 'SUCCESS' },
          { tenantId, woId: wo.id, triggerType: 'FULL', status: 'RETRYING' },
        ],
      });
      if (existing) {
        this.logger.warn(
          `[Orchestrator] Duplicate FULL receipt trigger for WO ${wo.id}, skipping`,
        );
        // 记录重复触发事件
        await this.logRepo.save(
          this.logRepo.create({
            tenantId,
            woId: wo.id,
            woNo: wo.woNo,
            triggerType: 'FULL',
            materialId: wo.materialId,
            materialCode: wo.materialCode,
            materialName: wo.materialName,
            quantity: qty,
            uomId: wo.uomId,
            status: 'FAILED',
            errorMessage: `Duplicate trigger rejected: existing log ${existing.id} in status ${existing.status}`,
          }),
        );
        return;
      }
    }

    // 查找自动入库配置
    const config = await this.configSvc.findConfig(tenantId, wo.materialId);

    // 创建入库日志
    const log = await this.logRepo.save(
      this.logRepo.create({
        tenantId,
        woId: wo.id,
        woNo: wo.woNo,
        triggerType,
        materialId: wo.materialId,
        materialCode: wo.materialCode,
        materialName: wo.materialName,
        quantity: qty,
        uomId: wo.uomId,
        targetWarehouseId: config.targetWarehouseId,
        targetLocationId: config.targetLocationId,
        requireFqc: config.requireFqc ? 1 : 0,
        status: 'PENDING',
      }),
    );

    if (config.isDefault) {
      this.logger.warn(
        `[Orchestrator] Using default config for WO ${wo.id} (no matching AutoReceiptConfig found)`,
      );
    }

    const basePayload = {
      receiptLogId: log.id,
      woId: wo.id,
      materialId: wo.materialId,
      quantity: qty,
      uomId: wo.uomId,
      targetWarehouseId: config.targetWarehouseId,
      targetLocationId: config.targetLocationId,
    };

    try {
      if (config.requireFqc) {
        // 路径 B：需要 FQC
        await this.messageSvc.publish({
          eventId: uuidv4(),
          eventType: EventTypes.FQC_INSPECTION_REQUEST,
          tenantId,
          sourceModule: 'MES',
          targetModule: 'QMS',
          payload: basePayload,
          createdAt: new Date(),
        });
        this.logger.log(
          `[Orchestrator] Published FQC_INSPECTION_REQUEST for WO ${wo.id}, logId=${log.id}`,
        );
      } else {
        // 路径 A：直接入库
        await this.messageSvc.publish({
          eventId: uuidv4(),
          eventType: EventTypes.PRODUCTION_RECEIPT_REQUEST,
          tenantId,
          sourceModule: 'MES',
          targetModule: 'WMS',
          payload: basePayload,
          createdAt: new Date(),
        });
        this.logger.log(
          `[Orchestrator] Published PRODUCTION_RECEIPT_REQUEST for WO ${wo.id}, logId=${log.id}`,
        );
      }
    } catch (err) {
      this.logger.error(
        `[Orchestrator] Failed to publish event for WO ${wo.id}: ${err}`,
      );
      await this.logSvc.markFailed(log.id, `Event publish failed: ${err}`);
    }
  }
}
