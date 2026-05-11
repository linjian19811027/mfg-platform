import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  ErpCustomer,
  CustomerType,
  CustomerStatus,
} from '../entities/erp-customer.entity.js';
import {
  ErpReceivable,
  ReceivableStatus,
} from '../entities/erp-receivable.entity.js';
import { ErpQuotation } from '../entities/erp-quotation.entity.js';

export interface CustomerQuery {
  type?: CustomerType;
  status?: CustomerStatus;
  keyword?: string;
  page?: number;
  pageSize?: number;
}

export interface CreditCheckResult {
  allowed: boolean;
  reason?: string;
  usedAmount?: number;
  creditLimit?: number;
  remaining?: number;
}

@Injectable()
export class CustomerService {
  constructor(
    @InjectRepository(ErpCustomer)
    private readonly customerRepo: Repository<ErpCustomer>,
    @InjectRepository(ErpReceivable)
    private readonly receivableRepo: Repository<ErpReceivable>,
    @InjectRepository(ErpQuotation)
    private readonly quotationRepo: Repository<ErpQuotation>,
  ) {}

  // ── CRUD ─────────────────────────────────────────────────────────────────

  async create(
    tenantId: string,
    data: Partial<ErpCustomer>,
  ): Promise<ErpCustomer> {
    const code = await this._generateCode(tenantId);
    const customer = this.customerRepo.create({ ...data, tenantId, code });
    return this.customerRepo.save(customer);
  }

  async findAll(
    tenantId: string,
    query: CustomerQuery = {},
  ): Promise<{ items: ErpCustomer[]; total: number }> {
    const { type, status, keyword, page = 1, pageSize = 20 } = query;

    const qb = this.customerRepo
      .createQueryBuilder('c')
      .where('c.tenantId = :tenantId', { tenantId });

    if (type) qb.andWhere('c.type = :type', { type });
    if (status) qb.andWhere('c.status = :status', { status });
    if (keyword) {
      qb.andWhere('(c.code LIKE :kw OR c.name LIKE :kw)', {
        kw: `%${keyword}%`,
      });
    }

    qb.orderBy('c.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async findOne(tenantId: string, id: string): Promise<ErpCustomer> {
    const customer = await this.customerRepo.findOne({
      where: { id, tenantId },
    });
    if (!customer) {
      throw new NotFoundException(`客户 ${id} 不存在`);
    }
    return customer;
  }

  async update(
    tenantId: string,
    id: string,
    data: Partial<ErpCustomer>,
  ): Promise<ErpCustomer> {
    const customer = await this.findOne(tenantId, id);
    Object.assign(customer, data);
    return this.customerRepo.save(customer);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const customer = await this.findOne(tenantId, id);
    await this.customerRepo.remove(customer);
  }

  // ── 信用额度 ──────────────────────────────────────────────────────────────

  async checkCreditLimit(
    tenantId: string,
    customerId: string,
    orderAmount: number,
  ): Promise<CreditCheckResult> {
    const customer = await this.findOne(tenantId, customerId);

    // 无限额
    if (customer.creditLimit == null) {
      return { allowed: true };
    }

    // 查询未结清应收账款总额
    const result = await this.receivableRepo
      .createQueryBuilder('r')
      .select('SUM(r.amount - r.paidAmount)', 'usedAmount')
      .where('r.tenantId = :tenantId', { tenantId })
      .andWhere('r.customerId = :customerId', { customerId })
      .andWhere('r.status IN (:...statuses)', {
        statuses: [
          ReceivableStatus.PENDING,
          ReceivableStatus.PARTIAL,
          ReceivableStatus.OVERDUE,
        ],
      })
      .getRawOne<{ usedAmount: string | null }>();

    const usedAmount = result?.usedAmount ? parseFloat(result.usedAmount) : 0;
    const creditLimit = Number(customer.creditLimit);

    if (usedAmount + orderAmount > creditLimit) {
      return {
        allowed: false,
        reason: `信用额度不足，已用 ${usedAmount}，本次订单 ${orderAmount}，额度上限 ${creditLimit}`,
        usedAmount,
        creditLimit,
      };
    }

    return {
      allowed: true,
      usedAmount,
      remaining: creditLimit - usedAmount,
    };
  }

  async updateCreditLimit(
    tenantId: string,
    id: string,
    creditLimit: number | null,
  ): Promise<ErpCustomer> {
    return this.update(tenantId, id, { creditLimit: creditLimit ?? undefined });
  }

  // ── 报价历史 ──────────────────────────────────────────────────────────────

  async getQuotationHistory(
    tenantId: string,
    customerId: string,
    limit = 10,
  ): Promise<ErpQuotation[]> {
    return this.quotationRepo.find({
      where: { tenantId, customerId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  // ── 私有方法 ──────────────────────────────────────────────────────────────

  private async _generateCode(tenantId: string): Promise<string> {
    const result = await this.customerRepo
      .createQueryBuilder('c')
      .select('MAX(CAST(SUBSTRING(c.code, 5) AS UNSIGNED))', 'maxSeq')
      .where('c.tenantId = :tenantId', { tenantId })
      .andWhere("c.code LIKE 'CUS-%'")
      .getRawOne<{ maxSeq: number | null }>();

    const nextSeq = (result?.maxSeq ?? 0) + 1;
    return `CUS-${String(nextSeq).padStart(3, '0')}`;
  }
}
