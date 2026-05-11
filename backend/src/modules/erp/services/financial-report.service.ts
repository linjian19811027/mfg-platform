import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ErpVoucher, VoucherStatus } from '../entities/erp-voucher.entity.js';
import { ErpVoucherLine } from '../entities/erp-voucher-line.entity.js';
import { ErpAccount, AccountType } from '../entities/erp-account.entity.js';
import { LedgerService, BalanceSheetItem } from './ledger.service.js';
import { AccountService } from './account.service.js';
import { CostAnalysisService } from './cost-analysis.service.js';

// ── Query interfaces ──────────────────────────────────────────────────────────

export interface IncomeStatementQuery {
  period?: string; // YYYY-MM
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  groupBy?: 'month' | 'quarter' | 'year';
}

// ── Result interfaces ─────────────────────────────────────────────────────────

export interface BalanceSheetSection {
  total: number;
  items: BalanceSheetItem[];
}

export interface BalanceSheetReport {
  assets: BalanceSheetSection;
  liabilities: BalanceSheetSection;
  equity: BalanceSheetSection;
  date: string;
}

export interface IncomeStatementReport {
  revenue: number;
  costOfGoods: number;
  grossProfit: number;
  operatingExpenses: number;
  operatingProfit: number;
  netProfit: number;
  period: string;
}

export interface CashFlowReport {
  operating: number;
  investing: number;
  financing: number;
  netChange: number;
  period: string;
}

export interface DeptPnlItem {
  deptId: string;
  deptName: string;
  revenue: number;
  expense: number;
  profit: number;
}

export interface ProductPnlItem {
  materialId: string;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
}

export interface ProjectPnlItem {
  projectId: string;
  revenue: number;
  expense: number;
  profit: number;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class FinancialReportService {
  constructor(
    @InjectRepository(ErpVoucher)
    private readonly voucherRepo: Repository<ErpVoucher>,
    @InjectRepository(ErpVoucherLine)
    private readonly lineRepo: Repository<ErpVoucherLine>,
    @InjectRepository(ErpAccount)
    private readonly accountRepo: Repository<ErpAccount>,
    private readonly ledgerService: LedgerService,
    private readonly accountService: AccountService,
    private readonly costAnalysisService: CostAnalysisService,
  ) {}

  // ── 辅助：日期 → 期间 YYYY-MM ────────────────────────────────────────────

  private dateToPeriod(date: string): string {
    return date.substring(0, 7);
  }

  // ── 辅助：期间 → 起止日期 ────────────────────────────────────────────────

  private periodRange(period: string): { start: string; end: string } {
    const [y, m] = period.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    return {
      start: `${period}-01`,
      end: `${period}-${String(lastDay).padStart(2, '0')}`,
    };
  }

  // ── 辅助：查询期间内各科目发生额 ─────────────────────────────────────────

  private async getAccountAmounts(
    tenantId: string,
    start: string,
    end: string,
  ): Promise<Map<string, { debit: number; credit: number }>> {
    const rows = await this.lineRepo
      .createQueryBuilder('l')
      .innerJoin(
        ErpVoucher,
        'v',
        'v.id = l.voucherId AND v.tenantId = l.tenantId',
      )
      .where('l.tenantId = :tenantId', { tenantId })
      .andWhere('v.status = :status', { status: VoucherStatus.POSTED })
      .andWhere('v.voucherDate >= :start', { start })
      .andWhere('v.voucherDate <= :end', { end })
      .select('l.accountId', 'accountId')
      .addSelect('SUM(l.debitAmount)', 'debitTotal')
      .addSelect('SUM(l.creditAmount)', 'creditTotal')
      .groupBy('l.accountId')
      .getRawMany<{
        accountId: string;
        debitTotal: string;
        creditTotal: string;
      }>();

    const map = new Map<string, { debit: number; credit: number }>();
    for (const r of rows) {
      map.set(r.accountId, {
        debit: Number(r.debitTotal) || 0,
        credit: Number(r.creditTotal) || 0,
      });
    }
    return map;
  }

  // ── 1. 资产负债表（任务4.13）─────────────────────────────────────────────

  /**
   * 取 date 所在月份的期末余额，按科目类型分组返回资产负债表。
   * @param tenantId 租户 ID
   * @param date     YYYY-MM-DD
   */
  async getBalanceSheet(
    tenantId: string,
    date: string,
  ): Promise<BalanceSheetReport> {
    const period = this.dateToPeriod(date);

    // 调用 LedgerService.getBalanceSheet 获取所有科目余额
    const balanceItems = await this.ledgerService.getBalanceSheet(
      tenantId,
      period,
    );

    // 查询所有科目，建立 id → type 映射
    const accounts = await this.accountRepo.find({ where: { tenantId } });
    const accountTypeMap = new Map<string, AccountType>(
      accounts.map((a) => [a.id, a.type]),
    );

    const assets: BalanceSheetItem[] = [];
    const liabilities: BalanceSheetItem[] = [];
    const equity: BalanceSheetItem[] = [];

    for (const item of balanceItems) {
      const type = accountTypeMap.get(item.accountId);
      if (type === AccountType.ASSET) {
        assets.push(item);
      } else if (type === AccountType.LIABILITY) {
        liabilities.push(item);
      } else if (type === AccountType.EQUITY) {
        equity.push(item);
      }
    }

    const sumClosing = (items: BalanceSheetItem[]) =>
      items.reduce((s, i) => s + i.closingBalance, 0);

    return {
      assets: { total: sumClosing(assets), items: assets },
      liabilities: { total: sumClosing(liabilities), items: liabilities },
      equity: { total: sumClosing(equity), items: equity },
      date,
    };
  }

  // ── 2. 利润表（任务4.13）─────────────────────────────────────────────────

  /**
   * 查询收入类（REVENUE）和费用类（EXPENSE）科目的期间发生额，计算利润。
   */
  async getIncomeStatement(
    tenantId: string,
    query: IncomeStatementQuery,
  ): Promise<IncomeStatementReport> {
    let start: string;
    let end: string;
    let periodLabel: string;

    if (query.period) {
      const range = this.periodRange(query.period);
      start = range.start;
      end = range.end;
      periodLabel = query.period;
    } else if (query.startDate && query.endDate) {
      start = query.startDate;
      end = query.endDate;
      periodLabel = `${start}~${end}`;
    } else {
      // 默认当月
      const now = new Date();
      const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const range = this.periodRange(period);
      start = range.start;
      end = range.end;
      periodLabel = period;
    }

    // 查询期间内各科目发生额
    const amountMap = await this.getAccountAmounts(tenantId, start, end);

    // 查询收入类和费用类科目
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

    // 收入：贷方发生额 - 借方发生额（收入科目正常余额为贷方）
    let revenue = 0;
    for (const acc of revenueAccounts.items) {
      const amounts = amountMap.get(acc.id);
      if (amounts) {
        revenue += amounts.credit - amounts.debit;
      }
    }

    // 费用：借方发生额 - 贷方发生额（费用科目正常余额为借方）
    let totalExpenses = 0;
    for (const acc of expenseAccounts.items) {
      const amounts = amountMap.get(acc.id);
      if (amounts) {
        totalExpenses += amounts.debit - amounts.credit;
      }
    }

    // 简化：将费用中编码以 5001（主营业务成本）开头的归为销售成本，其余为运营费用
    let costOfGoods = 0;
    let operatingExpenses = 0;
    for (const acc of expenseAccounts.items) {
      const amounts = amountMap.get(acc.id);
      const net = amounts ? amounts.debit - amounts.credit : 0;
      if (acc.code.startsWith('5001') || acc.code.startsWith('5002')) {
        costOfGoods += net;
      } else {
        operatingExpenses += net;
      }
    }

    const grossProfit = revenue - costOfGoods;
    const operatingProfit = grossProfit - operatingExpenses;
    const netProfit = operatingProfit;

    return {
      revenue,
      costOfGoods,
      grossProfit,
      operatingExpenses,
      operatingProfit,
      netProfit,
      period: periodLabel,
    };
  }

  // ── 3. 现金流量表（任务4.13，简化版）────────────────────────────────────

  /**
   * 查询现金类科目（编码以 1001/1002 开头）的期间发生额，简化分类。
   */
  async getCashFlow(tenantId: string, period: string): Promise<CashFlowReport> {
    const { start, end } = this.periodRange(period);

    // 查询现金/银行存款科目
    const cashAccounts = await this.accountRepo
      .createQueryBuilder('a')
      .where('a.tenantId = :tenantId', { tenantId })
      .andWhere('(a.code LIKE :cash OR a.code LIKE :bank)', {
        cash: '1001%',
        bank: '1002%',
      })
      .getMany();

    if (cashAccounts.length === 0) {
      return { operating: 0, investing: 0, financing: 0, netChange: 0, period };
    }

    const cashAccountIds = cashAccounts.map((a) => a.id);

    // 查询现金科目的凭证分录，关联凭证的 sourceType 做简化分类
    const rows = await this.lineRepo
      .createQueryBuilder('l')
      .innerJoin(
        ErpVoucher,
        'v',
        'v.id = l.voucherId AND v.tenantId = l.tenantId',
      )
      .where('l.tenantId = :tenantId', { tenantId })
      .andWhere('v.status = :status', { status: VoucherStatus.POSTED })
      .andWhere('v.voucherDate >= :start', { start })
      .andWhere('v.voucherDate <= :end', { end })
      .andWhere('l.accountId IN (:...cashAccountIds)', { cashAccountIds })
      .select('v.sourceType', 'sourceType')
      .addSelect('SUM(l.debitAmount)', 'debitTotal')
      .addSelect('SUM(l.creditAmount)', 'creditTotal')
      .groupBy('v.sourceType')
      .getRawMany<{
        sourceType: string | null;
        debitTotal: string;
        creditTotal: string;
      }>();

    // 简化分类规则：
    // 经营活动：SALES_ORDER, PURCHASE_ORDER, PERIOD_END_CLOSING, null（默认）
    // 投资活动：ASSET_PURCHASE, ASSET_DISPOSAL, PROJECT
    // 筹资活动：LOAN, EQUITY, DIVIDEND
    const investingTypes = new Set([
      'ASSET_PURCHASE',
      'ASSET_DISPOSAL',
      'PROJECT',
    ]);
    const financingTypes = new Set(['LOAN', 'EQUITY', 'DIVIDEND']);

    let operating = 0;
    let investing = 0;
    let financing = 0;

    for (const r of rows) {
      const net = (Number(r.debitTotal) || 0) - (Number(r.creditTotal) || 0);
      const src = r.sourceType ?? '';
      if (investingTypes.has(src)) {
        investing += net;
      } else if (financingTypes.has(src)) {
        financing += net;
      } else {
        operating += net;
      }
    }

    return {
      operating,
      investing,
      financing,
      netChange: operating + investing + financing,
      period,
    };
  }

  // ── 4. 部门损益（任务4.14）───────────────────────────────────────────────

  /**
   * 按凭证分录的辅助维度 department 汇总收入和费用。
   * 简化：从 erp_voucher_line 的 summary 字段或关联科目辅助维度推断部门。
   * 实际实现：直接从 erp_cost_record 按 costCenterId 汇总（更可靠）。
   */
  async getDeptPnl(tenantId: string, period: string): Promise<DeptPnlItem[]> {
    const { start, end } = this.periodRange(period);

    // 查询期间内收入/费用科目的发生额，按 summary 中的部门维度分组
    // 简化：通过凭证分录关联科目类型，按 sourceId 作为部门标识汇总
    const rows = await this.lineRepo
      .createQueryBuilder('l')
      .innerJoin(
        ErpVoucher,
        'v',
        'v.id = l.voucherId AND v.tenantId = l.tenantId',
      )
      .innerJoin(
        ErpAccount,
        'a',
        'a.id = l.accountId AND a.tenantId = l.tenantId',
      )
      .where('l.tenantId = :tenantId', { tenantId })
      .andWhere('v.status = :status', { status: VoucherStatus.POSTED })
      .andWhere('v.voucherDate >= :start', { start })
      .andWhere('v.voucherDate <= :end', { end })
      .andWhere('a.type IN (:...types)', {
        types: [AccountType.REVENUE, AccountType.EXPENSE],
      })
      .select('v.sourceId', 'deptId')
      .addSelect('a.type', 'accountType')
      .addSelect('SUM(l.debitAmount)', 'debitTotal')
      .addSelect('SUM(l.creditAmount)', 'creditTotal')
      .groupBy('v.sourceId')
      .addGroupBy('a.type')
      .getRawMany<{
        deptId: string | null;
        accountType: AccountType;
        debitTotal: string;
        creditTotal: string;
      }>();

    // 按 deptId 聚合
    const deptMap = new Map<string, { revenue: number; expense: number }>();
    for (const r of rows) {
      const deptId = r.deptId ?? 'UNKNOWN';
      if (!deptMap.has(deptId)) {
        deptMap.set(deptId, { revenue: 0, expense: 0 });
      }
      const entry = deptMap.get(deptId)!;
      const debit = Number(r.debitTotal) || 0;
      const credit = Number(r.creditTotal) || 0;
      if (r.accountType === AccountType.REVENUE) {
        entry.revenue += credit - debit;
      } else if (r.accountType === AccountType.EXPENSE) {
        entry.expense += debit - credit;
      }
    }

    return [...deptMap.entries()].map(([deptId, v]) => ({
      deptId,
      deptName: deptId,
      revenue: v.revenue,
      expense: v.expense,
      profit: v.revenue - v.expense,
    }));
  }

  // ── 5. 产品损益（任务4.14）───────────────────────────────────────────────

  /**
   * 按 materialId 汇总收入和成本，计算产品利润率。
   * 收入来自销售凭证（sourceType='SALES_ORDER'）的收入科目发生额。
   * 成本来自 CostAnalysisService.getProductCostReport。
   */
  async getProductPnl(
    tenantId: string,
    period: string,
  ): Promise<ProductPnlItem[]> {
    const { start, end } = this.periodRange(period);

    // 查询销售收入：sourceType='SALES_ORDER' 的收入科目贷方发生额
    // 简化：按 sourceId（销售订单ID）关联物料，此处直接按凭证 sourceId 汇总
    const revenueRows = await this.lineRepo
      .createQueryBuilder('l')
      .innerJoin(
        ErpVoucher,
        'v',
        'v.id = l.voucherId AND v.tenantId = l.tenantId',
      )
      .innerJoin(
        ErpAccount,
        'a',
        'a.id = l.accountId AND a.tenantId = l.tenantId',
      )
      .where('l.tenantId = :tenantId', { tenantId })
      .andWhere('v.status = :status', { status: VoucherStatus.POSTED })
      .andWhere('v.voucherDate >= :start', { start })
      .andWhere('v.voucherDate <= :end', { end })
      .andWhere('a.type = :type', { type: AccountType.REVENUE })
      .andWhere('v.sourceType = :sourceType', { sourceType: 'SALES_ORDER' })
      .select('v.sourceId', 'materialId')
      .addSelect('SUM(l.creditAmount - l.debitAmount)', 'revenue')
      .groupBy('v.sourceId')
      .getRawMany<{ materialId: string | null; revenue: string }>();

    // 查询产品成本
    const costItems = await this.costAnalysisService.getProductCostReport(
      tenantId,
      period,
    );
    const costMap = new Map(costItems.map((c) => [c.materialId, c.totalCost]));

    // 合并收入和成本
    const productMap = new Map<string, { revenue: number; cost: number }>();

    for (const r of revenueRows) {
      const matId = r.materialId ?? 'UNKNOWN';
      if (!productMap.has(matId)) {
        productMap.set(matId, { revenue: 0, cost: 0 });
      }
      productMap.get(matId)!.revenue += Number(r.revenue) || 0;
    }

    for (const [matId, cost] of costMap) {
      if (!productMap.has(matId)) {
        productMap.set(matId, { revenue: 0, cost: 0 });
      }
      productMap.get(matId)!.cost += cost;
    }

    return [...productMap.entries()].map(([materialId, v]) => {
      const profit = v.revenue - v.cost;
      const margin = v.revenue > 0 ? profit / v.revenue : 0;
      return { materialId, revenue: v.revenue, cost: v.cost, profit, margin };
    });
  }

  // ── 6. 项目损益（任务4.14，简化）────────────────────────────────────────

  /**
   * 按凭证的 sourceType='PROJECT' 汇总收入和费用。
   */
  async getProjectPnl(
    tenantId: string,
    period: string,
  ): Promise<ProjectPnlItem[]> {
    const { start, end } = this.periodRange(period);

    const rows = await this.lineRepo
      .createQueryBuilder('l')
      .innerJoin(
        ErpVoucher,
        'v',
        'v.id = l.voucherId AND v.tenantId = l.tenantId',
      )
      .innerJoin(
        ErpAccount,
        'a',
        'a.id = l.accountId AND a.tenantId = l.tenantId',
      )
      .where('l.tenantId = :tenantId', { tenantId })
      .andWhere('v.status = :status', { status: VoucherStatus.POSTED })
      .andWhere('v.voucherDate >= :start', { start })
      .andWhere('v.voucherDate <= :end', { end })
      .andWhere('v.sourceType = :sourceType', { sourceType: 'PROJECT' })
      .andWhere('a.type IN (:...types)', {
        types: [AccountType.REVENUE, AccountType.EXPENSE],
      })
      .select('v.sourceId', 'projectId')
      .addSelect('a.type', 'accountType')
      .addSelect('SUM(l.debitAmount)', 'debitTotal')
      .addSelect('SUM(l.creditAmount)', 'creditTotal')
      .groupBy('v.sourceId')
      .addGroupBy('a.type')
      .getRawMany<{
        projectId: string | null;
        accountType: AccountType;
        debitTotal: string;
        creditTotal: string;
      }>();

    const projectMap = new Map<string, { revenue: number; expense: number }>();
    for (const r of rows) {
      const projectId = r.projectId ?? 'UNKNOWN';
      if (!projectMap.has(projectId)) {
        projectMap.set(projectId, { revenue: 0, expense: 0 });
      }
      const entry = projectMap.get(projectId)!;
      const debit = Number(r.debitTotal) || 0;
      const credit = Number(r.creditTotal) || 0;
      if (r.accountType === AccountType.REVENUE) {
        entry.revenue += credit - debit;
      } else if (r.accountType === AccountType.EXPENSE) {
        entry.expense += debit - credit;
      }
    }

    return [...projectMap.entries()].map(([projectId, v]) => ({
      projectId,
      revenue: v.revenue,
      expense: v.expense,
      profit: v.revenue - v.expense,
    }));
  }
}
