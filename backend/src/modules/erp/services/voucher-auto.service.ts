import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import {
  MESSAGE_SERVICE,
  MessageService,
} from '../../../shared/message/message.interface.js';
import { VoucherService } from './voucher.service.js';
import { AccountService } from './account.service.js';
import { VoucherType } from '../entities/erp-voucher.entity.js';

@Injectable()
export class VoucherAutoService implements OnModuleInit {
  private readonly logger = new Logger(VoucherAutoService.name);

  constructor(
    private readonly voucherService: VoucherService,
    private readonly accountService: AccountService,
    @Inject(MESSAGE_SERVICE) private readonly messageService: MessageService,
  ) {}

  onModuleInit() {
    this.messageService.subscribe('PRODUCTION_COMPLETED', (event) =>
      this.handleProductionCompleted(event),
    );
    this.messageService.subscribe('SALES_ORDER_SHIPPED', (event) =>
      this.handleSalesOrderShipped(event),
    );
    this.messageService.subscribe('RECEIPT_CONFIRMED', (event) =>
      this.handleReceiptConfirmed(event),
    );
    this.logger.log(
      'VoucherAutoService 已订阅事件：PRODUCTION_COMPLETED, SALES_ORDER_SHIPPED, RECEIPT_CONFIRMED',
    );
  }

  // ── 辅助：按编码查科目 ID，不存在时返回 '0' ────────────────────────────

  private async resolveAccountId(
    tenantId: string,
    code: string,
  ): Promise<string> {
    try {
      const account = await this.accountService.getByCode(tenantId, code);
      return String(account.id);
    } catch {
      this.logger.warn(
        `科目编码 ${code} 不存在（tenantId=${tenantId}），使用占位 ID '0'`,
      );
      return '0';
    }
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  // ── 1. 完工入库凭证 ───────────────────────────────────────────────────────

  private async handleProductionCompleted(event: {
    payload: Record<string, unknown>;
    tenantId: string;
  }): Promise<void> {
    const { tenantId, payload } = event;
    const {
      ciId,
      businessNo,
      totalCost = 0,
      materialCost = 0,
      laborCost = 0,
      overheadCost = 0,
    } = payload as {
      ciId: string;
      businessNo: string;
      materialId?: string;
      totalCost?: number;
      materialCost?: number;
      laborCost?: number;
      overheadCost?: number;
    };

    try {
      const [acc1405, acc5001, acc5002, acc5003] = await Promise.all([
        this.resolveAccountId(tenantId, '1405'),
        this.resolveAccountId(tenantId, '5001'),
        this.resolveAccountId(tenantId, '5002'),
        this.resolveAccountId(tenantId, '5003'),
      ]);

      const voucher = await this.voucherService.createAuto(
        tenantId,
        {
          voucherDate: this.today(),
          voucherType: VoucherType.MEMO,
          sourceType: 'CONVERSION_INSTANCE',
          sourceId: String(ciId),
        },
        [
          {
            accountId: acc1405,
            debitAmount: Number(totalCost),
            summary: `完工入库-${businessNo}`,
          },
          {
            accountId: acc5001,
            creditAmount: Number(materialCost),
            summary: '直接材料',
          },
          {
            accountId: acc5002,
            creditAmount: Number(laborCost),
            summary: '直接人工',
          },
          {
            accountId: acc5003,
            creditAmount: Number(overheadCost),
            summary: '制造费用',
          },
        ],
      );

      this.logger.log(
        `完工入库凭证已生成：${voucher.voucherNo}（ciId=${ciId}）`,
      );
    } catch (err) {
      this.logger.error(
        `完工入库凭证生成失败（ciId=${ciId}）：${(err as Error).message}`,
      );
    }
  }

  // ── 2. 销售出库凭证 ───────────────────────────────────────────────────────

  private async handleSalesOrderShipped(event: {
    payload: Record<string, unknown>;
    tenantId: string;
  }): Promise<void> {
    const { tenantId, payload } = event;
    const {
      shipmentId,
      shipmentNo,
      soId,
      items = [],
      totalCost,
    } = payload as {
      shipmentId: string;
      shipmentNo: string;
      soId?: string;
      customerId?: string;
      items?: Array<{ quantity?: number; unitPrice?: number }>;
      totalCost?: number;
    };

    try {
      // 优先使用 payload.totalCost，否则从 items 计算
      const cost =
        totalCost != null
          ? Number(totalCost)
          : (items as Array<{ quantity?: number; unitPrice?: number }>).reduce(
              (sum, item) =>
                sum +
                (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
              0,
            );

      const [acc5101, acc1405] = await Promise.all([
        this.resolveAccountId(tenantId, '5101'),
        this.resolveAccountId(tenantId, '1405'),
      ]);

      const voucher = await this.voucherService.createAuto(
        tenantId,
        {
          voucherDate: this.today(),
          voucherType: VoucherType.MEMO,
          sourceType: 'SHIPMENT',
          sourceId: String(shipmentId),
        },
        [
          {
            accountId: acc5101,
            debitAmount: cost,
            summary: `销售出库-${shipmentNo}`,
          },
          {
            accountId: acc1405,
            creditAmount: cost,
            summary: `销售出库-${shipmentNo}`,
          },
        ],
      );

      this.logger.log(
        `销售出库凭证已生成：${voucher.voucherNo}（shipmentId=${shipmentId}, soId=${soId}）`,
      );
    } catch (err) {
      this.logger.error(
        `销售出库凭证生成失败（shipmentId=${shipmentId}）：${(err as Error).message}`,
      );
    }
  }

  // ── 3. 采购入库凭证 ───────────────────────────────────────────────────────

  private async handleReceiptConfirmed(event: {
    payload: Record<string, unknown>;
    tenantId: string;
  }): Promise<void> {
    const { tenantId, payload } = event;
    const {
      receiptId,
      receiptNo,
      poId,
      items = [],
    } = payload as {
      receiptId: string;
      receiptNo: string;
      poId?: string;
      supplierId?: string;
      items?: Array<{ receivedQty?: number; unitPrice?: number }>;
    };

    try {
      const totalAmount = (
        items as Array<{ receivedQty?: number; unitPrice?: number }>
      ).reduce(
        (sum, item) =>
          sum + (Number(item.receivedQty) || 0) * (Number(item.unitPrice) || 0),
        0,
      );

      const [acc1403, acc2202] = await Promise.all([
        this.resolveAccountId(tenantId, '1403'),
        this.resolveAccountId(tenantId, '2202'),
      ]);

      const voucher = await this.voucherService.createAuto(
        tenantId,
        {
          voucherDate: this.today(),
          voucherType: VoucherType.MEMO,
          sourceType: 'RECEIPT',
          sourceId: String(receiptId),
        },
        [
          {
            accountId: acc1403,
            debitAmount: totalAmount,
            summary: `采购入库-${receiptNo}`,
          },
          {
            accountId: acc2202,
            creditAmount: totalAmount,
            summary: `采购入库-${receiptNo}`,
          },
        ],
      );

      this.logger.log(
        `采购入库凭证已生成：${voucher.voucherNo}（receiptId=${receiptId}, poId=${poId}）`,
      );
    } catch (err) {
      this.logger.error(
        `采购入库凭证生成失败（receiptId=${receiptId}）：${(err as Error).message}`,
      );
    }
  }
}
