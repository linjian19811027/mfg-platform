import { Injectable, OnModuleInit, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OutsourcingIssue } from '../entities/outsourcing-issue.entity.js';
import {
  OutsourcingReceipt,
  OutsourcingReceiptStatus,
} from '../entities/outsourcing-receipt.entity.js';
import { OutsourcingSettlement } from '../entities/outsourcing-settlement.entity.js';
import { OutsourcingOrderService } from './outsourcing-order.service.js';
import { OutsourcingReceiptService } from './outsourcing-receipt.service.js';
import { OutsourcingSettlementService } from './outsourcing-settlement.service.js';
import {
  MESSAGE_SERVICE,
  MessageService,
  DomainEvent,
} from '../../../shared/message/message.interface.js';
import { EventTypes } from '../../event/event-types.constant.js';

@Injectable()
export class OutsourcingEventService implements OnModuleInit {
  private readonly logger = new Logger('OutsourcingEventService');

  constructor(
    @InjectRepository(OutsourcingIssue)
    private readonly issueRepo: Repository<OutsourcingIssue>,
    @InjectRepository(OutsourcingReceipt)
    private readonly receiptRepo: Repository<OutsourcingReceipt>,
    @InjectRepository(OutsourcingSettlement)
    private readonly settlementRepo: Repository<OutsourcingSettlement>,
    private readonly orderSvc: OutsourcingOrderService,
    private readonly receiptSvc: OutsourcingReceiptService,
    private readonly settlementSvc: OutsourcingSettlementService,
    @Inject(MESSAGE_SERVICE)
    private readonly messageSvc: MessageService,
  ) {}

  onModuleInit() {
    // WMS 出库完成 → 回填 wms_tx_id
    this.messageSvc.subscribe(EventTypes.MATERIAL_ISSUED, (e) =>
      this.onMaterialIssued(e),
    );
    // WMS 检验通过正式入库完成 → 累加 inspected_qty
    this.messageSvc.subscribe(EventTypes.OUTSOURCING_RECEIPT_STOCKED, (e) =>
      this.onReceiptStocked(e),
    );
    // QMS 检验不合格 → 更新收货单状态
    this.messageSvc.subscribe(EventTypes.INSPECTION_COMPLETED, (e) =>
      this.onInspectionCompleted(e),
    );
    // SCM 应付账款创建 → 回填 scm_payable_id
    this.messageSvc.subscribe(EventTypes.OUTSOURCING_PAYABLE_CREATED, (e) =>
      this.onPayableCreated(e),
    );
    this.logger.log('Outsourcing event subscriptions registered');
  }

  // ── WMS 出库完成 → 回填 wms_tx_id ────────────────────────────────────────

  private async onMaterialIssued(event: DomainEvent): Promise<void> {
    const { tenantId, payload } = event;
    if (payload['sourceType'] !== 'OUTSOURCING') return;

    const issueId = payload['sourceId']
      ? String(payload['sourceId'])
      : undefined;
    if (!issueId) return;

    this.logger.log(
      `[Outsourcing] MATERIAL_ISSUED (OUTSOURCING): issueId=${issueId}`,
    );

    try {
      // wms_tx_id 通过 sourceId 关联，这里用事务 ID 回填
      const txId = payload['txId'] ? String(payload['txId']) : undefined;
      if (txId) {
        await this.issueRepo.update(
          { id: issueId, tenantId },
          { wmsTxId: txId },
        );
      }
    } catch (err) {
      this.logger.error(`[Outsourcing] Failed to update wms_tx_id: ${err}`);
    }
  }

  // ── 检验通过正式入库 → 累加 inspected_qty ────────────────────────────────

  private async onReceiptStocked(event: DomainEvent): Promise<void> {
    const { tenantId, payload } = event;
    const receiptId = payload['receiptId']
      ? String(payload['receiptId'])
      : undefined;
    const qty = Number(payload['qty'] ?? 0);

    if (!receiptId || qty <= 0) return;

    this.logger.log(
      `[Outsourcing] OUTSOURCING_RECEIPT_STOCKED: receiptId=${receiptId}, qty=${qty}`,
    );

    try {
      const receipt = await this.receiptRepo.findOne({
        where: { id: receiptId, tenantId },
      });
      if (!receipt) return;

      // 更新收货单状态为 PASSED
      await this.receiptSvc.updateStatus(
        tenantId,
        receiptId,
        OutsourcingReceiptStatus.PASSED,
      );

      // 累加工单已检验合格数量
      await this.orderSvc.incrementInspectedQty(tenantId, receipt.ocId, qty);
    } catch (err) {
      this.logger.error(
        `[Outsourcing] Failed to process OUTSOURCING_RECEIPT_STOCKED: ${err}`,
      );
    }
  }

  // ── QMS 检验完成 → 处理不合格情形 ────────────────────────────────────────

  private async onInspectionCompleted(event: DomainEvent): Promise<void> {
    const { tenantId, payload } = event;
    if (payload['sourceType'] !== 'OUTSOURCING') return;
    if (payload['result'] !== 'FAILED') return;

    const receiptId = payload['sourceId']
      ? String(payload['sourceId'])
      : undefined;
    if (!receiptId) return;

    this.logger.log(
      `[Outsourcing] INSPECTION_COMPLETED (OUTSOURCING, FAILED): receiptId=${receiptId}`,
    );

    try {
      await this.receiptSvc.updateStatus(
        tenantId,
        receiptId,
        OutsourcingReceiptStatus.FAILED,
      );
      // 实际项目中此处可发送通知给外协工单负责人
      this.logger.warn(
        `[Outsourcing] Receipt ${receiptId} inspection FAILED, notification should be sent`,
      );
    } catch (err) {
      this.logger.error(
        `[Outsourcing] Failed to process INSPECTION_COMPLETED FAILED: ${err}`,
      );
    }
  }

  // ── SCM 应付账款创建 → 回填 scm_payable_id ───────────────────────────────

  private async onPayableCreated(event: DomainEvent): Promise<void> {
    const { tenantId, payload } = event;
    const settlementId = payload['settlementId']
      ? String(payload['settlementId'])
      : undefined;
    const payableId = payload['payableId']
      ? String(payload['payableId'])
      : undefined;

    if (!settlementId || !payableId) return;

    this.logger.log(
      `[Outsourcing] OUTSOURCING_PAYABLE_CREATED: settlementId=${settlementId}, payableId=${payableId}`,
    );

    try {
      await this.settlementSvc.updatePayableId(
        tenantId,
        settlementId,
        payableId,
      );
    } catch (err) {
      this.logger.error(
        `[Outsourcing] Failed to update scm_payable_id: ${err}`,
      );
    }
  }
}
