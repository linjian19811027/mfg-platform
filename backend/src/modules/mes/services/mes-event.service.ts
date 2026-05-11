import { Injectable, OnModuleInit, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { MesWorkOrder } from '../entities/mes-work-order.entity.js';
import { MesWorkOrderOperation } from '../entities/mes-work-order-operation.entity.js';
import { WorkOrderService } from './work-order.service.js';
import { AutoReceiptOrchestratorService } from './auto-receipt-orchestrator.service.js';
import { CriticalPathService } from './critical-path.service.js';
import { MaterialReadinessService } from './material-readiness.service.js';
import {
  MESSAGE_SERVICE,
  MessageService,
  DomainEvent,
} from '../../../shared/message/message.interface.js';
import { EventTypes } from '../../event/event-types.constant.js';

@Injectable()
export class MesEventService implements OnModuleInit {
  private readonly logger = new Logger('MesEventService');

  constructor(
    @InjectRepository(MesWorkOrder)
    private readonly woRepo: Repository<MesWorkOrder>,
    @InjectRepository(MesWorkOrderOperation)
    private readonly wooRepo: Repository<MesWorkOrderOperation>,
    private readonly workOrderSvc: WorkOrderService,
    private readonly orchestratorSvc: AutoReceiptOrchestratorService,
    private readonly criticalPathSvc: CriticalPathService,
    private readonly readinessSvc: MaterialReadinessService,
    @Inject(MESSAGE_SERVICE)
    private readonly messageSvc: MessageService,
  ) {}

  onModuleInit() {
    // 2.17 订阅 WORK_ORDER_RELEASED 事件
    this.messageSvc.subscribe(EventTypes.WORK_ORDER_RELEASED, (event) =>
      this.onWorkOrderReleased(event),
    );
    // 自动入库编排事件
    this.messageSvc.subscribe(EventTypes.OPERATION_COMPLETED, (e) =>
      this.orchestratorSvc.onOperationCompleted(e),
    );
    this.messageSvc.subscribe(EventTypes.WORK_ORDER_ALL_COMPLETED, (e) =>
      this.onWorkOrderAllCompleted(e),
    );
    this.messageSvc.subscribe(EventTypes.STOCK_IN_COMPLETED, (e) =>
      this.orchestratorSvc.onStockInCompleted(e),
    );
    this.messageSvc.subscribe(EventTypes.INSPECTION_COMPLETED, (e) =>
      this.orchestratorSvc.onInspectionCompleted(e),
    );
    // 父子工单联动事件
    this.messageSvc.subscribe(EventTypes.CHILD_WO_COMPLETED, (e) =>
      this.onChildWoCompleted(e),
    );
    this.messageSvc.subscribe(EventTypes.WO_CANCELLED, (e) =>
      this.onWoCancelled(e),
    );
    // ECN 执行完成事件
    this.messageSvc.subscribe(EventTypes.ECN_EXECUTED, (e) =>
      this.onEcnExecuted(e),
    );
    this.logger.log('MES event subscriptions registered');
  }

  // ── 4.1 接收 WORK_ORDER_RELEASED，创建工单并建立父子关联 ─────────────────

  private async onWorkOrderReleased(event: DomainEvent): Promise<void> {
    const { tenantId, payload } = event;
    this.logger.log(
      `[MES] WORK_ORDER_RELEASED received: ${JSON.stringify(payload)}`,
    );

    try {
      // 检查是否已存在（幂等）
      const existing = await this.woRepo.findOne({
        where: {
          tenantId,
          sourceType: 'APS',
          sourceId: String(payload['woId'] ?? payload['sourceId'] ?? ''),
        },
      });
      if (existing) return;

      // ── 4.1.1 解析 BOM 层级信息 ──────────────────────────────────────────
      const apsParentWoId = payload['parentWoId']
        ? String(payload['parentWoId'])
        : null;
      const bomLevel = Number(payload['bomLevel'] ?? 0);
      const apsRootWoId = payload['rootWoId']
        ? String(payload['rootWoId'])
        : null;

      // ── 4.1.2 查找父工单（sourceType=APS, sourceId=apsParentWoId） ────────
      let parentWo: MesWorkOrder | null = null;
      if (apsParentWoId) {
        parentWo =
          (await this.woRepo.findOne({
            where: { tenantId, sourceType: 'APS', sourceId: apsParentWoId },
          })) ?? null;
      }

      // 查找根工单
      let rootWo: MesWorkOrder | null = null;
      if (apsRootWoId) {
        rootWo =
          (await this.woRepo.findOne({
            where: { tenantId, sourceType: 'APS', sourceId: apsRootWoId },
          })) ?? null;
      }

      // 创建工单
      const wo = await this.woRepo.save(
        this.woRepo.create({
          tenantId,
          woNo: String(payload['woNo'] ?? `WO-APS-${Date.now()}`),
          woType: 'STANDARD',
          sourceType: 'APS',
          sourceId: String(payload['woId'] ?? ''),
          materialId: String(payload['materialId'] ?? ''),
          bomId: payload['bomId'] ? String(payload['bomId']) : undefined,
          routingId: payload['routingId']
            ? String(payload['routingId'])
            : undefined,
          plannedQty: Number(payload['plannedQty'] ?? 0),
          uomId: String(payload['uomId'] ?? '1'),
          plannedStart: payload['plannedStart']
            ? new Date(String(payload['plannedStart']))
            : undefined,
          plannedEnd: payload['plannedEnd']
            ? new Date(String(payload['plannedEnd']))
            : undefined,
          status: 'RELEASED',
          priority: Number(payload['priority'] ?? 5),
          // ── 4.1.3 设置父子关联字段 ──────────────────────────────────────────
          parentWoId: parentWo?.id,
          rootWoId: rootWo?.id ?? undefined,
          bomLevel,
        }),
      );

      // 若是根工单（无父），rootWoId 指向自身
      if (!wo.rootWoId) {
        wo.rootWoId = wo.id;
        await this.woRepo.save(wo);
      }

      // 如果有工艺路线，自动创建工序列表
      if (wo.routingId) {
        const operations: {
          sequence: number;
          operation_id: string;
          operation_name: string;
          work_center_id?: string;
          planned_hours?: number;
        }[] = await this.woRepo.manager.query(
          `SELECT sequence, id as operation_id, operation_name, work_center_id, std_hours as planned_hours
             FROM plm_routing_operation
             WHERE routing_id = ? AND tenant_id = ?
             ORDER BY sequence ASC`,
          [wo.routingId, tenantId],
        );

        if (operations.length > 0) {
          const woos = operations.map((op) =>
            this.wooRepo.create({
              tenantId,
              woId: wo.id,
              sequence: op.sequence,
              operationId: op.operation_id,
              operationName: op.operation_name,
              workCenterId: op.work_center_id,
              plannedHours: op.planned_hours,
              plannedQty: wo.plannedQty,
              status: 'PENDING',
            }),
          );
          await this.wooRepo.save(woos);
        }
      }

      this.logger.log(
        `[MES] Work order created: ${wo.woNo} (${wo.id}), bomLevel=${bomLevel}, parent=${parentWo?.id ?? 'none'}`,
      );

      // ── 4.1.4 触发关键路径重算 ────────────────────────────────────────────
      const rootWoIdForCpm = wo.rootWoId ?? wo.id;
      this.criticalPathSvc
        .recalculate(tenantId, rootWoIdForCpm)
        .catch((err) => {
          this.logger.warn(`[MES] CPM recalculation failed: ${err}`);
        });
    } catch (err) {
      this.logger.error(`[MES] Failed to create work order from event: ${err}`);
      throw err;
    }
  }

  // ── 4.2 CHILD_WO_COMPLETED → MaterialReadinessService ────────────────────

  private async onChildWoCompleted(event: DomainEvent): Promise<void> {
    const { tenantId, payload } = event;
    const childWoId = String(payload['childWoId'] ?? '');
    const receiptQty = Number(payload['receiptQty'] ?? 0);

    if (!childWoId) return;

    try {
      await this.readinessSvc.onChildCompleted(tenantId, childWoId, receiptQty);
    } catch (err) {
      this.logger.error(`[MES] onChildWoCompleted failed: ${err}`);
    }
  }

  // ── 4.3 WO_CANCELLED → MaterialReadinessService ──────────────────────────

  private async onWoCancelled(event: DomainEvent): Promise<void> {
    const { tenantId, payload } = event;
    const woId = String(payload['woId'] ?? '');

    if (!woId) return;

    try {
      await this.readinessSvc.onChildCancelled(tenantId, woId);
    } catch (err) {
      this.logger.error(`[MES] onWoCancelled failed: ${err}`);
    }
  }

  // ── ECN_EXECUTED → 更新工单 BOM/Routing 或写入通知 ──────────────────────

  private async onEcnExecuted(event: DomainEvent): Promise<void> {
    const { tenantId, payload } = event;
    const affectedWos =
      (payload['affectedWos'] as Record<string, unknown>[]) ?? [];
    this.logger.log(
      `[MES] ECN_EXECUTED received, affected WOs: ${affectedWos.length}`,
    );

    for (const wo of affectedWos) {
      const woId = String(wo['woId'] ?? '');
      const suggestion = String(wo['suggestion'] ?? '');
      if (!woId) continue;

      try {
        if (suggestion === 'SWITCH_NEW') {
          // 更新工单的 BOM/Routing 到新版本（使用 raw query 避免类型冲突）
          const sets: string[] = [];
          const params: unknown[] = [];
          if (wo['newBomId']) {
            sets.push('bom_id = ?');
            params.push(String(wo['newBomId']));
          }
          if (wo['newRoutingId']) {
            sets.push('routing_id = ?');
            params.push(String(wo['newRoutingId']));
          }

          if (sets.length > 0) {
            params.push(woId, tenantId);
            await this.woRepo.manager.query(
              `UPDATE mes_work_order SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`,
              params,
            );
            this.logger.log(
              `[MES] Updated WO ${woId} BOM/Routing for ECN SWITCH_NEW`,
            );
          }
        } else if (suggestion === 'SUSPEND_REVIEW') {
          // 写入系统通知
          const workOrder = await this.woRepo.findOne({
            where: { id: woId, tenantId },
          });
          if (workOrder) {
            await this.woRepo.manager.query(
              `INSERT INTO sys_notification (tenant_id, type, title, content, ref_type, ref_id, created_at)
               VALUES (?, 'ECN_SUSPEND_REVIEW', 'ECN 变更工单待审核', ?, 'MES_WORK_ORDER', ?, NOW())`,
              [
                tenantId,
                `工单 ${workOrder.woNo} 因 ECN 变更需人工审核，请及时处理`,
                woId,
              ],
            );
            this.logger.log(
              `[MES] Created SUSPEND_REVIEW notification for WO ${workOrder.woNo}`,
            );
          }
        }
        // CONTINUE_OLD: 不做任何操作
      } catch (err) {
        this.logger.error(
          `[MES] Failed to process ECN_EXECUTED for WO ${woId}: ${err}`,
        );
      }
    }
  }

  // ── 4.4 工单完工时，若有父工单则发布 CHILD_WO_COMPLETED ──────────────────

  private async onWorkOrderAllCompleted(event: DomainEvent): Promise<void> {
    // 先交给自动入库编排处理
    await this.orchestratorSvc.onWorkOrderAllCompleted(event);

    const { tenantId, payload } = event;
    const woId = String(payload['woId'] ?? '');
    if (!woId) return;

    try {
      const wo = await this.woRepo.findOne({ where: { id: woId, tenantId } });
      if (wo?.parentWoId) {
        await this.messageSvc.publish({
          eventId: uuidv4(),
          eventType: EventTypes.CHILD_WO_COMPLETED,
          tenantId,
          sourceModule: 'MES',
          targetModule: 'MES',
          payload: {
            childWoId: wo.id,
            parentWoId: wo.parentWoId,
            materialId: wo.materialId,
            receiptQty: Number(wo.actualReceiptQty ?? wo.completedQty ?? 0),
          },
          createdAt: new Date(),
        });
        this.logger.log(
          `[MES] Published CHILD_WO_COMPLETED for WO ${woId} → parent ${wo.parentWoId}`,
        );
      }
    } catch (err) {
      this.logger.error(`[MES] Failed to publish CHILD_WO_COMPLETED: ${err}`);
    }
  }
}
