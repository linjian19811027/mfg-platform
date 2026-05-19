import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import {
  MessageService,
  MESSAGE_SERVICE,
} from '../../../shared/message/message.interface.js';
import {
  ScmReconciliation,
  ReconciliationStatus,
} from '../entities/scm-reconciliation.entity.js';

// ── DTOs ──────────────────────────────────────────────────────────────────────

export interface ReconciliationItemDto {
  receiptNo: string;
  receiptAmount: number;
  invoiceAmount: number;
  diffAmount: number;
  note?: string;
}

export interface CreateReconciliationDto {
  supplierId: string;
  periodStart: Date;
  periodEnd: Date;
  invoiceAmount: number;
  items: ReconciliationItemDto[];
}

export interface ReconciliationQuery {
  status?: ReconciliationStatus;
  supplierId?: string;
  page?: number;
  pageSize?: number;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class ReconciliationService {
  constructor(
    @InjectRepository(ScmReconciliation)
    private readonly reconRepo: Repository<ScmReconciliation>,
    @Inject(MESSAGE_SERVICE) private readonly messageService: MessageService,
  ) {}

  // ── reconNo 生成：REC-YYYYMM-序号 ─────────────────────────────────────────

  private async generateReconNo(tenantId: string): Promise<string> {
    const now = new Date();
    const yyyymm =
      String(now.getFullYear()) + String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `REC-${yyyymm}-`;

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
    data: CreateReconciliationDto,
  ): Promise<ScmReconciliation> {
    const reconNo = await this.generateReconNo(tenantId);

    // 自动计算 receiptAmount = sum(item.receiptAmount)
    const receiptAmount = (data.items ?? []).reduce(
      (sum, item) => sum + Number(item.receiptAmount),
      0,
    );

    // 自动计算 diffAmount = invoiceAmount - receiptAmount
    const diffAmount = Number(data.invoiceAmount) - receiptAmount;

    const recon = this.reconRepo.create({
      tenantId,
      reconNo,
      supplierId: data.supplierId,
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      receiptAmount,
      invoiceAmount: data.invoiceAmount,
      diffAmount,
      status: ReconciliationStatus.DRAFT,
      items: data.items,
      payableCreated: 0,
    });

    return this.reconRepo.save(recon);
  }

  // ── 2. findAll ────────────────────────────────────────────────────────────

  async findAll(
    tenantId: string,
    query: ReconciliationQuery = {},
  ): Promise<{ items: ScmReconciliation[]; total: number }> {
    const { status, supplierId, page = 1, pageSize = 20 } = query;

    const qb = this.reconRepo
      .createQueryBuilder('r')
      .leftJoin('scm_supplier', 'sup', 'sup.id = r.supplier_id AND sup.tenant_id = r.tenant_id')
      .addSelect('sup.name', 'supplierName')
      .where('r.tenantId = :tenantId', { tenantId });

    if (status) qb.andWhere('r.status = :status', { status });
    if (supplierId) qb.andWhere('r.supplierId = :supplierId', { supplierId });

    qb.orderBy('r.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const { entities, raw } = await qb.getRawAndEntities();
    const total = await qb.getCount();
    const items = entities.map((e, i) => ({ ...e, supplierName: raw[i]?.supplierName }));
    return { items, total };
  }

  // ── 3. findOne ────────────────────────────────────────────────────────────

  async findOne(tenantId: string, id: string): Promise<ScmReconciliation> {
    const recon = await this.reconRepo.findOne({ where: { id, tenantId } });
    if (!recon) throw new NotFoundException(`对账单 ${id} 不存在`);
    return recon;
  }

  // ── 4. confirm ────────────────────────────────────────────────────────────
  // DRAFT → CONFIRMED（差异为 0）
  // DRAFT → DISCREPANCY（差异不为 0）

  async confirm(tenantId: string, id: string): Promise<ScmReconciliation> {
    const recon = await this.findOne(tenantId, id);

    if (recon.status !== ReconciliationStatus.DRAFT) {
      throw new BadRequestException(
        `仅 DRAFT 状态可确认，当前状态：${recon.status}`,
      );
    }

    recon.status =
      Number(recon.diffAmount) === 0
        ? ReconciliationStatus.CONFIRMED
        : ReconciliationStatus.DISCREPANCY;

    const saved = await this.reconRepo.save(recon);

    if (saved.status === ReconciliationStatus.CONFIRMED) {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);
      await this.messageService.publish({
        eventId: uuidv4(),
        eventType: 'PAYABLE_CREATED',
        tenantId,
        sourceModule: 'SCM',
        targetModule: 'ERP',
        payload: {
          reconId: saved.id,
          reconNo: saved.reconNo,
          supplierId: saved.supplierId,
          amount: saved.invoiceAmount,
          paymentPlan: [
            {
              dueDate: dueDate.toISOString(),
              amount: saved.invoiceAmount,
              status: 'PENDING',
            },
          ],
          tenantId,
        },
        createdAt: new Date(),
      });
    }

    return saved;
  }

  // ── 5. markPayableCreated ─────────────────────────────────────────────────
  // 由 ERP 事件处理器调用，标记应付账款已创建

  async markPayableCreated(
    tenantId: string,
    id: string,
  ): Promise<ScmReconciliation> {
    const recon = await this.findOne(tenantId, id);
    recon.payableCreated = 1;
    return this.reconRepo.save(recon);
  }

  // ── 6. pushPayable ────────────────────────────────────────────────────────
  // 手动推送应付账款（用于 DISCREPANCY 状态人工确认后）

  async pushPayable(
    tenantId: string,
    id: string,
    paymentTermDays = 30,
  ): Promise<ScmReconciliation> {
    const recon = await this.findOne(tenantId, id);

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + paymentTermDays);

    await this.messageService.publish({
      eventId: uuidv4(),
      eventType: 'PAYABLE_CREATED',
      tenantId,
      sourceModule: 'SCM',
      targetModule: 'ERP',
      payload: {
        reconId: recon.id,
        reconNo: recon.reconNo,
        supplierId: recon.supplierId,
        amount: recon.invoiceAmount,
        paymentPlan: [
          {
            dueDate: dueDate.toISOString(),
            amount: recon.invoiceAmount,
            status: 'PENDING',
          },
        ],
        tenantId,
      },
      createdAt: new Date(),
    });

    return this.markPayableCreated(tenantId, id);
  }
}
