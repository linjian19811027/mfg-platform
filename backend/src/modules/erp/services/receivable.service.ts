import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Repository } from 'typeorm';
import {
  ErpReceivable,
  ReceivableStatus,
} from '../entities/erp-receivable.entity.js';

// ── DTOs ──────────────────────────────────────────────────────────────────────

export interface ReceivableQuery {
  status?: ReceivableStatus;
  customerId?: string;
  page?: number;
  pageSize?: number;
}

export interface AgingBucket {
  bucket: string;
  count: number;
  totalAmount: number;
  overdueAmount: number;
}

export interface OverdueReminder {
  receivable: ErpReceivable;
  daysUntilDue: number;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class ReceivableService {
  constructor(
    @InjectRepository(ErpReceivable)
    private readonly receivableRepo: Repository<ErpReceivable>,
  ) {}

  // ── 1. findAll ────────────────────────────────────────────────────────────

  async findAll(
    tenantId: string,
    query: ReceivableQuery = {},
  ): Promise<{ items: ErpReceivable[]; total: number }> {
    const { status, customerId, page = 1, pageSize = 20 } = query;

    const qb = this.receivableRepo
      .createQueryBuilder('r')
      .leftJoin('erp_customer', 'c', 'c.id = r.customer_id AND c.tenant_id = r.tenant_id')
      .addSelect('c.name', 'customerName')
      .where('r.tenantId = :tenantId', { tenantId });

    if (status) qb.andWhere('r.status = :status', { status });
    if (customerId) qb.andWhere('r.customerId = :customerId', { customerId });

    qb.orderBy('r.dueDate', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const { entities, raw } = await qb.getRawAndEntities();
    const total = await qb.getCount();
    const items = entities.map((e, i) => ({ ...e, customerName: raw[i]?.customerName }));
    return { items, total };
  }

  // ── 2. findOne ────────────────────────────────────────────────────────────

  async findOne(tenantId: string, id: string): Promise<ErpReceivable> {
    const record = await this.receivableRepo.findOne({
      where: { id, tenantId },
    });
    if (!record) throw new NotFoundException(`应收账款 ${id} 不存在`);
    return record;
  }

  // ── 3. getAgingAnalysis ───────────────────────────────────────────────────
  // 按 dueDate 距今天数分组：0-30、31-60、61-90、91-180、180+
  // overdueAmount = dueDate < today 的金额

  async getAgingAnalysis(tenantId: string): Promise<AgingBucket[]> {
    const records = await this.receivableRepo.find({
      where: { tenantId },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const buckets: Array<{ label: string; min: number; max: number }> = [
      { label: '0-30天', min: 0, max: 30 },
      { label: '31-60天', min: 31, max: 60 },
      { label: '61-90天', min: 61, max: 90 },
      { label: '91-180天', min: 91, max: 180 },
      { label: '180天以上', min: 181, max: Infinity },
    ];

    return buckets.map(({ label, min, max }) => {
      const matched = records.filter((r) => {
        const due = new Date(r.dueDate);
        due.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil(
          (today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24),
        );
        // diffDays > 0 → 已逾期；diffDays <= 0 → 未到期
        // 账龄按绝对天数分桶（无论是否逾期）
        const ageDays = Math.abs(diffDays);
        return ageDays >= min && ageDays <= max;
      });

      const totalAmount = matched.reduce((sum, r) => sum + Number(r.amount), 0);

      const overdueAmount = matched
        .filter((r) => {
          const due = new Date(r.dueDate);
          due.setHours(0, 0, 0, 0);
          return due < today;
        })
        .reduce((sum, r) => sum + Number(r.amount), 0);

      return {
        bucket: label,
        count: matched.length,
        totalAmount,
        overdueAmount,
      };
    });
  }

  // ── 4. getOverdueReminders ────────────────────────────────────────────────
  // dueDate 在未来 daysAhead 天内且 status IN [PENDING, PARTIAL]

  async getOverdueReminders(
    tenantId: string,
    daysAhead = 7,
  ): Promise<OverdueReminder[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const deadline = new Date(today);
    deadline.setDate(deadline.getDate() + daysAhead);

    const records = await this.receivableRepo
      .createQueryBuilder('r')
      .where('r.tenantId = :tenantId', { tenantId })
      .andWhere('r.status IN (:...statuses)', {
        statuses: [ReceivableStatus.PENDING, ReceivableStatus.PARTIAL],
      })
      .andWhere('r.dueDate >= :today', { today })
      .andWhere('r.dueDate <= :deadline', { deadline })
      .orderBy('r.dueDate', 'ASC')
      .getMany();

    return records.map((receivable) => {
      const due = new Date(receivable.dueDate);
      due.setHours(0, 0, 0, 0);
      const daysUntilDue = Math.ceil(
        (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      );
      return { receivable, daysUntilDue };
    });
  }

  // ── 5. markOverdue ────────────────────────────────────────────────────────
  // dueDate < today 且 status IN [PENDING, PARTIAL] → OVERDUE

  async markOverdue(tenantId: string): Promise<{ updated: number }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = await this.receivableRepo
      .createQueryBuilder()
      .update(ErpReceivable)
      .set({ status: ReceivableStatus.OVERDUE })
      .where('tenantId = :tenantId', { tenantId })
      .andWhere('dueDate < :today', { today })
      .andWhere('status IN (:...statuses)', {
        statuses: [ReceivableStatus.PENDING, ReceivableStatus.PARTIAL],
      })
      .execute();

    return { updated: result.affected ?? 0 };
  }

  // ── 6. recordPayment ──────────────────────────────────────────────────────
  // 累加 paidAmount；>= amount → PAID，否则 → PARTIAL

  async recordPayment(
    tenantId: string,
    id: string,
    paidAmount: number,
  ): Promise<ErpReceivable> {
    const record = await this.findOne(tenantId, id);

    const newPaid = Number(record.paidAmount) + Number(paidAmount);
    record.paidAmount = newPaid;
    record.status =
      newPaid >= Number(record.amount)
        ? ReceivableStatus.PAID
        : ReceivableStatus.PARTIAL;

    return this.receivableRepo.save(record);
  }
}
