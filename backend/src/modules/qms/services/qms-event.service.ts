import { Injectable, OnModuleInit, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InspectionService } from './inspection.service.js';
import { QmsInspectionRecord } from '../entities/qms-inspection-record.entity.js';
import {
  MESSAGE_SERVICE,
  MessageService,
  DomainEvent,
} from '../../../shared/message/message.interface.js';
import { EventTypes } from '../../event/event-types.constant.js';

@Injectable()
export class QmsEventService implements OnModuleInit {
  private readonly logger = new Logger('QmsEventService');

  constructor(
    private readonly inspectionSvc: InspectionService,
    @InjectRepository(QmsInspectionRecord)
    private readonly irRepo: Repository<QmsInspectionRecord>,
    @Inject(MESSAGE_SERVICE)
    private readonly messageSvc: MessageService,
  ) {}

  onModuleInit() {
    // 订阅 RECEIPT_CONFIRMED 事件，自动创建 IQC 检验任务
    this.messageSvc.subscribe(EventTypes.RECEIPT_CONFIRMED, (e) =>
      this.onReceiptConfirmed(e),
    );
    // 订阅 FQC_INSPECTION_REQUEST 事件，自动创建 FQC 检验任务
    this.messageSvc.subscribe(EventTypes.FQC_INSPECTION_REQUEST, (e) =>
      this.onFqcInspectionRequest(e),
    );
    // 订阅 OUTSOURCING_RECEIPT_CONFIRMED → 创建外协 IQC 检验单
    this.messageSvc.subscribe(EventTypes.OUTSOURCING_RECEIPT_CONFIRMED, (e) =>
      this.onOutsourcingReceiptConfirmed(e),
    );
    this.logger.log('QMS event subscriptions registered');
  }

  // ── SCM 收货确认 → 自动创建 IQC 检验 ──────────────────────────────────────

  private async onReceiptConfirmed(event: DomainEvent): Promise<void> {
    const { tenantId, payload } = event;
    this.logger.log(`[QMS] RECEIPT_CONFIRMED: ${JSON.stringify(payload)}`);

    const items = payload['items'] as
      | Array<{ materialId: string; receivedQty: number }>
      | undefined;
    if (!items || items.length === 0) return;

    try {
      for (const item of items) {
        await this.inspectionSvc.create({
          inspectionType: 'IQC',
          materialId: String(item.materialId),
          batchId: payload['batchId'] ? String(payload['batchId']) : undefined,
          lotQty: Number(item.receivedQty ?? 0),
        });
      }
    } catch (err) {
      this.logger.error(`[QMS] Failed to create IQC inspection: ${err}`);
      throw err;
    }
  }

  // ── MES 完工 → 自动创建 FQC 检验 ─────────────────────────────────────────

  private async onFqcInspectionRequest(event: DomainEvent): Promise<void> {
    const { tenantId, payload } = event;
    this.logger.log(`[QMS] FQC_INSPECTION_REQUEST: ${JSON.stringify(payload)}`);

    const materialId = payload['materialId']
      ? String(payload['materialId'])
      : undefined;
    const woId = payload['woId'] ? String(payload['woId']) : undefined;
    const receiptLogId = payload['receiptLogId']
      ? String(payload['receiptLogId'])
      : undefined;
    const quantity = Number(payload['quantity'] ?? 0);

    if (!materialId || !woId) {
      this.logger.warn(
        '[QMS] FQC_INSPECTION_REQUEST missing materialId or woId',
      );
      return;
    }

    try {
      // 幂等检查：同一 receiptLogId 不重复创建
      if (receiptLogId) {
        const existing = await this.irRepo.findOne({
          where: { tenantId, woId, inspectionType: 'FQC' } as any,
        });
        if (existing) {
          this.logger.warn(
            `[QMS] FQC inspection already exists for woId=${woId}, skipping`,
          );
          return;
        }
      }

      const ir = await this.inspectionSvc.create({
        inspectionType: 'FQC',
        materialId,
        woId,
        lotQty: quantity,
      });

      this.logger.log(
        `[QMS] FQC inspection created: irId=${ir.id}, woId=${woId}`,
      );

      if (receiptLogId) {
        await this.messageSvc.publish({
          eventId: `fqc-created-${ir.id}`,
          eventType: 'FQC_INSPECTION_CREATED',
          tenantId,
          sourceModule: 'QMS',
          targetModule: 'MES',
          payload: { receiptLogId, fqcIrId: ir.id, woId },
          createdAt: new Date(),
        });
      }
    } catch (err) {
      this.logger.error(`[QMS] Failed to create FQC inspection: ${err}`);
      throw err;
    }
  }

  // ── 外协收货确认 → 创建 IQC 检验单 ──────────────────────────────────────

  private async onOutsourcingReceiptConfirmed(
    event: DomainEvent,
  ): Promise<void> {
    const { tenantId, payload } = event;
    this.logger.log(
      `[QMS] OUTSOURCING_RECEIPT_CONFIRMED: receiptId=${payload['receiptId']}`,
    );

    const materialId = payload['materialId']
      ? String(payload['materialId'])
      : undefined;
    const receiptId = payload['receiptId']
      ? String(payload['receiptId'])
      : undefined;
    const qty = Number(payload['qty'] ?? 0);

    if (!materialId || !receiptId) {
      this.logger.warn(
        '[QMS] OUTSOURCING_RECEIPT_CONFIRMED missing materialId or receiptId',
      );
      return;
    }

    try {
      const ir = await this.inspectionSvc.create({
        inspectionType: 'IQC',
        materialId,
        lotQty: qty,
      });

      this.logger.log(
        `[QMS] Outsourcing IQC inspection created: irId=${ir.id}, receiptId=${receiptId}`,
      );

      // 回填 qms_ir_id 到外协收货单（通过事件总线，避免直接依赖 Outsourcing 模块）
      await this.messageSvc.publish({
        eventId: `oc-iqc-created-${ir.id}`,
        eventType: 'OUTSOURCING_IQC_CREATED',
        tenantId,
        sourceModule: 'QMS',
        targetModule: 'OUTSOURCING',
        payload: { receiptId, qmsIrId: ir.id },
        createdAt: new Date(),
      });
    } catch (err) {
      this.logger.error(
        `[QMS] Failed to create outsourcing IQC inspection: ${err}`,
      );
    }
  }
}
