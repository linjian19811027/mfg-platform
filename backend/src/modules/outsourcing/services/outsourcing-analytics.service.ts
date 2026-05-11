import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  OutsourcingOrder,
  OutsourcingOrderStatus,
} from '../entities/outsourcing-order.entity.js';
import { OutsourcingSettlement } from '../entities/outsourcing-settlement.entity.js';
import { TenantContext } from '../../../shared/tenant/tenant.context.js';

@Injectable()
export class OutsourcingAnalyticsService {
  constructor(
    @InjectRepository(OutsourcingOrder)
    private readonly orderRepo: Repository<OutsourcingOrder>,
    @InjectRepository(OutsourcingSettlement)
    private readonly settlementRepo: Repository<OutsourcingSettlement>,
    private readonly dataSource: DataSource,
  ) {}

  // ── 看板汇总 ──────────────────────────────────────────────────────────────

  async getDashboard(): Promise<Record<string, unknown>> {
    const tenantId = TenantContext.requireCurrentTenant();
    const now = new Date();

    // 各状态工单数量
    const statusCounts = await this.orderRepo
      .createQueryBuilder('o')
      .select('o.status', 'status')
      .addSelect('COUNT(*)', 'cnt')
      .where('o.tenant_id = :tenantId', { tenantId })
      .groupBy('o.status')
      .getRawMany<{ status: string; cnt: string }>();

    const statusMap: Record<string, number> = {};
    for (const row of statusCounts) {
      statusMap[row.status] = Number(row.cnt);
    }

    // 逾期工单数
    const overdueCount = await this.orderRepo
      .createQueryBuilder('o')
      .where('o.tenant_id = :tenantId', { tenantId })
      .andWhere('o.planned_delivery < :now', { now })
      .andWhere('o.status NOT IN (:...done)', {
        done: [
          OutsourcingOrderStatus.SETTLED,
          OutsourcingOrderStatus.CLOSED,
          OutsourcingOrderStatus.CANCELLED,
        ],
      })
      .getCount();

    // 本月到期工单数
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const dueSoonCount = await this.orderRepo
      .createQueryBuilder('o')
      .where('o.tenant_id = :tenantId', { tenantId })
      .andWhere('o.planned_delivery BETWEEN :start AND :end', {
        start: monthStart,
        end: monthEnd,
      })
      .andWhere('o.status NOT IN (:...done)', {
        done: [
          OutsourcingOrderStatus.SETTLED,
          OutsourcingOrderStatus.CLOSED,
          OutsourcingOrderStatus.CANCELLED,
        ],
      })
      .getCount();

    // 本月结算金额合计
    const monthSettlement = await this.settlementRepo
      .createQueryBuilder('s')
      .select('SUM(s.amount_with_tax)', 'total')
      .where('s.tenant_id = :tenantId', { tenantId })
      .andWhere('s.status = :approved', { approved: 'APPROVED' })
      .andWhere('s.settle_date BETWEEN :start AND :end', {
        start: monthStart,
        end: monthEnd,
      })
      .getRawOne<{ total: string }>();

    return {
      statusCounts: statusMap,
      overdueCount,
      dueSoonCount,
      monthSettlementAmount: Number(monthSettlement?.total ?? 0),
    };
  }

  // ── Excel 导出（最多 5000 条）────────────────────────────────────────────

  async exportExcel(query: {
    status?: string;
    supplierId?: string;
    deliveryFrom?: Date;
    deliveryTo?: Date;
  }): Promise<Record<string, unknown>[]> {
    const tenantId = TenantContext.requireCurrentTenant();

    const qb = this.orderRepo
      .createQueryBuilder('o')
      .where('o.tenant_id = :tenantId', { tenantId });

    if (query.status)
      qb.andWhere('o.status = :status', { status: query.status });
    if (query.supplierId)
      qb.andWhere('o.supplier_id = :sid', { sid: query.supplierId });
    if (query.deliveryFrom)
      qb.andWhere('o.planned_delivery >= :from', { from: query.deliveryFrom });
    if (query.deliveryTo)
      qb.andWhere('o.planned_delivery <= :to', { to: query.deliveryTo });

    const orders = await qb
      .orderBy('o.created_at', 'DESC')
      .take(5000)
      .getMany();

    const now = new Date();
    const settledStatuses = [
      OutsourcingOrderStatus.SETTLED,
      OutsourcingOrderStatus.CLOSED,
      OutsourcingOrderStatus.CANCELLED,
    ];

    return orders.map((o) => {
      const delivery = new Date(o.plannedDelivery);
      const diffMs = delivery.getTime() - now.getTime();
      const isOverdue = !settledStatuses.includes(o.status) && diffMs < 0;
      const overdueDays = isOverdue
        ? Math.ceil(-diffMs / (24 * 60 * 60 * 1000))
        : 0;
      const planned = Number(o.plannedQty);
      const issued = Number(o.issuedQty);
      const received = Number(o.receivedQty);
      const inspected = Number(o.inspectedQty);
      const settled = Number(o.settledQty);
      const pct = (n: number, d: number) =>
        d > 0 ? `${Math.round((n / d) * 10000) / 100}%` : '0%';

      return {
        ocNo: o.ocNo ?? '',
        supplierId: o.supplierId,
        processName: o.processName,
        materialId: o.materialId,
        status: o.status,
        plannedQty: planned,
        issuedQty: issued,
        receivedQty: received,
        inspectedQty: inspected,
        settledQty: settled,
        issuePct: pct(issued, planned),
        receivePct: pct(received, planned),
        inspectPct: pct(inspected, received),
        settlePct: pct(settled, inspected),
        plannedDelivery: o.plannedDelivery,
        isOverdue,
        overdueDays,
        unitPrice: Number(o.unitPrice),
        currency: o.currency,
        createdAt: o.createdAt,
      };
    });
  }
}
