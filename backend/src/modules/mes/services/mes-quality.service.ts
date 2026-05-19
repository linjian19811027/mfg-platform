import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { MesWorkOrderOperation } from '../entities/mes-work-order-operation.entity.js';
import { MesWorkOrder } from '../entities/mes-work-order.entity.js';
import { TenantContext } from '../../../shared/tenant/tenant.context.js';
import {
  MESSAGE_SERVICE,
  MessageService,
} from '../../../shared/message/message.interface.js';
import { EventTypes } from '../../event/event-types.constant.js';

export interface InspectionTrigger {
  wooId: string;
  inspectionType: 'FIRST' | 'PATROL' | 'FINAL';
  inspectorId?: string;
  sampleQty?: number;
}

@Injectable()
export class MesQualityService {
  constructor(
    @InjectRepository(MesWorkOrderOperation)
    private readonly wooRepo: Repository<MesWorkOrderOperation>,
    @InjectRepository(MesWorkOrder)
    private readonly woRepo: Repository<MesWorkOrder>,
    @Inject(MESSAGE_SERVICE)
    private readonly messageSvc: MessageService,
  ) {}

  // ── 2.19 首检触发 ─────────────────────────────────────────────────────────

  async triggerFirstInspection(
    wooId: string,
    inspectorId?: string,
  ): Promise<void> {
    const tenantId = TenantContext.requireCurrentTenant();
    const woo = await this.wooRepo.findOne({
      where: { id: wooId, tenantId } as any,
    });
    if (!woo) throw new NotFoundException('MES_WOO_NOT_FOUND');

    await this.messageSvc.publish({
      eventId: uuidv4(),
      eventType: EventTypes.INSPECTION_TRIGGERED,
      tenantId,
      sourceModule: 'MES',
      targetModule: 'QMS',
      payload: {
        inspectionType: 'FIRST',
        woId: woo.woId,
        wooId,
        operationId: woo.operationId,
        inspectorId,
        triggeredAt: new Date().toISOString(),
      },
      createdAt: new Date(),
    });
  }

  // ── 巡检触发 ──────────────────────────────────────────────────────────────

  async triggerPatrolInspection(
    wooId: string,
    sampleQty?: number,
    inspectorId?: string,
  ): Promise<void> {
    const tenantId = TenantContext.requireCurrentTenant();
    const woo = await this.wooRepo.findOne({
      where: { id: wooId, tenantId } as any,
    });
    if (!woo) throw new NotFoundException('MES_WOO_NOT_FOUND');

    await this.messageSvc.publish({
      eventId: uuidv4(),
      eventType: EventTypes.INSPECTION_TRIGGERED,
      tenantId,
      sourceModule: 'MES',
      targetModule: 'QMS',
      payload: {
        inspectionType: 'PATROL',
        woId: woo.woId,
        wooId,
        operationId: woo.operationId,
        sampleQty,
        inspectorId,
        triggeredAt: new Date().toISOString(),
      },
      createdAt: new Date(),
    });
  }

  // ── 末检触发 ──────────────────────────────────────────────────────────────

  async triggerFinalInspection(
    woId: string,
    inspectorId?: string,
  ): Promise<void> {
    const tenantId = TenantContext.requireCurrentTenant();
    const wo = await this.woRepo.findOne({ where: { id: woId, tenantId } });
    if (!wo) throw new NotFoundException('MES_WO_NOT_FOUND');

    await this.messageSvc.publish({
      eventId: uuidv4(),
      eventType: EventTypes.INSPECTION_TRIGGERED,
      tenantId,
      sourceModule: 'MES',
      targetModule: 'QMS',
      payload: {
        inspectionType: 'FINAL',
        woId,
        materialId: wo.materialId,
        plannedQty: wo.plannedQty,
        completedQty: wo.completedQty,
        inspectorId,
        triggeredAt: new Date().toISOString(),
      },
      createdAt: new Date(),
    });
  }

  // ── 2.20 不合格品处理 ─────────────────────────────────────────────────────

  async handleNonconformance(params: {
    woId: string;
    wooId?: string;
    materialId: string;
    batchId?: string;
    quantity: number;
    defectType: string;
    disposition: 'REWORK' | 'REPAIR' | 'SCRAP' | 'CONCESSION';
    reason?: string;
  }): Promise<{ ncId: string }> {
    const tenantId = TenantContext.requireCurrentTenant();

    // 通过事件发布不合格品信息，QMS 模块订阅后自行写入
    await this.messageSvc.publish({
      eventId: uuidv4(),
      eventType: 'MES_NONCONFORMANCE_CREATED',
      tenantId,
      sourceModule: 'MES',
      targetModule: 'QMS',
      payload: {
        woId: params.woId,
        wooId: params.wooId,
        materialId: params.materialId,
        batchId: params.batchId,
        quantity: params.quantity,
        defectType: params.defectType,
        disposition: params.disposition,
        reason: params.reason,
        ncNo: `NC-MES-${Date.now()}`,
      },
      createdAt: new Date(),
    });

    return { ncId: '0' };
  }

  // ── 2.21 质量追溯 ─────────────────────────────────────────────────────────

  async getTraceability(woId: string): Promise<Record<string, unknown>> {
    const tenantId = TenantContext.requireCurrentTenant();
    const wo = await this.woRepo.findOne({ where: { id: woId, tenantId } });
    if (!wo) throw new NotFoundException('MES_WO_NOT_FOUND');

    // 查领料记录（人/料）
    const materials = await this.woRepo.manager.query(
      `SELECT mi.material_id, mi.batch_id, mi.quantity, mi.issue_type, mi.issue_time, mi.operator_id
       FROM mes_material_issue mi WHERE mi.wo_id = ? AND mi.tenant_id = ?`,
      [woId, tenantId],
    );

    // 查工序记录（法/机）
    const operations = await this.woRepo.manager.query(
      `SELECT woo.sequence, woo.operation_name, woo.equipment_id, woo.actual_start, woo.actual_end, woo.status
       FROM mes_work_order_operation woo WHERE woo.wo_id = ? AND woo.tenant_id = ?
       ORDER BY woo.sequence`,
      [woId, tenantId],
    );

    // 查报工记录（人）
    const reports = await this.woRepo.manager.query(
      `SELECT pr.report_type, pr.completed_qty, pr.scrap_qty, pr.operator_id, pr.equipment_id, pr.report_time
       FROM mes_production_report pr WHERE pr.wo_id = ? AND pr.tenant_id = ?
       ORDER BY pr.report_time`,
      [woId, tenantId],
    );

    // 查检验记录（质）
    const inspections = await this.woRepo.manager
      .query(
        `SELECT ir.ir_no, ir.inspection_type, ir.result, ir.inspector_id, ir.inspection_time
       FROM qms_inspection_record ir WHERE ir.wo_id = ? AND ir.tenant_id = ?
       ORDER BY ir.inspection_time`,
        [woId, tenantId],
      )
      .catch(() => []);

    return {
      workOrder: wo,
      materials, // 料
      operations, // 法/机
      reports, // 人
      inspections, // 质
    };
  }
}
