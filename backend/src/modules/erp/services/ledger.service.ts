import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ErpVoucher,
  VoucherStatus,
  VoucherType,
} from '../entities/erp-voucher.entity.js';
import { ErpVoucherLine } from '../entities/erp-voucher-line.entity.js';
import { ErpAccount } from '../entities/erp-account.entity.js';

// ── Query interfaces ──────────────────────────────────────────────────────────

export interface GeneralLedgerQuery {
  accountId?: string;
  startDate?: string;
  endDate?: string;
  period?: string; // YYYY-MM
}

export interface DetailLedgerQuery {
  accountId: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

export interface JournalQuery {
  startDate?: string;
  endDate?: string;
  voucherType?: VoucherType;
  page?: number;
  pageSize?: number;
}

// ── Result interfaces ─────────────────────────────────────────────────────────

export interface GeneralLedgerItem {
  accountId: string;
  accountCode: string;
  accountName: string;
  debitTotal: number;
  creditTotal: number;
  balance: number;
}

export interface DetailLedgerItem {
  voucherNo: string;
  voucherDate: string;
  summary: string;
  debitAmount: number;
  creditAmount: number;
  balance: number;
}

export interface BalanceSheetItem {
  accountId: string;
  accountCode: string;
  accountName: string;
  openingBalance: number;
  debitAmount: number;
  creditAmount: number;
  closingBalance: number;
}

export interface JournalLineItem {
  accountId: string;
  accountCode: string;
  accountName: string;
  summary: string;
  debitAmount: number;
  creditAmount: number;
}

export interface JournalItem {
  voucherNo: string;
  voucherDate: string;
  voucherType: VoucherType;
  lines: JournalLineItem[];
}

@Injectable()
export class LedgerService {
  constructor(
    @InjectRepository(ErpVoucher)
    private readonly voucherRepo: Repository<ErpVoucher>,
    @InjectRepository(ErpVoucherLine)
    private readonly lineRepo: Repository<ErpVoucherLine>,
    @InjectRepository(ErpAccount)
    private readonly accountRepo: Repository<ErpAccount>,
  ) {}

  // ── 辅助：加载科目 map ────────────────────────────────────────────────────

  private async loadAccountMap(
    tenantId: string,
  ): Promise<Map<string, ErpAccount>> {
    const accounts = await this.accountRepo.find({ where: { tenantId } });
    return new Map(accounts.map((a) => [a.id, a]));
  }

  // ── 1. 总账 ───────────────────────────────────────────────────────────────

  async getGeneralLedger(
    tenantId: string,
    query: GeneralLedgerQuery,
  ): Promise<GeneralLedgerItem[]> {
    const { accountId, startDate, endDate, period } = query;

    // period 优先：YYYY-MM → 推算起止日期
    let start = startDate;
    let end = endDate;
    if (period) {
      start = `${period}-01`;
      const [y, m] = period.split('-').map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      end = `${period}-${String(lastDay).padStart(2, '0')}`;
    }

    const qb = this.lineRepo
      .createQueryBuilder('l')
      .innerJoin(
        ErpVoucher,
        'v',
        'v.id = l.voucherId AND v.tenantId = l.tenantId',
      )
      .where('l.tenantId = :tenantId', { tenantId })
      .andWhere('v.status = :status', { status: VoucherStatus.POSTED })
      .select('l.accountId', 'accountId')
      .addSelect('SUM(l.debitAmount)', 'debitTotal')
      .addSelect('SUM(l.creditAmount)', 'creditTotal')
      .groupBy('l.accountId');

    if (accountId) qb.andWhere('l.accountId = :accountId', { accountId });
    if (start) qb.andWhere('v.voucherDate >= :start', { start });
    if (end) qb.andWhere('v.voucherDate <= :end', { end });

    const rows: Array<{
      accountId: string;
      debitTotal: string;
      creditTotal: string;
    }> = await qb.getRawMany();

    const accountMap = await this.loadAccountMap(tenantId);

    return rows.map((r) => {
      const acc = accountMap.get(r.accountId);
      const debitTotal = Number(r.debitTotal) || 0;
      const creditTotal = Number(r.creditTotal) || 0;
      return {
        accountId: r.accountId,
        accountCode: acc?.code ?? '',
        accountName: acc?.name ?? '',
        debitTotal,
        creditTotal,
        balance: debitTotal - creditTotal,
      };
    });
  }

  // ── 2. 明细账 ─────────────────────────────────────────────────────────────

  async getDetailLedger(
    tenantId: string,
    query: DetailLedgerQuery,
  ): Promise<{ items: DetailLedgerItem[]; total: number }> {
    const { accountId, startDate, endDate, page = 1, pageSize = 20 } = query;

    const qb = this.lineRepo
      .createQueryBuilder('l')
      .innerJoin(
        ErpVoucher,
        'v',
        'v.id = l.voucherId AND v.tenantId = l.tenantId',
      )
      .where('l.tenantId = :tenantId', { tenantId })
      .andWhere('l.accountId = :accountId', { accountId })
      .andWhere('v.status = :status', { status: VoucherStatus.POSTED })
      .select([
        'v.voucherNo    AS voucherNo',
        'v.voucherDate  AS voucherDate',
        'l.summary      AS summary',
        'l.debitAmount  AS debitAmount',
        'l.creditAmount AS creditAmount',
      ])
      .orderBy('v.voucherDate', 'ASC')
      .addOrderBy('v.voucherNo', 'ASC')
      .addOrderBy('l.lineNo', 'ASC');

    if (startDate) qb.andWhere('v.voucherDate >= :startDate', { startDate });
    if (endDate) qb.andWhere('v.voucherDate <= :endDate', { endDate });

    // 先取总数（不分页）
    const allRows: Array<{
      voucherNo: string;
      voucherDate: string;
      summary: string;
      debitAmount: string;
      creditAmount: string;
    }> = await qb.getRawMany();

    const total = allRows.length;

    // 计算累计余额后再分页
    let runningBalance = 0;
    const withBalance: DetailLedgerItem[] = allRows.map((r) => {
      const debit = Number(r.debitAmount) || 0;
      const credit = Number(r.creditAmount) || 0;
      runningBalance += debit - credit;
      return {
        voucherNo: r.voucherNo,
        voucherDate: r.voucherDate,
        summary: r.summary ?? '',
        debitAmount: debit,
        creditAmount: credit,
        balance: runningBalance,
      };
    });

    const start = (page - 1) * pageSize;
    const items = withBalance.slice(start, start + pageSize);

    return { items, total };
  }

  // ── 3. 科目余额表 ─────────────────────────────────────────────────────────

  async getBalanceSheet(
    tenantId: string,
    period: string,
  ): Promise<BalanceSheetItem[]> {
    const [y, m] = period.split('-').map(Number);
    const periodStart = `${period}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const periodEnd = `${period}-${String(lastDay).padStart(2, '0')}`;

    // 期初：period 开始日之前所有 POSTED 凭证
    const openingQb = this.lineRepo
      .createQueryBuilder('l')
      .innerJoin(
        ErpVoucher,
        'v',
        'v.id = l.voucherId AND v.tenantId = l.tenantId',
      )
      .where('l.tenantId = :tenantId', { tenantId })
      .andWhere('v.status = :status', { status: VoucherStatus.POSTED })
      .andWhere('v.voucherDate < :periodStart', { periodStart })
      .select('l.accountId', 'accountId')
      .addSelect('SUM(l.debitAmount)', 'debitTotal')
      .addSelect('SUM(l.creditAmount)', 'creditTotal')
      .groupBy('l.accountId');

    // 本期发生额
    const currentQb = this.lineRepo
      .createQueryBuilder('l')
      .innerJoin(
        ErpVoucher,
        'v',
        'v.id = l.voucherId AND v.tenantId = l.tenantId',
      )
      .where('l.tenantId = :tenantId', { tenantId })
      .andWhere('v.status = :status', { status: VoucherStatus.POSTED })
      .andWhere('v.voucherDate >= :periodStart', { periodStart })
      .andWhere('v.voucherDate <= :periodEnd', { periodEnd })
      .select('l.accountId', 'accountId')
      .addSelect('SUM(l.debitAmount)', 'debitTotal')
      .addSelect('SUM(l.creditAmount)', 'creditTotal')
      .groupBy('l.accountId');

    const [openingRows, currentRows] = await Promise.all([
      openingQb.getRawMany<{
        accountId: string;
        debitTotal: string;
        creditTotal: string;
      }>(),
      currentQb.getRawMany<{
        accountId: string;
        debitTotal: string;
        creditTotal: string;
      }>(),
    ]);

    // 合并到 accountId 维度
    const map = new Map<
      string,
      {
        openingDebit: number;
        openingCredit: number;
        debitAmount: number;
        creditAmount: number;
      }
    >();

    for (const r of openingRows) {
      map.set(r.accountId, {
        openingDebit: Number(r.debitTotal) || 0,
        openingCredit: Number(r.creditTotal) || 0,
        debitAmount: 0,
        creditAmount: 0,
      });
    }
    for (const r of currentRows) {
      const existing = map.get(r.accountId) ?? {
        openingDebit: 0,
        openingCredit: 0,
        debitAmount: 0,
        creditAmount: 0,
      };
      existing.debitAmount = Number(r.debitTotal) || 0;
      existing.creditAmount = Number(r.creditTotal) || 0;
      map.set(r.accountId, existing);
    }

    const accountMap = await this.loadAccountMap(tenantId);

    const result: BalanceSheetItem[] = [];
    for (const [accId, v] of map.entries()) {
      const acc = accountMap.get(accId);
      const openingBalance = v.openingDebit - v.openingCredit;
      const closingBalance = openingBalance + v.debitAmount - v.creditAmount;
      result.push({
        accountId: accId,
        accountCode: acc?.code ?? '',
        accountName: acc?.name ?? '',
        openingBalance,
        debitAmount: v.debitAmount,
        creditAmount: v.creditAmount,
        closingBalance,
      });
    }

    // 按科目编码排序
    result.sort((a, b) => a.accountCode.localeCompare(b.accountCode));
    return result;
  }

  // ── 4. 日记账 ─────────────────────────────────────────────────────────────

  async getJournal(
    tenantId: string,
    query: JournalQuery,
  ): Promise<{ items: JournalItem[]; total: number }> {
    const { startDate, endDate, voucherType, page = 1, pageSize = 20 } = query;

    // 先查凭证列表（分页）
    const vQb = this.voucherRepo
      .createQueryBuilder('v')
      .where('v.tenantId = :tenantId', { tenantId })
      .andWhere('v.status = :status', { status: VoucherStatus.POSTED })
      .orderBy('v.voucherDate', 'ASC')
      .addOrderBy('v.voucherNo', 'ASC');

    if (startDate) vQb.andWhere('v.voucherDate >= :startDate', { startDate });
    if (endDate) vQb.andWhere('v.voucherDate <= :endDate', { endDate });
    if (voucherType)
      vQb.andWhere('v.voucherType = :voucherType', { voucherType });

    const [vouchers, total] = await vQb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    if (vouchers.length === 0) return { items: [], total };

    const voucherIds = vouchers.map((v) => v.id);

    // 批量查分录
    const lines = await this.lineRepo
      .createQueryBuilder('l')
      .where('l.tenantId = :tenantId', { tenantId })
      .andWhere('l.voucherId IN (:...voucherIds)', { voucherIds })
      .orderBy('l.voucherId', 'ASC')
      .addOrderBy('l.lineNo', 'ASC')
      .getMany();

    const accountMap = await this.loadAccountMap(tenantId);

    // 按 voucherId 分组
    const linesByVoucher = new Map<string, ErpVoucherLine[]>();
    for (const l of lines) {
      const arr = linesByVoucher.get(l.voucherId) ?? [];
      arr.push(l);
      linesByVoucher.set(l.voucherId, arr);
    }

    const items: JournalItem[] = vouchers.map((v) => ({
      voucherNo: v.voucherNo,
      voucherDate: v.voucherDate,
      voucherType: v.voucherType,
      lines: (linesByVoucher.get(v.id) ?? []).map((l) => {
        const acc = accountMap.get(l.accountId);
        return {
          accountId: l.accountId,
          accountCode: acc?.code ?? '',
          accountName: acc?.name ?? '',
          summary: l.summary ?? '',
          debitAmount: Number(l.debitAmount) || 0,
          creditAmount: Number(l.creditAmount) || 0,
        };
      }),
    }));

    return { items, total };
  }
}
