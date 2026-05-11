import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager, DataSource } from 'typeorm';
import {
  ErpQuotation,
  QuotationStatus,
} from '../entities/erp-quotation.entity.js';
import {
  ErpSalesOrder,
  SalesOrderStatus,
} from '../entities/erp-sales-order.entity.js';
import {
  ErpSalesOrderLine,
  SalesOrderLineStatus,
} from '../entities/erp-sales-order-line.entity.js';

// ── DTOs ──────────────────────────────────────────────────────────────────────

export interface QuotationLineDto {
  lineNo: number;
  materialId: string;
  quantity: number;
  uomId: string;
  unitPrice: number;
  amount: number;
  deliveryDate?: Date;
}

export interface CreateQuotationDto {
  customerId: string;
  quotationDate: Date;
  validUntil?: Date;
  currency?: string;
  lines: QuotationLineDto[];
  createdBy?: string;
}

export interface QuotationQuery {
  status?: QuotationStatus;
  customerId?: string;
  page?: number;
  pageSize?: number;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class QuotationService {
  constructor(
    @InjectRepository(ErpQuotation)
    private readonly quotationRepo: Repository<ErpQuotation>,
    @InjectRepository(ErpSalesOrder)
    private readonly soRepo: Repository<ErpSalesOrder>,
    @InjectRepository(ErpSalesOrderLine)
    private readonly soLineRepo: Repository<ErpSalesOrderLine>,
    private readonly dataSource: DataSource,
  ) {
    // soRepo / soLineRepo are injected for potential direct queries;
    // transactional writes use EntityManager via dataSource.transaction
    void this.soRepo;
    void this.soLineRepo;
  }

  // ── quotationNo 生成 ──────────────────────────────────────────────────────

  private async generateQuotationNo(
    tenantId: string,
    em: EntityManager,
  ): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
    const prefix = `QT-${dateStr}-`;

    const result = await em
      .createQueryBuilder(ErpQuotation, 'q')
      .select('q.quotationNo', 'quotationNo')
      .where('q.tenantId = :tenantId', { tenantId })
      .andWhere('q.quotationNo LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('q.quotationNo', 'DESC')
      .limit(1)
      .getRawOne<{ quotationNo: string }>();

    let seq = 1;
    if (result?.quotationNo) {
      const lastSeq = parseInt(result.quotationNo.slice(prefix.length), 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }

    return `${prefix}${String(seq).padStart(3, '0')}`;
  }

  // ── soNo 生成 ─────────────────────────────────────────────────────────────

  private async generateSoNo(
    tenantId: string,
    em: EntityManager,
  ): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `SO-${dateStr}-`;

    const result = await em
      .createQueryBuilder(ErpSalesOrder, 'so')
      .select('so.soNo', 'soNo')
      .where('so.tenantId = :tenantId', { tenantId })
      .andWhere('so.soNo LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('so.soNo', 'DESC')
      .limit(1)
      .getRawOne<{ soNo: string }>();

    let seq = 1;
    if (result?.soNo) {
      const lastSeq = parseInt(result.soNo.slice(prefix.length), 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }

    return `${prefix}${String(seq).padStart(3, '0')}`;
  }

  // ── 1. create ─────────────────────────────────────────────────────────────

  async create(
    tenantId: string,
    data: CreateQuotationDto,
  ): Promise<ErpQuotation> {
    return this.dataSource.transaction(async (em) => {
      const quotationNo = await this.generateQuotationNo(tenantId, em);

      // 自动计算 totalAmount
      const totalAmount = (data.lines ?? []).reduce(
        (sum, l) => sum + Number(l.amount),
        0,
      );

      const quotation = em.create(ErpQuotation, {
        tenantId,
        quotationNo,
        customerId: data.customerId,
        quotationDate: data.quotationDate,
        validUntil: data.validUntil,
        status: QuotationStatus.DRAFT,
        totalAmount,
        currency: data.currency ?? 'CNY',
        lines: data.lines,
        createdBy: data.createdBy,
      });

      return em.save(ErpQuotation, quotation);
    });
  }

  // ── 2. findAll ────────────────────────────────────────────────────────────

  async findAll(
    tenantId: string,
    query: QuotationQuery = {},
  ): Promise<{ items: ErpQuotation[]; total: number }> {
    const { status, customerId, page = 1, pageSize = 20 } = query;

    const qb = this.quotationRepo
      .createQueryBuilder('q')
      .where('q.tenantId = :tenantId', { tenantId });

    if (status) qb.andWhere('q.status = :status', { status });
    if (customerId) qb.andWhere('q.customerId = :customerId', { customerId });

    qb.orderBy('q.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  // ── 3. findOne ────────────────────────────────────────────────────────────

  async findOne(tenantId: string, id: string): Promise<ErpQuotation> {
    const quotation = await this.quotationRepo.findOne({
      where: { id, tenantId },
    });
    if (!quotation) {
      throw new NotFoundException(`报价单 ${id} 不存在`);
    }
    return quotation;
  }

  // ── 4. send ───────────────────────────────────────────────────────────────

  async send(tenantId: string, id: string): Promise<ErpQuotation> {
    const quotation = await this.findOne(tenantId, id);
    if (quotation.status !== QuotationStatus.DRAFT) {
      throw new BadRequestException(
        `仅 DRAFT 状态可发送，当前状态：${quotation.status}`,
      );
    }
    quotation.status = QuotationStatus.SENT;
    return this.quotationRepo.save(quotation);
  }

  // ── 5. accept ─────────────────────────────────────────────────────────────

  async accept(tenantId: string, id: string): Promise<ErpQuotation> {
    const quotation = await this.findOne(tenantId, id);
    if (quotation.status !== QuotationStatus.SENT) {
      throw new BadRequestException(
        `仅 SENT 状态可接受，当前状态：${quotation.status}`,
      );
    }
    quotation.status = QuotationStatus.ACCEPTED;
    return this.quotationRepo.save(quotation);
  }

  // ── 6. reject ─────────────────────────────────────────────────────────────

  async reject(tenantId: string, id: string): Promise<ErpQuotation> {
    const quotation = await this.findOne(tenantId, id);
    if (quotation.status !== QuotationStatus.SENT) {
      throw new BadRequestException(
        `仅 SENT 状态可拒绝，当前状态：${quotation.status}`,
      );
    }
    quotation.status = QuotationStatus.REJECTED;
    return this.quotationRepo.save(quotation);
  }

  // ── 7. convertToOrder ─────────────────────────────────────────────────────

  async convertToOrder(
    tenantId: string,
    id: string,
    createdBy?: string,
  ): Promise<ErpSalesOrder> {
    return this.dataSource.transaction(async (em) => {
      const quotation = await em.findOne(ErpQuotation, {
        where: { id, tenantId },
      });
      if (!quotation) {
        throw new NotFoundException(`报价单 ${id} 不存在`);
      }
      if (quotation.status !== QuotationStatus.ACCEPTED) {
        throw new BadRequestException(
          `仅 ACCEPTED 状态可转订单，当前状态：${quotation.status}`,
        );
      }

      const soNo = await this.generateSoNo(tenantId, em);
      const today = new Date();

      const so = em.create(ErpSalesOrder, {
        tenantId,
        soNo,
        customerId: quotation.customerId,
        quotationId: quotation.id,
        orderDate: today,
        status: SalesOrderStatus.DRAFT,
        totalAmount: quotation.totalAmount,
        currency: quotation.currency,
        version: 1,
        createdBy: createdBy ?? quotation.createdBy,
      });

      const savedSo = await em.save(ErpSalesOrder, so);

      // 从 quotation.lines 生成订单明细
      const lines = quotation.lines ?? [];
      for (const line of lines) {
        const soLine = em.create(ErpSalesOrderLine, {
          tenantId,
          soId: savedSo.id,
          lineNo: line['lineNo'] as number,
          materialId: String(line['materialId']),
          quantity: Number(line['quantity']),
          uomId: String(line['uomId']),
          unitPrice: Number(line['unitPrice']),
          amount: Number(line['amount']),
          deliveryDate: line['deliveryDate']
            ? new Date(line['deliveryDate'] as string)
            : undefined,
          status: SalesOrderLineStatus.OPEN,
          shippedQty: 0,
        });
        await em.save(ErpSalesOrderLine, soLine);
      }

      return savedSo;
    });
  }
}
