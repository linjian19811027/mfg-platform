import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MesWorkOrder } from '../entities/mes-work-order.entity.js';
import { MesMaterialIssue } from '../entities/mes-material-issue.entity.js';
import { TenantContext } from '../../../shared/tenant/tenant.context.js';

export interface KitShortage {
  materialId: string;
  required: number;
  available: number;
  shortage: number;
  uomId: string;
}

export interface KitCheckResult {
  woId: string;
  kitRate: number; // 0-1
  isComplete: boolean;
  shortages: KitShortage[];
}

export interface IssueRequest {
  materialId: string;
  batchId?: string;
  quantity: number;
  uomId: string;
  wooId?: string;
  fromLocationId?: string;
  operatorId?: string;
}

@Injectable()
export class MaterialKitService {
  constructor(
    @InjectRepository(MesWorkOrder)
    private readonly woRepo: Repository<MesWorkOrder>,
    @InjectRepository(MesMaterialIssue)
    private readonly issueRepo: Repository<MesMaterialIssue>,
  ) {}

  // ── 2.6 齐套检查 ──────────────────────────────────────────────────────────

  async checkKit(woId: string): Promise<KitCheckResult> {
    const tenantId = TenantContext.requireCurrentTenant();
    const wo = await this.woRepo.findOne({ where: { id: woId, tenantId } });
    if (!wo) throw new NotFoundException('MES_WO_NOT_FOUND');
    if (!wo.bomId) return { woId, kitRate: 1, isComplete: true, shortages: [] };

    // 查 BOM 需求（跨模块查询，降级处理）
    const bomLines: {
      material_id: string;
      quantity: number;
      loss_rate: number;
      uom_id: string;
    }[] = await this.woRepo.manager.query(
      `SELECT bl.material_id, bl.quantity, bl.loss_rate, bl.uom_id
         FROM plm_bom_line bl
         WHERE bl.bom_id = ? AND bl.tenant_id = ?`,
      [wo.bomId, tenantId],
    ).catch(() => []);

    if (bomLines.length === 0)
      return { woId, kitRate: 1, isComplete: true, shortages: [] };

    // 查 WMS 可用库存（跨模块查询，降级处理）
    const matIds = bomLines.map((l) => l.material_id);
    const inventory: { material_id: string; available_qty: number }[] =
      await this.woRepo.manager.query(
        `SELECT material_id, SUM(available_qty) as available_qty
         FROM wms_inventory
         WHERE tenant_id = ? AND material_id IN (?) AND status = 'AVAILABLE'
         GROUP BY material_id`,
        [tenantId, matIds],
      ).catch(() => []);
    const invMap = new Map(
      inventory.map((i) => [i.material_id, Number(i.available_qty)]),
    );

    const shortages: KitShortage[] = [];
    for (const line of bomLines) {
      const required =
        Number(line.quantity) *
        Number(wo.plannedQty) *
        (1 + Number(line.loss_rate));
      const available = invMap.get(line.material_id) ?? 0;
      if (available < required) {
        shortages.push({
          materialId: line.material_id,
          required,
          available,
          shortage: required - available,
          uomId: line.uom_id,
        });
      }
    }

    const kitRate =
      shortages.length === 0 ? 1 : 1 - shortages.length / bomLines.length;

    return { woId, kitRate, isComplete: shortages.length === 0, shortages };
  }

  // ── 2.7 领料 ──────────────────────────────────────────────────────────────

  async issue(
    woId: string,
    items: IssueRequest[],
    operatorId?: string,
  ): Promise<MesMaterialIssue[]> {
    const tenantId = TenantContext.requireCurrentTenant();
    const wo = await this.woRepo.findOne({ where: { id: woId, tenantId } });
    if (!wo) throw new NotFoundException('MES_WO_NOT_FOUND');
    if (!['RELEASED', 'IN_PROGRESS'].includes(wo.status)) {
      throw new BadRequestException('MES_WO_ISSUE_INVALID_STATUS');
    }

    const records: MesMaterialIssue[] = [];
    for (const item of items) {
      const record = await this.issueRepo.save(
        this.issueRepo.create({
          tenantId,
          woId,
          wooId: item.wooId,
          materialId: item.materialId,
          batchId: item.batchId,
          quantity: item.quantity,
          uomId: item.uomId,
          issueType: 'ISSUE',
          operatorId: operatorId ?? item.operatorId,
          fromLocationId: item.fromLocationId,
        }),
      );
      records.push(record);
    }

    return records;
  }

  // ── 2.8 退料 ──────────────────────────────────────────────────────────────

  async return(
    woId: string,
    items: IssueRequest[],
    operatorId?: string,
  ): Promise<MesMaterialIssue[]> {
    const tenantId = TenantContext.requireCurrentTenant();
    const wo = await this.woRepo.findOne({ where: { id: woId, tenantId } });
    if (!wo) throw new NotFoundException('MES_WO_NOT_FOUND');

    const records: MesMaterialIssue[] = [];
    for (const item of items) {
      if (item.quantity <= 0)
        throw new BadRequestException('MES_RETURN_QTY_POSITIVE');

      const record = await this.issueRepo.save(
        this.issueRepo.create({
          tenantId,
          woId,
          wooId: item.wooId,
          materialId: item.materialId,
          batchId: item.batchId,
          quantity: item.quantity,
          uomId: item.uomId,
          issueType: 'RETURN',
          operatorId: operatorId ?? item.operatorId,
          fromLocationId: item.fromLocationId,
        }),
      );
      records.push(record);
    }

    return records;
  }

  // ── 2.9 补料 ──────────────────────────────────────────────────────────────

  async supplement(
    woId: string,
    items: (IssueRequest & { reason: 'OVER_CONSUMPTION' | 'SCRAP' })[],
    operatorId?: string,
  ): Promise<MesMaterialIssue[]> {
    const tenantId = TenantContext.requireCurrentTenant();
    const wo = await this.woRepo.findOne({ where: { id: woId, tenantId } });
    if (!wo) throw new NotFoundException('MES_WO_NOT_FOUND');
    if (wo.status !== 'IN_PROGRESS') {
      throw new BadRequestException('MES_WO_SUPPLEMENT_ONLY_IN_PROGRESS');
    }

    const records: MesMaterialIssue[] = [];
    for (const item of items) {
      const record = await this.issueRepo.save(
        this.issueRepo.create({
          tenantId,
          woId,
          wooId: item.wooId,
          materialId: item.materialId,
          batchId: item.batchId,
          quantity: item.quantity,
          uomId: item.uomId,
          issueType: 'SUPPLEMENT',
          issueReason: item.reason,
          operatorId: operatorId ?? item.operatorId,
          fromLocationId: item.fromLocationId,
        }),
      );
      records.push(record);
    }

    return records;
  }

  // ── 查询领料记录 ──────────────────────────────────────────────────────────

  async findIssues(
    woId: string,
    issueType?: string,
  ): Promise<MesMaterialIssue[]> {
    const tenantId = TenantContext.requireCurrentTenant();
    const where: any = { tenantId, woId };
    if (issueType) where.issueType = issueType;
    return this.issueRepo.find({ where, order: { issueTime: 'DESC' } });
  }
}
