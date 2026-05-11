import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager, DataSource } from 'typeorm';
import { ScmInquiry, InquiryStatus } from '../entities/scm-inquiry.entity.js';
import { ScmInquiryLine } from '../entities/scm-inquiry-line.entity.js';

// ── DTOs ──────────────────────────────────────────────────────────────────────

export interface CreateInquiryDto {
  materialId: string;
  quantity: number;
  uomId: string;
  requiredDate?: Date;
  createdBy?: string;
}

export interface SubmitQuoteDto {
  quotedPrice: number;
  quotedLeadDays: number;
  remarks?: string;
}

export interface InquiryQuery {
  status?: InquiryStatus;
  materialId?: string;
  page?: number;
  pageSize?: number;
}

export interface ComparisonResult {
  inquiry: ScmInquiry;
  lines: ScmInquiryLine[];
  recommendation: ScmInquiryLine | null;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class InquiryService {
  constructor(
    @InjectRepository(ScmInquiry)
    private readonly inquiryRepo: Repository<ScmInquiry>,
    @InjectRepository(ScmInquiryLine)
    private readonly lineRepo: Repository<ScmInquiryLine>,
    private readonly dataSource: DataSource,
  ) {}

  // ── inquiryNo 生成 ──────────────────────────────────────────────────────────

  private async generateInquiryNo(
    tenantId: string,
    em: EntityManager,
  ): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
    const prefix = `INQ-${dateStr}-`;

    const result = await em
      .createQueryBuilder(ScmInquiry, 'inq')
      .select('inq.inquiryNo', 'inquiryNo')
      .where('inq.tenantId = :tenantId', { tenantId })
      .andWhere('inq.inquiryNo LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('inq.inquiryNo', 'DESC')
      .limit(1)
      .getRawOne<{ inquiryNo: string }>();

    let seq = 1;
    if (result?.inquiryNo) {
      const lastSeq = parseInt(result.inquiryNo.slice(prefix.length), 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }

    return `${prefix}${String(seq).padStart(3, '0')}`;
  }

  // ── 1. create ───────────────────────────────────────────────────────────────

  async create(tenantId: string, data: CreateInquiryDto): Promise<ScmInquiry> {
    return this.dataSource.transaction(async (em) => {
      const inquiryNo = await this.generateInquiryNo(tenantId, em);

      const inquiry = em.create(ScmInquiry, {
        tenantId,
        inquiryNo,
        materialId: data.materialId,
        quantity: data.quantity,
        uomId: data.uomId,
        requiredDate: data.requiredDate,
        status: InquiryStatus.DRAFT,
        createdBy: data.createdBy,
      });

      return em.save(ScmInquiry, inquiry);
    });
  }

  // ── 2. send ─────────────────────────────────────────────────────────────────

  async send(
    tenantId: string,
    id: string,
    supplierIds: string[],
  ): Promise<ScmInquiry> {
    return this.dataSource.transaction(async (em) => {
      const inquiry = await em.findOne(ScmInquiry, { where: { id, tenantId } });
      if (!inquiry) throw new NotFoundException(`询价单 ${id} 不存在`);
      if (inquiry.status !== InquiryStatus.DRAFT) {
        throw new BadRequestException(
          `仅 DRAFT 状态可发送，当前状态：${inquiry.status}`,
        );
      }
      if (!supplierIds || supplierIds.length === 0) {
        throw new BadRequestException('至少需要选择一家供应商');
      }

      // 为每个供应商创建询价明细
      for (const supplierId of supplierIds) {
        const line = em.create(ScmInquiryLine, {
          tenantId,
          inquiryId: id,
          supplierId,
          isSelected: 0,
        });
        await em.save(ScmInquiryLine, line);
      }

      inquiry.status = InquiryStatus.SENT;
      return em.save(ScmInquiry, inquiry);
    });
  }

  // ── 3. submitQuote ──────────────────────────────────────────────────────────

  async submitQuote(
    tenantId: string,
    inquiryId: string,
    supplierId: string,
    quote: SubmitQuoteDto,
  ): Promise<ScmInquiryLine> {
    return this.dataSource.transaction(async (em) => {
      const inquiry = await em.findOne(ScmInquiry, {
        where: { id: inquiryId, tenantId },
      });
      if (!inquiry) throw new NotFoundException(`询价单 ${inquiryId} 不存在`);
      if (
        inquiry.status !== InquiryStatus.SENT &&
        inquiry.status !== InquiryStatus.COMPARING
      ) {
        throw new BadRequestException(
          `仅 SENT/COMPARING 状态可提交报价，当前状态：${inquiry.status}`,
        );
      }

      const line = await em.findOne(ScmInquiryLine, {
        where: { inquiryId, supplierId, tenantId },
      });
      if (!line) {
        throw new NotFoundException(`供应商 ${supplierId} 的询价明细不存在`);
      }

      line.quotedPrice = quote.quotedPrice;
      line.quotedLeadDays = quote.quotedLeadDays;
      line.remarks = quote.remarks;
      await em.save(ScmInquiryLine, line);

      // 状态 SENT → COMPARING
      if (inquiry.status === InquiryStatus.SENT) {
        inquiry.status = InquiryStatus.COMPARING;
        await em.save(ScmInquiry, inquiry);
      }

      return line;
    });
  }

  // ── 4. getComparison ────────────────────────────────────────────────────────

  async getComparison(tenantId: string, id: string): Promise<ComparisonResult> {
    const inquiry = await this.inquiryRepo.findOne({ where: { id, tenantId } });
    if (!inquiry) throw new NotFoundException(`询价单 ${id} 不存在`);

    // 只取已报价的明细（quotedPrice 和 quotedLeadDays 均不为 null）
    const allLines = await this.lineRepo.find({
      where: { inquiryId: id, tenantId },
    });

    const quotedLines = allLines.filter(
      (l) => l.quotedPrice != null && l.quotedLeadDays != null,
    );

    if (quotedLines.length === 0) {
      return { inquiry, lines: [], recommendation: null };
    }

    // 计算综合评分
    const minPrice = Math.min(...quotedLines.map((l) => Number(l.quotedPrice)));
    const minLeadDays = Math.min(
      ...quotedLines.map((l) => Number(l.quotedLeadDays)),
    );

    for (const line of quotedLines) {
      const priceScore = (minPrice / Number(line.quotedPrice)) * 100;
      const leadScore = (minLeadDays / Number(line.quotedLeadDays)) * 100;
      line.totalScore =
        Math.round((priceScore * 0.6 + leadScore * 0.4) * 100) / 100;
    }

    // 按 totalScore 降序
    quotedLines.sort((a, b) => Number(b.totalScore) - Number(a.totalScore));

    const recommendation = quotedLines[0] ?? null;

    return { inquiry, lines: quotedLines, recommendation };
  }

  // ── 5. selectSupplier ───────────────────────────────────────────────────────

  async selectSupplier(
    tenantId: string,
    inquiryId: string,
    lineId: string,
  ): Promise<ScmInquiry> {
    return this.dataSource.transaction(async (em) => {
      const inquiry = await em.findOne(ScmInquiry, {
        where: { id: inquiryId, tenantId },
      });
      if (!inquiry) throw new NotFoundException(`询价单 ${inquiryId} 不存在`);
      if (inquiry.status === InquiryStatus.CLOSED) {
        throw new BadRequestException('询价单已关闭');
      }

      const targetLine = await em.findOne(ScmInquiryLine, {
        where: { id: lineId, inquiryId, tenantId },
      });
      if (!targetLine) {
        throw new NotFoundException(`询价明细 ${lineId} 不存在`);
      }

      // 将所有明细 isSelected 设为 false，目标设为 true
      const allLines = await em.find(ScmInquiryLine, {
        where: { inquiryId, tenantId },
      });

      for (const line of allLines) {
        line.isSelected = line.id === lineId ? 1 : 0;
        await em.save(ScmInquiryLine, line);
      }

      inquiry.status = InquiryStatus.CLOSED;
      return em.save(ScmInquiry, inquiry);
    });
  }

  // ── 6. findAll ──────────────────────────────────────────────────────────────

  async findAll(
    tenantId: string,
    query: InquiryQuery = {},
  ): Promise<{ items: ScmInquiry[]; total: number }> {
    const { status, materialId, page = 1, pageSize = 20 } = query;

    const qb = this.inquiryRepo
      .createQueryBuilder('inq')
      .where('inq.tenantId = :tenantId', { tenantId });

    if (status) qb.andWhere('inq.status = :status', { status });
    if (materialId) qb.andWhere('inq.materialId = :materialId', { materialId });

    qb.orderBy('inq.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  // ── 7. findOne ──────────────────────────────────────────────────────────────

  async findOne(
    tenantId: string,
    id: string,
  ): Promise<ScmInquiry & { lines: ScmInquiryLine[] }> {
    const inquiry = await this.inquiryRepo.findOne({ where: { id, tenantId } });
    if (!inquiry) throw new NotFoundException(`询价单 ${id} 不存在`);

    const lines = await this.lineRepo.find({
      where: { inquiryId: id, tenantId },
      order: { createdAt: 'ASC' },
    });

    return Object.assign(inquiry, { lines });
  }
}
