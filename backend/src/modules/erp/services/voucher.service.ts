import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  ErpVoucher,
  VoucherType,
  VoucherStatus,
} from '../entities/erp-voucher.entity.js';
import { ErpVoucherLine } from '../entities/erp-voucher-line.entity.js';

export interface VoucherLineInput {
  accountId: string;
  debitAmount?: number;
  creditAmount?: number;
  summary?: string;
}

export interface CreateVoucherInput {
  voucherDate: string;
  voucherType: VoucherType;
  sourceType?: string;
  sourceId?: string;
  createdBy?: string;
}

export interface VoucherQuery {
  status?: VoucherStatus;
  voucherType?: VoucherType;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class VoucherService {
  constructor(
    @InjectRepository(ErpVoucher)
    private readonly voucherRepo: Repository<ErpVoucher>,
    @InjectRepository(ErpVoucherLine)
    private readonly lineRepo: Repository<ErpVoucherLine>,
    private readonly dataSource: DataSource,
  ) {}

  // ── 生成凭证号 ────────────────────────────────────────────────────────────

  private async generateVoucherNo(
    tenantId: string,
    date: string,
  ): Promise<string> {
    const dateStr = date.replace(/-/g, '').slice(0, 8); // YYYYMMDD
    const prefix = `VCH-${dateStr}-`;

    const last = await this.voucherRepo
      .createQueryBuilder('v')
      .where('v.tenantId = :tenantId', { tenantId })
      .andWhere('v.voucherNo LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('v.voucherNo', 'DESC')
      .getOne();

    let seq = 1;
    if (last) {
      const parts = last.voucherNo.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }

    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  // ── 借贷平衡校验 ──────────────────────────────────────────────────────────

  private checkBalance(lines: VoucherLineInput[]): {
    totalDebit: number;
    totalCredit: number;
  } {
    const totalDebit = lines.reduce(
      (s, l) => s + (Number(l.debitAmount) || 0),
      0,
    );
    const totalCredit = lines.reduce(
      (s, l) => s + (Number(l.creditAmount) || 0),
      0,
    );

    if (Math.abs(totalDebit - totalCredit) >= 0.0001) {
      throw new BadRequestException(
        `借贷不平衡：借方合计 ${totalDebit}，贷方合计 ${totalCredit}`,
      );
    }
    return { totalDebit, totalCredit };
  }

  // ── 内部保存凭证（事务） ──────────────────────────────────────────────────

  private async saveVoucher(
    tenantId: string,
    data: CreateVoucherInput,
    lines: VoucherLineInput[],
    totalDebit: number,
    totalCredit: number,
  ): Promise<ErpVoucher> {
    return this.dataSource.transaction(async (manager) => {
      const voucherNo = await this.generateVoucherNo(
        tenantId,
        data.voucherDate,
      );

      const voucher = manager.create(ErpVoucher, {
        tenantId,
        voucherNo,
        voucherDate: data.voucherDate,
        voucherType: data.voucherType,
        sourceType: data.sourceType,
        sourceId: data.sourceId,
        totalDebit,
        totalCredit,
        status: VoucherStatus.DRAFT,
        createdBy: data.createdBy,
      });
      const saved = await manager.save(ErpVoucher, voucher);

      const lineEntities = lines.map((l, idx) =>
        manager.create(ErpVoucherLine, {
          tenantId,
          voucherId: saved.id,
          lineNo: idx + 1,
          accountId: l.accountId,
          debitAmount: Number(l.debitAmount) || 0,
          creditAmount: Number(l.creditAmount) || 0,
          summary: l.summary,
        }),
      );
      await manager.save(ErpVoucherLine, lineEntities);

      return saved;
    });
  }

  // ── 公开方法 ──────────────────────────────────────────────────────────────

  /** 手工录入凭证（校验借贷平衡） */
  async create(
    tenantId: string,
    data: CreateVoucherInput,
    lines: VoucherLineInput[],
  ): Promise<ErpVoucher> {
    const { totalDebit, totalCredit } = this.checkBalance(lines);
    return this.saveVoucher(tenantId, data, lines, totalDebit, totalCredit);
  }

  /** 系统自动生成凭证（跳过借贷平衡校验） */
  async createAuto(
    tenantId: string,
    data: CreateVoucherInput,
    lines: VoucherLineInput[],
  ): Promise<ErpVoucher> {
    const totalDebit = lines.reduce(
      (s, l) => s + (Number(l.debitAmount) || 0),
      0,
    );
    const totalCredit = lines.reduce(
      (s, l) => s + (Number(l.creditAmount) || 0),
      0,
    );
    return this.saveVoucher(tenantId, data, lines, totalDebit, totalCredit);
  }

  /** 分页查询 */
  async findAll(
    tenantId: string,
    query: VoucherQuery = {},
  ): Promise<{ items: ErpVoucher[]; total: number }> {
    const {
      status,
      voucherType,
      startDate,
      endDate,
      page = 1,
      pageSize = 20,
    } = query;

    const qb = this.voucherRepo
      .createQueryBuilder('v')
      .where('v.tenantId = :tenantId', { tenantId });

    if (status) qb.andWhere('v.status = :status', { status });
    if (voucherType)
      qb.andWhere('v.voucherType = :voucherType', { voucherType });
    if (startDate) qb.andWhere('v.voucherDate >= :startDate', { startDate });
    if (endDate) qb.andWhere('v.voucherDate <= :endDate', { endDate });

    qb.orderBy('v.voucherDate', 'DESC')
      .addOrderBy('v.voucherNo', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  /** 查询单张凭证（含分录） */
  async findOne(
    tenantId: string,
    id: string,
  ): Promise<ErpVoucher & { lines: ErpVoucherLine[] }> {
    const voucher = await this.voucherRepo.findOne({ where: { id, tenantId } });
    if (!voucher) throw new NotFoundException(`凭证 ${id} 不存在`);

    const lines = await this.lineRepo.find({
      where: { voucherId: id, tenantId },
      order: { lineNo: 'ASC' },
    });

    return { ...voucher, lines };
  }

  /** 审核：DRAFT → APPROVED */
  async approve(tenantId: string, id: string): Promise<ErpVoucher> {
    const voucher = await this.voucherRepo.findOne({ where: { id, tenantId } });
    if (!voucher) throw new NotFoundException(`凭证 ${id} 不存在`);
    if (voucher.status !== VoucherStatus.DRAFT) {
      throw new BadRequestException(
        `凭证状态为 ${voucher.status}，只有 DRAFT 状态可审核`,
      );
    }
    voucher.status = VoucherStatus.APPROVED;
    return this.voucherRepo.save(voucher);
  }

  /** 过账：APPROVED → POSTED */
  async post(tenantId: string, id: string): Promise<ErpVoucher> {
    const voucher = await this.voucherRepo.findOne({ where: { id, tenantId } });
    if (!voucher) throw new NotFoundException(`凭证 ${id} 不存在`);
    if (voucher.status !== VoucherStatus.APPROVED) {
      throw new BadRequestException(
        `凭证状态为 ${voucher.status}，只有 APPROVED 状态可过账`,
      );
    }
    voucher.status = VoucherStatus.POSTED;
    return this.voucherRepo.save(voucher);
  }

  /** 反过账：POSTED → REVERSED，同时生成红字冲销凭证 */
  async reverse(
    tenantId: string,
    id: string,
    createdBy?: string,
  ): Promise<ErpVoucher> {
    const voucher = await this.voucherRepo.findOne({ where: { id, tenantId } });
    if (!voucher) throw new NotFoundException(`凭证 ${id} 不存在`);
    if (voucher.status !== VoucherStatus.POSTED) {
      throw new BadRequestException(
        `凭证状态为 ${voucher.status}，只有 POSTED 状态可反过账`,
      );
    }

    const originalLines = await this.lineRepo.find({
      where: { voucherId: id, tenantId },
      order: { lineNo: 'ASC' },
    });

    await this.dataSource.transaction(async (manager) => {
      // 原凭证标记为 REVERSED
      await manager.update(
        ErpVoucher,
        { id },
        { status: VoucherStatus.REVERSED },
      );

      // 生成红字冲销凭证（借贷互换）
      const reversalNo = await this.generateVoucherNo(
        tenantId,
        voucher.voucherDate,
      );
      const reversal = manager.create(ErpVoucher, {
        tenantId,
        voucherNo: reversalNo,
        voucherDate: voucher.voucherDate,
        voucherType: voucher.voucherType,
        sourceType: voucher.sourceType,
        sourceId: voucher.sourceId,
        totalDebit: voucher.totalCredit, // 借贷互换
        totalCredit: voucher.totalDebit,
        status: VoucherStatus.POSTED,
        createdBy: createdBy ?? voucher.createdBy,
      });
      const savedReversal = await manager.save(ErpVoucher, reversal);

      const reversalLines = originalLines.map((l, idx) =>
        manager.create(ErpVoucherLine, {
          tenantId,
          voucherId: savedReversal.id,
          lineNo: idx + 1,
          accountId: l.accountId,
          debitAmount: Number(l.creditAmount), // 借贷互换
          creditAmount: Number(l.debitAmount),
          summary: l.summary,
        }),
      );
      await manager.save(ErpVoucherLine, reversalLines);
    });

    voucher.status = VoucherStatus.REVERSED;
    return voucher;
  }

  /** 按来源查询凭证 */
  async findBySource(
    tenantId: string,
    sourceType: string,
    sourceId: string,
  ): Promise<ErpVoucher[]> {
    return this.voucherRepo.find({
      where: { tenantId, sourceType, sourceId },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * 作废凭证（DRAFT → VOID）
   * 原数据库 FK CASCADE DELETE 已移除，此处在事务内手动级联删除分录行，
   * 确保凭证头与分录行的数据完整性不依赖数据库外键。
   */
  async void(tenantId: string, id: string): Promise<void> {
    const voucher = await this.voucherRepo.findOne({ where: { id, tenantId } });
    if (!voucher) throw new NotFoundException(`凭证 ${id} 不存在`);
    if (voucher.status !== VoucherStatus.DRAFT) {
      throw new BadRequestException(
        `凭证状态为 ${voucher.status}，只有 DRAFT 状态可作废`,
      );
    }

    await this.dataSource.transaction(async (manager) => {
      // 1. 先删除所有分录行（逻辑级联，替代数据库外键 CASCADE DELETE）
      await manager.delete(ErpVoucherLine, { voucherId: id, tenantId });
      // 2. 再删除凭证头
      await manager.delete(ErpVoucher, { id, tenantId });
    });
  }
}
