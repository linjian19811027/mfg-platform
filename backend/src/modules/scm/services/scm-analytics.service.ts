import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScmPurchaseOrder } from '../entities/scm-purchase-order.entity.js';
import { ScmPurchaseOrderLine } from '../entities/scm-purchase-order-line.entity.js';
import { ScmReceipt } from '../entities/scm-receipt.entity.js';
import { ScmSupplier } from '../entities/scm-supplier.entity.js';

// ── Query types ───────────────────────────────────────────────────────────────

export interface AmountAnalysisQuery {
  startDate?: Date;
  endDate?: Date;
  groupBy: 'month' | 'quarter' | 'year';
}

export interface SupplierAnalysisQuery {
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

export interface MaterialAnalysisQuery {
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

// ── Result types ──────────────────────────────────────────────────────────────

export interface AmountAnalysisItem {
  period: string;
  totalAmount: number;
  orderCount: number;
}

export interface SupplierAnalysisItem {
  supplierId: string;
  supplierName: string;
  totalAmount: number;
  orderCount: number;
  deliveryRate: number;
}

export interface MaterialAnalysisItem {
  materialId: string;
  totalAmount: number;
  totalQty: number;
  orderCount: number;
}

export interface DeliveryTrendItem {
  month: string;
  deliveryRate: number;
  onTimeCount: number;
  totalCount: number;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class ScmAnalyticsService {
  constructor(
    @InjectRepository(ScmPurchaseOrder)
    private readonly poRepo: Repository<ScmPurchaseOrder>,
    @InjectRepository(ScmPurchaseOrderLine)
    private readonly lineRepo: Repository<ScmPurchaseOrderLine>,
    @InjectRepository(ScmReceipt)
    private readonly receiptRepo: Repository<ScmReceipt>,
    @InjectRepository(ScmSupplier)
    private readonly supplierRepo: Repository<ScmSupplier>,
  ) {}

  // ── 1. 采购金额分析 ────────────────────────────────────────────────────────

  async getAmountAnalysis(
    tenantId: string,
    query: AmountAnalysisQuery,
  ): Promise<AmountAnalysisItem[]> {
    const { startDate, endDate, groupBy } = query;

    const formatMap: Record<string, string> = {
      month: '%Y-%m',
      quarter: '%Y-Q',
      year: '%Y',
    };

    // MySQL DATE_FORMAT 格式
    const mysqlFmt = groupBy === 'quarter' ? '%Y' : formatMap[groupBy];

    const qb = this.poRepo
      .createQueryBuilder('po')
      .select(
        groupBy === 'quarter'
          ? `CONCAT(DATE_FORMAT(po.order_date, '%Y'), '-Q', QUARTER(po.order_date))`
          : `DATE_FORMAT(po.order_date, '${mysqlFmt}')`,
        'period',
      )
      .addSelect('SUM(po.total_amount)', 'totalAmount')
      .addSelect('COUNT(po.id)', 'orderCount')
      .where('po.tenant_id = :tenantId', { tenantId });

    if (startDate) {
      qb.andWhere('po.order_date >= :startDate', { startDate });
    }
    if (endDate) {
      qb.andWhere('po.order_date <= :endDate', { endDate });
    }

    qb.groupBy('period').orderBy('period', 'ASC');

    const rows = await qb.getRawMany<{
      period: string;
      totalAmount: string;
      orderCount: string;
    }>();

    return rows.map((r) => ({
      period: r.period,
      totalAmount: parseFloat(r.totalAmount ?? '0'),
      orderCount: parseInt(r.orderCount ?? '0', 10),
    }));
  }

  // ── 2. 供应商分析 ──────────────────────────────────────────────────────────

  async getSupplierAnalysis(
    tenantId: string,
    query: SupplierAnalysisQuery,
  ): Promise<SupplierAnalysisItem[]> {
    const { startDate, endDate, limit = 20 } = query;

    // 按供应商汇总采购金额和订单数
    const qb = this.poRepo
      .createQueryBuilder('po')
      .select('po.supplier_id', 'supplierId')
      .addSelect('SUM(po.total_amount)', 'totalAmount')
      .addSelect('COUNT(po.id)', 'orderCount')
      .where('po.tenant_id = :tenantId', { tenantId });

    if (startDate) {
      qb.andWhere('po.order_date >= :startDate', { startDate });
    }
    if (endDate) {
      qb.andWhere('po.order_date <= :endDate', { endDate });
    }

    qb.groupBy('po.supplier_id').orderBy('totalAmount', 'DESC').limit(limit);

    const poRows = await qb.getRawMany<{
      supplierId: string;
      totalAmount: string;
      orderCount: string;
    }>();

    if (poRows.length === 0) return [];

    const supplierIds = poRows.map((r) => r.supplierId);

    // 查询供应商名称
    const suppliers = await this.supplierRepo
      .createQueryBuilder('s')
      .select(['s.id', 's.name'])
      .where('s.tenantId = :tenantId', { tenantId })
      .andWhere('s.id IN (:...ids)', { ids: supplierIds })
      .getMany();

    const supplierMap = new Map(suppliers.map((s) => [s.id, s.name]));

    // 查询每个供应商的交期达成率
    // 按时到货：receipt.receiptDate <= po.expectedDate
    const deliveryQb = this.receiptRepo
      .createQueryBuilder('r')
      .select('r.supplier_id', 'supplierId')
      .addSelect('COUNT(r.id)', 'totalCount')
      .addSelect(
        `SUM(CASE WHEN po.expected_date IS NOT NULL AND r.receipt_date <= po.expected_date THEN 1 ELSE 0 END)`,
        'onTimeCount',
      )
      .innerJoin(
        ScmPurchaseOrder,
        'po',
        'po.id = r.po_id AND po.tenant_id = r.tenant_id',
      )
      .where('r.tenant_id = :tenantId', { tenantId })
      .andWhere('r.supplier_id IN (:...ids)', { ids: supplierIds });

    if (startDate) {
      deliveryQb.andWhere('r.receipt_date >= :startDate', { startDate });
    }
    if (endDate) {
      deliveryQb.andWhere('r.receipt_date <= :endDate', { endDate });
    }

    deliveryQb.groupBy('r.supplier_id');

    const deliveryRows = await deliveryQb.getRawMany<{
      supplierId: string;
      totalCount: string;
      onTimeCount: string;
    }>();

    const deliveryMap = new Map(
      deliveryRows.map((r) => [
        r.supplierId,
        {
          total: parseInt(r.totalCount ?? '0', 10),
          onTime: parseInt(r.onTimeCount ?? '0', 10),
        },
      ]),
    );

    return poRows.map((r) => {
      const delivery = deliveryMap.get(r.supplierId);
      const deliveryRate =
        delivery && delivery.total > 0 ? delivery.onTime / delivery.total : 0;

      return {
        supplierId: r.supplierId,
        supplierName: supplierMap.get(r.supplierId) ?? '',
        totalAmount: parseFloat(r.totalAmount ?? '0'),
        orderCount: parseInt(r.orderCount ?? '0', 10),
        deliveryRate,
      };
    });
  }

  // ── 3. 品类分析 ────────────────────────────────────────────────────────────

  async getMaterialAnalysis(
    tenantId: string,
    query: MaterialAnalysisQuery,
  ): Promise<MaterialAnalysisItem[]> {
    const { startDate, endDate, limit = 20 } = query;

    const qb = this.lineRepo
      .createQueryBuilder('pol')
      .select('pol.material_id', 'materialId')
      .addSelect('SUM(pol.amount)', 'totalAmount')
      .addSelect('SUM(pol.quantity)', 'totalQty')
      .addSelect('COUNT(DISTINCT pol.po_id)', 'orderCount')
      .where('pol.tenant_id = :tenantId', { tenantId });

    if (startDate || endDate) {
      qb.innerJoin(
        ScmPurchaseOrder,
        'po',
        'po.id = pol.po_id AND po.tenant_id = pol.tenant_id',
      );
      if (startDate) {
        qb.andWhere('po.order_date >= :startDate', { startDate });
      }
      if (endDate) {
        qb.andWhere('po.order_date <= :endDate', { endDate });
      }
    }

    qb.groupBy('pol.material_id').orderBy('totalAmount', 'DESC').limit(limit);

    const rows = await qb.getRawMany<{
      materialId: string;
      totalAmount: string;
      totalQty: string;
      orderCount: string;
    }>();

    return rows.map((r) => ({
      materialId: r.materialId,
      totalAmount: parseFloat(r.totalAmount ?? '0'),
      totalQty: parseFloat(r.totalQty ?? '0'),
      orderCount: parseInt(r.orderCount ?? '0', 10),
    }));
  }

  // ── 4. 交期达成率趋势 ──────────────────────────────────────────────────────

  async getDeliveryTrend(
    tenantId: string,
    months = 6,
  ): Promise<DeliveryTrendItem[]> {
    // 计算起始日期：N 个月前的月初
    const now = new Date();
    const startDate = new Date(
      now.getFullYear(),
      now.getMonth() - months + 1,
      1,
    );

    const qb = this.receiptRepo
      .createQueryBuilder('r')
      .select(`DATE_FORMAT(r.receipt_date, '%Y-%m')`, 'month')
      .addSelect('COUNT(r.id)', 'totalCount')
      .addSelect(
        `SUM(CASE WHEN po.expected_date IS NOT NULL AND r.receipt_date <= po.expected_date THEN 1 ELSE 0 END)`,
        'onTimeCount',
      )
      .innerJoin(
        ScmPurchaseOrder,
        'po',
        'po.id = r.po_id AND po.tenant_id = r.tenant_id',
      )
      .where('r.tenant_id = :tenantId', { tenantId })
      .andWhere('r.receipt_date >= :startDate', { startDate })
      .groupBy('month')
      .orderBy('month', 'ASC');

    const rows = await qb.getRawMany<{
      month: string;
      totalCount: string;
      onTimeCount: string;
    }>();

    return rows.map((r) => {
      const total = parseInt(r.totalCount ?? '0', 10);
      const onTime = parseInt(r.onTimeCount ?? '0', 10);
      return {
        month: r.month,
        deliveryRate: total > 0 ? onTime / total : 0,
        onTimeCount: onTime,
        totalCount: total,
      };
    });
  }
}
