import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ErpSalesOrder } from '../entities/erp-sales-order.entity.js';
import { ErpSalesOrderLine } from '../entities/erp-sales-order-line.entity.js';
import { ErpCustomer } from '../entities/erp-customer.entity.js';

// ── DTOs ──────────────────────────────────────────────────────────────────────

export interface SalesTrendQuery {
  startDate?: Date;
  endDate?: Date;
  groupBy: 'month' | 'quarter' | 'year';
}

export interface SalesTrendItem {
  period: string;
  totalAmount: number;
  orderCount: number;
}

export interface CustomerAnalysisQuery {
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

export interface CustomerAnalysisItem {
  customerId: string;
  customerName: string;
  totalAmount: number;
  orderCount: number;
}

export interface ProductAnalysisQuery {
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

export interface ProductAnalysisItem {
  materialId: string;
  totalAmount: number;
  totalQty: number;
  orderCount: number;
}

export interface RegionAnalysisItem {
  region: string;
  totalAmount: number;
  customerCount: number;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class ErpAnalyticsService {
  constructor(
    @InjectRepository(ErpSalesOrder)
    private readonly soRepo: Repository<ErpSalesOrder>,
    @InjectRepository(ErpSalesOrderLine)
    private readonly lineRepo: Repository<ErpSalesOrderLine>,
    @InjectRepository(ErpCustomer)
    private readonly customerRepo: Repository<ErpCustomer>,
  ) {}

  // ── 1. 销售趋势分析 ────────────────────────────────────────────────────────

  async getSalesTrend(
    tenantId: string,
    query: SalesTrendQuery,
  ): Promise<SalesTrendItem[]> {
    const { startDate, endDate, groupBy } = query;

    const formatMap: Record<string, string> = {
      month: '%Y-%m',
      quarter: '%Y-Q',
      year: '%Y',
    };

    // MySQL DATE_FORMAT 格式
    const dateFormat = formatMap[groupBy] ?? '%Y-%m';

    const qb = this.soRepo
      .createQueryBuilder('so')
      .select(
        groupBy === 'quarter'
          ? `CONCAT(DATE_FORMAT(so.order_date, '%Y-Q'), QUARTER(so.order_date))`
          : `DATE_FORMAT(so.order_date, '${dateFormat}')`,
        'period',
      )
      .addSelect('SUM(so.total_amount)', 'totalAmount')
      .addSelect('COUNT(so.id)', 'orderCount')
      .where('so.tenant_id = :tenantId', { tenantId });

    if (startDate) {
      qb.andWhere('so.order_date >= :startDate', { startDate });
    }
    if (endDate) {
      qb.andWhere('so.order_date <= :endDate', { endDate });
    }

    qb.groupBy('period').orderBy('period', 'ASC');

    const rows = await qb.getRawMany<{
      period: string;
      totalAmount: string;
      orderCount: string;
    }>();

    return rows.map((r) => ({
      period: r.period,
      totalAmount: Number(r.totalAmount),
      orderCount: Number(r.orderCount),
    }));
  }

  // ── 2. 客户分析 ────────────────────────────────────────────────────────────

  async getCustomerAnalysis(
    tenantId: string,
    query: CustomerAnalysisQuery,
  ): Promise<CustomerAnalysisItem[]> {
    const { startDate, endDate, limit = 20 } = query;

    const qb = this.soRepo
      .createQueryBuilder('so')
      .select('so.customer_id', 'customerId')
      .addSelect('SUM(so.total_amount)', 'totalAmount')
      .addSelect('COUNT(so.id)', 'orderCount')
      .where('so.tenant_id = :tenantId', { tenantId });

    if (startDate) {
      qb.andWhere('so.order_date >= :startDate', { startDate });
    }
    if (endDate) {
      qb.andWhere('so.order_date <= :endDate', { endDate });
    }

    qb.groupBy('so.customer_id').orderBy('totalAmount', 'DESC').limit(limit);

    const rows = await qb.getRawMany<{
      customerId: string;
      totalAmount: string;
      orderCount: string;
    }>();

    if (rows.length === 0) return [];

    // 批量查询客户名称
    const customerIds = rows.map((r) => r.customerId);
    const customers = await this.customerRepo
      .createQueryBuilder('c')
      .select(['c.id', 'c.name'])
      .where('c.tenantId = :tenantId', { tenantId })
      .andWhere('c.id IN (:...ids)', { ids: customerIds })
      .getMany();

    const nameMap = new Map(customers.map((c) => [c.id, c.name]));

    return rows.map((r) => ({
      customerId: r.customerId,
      customerName: nameMap.get(r.customerId) ?? '未知客户',
      totalAmount: Number(r.totalAmount),
      orderCount: Number(r.orderCount),
    }));
  }

  // ── 3. 产品分析 ────────────────────────────────────────────────────────────

  async getProductAnalysis(
    tenantId: string,
    query: ProductAnalysisQuery,
  ): Promise<ProductAnalysisItem[]> {
    const { startDate, endDate, limit = 20 } = query;

    const qb = this.lineRepo
      .createQueryBuilder('sol')
      .innerJoin(
        ErpSalesOrder,
        'so',
        'so.id = sol.so_id AND so.tenant_id = sol.tenant_id',
      )
      .select('sol.material_id', 'materialId')
      .addSelect('SUM(sol.amount)', 'totalAmount')
      .addSelect('SUM(sol.quantity)', 'totalQty')
      .addSelect('COUNT(DISTINCT sol.so_id)', 'orderCount')
      .where('sol.tenant_id = :tenantId', { tenantId });

    if (startDate) {
      qb.andWhere('so.order_date >= :startDate', { startDate });
    }
    if (endDate) {
      qb.andWhere('so.order_date <= :endDate', { endDate });
    }

    qb.groupBy('sol.material_id').orderBy('totalAmount', 'DESC').limit(limit);

    const rows = await qb.getRawMany<{
      materialId: string;
      totalAmount: string;
      totalQty: string;
      orderCount: string;
    }>();

    return rows.map((r) => ({
      materialId: r.materialId,
      totalAmount: Number(r.totalAmount),
      totalQty: Number(r.totalQty),
      orderCount: Number(r.orderCount),
    }));
  }

  // ── 4. 区域分析 ────────────────────────────────────────────────────────────

  async getRegionAnalysis(
    tenantId: string,
    query: { startDate?: Date; endDate?: Date },
  ): Promise<RegionAnalysisItem[]> {
    const { startDate, endDate } = query;

    // 先聚合每个客户的销售金额
    const soQb = this.soRepo
      .createQueryBuilder('so')
      .select('so.customer_id', 'customerId')
      .addSelect('SUM(so.total_amount)', 'totalAmount')
      .where('so.tenant_id = :tenantId', { tenantId });

    if (startDate) {
      soQb.andWhere('so.order_date >= :startDate', { startDate });
    }
    if (endDate) {
      soQb.andWhere('so.order_date <= :endDate', { endDate });
    }

    soQb.groupBy('so.customer_id');

    const soRows = await soQb.getRawMany<{
      customerId: string;
      totalAmount: string;
    }>();

    if (soRows.length === 0) return [];

    // 查询客户的 attributes.region
    const customerIds = soRows.map((r) => r.customerId);
    const customers = await this.customerRepo
      .createQueryBuilder('c')
      .select(['c.id', 'c.attributes'])
      .where('c.tenantId = :tenantId', { tenantId })
      .andWhere('c.id IN (:...ids)', { ids: customerIds })
      .getMany();

    const customerMap = new Map(
      customers.map((c) => [c.id, c.attributes?.region as string | undefined]),
    );

    // 按 region 聚合
    const regionMap = new Map<
      string,
      { totalAmount: number; customerIds: Set<string> }
    >();

    for (const row of soRows) {
      const region = customerMap.get(row.customerId) ?? '未知区域';
      const existing = regionMap.get(region);
      if (existing) {
        existing.totalAmount += Number(row.totalAmount);
        existing.customerIds.add(row.customerId);
      } else {
        regionMap.set(region, {
          totalAmount: Number(row.totalAmount),
          customerIds: new Set([row.customerId]),
        });
      }
    }

    return Array.from(regionMap.entries())
      .map(([region, data]) => ({
        region,
        totalAmount: data.totalAmount,
        customerCount: data.customerIds.size,
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);
  }
}
