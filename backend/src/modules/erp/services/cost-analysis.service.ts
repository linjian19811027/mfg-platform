import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ErpCostRecord, CostType } from '../entities/erp-cost-record.entity.js';
import {
  ErpStandardCost,
  StandardCostStatus,
} from '../entities/erp-standard-cost.entity.js';

export interface VarianceAnalysisItem {
  materialId: string;
  actualMaterial: number;
  standardMaterial: number;
  materialVariance: number;
  actualLabor: number;
  standardLabor: number;
  laborVariance: number;
  actualOverhead: number;
  standardOverhead: number;
  overheadVariance: number;
  totalVariance: number;
}

export interface ProductCostItem {
  materialId: string;
  materialCost: number;
  laborCost: number;
  overheadCost: number;
  totalCost: number;
  period: string;
}

export interface UnitCostItem {
  materialId: string;
  totalCost: number;
  qty: number;
  unitCost: number;
}

export interface CostBreakdownReport {
  materialTotal: number;
  laborTotal: number;
  overheadTotal: number;
  grandTotal: number;
  materialRate: number;
  laborRate: number;
  overheadRate: number;
}

@Injectable()
export class CostAnalysisService {
  constructor(
    @InjectRepository(ErpCostRecord)
    private readonly costRecordRepo: Repository<ErpCostRecord>,
    @InjectRepository(ErpStandardCost)
    private readonly standardCostRepo: Repository<ErpStandardCost>,
  ) {}

  /**
   * 成本差异分析（任务4.10）
   * 对比期间实际成本与标准成本，计算各类差异
   */
  async getVarianceAnalysis(
    tenantId: string,
    period: string,
    materialId?: string,
  ): Promise<VarianceAnalysisItem[]> {
    // 查询期间实际成本，按 materialId + costType 分组
    const qb = this.costRecordRepo
      .createQueryBuilder('cr')
      .where('cr.tenantId = :tenantId', { tenantId })
      .andWhere('cr.period = :period', { period })
      .select('cr.materialId', 'materialId')
      .addSelect('cr.costType', 'costType')
      .addSelect('SUM(cr.amount)', 'total')
      .groupBy('cr.materialId')
      .addGroupBy('cr.costType');

    if (materialId) {
      qb.andWhere('cr.materialId = :materialId', { materialId });
    }

    const rows = await qb.getRawMany<{
      materialId: string;
      costType: CostType;
      total: string;
    }>();

    // 按 materialId 聚合实际成本
    const actualMap = new Map<
      string,
      { material: number; labor: number; overhead: number }
    >();
    for (const row of rows) {
      if (!actualMap.has(row.materialId)) {
        actualMap.set(row.materialId, { material: 0, labor: 0, overhead: 0 });
      }
      const entry = actualMap.get(row.materialId)!;
      const amount = Number(row.total) || 0;
      if (row.costType === CostType.MATERIAL) entry.material = amount;
      else if (row.costType === CostType.LABOR) entry.labor = amount;
      else if (row.costType === CostType.OVERHEAD) entry.overhead = amount;
    }

    if (actualMap.size === 0) return [];

    // 查询对应物料的标准成本（status=ACTIVE）
    const materialIds = [...actualMap.keys()];
    const stdQb = this.standardCostRepo
      .createQueryBuilder('sc')
      .where('sc.tenantId = :tenantId', { tenantId })
      .andWhere('sc.status = :status', { status: StandardCostStatus.ACTIVE })
      .andWhere('sc.materialId IN (:...materialIds)', { materialIds });

    const stdRecords = await stdQb.getMany();
    const stdMap = new Map(stdRecords.map((s) => [s.materialId, s]));

    // 计算差异
    const result: VarianceAnalysisItem[] = [];
    for (const [matId, actual] of actualMap) {
      const std = stdMap.get(matId);
      const standardMaterial = std ? Number(std.materialCost) : 0;
      const standardLabor = std ? Number(std.laborCost) : 0;
      const standardOverhead = std ? Number(std.overheadCost) : 0;
      const standardTotal = standardMaterial + standardLabor + standardOverhead;

      const actualTotal = actual.material + actual.labor + actual.overhead;

      result.push({
        materialId: matId,
        actualMaterial: actual.material,
        standardMaterial,
        materialVariance: actual.material - standardMaterial,
        actualLabor: actual.labor,
        standardLabor,
        laborVariance: actual.labor - standardLabor,
        actualOverhead: actual.overhead,
        standardOverhead,
        overheadVariance: actual.overhead - standardOverhead,
        totalVariance: actualTotal - standardTotal,
      });
    }

    return result;
  }

  /**
   * 产品成本表（任务4.11）
   * 按 materialId 汇总期间实际成本
   */
  async getProductCostReport(
    tenantId: string,
    period: string,
  ): Promise<ProductCostItem[]> {
    const rows = await this.costRecordRepo
      .createQueryBuilder('cr')
      .where('cr.tenantId = :tenantId', { tenantId })
      .andWhere('cr.period = :period', { period })
      .select('cr.materialId', 'materialId')
      .addSelect('cr.costType', 'costType')
      .addSelect('SUM(cr.amount)', 'total')
      .groupBy('cr.materialId')
      .addGroupBy('cr.costType')
      .getRawMany<{ materialId: string; costType: CostType; total: string }>();

    const map = new Map<
      string,
      { material: number; labor: number; overhead: number }
    >();
    for (const row of rows) {
      if (!map.has(row.materialId)) {
        map.set(row.materialId, { material: 0, labor: 0, overhead: 0 });
      }
      const entry = map.get(row.materialId)!;
      const amount = Number(row.total) || 0;
      if (row.costType === CostType.MATERIAL) entry.material = amount;
      else if (row.costType === CostType.LABOR) entry.labor = amount;
      else if (row.costType === CostType.OVERHEAD) entry.overhead = amount;
    }

    return [...map.entries()].map(([matId, costs]) => ({
      materialId: matId,
      materialCost: costs.material,
      laborCost: costs.labor,
      overheadCost: costs.overhead,
      totalCost: costs.material + costs.labor + costs.overhead,
      period,
    }));
  }

  /**
   * 单位成本表（任务4.11）
   * 基于产品成本表，结合各物料产量计算单位成本
   */
  async getUnitCostReport(
    tenantId: string,
    period: string,
    quantities: Map<string, number>,
  ): Promise<UnitCostItem[]> {
    const productCosts = await this.getProductCostReport(tenantId, period);

    return productCosts.map((item) => {
      const qty = quantities.get(item.materialId) ?? 0;
      const unitCost = qty > 0 ? item.totalCost / qty : 0;
      return {
        materialId: item.materialId,
        totalCost: item.totalCost,
        qty,
        unitCost,
      };
    });
  }

  /**
   * 成本构成表（任务4.11）
   * 按 costType 汇总期间总成本，计算各类型占比
   */
  async getCostBreakdownReport(
    tenantId: string,
    period: string,
  ): Promise<CostBreakdownReport> {
    const rows = await this.costRecordRepo
      .createQueryBuilder('cr')
      .where('cr.tenantId = :tenantId', { tenantId })
      .andWhere('cr.period = :period', { period })
      .select('cr.costType', 'costType')
      .addSelect('SUM(cr.amount)', 'total')
      .groupBy('cr.costType')
      .getRawMany<{ costType: CostType; total: string }>();

    const typeMap = new Map(
      rows.map((r) => [r.costType, Number(r.total) || 0]),
    );

    const materialTotal = typeMap.get(CostType.MATERIAL) ?? 0;
    const laborTotal = typeMap.get(CostType.LABOR) ?? 0;
    const overheadTotal = typeMap.get(CostType.OVERHEAD) ?? 0;
    const grandTotal = materialTotal + laborTotal + overheadTotal;

    const materialRate = grandTotal > 0 ? materialTotal / grandTotal : 0;
    const laborRate = grandTotal > 0 ? laborTotal / grandTotal : 0;
    const overheadRate = grandTotal > 0 ? overheadTotal / grandTotal : 0;

    return {
      materialTotal,
      laborTotal,
      overheadTotal,
      grandTotal,
      materialRate,
      laborRate,
      overheadRate,
    };
  }
}
