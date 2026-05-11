import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ErpReconciliation,
  ErpReconciliationStatus,
} from '../entities/erp-reconciliation.entity.js';

// ── DTOs ──────────────────────────────────────────────────────────────────────

export interface ErpReconciliationItemDto {
  shipmentNo: string;
  shipmentAmount: number;
  invoiceAmount: number;
  diffAmount: number;
  note?: string;
}

export interface CreateErpReconciliationDto {
  customerId: string;
  periodStart: Date;
  periodEnd: Date;
  invoiceAmount: number;
  items: ErpReconciliationItemDto[];
}

export interface ErpReconciliationQuery {
  status?: ErpReconciliationStatus;
  customerId?: string;
  page?: number;
  pageSize?: number;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class ErpReconciliationService {
  constructor(
    @InjectRepository(ErpReconciliation)
    private readonly reconRepo: Repository<ErpReconciliation>,
  ) {}

  // ── reconNo 生成：SRECON-YYYYMM-序号 ──────────────────────────────────────

  private async generateReconNo(tenantId: string): Promise<string> {
    const now = new Date();
    const yyyymm =
      String(now.getFullYear()) + String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `SRECON-${yyyymm}-`;

    const last = await this.reconRepo
      .createQueryBuilder('r')
      .select('r.reconNo', 'reconNo')
      .where('r.tenantId = :tenantId', { tenantId })
      .andWhere('r.reconNo LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('r.reconNo', 'DESC')
      .limit(1)
      .getRawOne<{ reconNo: string }>();

    let seq = 1;
    if (last?.reconNo) {
      const lastSeq = parseInt(last.reconNo.slice(prefix.length), 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }

    return `${prefix}${String(seq).padStart(3, '0')}`;
  }

  // ── 1. create ─────────────────────────────────────────────────────────────

  async create(
    tenantId: string,
    data: CreateErpReconciliationDto,
  ): Promise<ErpReconciliation> {
    const reconNo = await this.generateReconNo(tenantId);

    // 自动计算 shipmentAmount = sum(item.shipmentAmount)
    const shipmentAmount = (data.items ?? []).reduce(
      (sum, item) => sum + Number(item.shipmentAmount),
      0,
    );

    // 自动计算 diffAmount = invoiceAmount - shipmentAmount
    const diffAmount = Number(data.invoiceAmount) - shipmentAmount;

    const recon = this.reconRepo.create({
      tenantId,
      reconNo,
      customerId: data.customerId,
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      shipmentAmount,
      invoiceAmount: data.invoiceAmount,
      diffAmount,
      status: ErpReconciliationStatus.DRAFT,
      items: data.items,
    });

    return this.reconRepo.save(recon);
  }

  // ── 2. findAll ────────────────────────────────────────────────────────────

  async findAll(
    tenantId: string,
    query: ErpReconciliationQuery = {},
  ): Promise<{ items: ErpReconciliation[]; total: number }> {
    const { status, customerId, page = 1, pageSize = 20 } = query;

    const qb = this.reconRepo
      .createQueryBuilder('r')
      .where('r.tenantId = :tenantId', { tenantId });

    if (status) qb.andWhere('r.status = :status', { status });
    if (customerId) qb.andWhere('r.customerId = :customerId', { customerId });

    qb.orderBy('r.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  // ── 3. findOne ────────────────────────────────────────────────────────────

  async findOne(tenantId: string, id: string): Promise<ErpReconciliation> {
    const recon = await this.reconRepo.findOne({ where: { id, tenantId } });
    if (!recon) throw new NotFoundException(`销售对账单 ${id} 不存在`);
    return recon;
  }

  // ── 4. confirm ────────────────────────────────────────────────────────────
  // DRAFT → CONFIRMED（diffAmount === 0）
  // DRAFT → DISCREPANCY（diffAmount !== 0）

  async confirm(tenantId: string, id: string): Promise<ErpReconciliation> {
    const recon = await this.findOne(tenantId, id);

    if (recon.status !== ErpReconciliationStatus.DRAFT) {
      throw new BadRequestException(
        `仅 DRAFT 状态可确认，当前状态：${recon.status}`,
      );
    }

    recon.status =
      Number(recon.diffAmount) === 0
        ? ErpReconciliationStatus.CONFIRMED
        : ErpReconciliationStatus.DISCREPANCY;

    return this.reconRepo.save(recon);
  }
}
