import { Injectable, OnModuleInit, Inject, Logger } from '@nestjs/common';
import { PurchaseOrderService } from './purchase-order.service.js';
import {
  MESSAGE_SERVICE,
  MessageService,
  DomainEvent,
} from '../../../shared/message/message.interface.js';
import { EventTypes } from '../../event/event-types.constant.js';
import { DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ScmEventService implements OnModuleInit {
  private readonly logger = new Logger('ScmEventService');

  constructor(
    private readonly purchaseOrderSvc: PurchaseOrderService,
    private readonly dataSource: DataSource,
    @Inject(MESSAGE_SERVICE)
    private readonly messageSvc: MessageService,
  ) {}

  onModuleInit() {
    // 订阅收货确认后更新 PO 收货数量（SCM 内部事件，解耦 ReceiptService 对 PurchaseOrderService 的直接依赖）
    this.messageSvc.subscribe(EventTypes.RECEIPT_PO_UPDATE_REQUEST, (e) =>
      this.onReceiptPoUpdateRequest(e),
    );
    // 外协结算审核通过 → 创建应付账款
    this.messageSvc.subscribe(EventTypes.OUTSOURCING_SETTLEMENT_APPROVED, (e) =>
      this.onOutsourcingSettlementApproved(e),
    );
    this.logger.log('SCM event subscriptions registered');
  }

  // ── 收货确认 → 更新 PO 收货数量 ──────────────────────────────────────────

  private async onReceiptPoUpdateRequest(event: DomainEvent): Promise<void> {
    const { tenantId, payload } = event;
    this.logger.log(
      `[SCM] RECEIPT_PO_UPDATE_REQUEST: receiptId=${payload['receiptId']}`,
    );

    const poId = String(payload['poId'] ?? '');
    const confirmedItems = payload['confirmedItems'] as
      | Array<{
          poLineId: string;
          receivedQty: number;
        }>
      | undefined;

    if (!poId || !confirmedItems?.length) return;

    try {
      for (const item of confirmedItems) {
        await this.purchaseOrderSvc.updateReceivedQty(
          tenantId,
          poId,
          item.poLineId,
          item.receivedQty,
        );
      }
    } catch (err) {
      this.logger.error(`[SCM] Failed to update PO received qty: ${err}`);
      throw err;
    }
  }

  // ── 外协结算审核通过 → 创建应付账款，发布 OUTSOURCING_PAYABLE_CREATED ────

  private async onOutsourcingSettlementApproved(
    event: DomainEvent,
  ): Promise<void> {
    const { tenantId, payload } = event;
    this.logger.log(
      `[SCM] OUTSOURCING_SETTLEMENT_APPROVED: settlementId=${payload['settlementId']}`,
    );

    const settlementId = payload['settlementId']
      ? String(payload['settlementId'])
      : undefined;
    const supplierId = payload['supplierId']
      ? String(payload['supplierId'])
      : undefined;
    const ocId = payload['ocId'] ? String(payload['ocId']) : undefined;
    const amount = Number(payload['amount'] ?? 0);
    const taxAmount = Number(payload['taxAmount'] ?? 0);
    const amountWithoutTax = Number(payload['amountWithoutTax'] ?? 0);
    const currency = payload['currency'] ? String(payload['currency']) : 'CNY';
    const approvedBy = payload['approvedBy']
      ? String(payload['approvedBy'])
      : undefined;

    if (!settlementId || !supplierId) {
      this.logger.warn(
        '[SCM] OUTSOURCING_SETTLEMENT_APPROVED missing required fields',
      );
      return;
    }

    try {
      // 创建应付账款记录（直接写 scm_payable 表，SCM 内部逻辑）
      const result = await this.dataSource.query(
        `INSERT INTO scm_payable
           (tenant_id, source_type, source_id, supplier_id, oc_id,
            amount_with_tax, tax_amount, amount_without_tax, currency,
            status, created_by, created_at)
         VALUES (?, 'OUTSOURCING', ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, NOW())`,
        [
          tenantId,
          settlementId,
          supplierId,
          ocId ?? null,
          amount,
          taxAmount,
          amountWithoutTax,
          currency,
          approvedBy ?? 'system',
        ],
      );

      const payableId = String(result.insertId ?? result[0]?.insertId ?? '');
      this.logger.log(
        `[SCM] Payable created: payableId=${payableId} for settlementId=${settlementId}`,
      );

      // 发布 OUTSOURCING_PAYABLE_CREATED → Outsourcing 回填 scm_payable_id
      await this.messageSvc.publish({
        eventId: uuidv4(),
        eventType: EventTypes.OUTSOURCING_PAYABLE_CREATED,
        tenantId,
        sourceModule: 'SCM',
        targetModule: 'OUTSOURCING',
        payload: { settlementId, payableId },
        createdAt: new Date(),
      });
    } catch (err) {
      this.logger.error(
        `[SCM] Failed to create payable for outsourcing settlement: ${err}`,
      );
    }
  }
}
