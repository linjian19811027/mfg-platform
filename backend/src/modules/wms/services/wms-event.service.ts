import { Injectable, OnModuleInit, Inject, Logger } from '@nestjs/common';
import { ReceiptService } from './receipt.service.js';
import { IssueService } from './issue.service.js';
import { InventoryService } from './inventory.service.js';
import {
  MESSAGE_SERVICE,
  MessageService,
  DomainEvent,
} from '../../../shared/message/message.interface.js';
import { EventTypes } from '../../event/event-types.constant.js';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class WmsEventService implements OnModuleInit {
  private readonly logger = new Logger('WmsEventService');

  constructor(
    private readonly receiptSvc: ReceiptService,
    private readonly issueSvc: IssueService,
    private readonly inventorySvc: InventoryService,
    @Inject(MESSAGE_SERVICE)
    private readonly messageSvc: MessageService,
  ) {}

  onModuleInit() {
    // 3.18 接收 MATERIAL_ISSUE_REQUEST → 自动出库
    this.messageSvc.subscribe(EventTypes.MATERIAL_ISSUE_REQUEST, (e) =>
      this.onMaterialIssueRequest(e),
    );
    // 3.19 接收 PRODUCTION_COMPLETED → 自动生产入库
    this.messageSvc.subscribe(EventTypes.PRODUCTION_COMPLETED, (e) =>
      this.onProductionCompleted(e),
    );
    // 3.19 接收 INSPECTION_COMPLETED → 解冻质检冻结库存 / 外协暂存转正式库存
    this.messageSvc.subscribe(EventTypes.INSPECTION_COMPLETED, (e) =>
      this.onInspectionCompleted(e),
    );
    // 自动入库编排：接收 PRODUCTION_RECEIPT_REQUEST → 执行生产入库
    this.messageSvc.subscribe(EventTypes.PRODUCTION_RECEIPT_REQUEST, (e) =>
      this.onProductionReceiptRequest(e),
    );
    // 外协发料确认 → 执行出库
    this.messageSvc.subscribe(EventTypes.OUTSOURCING_ISSUE_CONFIRMED, (e) =>
      this.onOutsourcingIssueConfirmed(e),
    );
    // 外协收货确认 → 执行暂存入库
    this.messageSvc.subscribe(EventTypes.OUTSOURCING_RECEIPT_CONFIRMED, (e) =>
      this.onOutsourcingReceiptConfirmed(e),
    );
    // 追溯召回冻结请求 → 冻结在库批次
    this.messageSvc.subscribe(EventTypes.RECALL_FREEZE_REQUEST, (e) =>
      this.onRecallFreezeRequest(e),
    );
    this.logger.log('WMS event subscriptions registered');
  }

  // ── 3.18 领料请求 → 自动出库 ──────────────────────────────────────────────

  private async onMaterialIssueRequest(event: DomainEvent): Promise<void> {
    const { payload } = event;
    this.logger.log(`[WMS] MATERIAL_ISSUE_REQUEST: ${JSON.stringify(payload)}`);

    try {
      await this.issueSvc.issue({
        issueType: 'MES_ISSUE',
        materialId: String(payload['materialId'] ?? ''),
        batchId: payload['batchId'] ? String(payload['batchId']) : undefined,
        quantity: Number(payload['quantity'] ?? 0),
        uomId: String(payload['uomId'] ?? '1'),
        warehouseId: payload['warehouseId']
          ? String(payload['warehouseId'])
          : undefined,
        strategy: 'FIFO',
        sourceType: 'MES',
        sourceId: String(payload['woId'] ?? ''),
      });
    } catch (err) {
      this.logger.error(
        `[WMS] Failed to process MATERIAL_ISSUE_REQUEST: ${err}`,
      );
      throw err;
    }
  }

  // ── 3.19 生产完工 → 自动入库 ──────────────────────────────────────────────

  private async onProductionCompleted(event: DomainEvent): Promise<void> {
    const { payload } = event;
    this.logger.log(`[WMS] PRODUCTION_COMPLETED: ${JSON.stringify(payload)}`);

    if (!payload['outputBatchId'] || !payload['materialId']) return;

    try {
      await this.receiptSvc.receive({
        receiptType: 'PRODUCTION',
        materialId: String(payload['materialId']),
        batchId: String(payload['outputBatchId']),
        quantity: Number(payload['completedQty'] ?? 0),
        uomId: String(payload['uomId'] ?? '1'),
        sourceType: 'MES',
        sourceId: String(payload['woId'] ?? ''),
        qualityStatus: 'UNINSPECTED',
      });
    } catch (err) {
      this.logger.error(`[WMS] Failed to process PRODUCTION_COMPLETED: ${err}`);
      throw err;
    }
  }

  // ── 自动入库编排：PRODUCTION_RECEIPT_REQUEST → 执行生产入库 ──────────────

  private async onProductionReceiptRequest(event: DomainEvent): Promise<void> {
    const { payload } = event;
    this.logger.log(
      `[WMS] PRODUCTION_RECEIPT_REQUEST: ${JSON.stringify(payload)}`,
    );

    const materialId = payload['materialId']
      ? String(payload['materialId'])
      : undefined;
    const quantity = Number(payload['quantity'] ?? 0);
    const uomId = payload['uomId'] ? String(payload['uomId']) : '1';
    const warehouseId = payload['targetWarehouseId']
      ? String(payload['targetWarehouseId'])
      : undefined;
    const locationId = payload['targetLocationId']
      ? String(payload['targetLocationId'])
      : undefined;
    const woId = payload['woId'] ? String(payload['woId']) : undefined;
    const receiptLogId = payload['receiptLogId']
      ? String(payload['receiptLogId'])
      : undefined;

    if (!materialId || quantity <= 0) {
      this.logger.warn(
        '[WMS] PRODUCTION_RECEIPT_REQUEST missing required fields',
      );
      return;
    }

    try {
      const inv = await this.receiptSvc.receive({
        receiptType: 'PRODUCTION',
        materialId,
        quantity,
        uomId,
        warehouseId,
        locationId,
        sourceType: 'MES',
        sourceId: receiptLogId ?? woId,
        qualityStatus: 'QUALIFIED',
        receiptLogId,
        woId,
      });
      this.logger.log(
        `[WMS] Production receipt completed: invId=${inv.id}, woId=${woId}`,
      );
    } catch (err) {
      this.logger.error(
        `[WMS] Failed to process PRODUCTION_RECEIPT_REQUEST: ${err}`,
      );
    }
  }

  // ── 检验通过 → 解冻库存 / 外协暂存转正式库存 ────────────────────────────

  private async onInspectionCompleted(event: DomainEvent): Promise<void> {
    const { tenantId, payload } = event;
    if (payload['result'] !== 'PASSED') return;

    const inspectionType = payload['inspectionType']
      ? String(payload['inspectionType'])
      : undefined;
    const sourceType = payload['sourceType']
      ? String(payload['sourceType'])
      : undefined;

    // FQC 检验通过 → 执行生产入库
    if (inspectionType === 'FQC') {
      await this.onFqcPassed(event);
      return;
    }

    // 外协 IQC 通过 → 暂存转正式库存
    if (sourceType === 'OUTSOURCING') {
      await this.onOutsourcingIqcPassed(event);
      return;
    }

    // 其他检验通过 → 解冻库存
    const batchId = payload['batchId'] ? String(payload['batchId']) : undefined;
    const materialId = payload['materialId']
      ? String(payload['materialId'])
      : undefined;
    const locationId = payload['locationId']
      ? String(payload['locationId'])
      : undefined;
    const quantity = Number(payload['quantity'] ?? 0);
    const uomId = String(payload['uomId'] ?? '1');

    if (!materialId || !locationId || quantity <= 0) {
      this.logger.warn(
        `[WMS] INSPECTION_COMPLETED missing required fields: ${JSON.stringify(payload)}`,
      );
      return;
    }

    this.logger.log(
      `[WMS] INSPECTION_COMPLETED (PASSED): batchId=${batchId}, locationId=${locationId}, qty=${quantity}`,
    );

    try {
      await this.inventorySvc.unlockByTenant(tenantId, {
        materialId,
        batchId,
        locationId,
        quantity,
        uomId,
        qualityStatus: 'QUALIFIED',
        sourceType: 'QMS',
        sourceId: payload['irId'] ? String(payload['irId']) : undefined,
      });
    } catch (err) {
      this.logger.error(
        `[WMS] Failed to unlock inventory after inspection: ${err}`,
      );
      throw err;
    }
  }

  // ── FQC 检验通过 → 执行生产入库 ──────────────────────────────────────────

  private async onFqcPassed(event: DomainEvent): Promise<void> {
    const { payload } = event;
    this.logger.log(
      `[WMS] FQC PASSED → triggering production receipt: ${JSON.stringify(payload)}`,
    );

    const materialId = payload['materialId']
      ? String(payload['materialId'])
      : undefined;
    const woId = payload['woId'] ? String(payload['woId']) : undefined;
    const quantity = Number(payload['quantity'] ?? 0);
    const uomId = payload['uomId'] ? String(payload['uomId']) : '1';

    if (!materialId || !woId || quantity <= 0) {
      this.logger.warn(
        '[WMS] FQC PASSED event missing required fields for production receipt',
      );
      return;
    }

    try {
      await this.receiptSvc.receive({
        receiptType: 'PRODUCTION',
        materialId,
        quantity,
        uomId,
        sourceType: 'MES',
        sourceId: payload['receiptLogId']
          ? String(payload['receiptLogId'])
          : woId,
        qualityStatus: 'QUALIFIED',
        receiptLogId: payload['receiptLogId']
          ? String(payload['receiptLogId'])
          : undefined,
        woId,
      });
      this.logger.log(
        `[WMS] FQC production receipt completed for woId=${woId}`,
      );
    } catch (err) {
      this.logger.error(
        `[WMS] Failed to process FQC production receipt for woId=${woId}: ${err}`,
      );
    }
  }

  // ── 外协发料确认 → 执行出库 ───────────────────────────────────────────────

  private async onOutsourcingIssueConfirmed(event: DomainEvent): Promise<void> {
    const { payload } = event;
    this.logger.log(
      `[WMS] OUTSOURCING_ISSUE_CONFIRMED: issueId=${payload['issueId']}`,
    );

    const materialId = payload['materialId']
      ? String(payload['materialId'])
      : undefined;
    const qty = Number(payload['qty'] ?? 0);
    const warehouseId = payload['warehouseId']
      ? String(payload['warehouseId'])
      : undefined;
    const batchId = payload['batchId'] ? String(payload['batchId']) : undefined;
    const issueId = payload['issueId'] ? String(payload['issueId']) : undefined;

    if (!materialId || qty <= 0) {
      this.logger.warn(
        '[WMS] OUTSOURCING_ISSUE_CONFIRMED missing required fields',
      );
      return;
    }

    try {
      await this.issueSvc.issue({
        issueType: 'OTHER',
        materialId,
        batchId,
        quantity: qty,
        uomId: '1',
        warehouseId,
        strategy: 'FIFO',
        sourceType: 'OUTSOURCING',
        sourceId: issueId,
      });
      this.logger.log(
        `[WMS] Outsourcing issue completed for issueId=${issueId}`,
      );
    } catch (err) {
      this.logger.error(
        `[WMS] Failed to process OUTSOURCING_ISSUE_CONFIRMED: ${err}`,
      );
    }
  }

  // ── 外协收货确认 → 执行暂存入库 ──────────────────────────────────────────

  private async onOutsourcingReceiptConfirmed(
    event: DomainEvent,
  ): Promise<void> {
    const { payload } = event;
    this.logger.log(
      `[WMS] OUTSOURCING_RECEIPT_CONFIRMED: receiptId=${payload['receiptId']}`,
    );

    const materialId = payload['materialId']
      ? String(payload['materialId'])
      : undefined;
    const qty = Number(payload['qty'] ?? 0);
    const stagingLocationId = payload['stagingLocationId']
      ? String(payload['stagingLocationId'])
      : undefined;
    const receiptId = payload['receiptId']
      ? String(payload['receiptId'])
      : undefined;

    if (!materialId || qty <= 0) {
      this.logger.warn(
        '[WMS] OUTSOURCING_RECEIPT_CONFIRMED missing required fields',
      );
      return;
    }

    try {
      await this.receiptSvc.receive({
        receiptType: 'OTHER',
        materialId,
        locationId: stagingLocationId,
        quantity: qty,
        uomId: '1',
        sourceType: 'OUTSOURCING',
        sourceId: receiptId,
        qualityStatus: 'UNINSPECTED',
      });
      this.logger.log(
        `[WMS] Outsourcing staging receipt completed for receiptId=${receiptId}`,
      );
    } catch (err) {
      this.logger.error(
        `[WMS] Failed to process OUTSOURCING_RECEIPT_CONFIRMED: ${err}`,
      );
    }
  }

  // ── 召回冻结请求 → 冻结在库批次，发布 RECALL_FREEZE_COMPLETED ─────────────

  private async onRecallFreezeRequest(event: DomainEvent): Promise<void> {
    const { tenantId, payload } = event;
    const assessmentNo = payload['assessmentNo']
      ? String(payload['assessmentNo'])
      : '';
    const batchIds = (payload['batchIds'] ?? []) as string[];
    this.logger.log(
      `[WMS] RECALL_FREEZE_REQUEST: assessmentNo=${assessmentNo}, batchIds=${batchIds.length}`,
    );

    const frozenBatchIds: string[] = [];
    for (const batchId of batchIds) {
      try {
        // Use raw query to freeze by WMS batch ID (batchId here is wms_batch_id)
        await this.inventorySvc['dataSource']?.query(
          'UPDATE wms_inventory SET status = ?, freeze_reason = ? WHERE batch_id = ? AND tenant_id = ?',
          ['LOCKED', 'RECALL_HOLD', batchId, tenantId],
        );
        frozenBatchIds.push(batchId);
      } catch (err) {
        this.logger.warn(`[WMS] Failed to freeze batch ${batchId}: ${err}`);
      }
    }

    await this.messageSvc.publish({
      eventId: uuidv4(),
      eventType: EventTypes.RECALL_FREEZE_COMPLETED,
      tenantId,
      sourceModule: 'WMS',
      targetModule: 'TRACEABILITY',
      payload: { assessmentNo, frozenBatchIds },
      createdAt: new Date(),
    });
  }

  // ── 外协 IQC 通过 → 暂存转正式库存，发布 OUTSOURCING_RECEIPT_STOCKED ──────

  private async onOutsourcingIqcPassed(event: DomainEvent): Promise<void> {
    const { tenantId, payload } = event;
    const receiptId = payload['sourceId']
      ? String(payload['sourceId'])
      : undefined;
    const materialId = payload['materialId']
      ? String(payload['materialId'])
      : undefined;
    const batchId = payload['batchId'] ? String(payload['batchId']) : undefined;
    const qty = Number(payload['quantity'] ?? 0);
    const stagingLocationId = payload['stagingLocationId']
      ? String(payload['stagingLocationId'])
      : undefined;
    const targetLocationId = payload['targetLocationId']
      ? String(payload['targetLocationId'])
      : stagingLocationId;

    if (!receiptId || !materialId || qty <= 0) {
      this.logger.warn('[WMS] Outsourcing IQC PASSED missing required fields');
      return;
    }

    this.logger.log(
      `[WMS] Outsourcing IQC PASSED → transfer staging to formal: receiptId=${receiptId}`,
    );

    try {
      if (
        stagingLocationId &&
        targetLocationId &&
        stagingLocationId !== targetLocationId
      ) {
        await this.inventorySvc.transfer({
          materialId,
          batchId,
          fromLocationId: stagingLocationId,
          toLocationId: targetLocationId,
          quantity: qty,
          uomId: '1',
          remark: 'OUTSOURCING_IQC_PASSED',
        });
      } else if (stagingLocationId) {
        await this.inventorySvc.unlockByTenant(tenantId, {
          materialId,
          batchId,
          locationId: stagingLocationId,
          quantity: qty,
          uomId: '1',
          qualityStatus: 'QUALIFIED',
          sourceType: 'OUTSOURCING',
          sourceId: receiptId,
        });
      }

      await this.messageSvc.publish({
        eventId: uuidv4(),
        eventType: EventTypes.OUTSOURCING_RECEIPT_STOCKED,
        tenantId,
        sourceModule: 'WMS',
        targetModule: 'OUTSOURCING',
        payload: { receiptId, qty, materialId, batchId },
        createdAt: new Date(),
      });
    } catch (err) {
      this.logger.error(
        `[WMS] Failed to process outsourcing IQC passed: ${err}`,
      );
    }
  }
}
