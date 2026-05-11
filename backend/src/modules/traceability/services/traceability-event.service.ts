import { Injectable, OnModuleInit, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TraceBatch } from '../entities/trace-batch.entity.js';
import { TraceLink } from '../entities/trace-link.entity.js';
import { TraceBatchService } from './trace-batch.service.js';
import { TraceLinkService } from './trace-link.service.js';
import {
  MESSAGE_SERVICE,
  MessageService,
  DomainEvent,
} from '../../../shared/message/message.interface.js';
import { EventTypes } from '../../event/event-types.constant.js';

@Injectable()
export class TraceabilityEventService implements OnModuleInit {
  private readonly logger = new Logger('TraceabilityEventService');

  constructor(
    @InjectRepository(TraceBatch)
    private readonly batchRepo: Repository<TraceBatch>,
    @InjectRepository(TraceLink)
    private readonly linkRepo: Repository<TraceLink>,
    private readonly batchSvc: TraceBatchService,
    private readonly linkSvc: TraceLinkService,
    @Inject(MESSAGE_SERVICE)
    private readonly messageSvc: MessageService,
  ) {}

  onModuleInit() {
    this.messageSvc.subscribe(EventTypes.PRODUCTION_COMPLETED, (e) =>
      this.onProductionCompleted(e),
    );
    this.messageSvc.subscribe(EventTypes.MATERIAL_ISSUED, (e) =>
      this.onMaterialIssued(e),
    );
    this.messageSvc.subscribe(EventTypes.STOCK_IN_COMPLETED, (e) =>
      this.onStockInCompleted(e),
    );
    this.messageSvc.subscribe(EventTypes.RECEIPT_CONFIRMED, (e) =>
      this.onReceiptConfirmed(e),
    );
    this.messageSvc.subscribe(EventTypes.INSPECTION_COMPLETED, (e) =>
      this.onInspectionCompleted(e),
    );
    this.messageSvc.subscribe(EventTypes.SALES_ORDER_CONFIRMED, (e) =>
      this.onSalesOrderConfirmed(e),
    );
    this.messageSvc.subscribe(EventTypes.RECALL_FREEZE_COMPLETED, (e) =>
      this.onRecallFreezeCompleted(e),
    );
    this.logger.log('Traceability event subscriptions registered');
  }

  // PRODUCTION_COMPLETED → 创建成品 TraceBatch + TraceLink
  private async onProductionCompleted(event: DomainEvent): Promise<void> {
    const { tenantId, payload } = event;
    try {
      const woId = payload['woId'] ? String(payload['woId']) : undefined;
      const materialId = payload['materialId']
        ? String(payload['materialId'])
        : undefined;
      const completedQty = Number(payload['completedQty'] ?? 0);
      const outputBatchId = payload['outputBatchId']
        ? String(payload['outputBatchId'])
        : undefined;
      const inputBatches = (payload['inputBatches'] ?? []) as Array<{
        batchId: string;
        materialId: string;
        qty: number;
      }>;

      if (!materialId || !outputBatchId) return;

      // Ensure output TraceBatch exists
      let outputBatch = await this.batchRepo.findOne({
        where: { tenantId, wmsBatchId: outputBatchId },
      });
      if (!outputBatch) {
        const traceCode = await this.batchSvc.generateTraceCode(
          tenantId,
          materialId,
        );
        const { barcodePath, qrcodePath } =
          await this.batchSvc.generateBarcodeImages(traceCode, tenantId);
        outputBatch = await this.batchRepo.save(
          this.batchRepo.create({
            tenantId,
            traceCode,
            materialId,
            materialCode: materialId,
            materialName: materialId,
            batchNo: outputBatchId,
            actualQty: completedQty,
            mesWoId: woId,
            wmsBatchId: outputBatchId,
            productionEnd: new Date(),
            barcodePath,
            qrcodePath,
          }),
        );
      }

      if (outputBatch === null || outputBatch === undefined) return;
      // Create TraceLinks for each input batch
      for (const input of inputBatches) {
        let inputBatch = await this.batchRepo.findOne({
          where: { tenantId, wmsBatchId: String(input.batchId) },
        });
        if (!inputBatch) {
          const traceCode = await this.batchSvc.generateTraceCode(
            tenantId,
            String(input.materialId),
          );
          inputBatch = await this.batchRepo.save(
            this.batchRepo.create({
              tenantId,
              traceCode,
              materialId: String(input.materialId),
              materialCode: String(input.materialId),
              materialName: String(input.materialId),
              batchNo: String(input.batchId),
              actualQty: input.qty,
              wmsBatchId: String(input.batchId),
            }),
          );
        }

        await this.linkSvc.createLink(tenantId, {
          inputBatchId: inputBatch.id,
          outputBatchId: outputBatch.id,
          linkType: 'PRODUCTION',
          inputQty: input.qty,
          mesWoId: woId,
          linkedAt: new Date(),
        });
      }
    } catch (err) {
      this.logger.error(`[Traceability] PRODUCTION_COMPLETED error: ${err}`);
    }
  }

  // MATERIAL_ISSUED → 确认/创建原材料 TraceBatch
  private async onMaterialIssued(event: DomainEvent): Promise<void> {
    const { tenantId, payload } = event;
    try {
      const materialId = payload['materialId']
        ? String(payload['materialId'])
        : undefined;
      const batchId = payload['batchId']
        ? String(payload['batchId'])
        : undefined;
      const quantity = Number(payload['quantity'] ?? 0);

      if (!materialId || !batchId) return;

      const existing = await this.batchRepo.findOne({
        where: { tenantId, wmsBatchId: batchId },
      });
      if (!existing) {
        const traceCode = await this.batchSvc.generateTraceCode(
          tenantId,
          materialId,
        );
        await this.batchRepo.save(
          this.batchRepo.create({
            tenantId,
            traceCode,
            materialId,
            materialCode: materialId,
            materialName: materialId,
            batchNo: batchId,
            actualQty: quantity,
            wmsBatchId: batchId,
            inventoryStatus: 'CONSUMED',
          }),
        );
      } else {
        await this.batchRepo.update(existing.id, {
          inventoryStatus: 'CONSUMED',
        });
      }
    } catch (err) {
      this.logger.error(`[Traceability] MATERIAL_ISSUED error: ${err}`);
    }
  }

  // STOCK_IN_COMPLETED → 更新 TraceBatch.inventoryStatus = IN_STOCK
  private async onStockInCompleted(event: DomainEvent): Promise<void> {
    const { tenantId, payload } = event;
    try {
      const batchId = payload['batchId']
        ? String(payload['batchId'])
        : undefined;
      if (!batchId) return;

      const batch = await this.batchRepo.findOne({
        where: { tenantId, wmsBatchId: batchId },
      });
      if (batch) {
        await this.batchRepo.update(batch.id, { inventoryStatus: 'IN_STOCK' });
      }
    } catch (err) {
      this.logger.error(`[Traceability] STOCK_IN_COMPLETED error: ${err}`);
    }
  }

  // RECEIPT_CONFIRMED → 创建采购原材料 TraceBatch
  private async onReceiptConfirmed(event: DomainEvent): Promise<void> {
    const { tenantId, payload } = event;
    try {
      const poId = payload['poId'] ? String(payload['poId']) : undefined;
      const items = (payload['items'] ?? []) as Array<{
        materialId: string;
        batchId: string;
        receivedQty: number;
      }>;

      for (const item of items) {
        const existing = await this.batchRepo.findOne({
          where: { tenantId, wmsBatchId: String(item.batchId) },
        });
        if (!existing) {
          const traceCode = await this.batchSvc.generateTraceCode(
            tenantId,
            String(item.materialId),
          );
          await this.batchRepo.save(
            this.batchRepo.create({
              tenantId,
              traceCode,
              materialId: String(item.materialId),
              materialCode: String(item.materialId),
              materialName: String(item.materialId),
              batchNo: String(item.batchId),
              actualQty: item.receivedQty,
              wmsBatchId: String(item.batchId),
              scmPoId: poId,
              inspectionStatus: 'PENDING',
              inventoryStatus: 'IN_STOCK',
            }),
          );
        }
      }
    } catch (err) {
      this.logger.error(`[Traceability] RECEIPT_CONFIRMED error: ${err}`);
    }
  }

  // INSPECTION_COMPLETED → 更新 TraceBatch.inspectionStatus
  private async onInspectionCompleted(event: DomainEvent): Promise<void> {
    const { tenantId, payload } = event;
    try {
      const batchId = payload['batchId']
        ? String(payload['batchId'])
        : undefined;
      const result = payload['result'] ? String(payload['result']) : undefined;
      if (!batchId || !result) return;

      const statusMap: Record<string, string> = {
        PASSED: 'PASSED',
        FAILED: 'FAILED',
        CONCESSION: 'CONCESSION',
      };
      const inspectionStatus = statusMap[result] ?? 'PENDING';

      const batch = await this.batchRepo.findOne({
        where: { tenantId, wmsBatchId: batchId },
      });
      if (batch) {
        await this.batchRepo.update(batch.id, { inspectionStatus });
      }
    } catch (err) {
      this.logger.error(`[Traceability] INSPECTION_COMPLETED error: ${err}`);
    }
  }

  // SALES_ORDER_CONFIRMED → 预关联销售订单
  private async onSalesOrderConfirmed(event: DomainEvent): Promise<void> {
    const { tenantId, payload } = event;
    try {
      const soId = payload['soId'] ? String(payload['soId']) : undefined;
      const batchId = payload['batchId']
        ? String(payload['batchId'])
        : undefined;
      if (!soId || !batchId) return;

      const batch = await this.batchRepo.findOne({
        where: { tenantId, wmsBatchId: batchId },
      });
      if (batch) {
        await this.batchRepo.update(batch.id, { erpSoId: soId });
      }
    } catch (err) {
      this.logger.error(`[Traceability] SALES_ORDER_CONFIRMED error: ${err}`);
    }
  }

  // RECALL_FREEZE_COMPLETED → 更新 TraceBatch.isFrozen = 1
  private async onRecallFreezeCompleted(event: DomainEvent): Promise<void> {
    const { tenantId, payload } = event;
    try {
      const assessmentNo = payload['assessmentNo']
        ? String(payload['assessmentNo'])
        : undefined;
      const frozenBatchIds = (payload['frozenBatchIds'] ?? []) as string[];

      for (const batchId of frozenBatchIds) {
        const batch = await this.batchRepo.findOne({
          where: { tenantId, wmsBatchId: batchId },
        });
        if (batch) {
          await this.batchRepo.update(batch.id, {
            isFrozen: 1,
            freezeReason: assessmentNo ?? 'RECALL_HOLD',
            inventoryStatus: 'FROZEN',
          });
        }
      }
    } catch (err) {
      this.logger.error(`[Traceability] RECALL_FREEZE_COMPLETED error: ${err}`);
    }
  }
}
