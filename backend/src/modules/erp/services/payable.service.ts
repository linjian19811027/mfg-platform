import {
  Injectable,
  Inject,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ErpPayable, PayableStatus } from '../entities/erp-payable.entity.js';
import {
  MessageService,
  MESSAGE_SERVICE,
} from '../../../shared/message/message.interface.js';

// ── DTOs ──────────────────────────────────────────────────────────────────────

export interface PayableQuery {
  status?: PayableStatus;
  supplierId?: string;
  page?: number;
  pageSize?: number;
}

export interface PaymentPlanItem {
  dueDate: string;
  amount: number;
  status: 'PENDING' | 'PAID';
}

export interface PayableCreatedPayload {
  reconId: string;
  reconNo: string;
  supplierId: string;
  supplierName?: string;
  amount: number;
  dueDate?: string;
  paymentPlan?: PaymentPlanItem[];
  tenantId: string;
  currency?: string;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class PayableService implements OnModuleInit {
  constructor(
    @InjectRepository(ErpPayable)
    private readonly payableRepo: Repository<ErpPayable>,
    @Inject(MESSAGE_SERVICE)
    private readonly messageService: MessageService,
  ) {}

  onModuleInit() {
    this.subscribe(this.messageService);
  }

  // ── 生成 payableNo ────────────────────────────────────────────────────────

  private async generatePayableNo(tenantId: string): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `AP-${dateStr}-`;

    const last = await this.payableRepo
      .createQueryBuilder('p')
      .where('p.tenantId = :tenantId', { tenantId })
      .andWhere('p.payableNo LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('p.payableNo', 'DESC')
      .getOne();

    let seq = 1;
    if (last) {
      const parts = last.payableNo.split('-');
      seq = parseInt(parts[parts.length - 1], 10) + 1;
    }

    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  // ── 1. createFromEvent ────────────────────────────────────────────────────

  async createFromEvent(
    tenantId: string,
    payload: PayableCreatedPayload,
  ): Promise<ErpPayable> {
    const payableNo = await this.generatePayableNo(tenantId);

    // dueDate: 优先取 payload.dueDate，否则取 paymentPlan 第一项，再否则今天
    let dueDate: Date;
    if (payload.dueDate) {
      dueDate = new Date(payload.dueDate);
    } else if (payload.paymentPlan && payload.paymentPlan.length > 0) {
      dueDate = new Date(payload.paymentPlan[0].dueDate);
    } else {
      dueDate = new Date();
    }

    const payable = this.payableRepo.create({
      tenantId,
      payableNo,
      supplierId: payload.supplierId,
      supplierName: payload.supplierName,
      reconId: payload.reconId,
      amount: payload.amount,
      paidAmount: 0,
      dueDate,
      status: PayableStatus.PENDING,
      paymentPlan: payload.paymentPlan ?? [],
      currency: payload.currency ?? 'CNY',
    });

    return this.payableRepo.save(payable);
  }

  // ── 2. findAll ────────────────────────────────────────────────────────────

  async findAll(
    tenantId: string,
    query: PayableQuery = {},
  ): Promise<{ items: ErpPayable[]; total: number }> {
    const { status, supplierId, page = 1, pageSize = 20 } = query;

    const qb = this.payableRepo
      .createQueryBuilder('p')
      .where('p.tenantId = :tenantId', { tenantId });

    if (status) qb.andWhere('p.status = :status', { status });
    if (supplierId) qb.andWhere('p.supplierId = :supplierId', { supplierId });

    qb.orderBy('p.dueDate', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  // ── 3. findOne ────────────────────────────────────────────────────────────

  async findOne(tenantId: string, id: string): Promise<ErpPayable> {
    const record = await this.payableRepo.findOne({ where: { id, tenantId } });
    if (!record) throw new NotFoundException(`应付账款 ${id} 不存在`);
    return record;
  }

  // ── 4. recordPayment ──────────────────────────────────────────────────────

  async recordPayment(
    tenantId: string,
    id: string,
    paidAmount: number,
  ): Promise<ErpPayable> {
    const record = await this.findOne(tenantId, id);

    const newPaid = Number(record.paidAmount) + Number(paidAmount);
    record.paidAmount = newPaid;
    record.status =
      newPaid >= Number(record.amount)
        ? PayableStatus.PAID
        : PayableStatus.PARTIAL;

    return this.payableRepo.save(record);
  }

  // ── 5. getPaymentPlan ─────────────────────────────────────────────────────

  async getPaymentPlan(
    tenantId: string,
    id: string,
  ): Promise<PaymentPlanItem[]> {
    const record = await this.findOne(tenantId, id);
    return (record.paymentPlan ?? []) as PaymentPlanItem[];
  }

  // ── 6. updatePaymentPlanItem ──────────────────────────────────────────────

  async updatePaymentPlanItem(
    tenantId: string,
    id: string,
    index: number,
    status: 'PENDING' | 'PAID',
  ): Promise<PaymentPlanItem[]> {
    const record = await this.findOne(tenantId, id);
    const plan = (record.paymentPlan ?? []) as PaymentPlanItem[];

    if (index < 0 || index >= plan.length) {
      throw new NotFoundException(`付款计划项 index=${index} 不存在`);
    }

    plan[index] = { ...plan[index], status };
    record.paymentPlan = plan;
    await this.payableRepo.save(record);
    return plan;
  }

  // ── 7. subscribe ──────────────────────────────────────────────────────────

  subscribe(messageService: MessageService): void {
    messageService.subscribe('PAYABLE_CREATED', async (event) => {
      const payload = event.payload as unknown as PayableCreatedPayload;
      await this.createFromEvent(event.tenantId, payload);
    });
  }
}
