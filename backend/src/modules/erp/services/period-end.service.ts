import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ErpVoucher,
  VoucherStatus,
  VoucherType,
} from '../entities/erp-voucher.entity.js';
import { AccountType } from '../entities/erp-account.entity.js';
import { VoucherService } from './voucher.service.js';
import { LedgerService } from './ledger.service.js';
import { AccountService } from './account.service.js';

// ── 返回类型 ──────────────────────────────────────────────────────────────────

export interface ClosingTransferResult {
  voucher: ErpVoucher;
  transferAmount: number;
}

export interface ReconcileResult {
  balanced: boolean;
  totalDebit: number;
  totalCredit: number;
  diff: number;
}

export interface LockPeriodResult {
  locked: boolean;
  postedCount: number;
  period: string;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class PeriodEndService {
  private readonly logger = new Logger(PeriodEndService.name);

  constructor(
    @InjectRepository(ErpVoucher)
    private readonly voucherRepo: Repository<ErpVoucher>,
    private readonly voucherService: VoucherService,
    private readonly ledgerService: LedgerService,
    private readonly accountService: AccountService,
  ) {}

  // ── 辅助：期间 YYYY-MM → 起止日期 ────────────────────────────────────────

  private periodRange(period: string): { start: string; end: string } {
    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      throw new Error('期间格式必须为 YYYY-MM');
    }
    const [y, m] = period.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    return {
      start: `${period}-01`,
      end: `${period}-${String(lastDay).padStart(2, '0')}`,
    };
  }

  // ── 1. 期末结转（损益结转） ───────────────────────────────────────────────

  /**
   * 将期间内所有收入类科目和费用类科目的余额结转至"本年利润"（3131）。
   * 生成结转凭证并返回凭证及结转金额。
   */
  async closingTransfer(
    tenantId: string,
    period: string,
  ): Promise<ClosingTransferResult> {
    const { start, end } = this.periodRange(period);

    // 查询期间总账（仅 POSTED 凭证）
    const ledger = await this.ledgerService.getGeneralLedger(tenantId, {
      startDate: start,
      endDate: end,
    });

    // 查询所有收入/费用科目
    const [revenueAccounts, expenseAccounts] = await Promise.all([
      this.accountService.findAll(tenantId, {
        type: AccountType.REVENUE,
        pageSize: 1000,
      }),
      this.accountService.findAll(tenantId, {
        type: AccountType.EXPENSE,
        pageSize: 1000,
      }),
    ]);

    const revenueIds = new Set(revenueAccounts.items.map((a) => a.id));
    const expenseIds = new Set(expenseAccounts.items.map((a) => a.id));

    // 按科目 ID 建立余额 map（debit - credit）
    const balanceMap = new Map<string, number>();
    for (const row of ledger) {
      balanceMap.set(row.accountId, row.balance);
    }

    // 本年利润科目（3131）
    const profitAccount = await this.accountService.getByCode(tenantId, '3131');
    const profitAccountId = String(profitAccount.id);

    // 构建凭证分录
    // 收入类：借：收入科目（冲销贷方余额），贷：本年利润
    // 费用类：借：本年利润，贷：费用科目（冲销借方余额）
    const lines: Array<{
      accountId: string;
      debitAmount?: number;
      creditAmount?: number;
      summary: string;
    }> = [];

    let totalRevenue = 0;
    let totalExpense = 0;

    for (const acc of revenueAccounts.items) {
      // 收入科目余额为贷方（balance = credit - debit，此处 balance = debit - credit 为负）
      // 实际贷方余额 = -(balance)，即 creditBalance = -balance
      const balance = balanceMap.get(acc.id) ?? 0;
      const creditBalance = -balance; // 收入科目正常余额为贷方，balance 为负
      if (creditBalance > 0.0001) {
        lines.push({
          accountId: acc.id,
          debitAmount: creditBalance,
          summary: `期末结转-${period}-${acc.name}`,
        });
        totalRevenue += creditBalance;
      }
    }

    // 收入合计贷：本年利润
    if (totalRevenue > 0.0001) {
      lines.push({
        accountId: profitAccountId,
        creditAmount: totalRevenue,
        summary: `期末结转收入-${period}`,
      });
    }

    for (const acc of expenseAccounts.items) {
      // 费用科目余额为借方（balance = debit - credit 为正）
      const balance = balanceMap.get(acc.id) ?? 0;
      if (balance > 0.0001) {
        lines.push({
          accountId: acc.id,
          creditAmount: balance,
          summary: `期末结转-${period}-${acc.name}`,
        });
        totalExpense += balance;
      }
    }

    // 费用合计借：本年利润
    if (totalExpense > 0.0001) {
      lines.push({
        accountId: profitAccountId,
        debitAmount: totalExpense,
        summary: `期末结转费用-${period}`,
      });
    }

    const transferAmount = Math.max(totalRevenue, totalExpense);

    // 若无需结转（无收入也无费用），生成空凭证
    if (lines.length === 0) {
      this.logger.warn(`期间 ${period} 无收入/费用科目余额，跳过结转`);
      lines.push(
        {
          accountId: profitAccountId,
          debitAmount: 0,
          summary: `期末结转-${period}（无余额）`,
        },
        {
          accountId: profitAccountId,
          creditAmount: 0,
          summary: `期末结转-${period}（无余额）`,
        },
      );
    }

    const voucher = await this.voucherService.createAuto(
      tenantId,
      {
        voucherDate: this.periodRange(period).end,
        voucherType: VoucherType.TRANSFER,
        sourceType: 'PERIOD_END_CLOSING',
        sourceId: period,
      },
      lines,
    );

    this.logger.log(
      `期末结转凭证已生成：${voucher.voucherNo}，结转金额：${transferAmount}`,
    );

    return { voucher, transferAmount };
  }

  // ── 2. 期末对账 ───────────────────────────────────────────────────────────

  /**
   * 验证期间内所有 POSTED 凭证的借贷总额是否平衡。
   */
  async reconcile(tenantId: string, period: string): Promise<ReconcileResult> {
    const { start, end } = this.periodRange(period);

    const rows = await this.voucherRepo
      .createQueryBuilder('v')
      .where('v.tenantId = :tenantId', { tenantId })
      .andWhere('v.status = :status', { status: VoucherStatus.POSTED })
      .andWhere('v.voucherDate >= :start', { start })
      .andWhere('v.voucherDate <= :end', { end })
      .select('SUM(v.totalDebit)', 'totalDebit')
      .addSelect('SUM(v.totalCredit)', 'totalCredit')
      .getRawOne<{ totalDebit: string; totalCredit: string }>();

    const totalDebit = Number(rows?.totalDebit) || 0;
    const totalCredit = Number(rows?.totalCredit) || 0;
    const diff = Math.abs(totalDebit - totalCredit);
    const balanced = diff < 0.0001;

    this.logger.log(
      `期末对账 ${period}：借方合计=${totalDebit}，贷方合计=${totalCredit}，差额=${diff}，平衡=${balanced}`,
    );

    return { balanced, totalDebit, totalCredit, diff };
  }

  // ── 3. 期末结账（锁定期间） ───────────────────────────────────────────────

  /**
   * 将期间内所有 APPROVED 状态的凭证批量过账（APPROVED → POSTED）。
   * 简化实现：不维护独立的期间锁定表，以"无 APPROVED 凭证"作为锁定标志。
   */
  async lockPeriod(
    tenantId: string,
    period: string,
  ): Promise<LockPeriodResult> {
    const { start, end } = this.periodRange(period);

    const approvedVouchers = await this.voucherRepo.find({
      where: {
        tenantId,
        status: VoucherStatus.APPROVED,
      },
      select: ['id', 'voucherDate'],
    });

    // 过滤出期间内的凭证
    const inPeriod = approvedVouchers.filter(
      (v) => v.voucherDate >= start && v.voucherDate <= end,
    );

    let postedCount = 0;
    for (const v of inPeriod) {
      await this.voucherRepo.update(
        { id: v.id, tenantId },
        { status: VoucherStatus.POSTED },
      );
      postedCount++;
    }

    this.logger.log(`期末结账 ${period}：已过账 ${postedCount} 张凭证`);

    return { locked: true, postedCount, period };
  }

  // ── 4. 检查期间是否已锁定 ─────────────────────────────────────────────────

  /**
   * 简化实现：若期间内不存在 DRAFT 凭证，则视为已锁定。
   */
  async isPeriodLocked(tenantId: string, period: string): Promise<boolean> {
    const { start, end } = this.periodRange(period);

    const draftCount = await this.voucherRepo
      .createQueryBuilder('v')
      .where('v.tenantId = :tenantId', { tenantId })
      .andWhere('v.status = :status', { status: VoucherStatus.DRAFT })
      .andWhere('v.voucherDate >= :start', { start })
      .andWhere('v.voucherDate <= :end', { end })
      .getCount();

    return draftCount === 0;
  }
}
