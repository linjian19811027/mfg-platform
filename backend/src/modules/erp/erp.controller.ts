import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

import { CurrentTenant } from '../auth/decorators/current-tenant.decorator.js';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomerService } from './services/customer.service.js';
import { QuotationService } from './services/quotation.service.js';
import { SalesOrderService } from './services/sales-order.service.js';
import { ShipmentService } from './services/shipment.service.js';
import { SalesReturnService } from './services/sales-return.service.js';
import { ErpReconciliationService } from './services/erp-reconciliation.service.js';
import { ReceivableService } from './services/receivable.service.js';
import { PayableService } from './services/payable.service.js';
import { ErpAnalyticsService } from './services/erp-analytics.service.js';
import { AccountService } from './services/account.service.js';
import { VoucherService } from './services/voucher.service.js';
import { LedgerService } from './services/ledger.service.js';
import { CostCenterService } from './services/cost-center.service.js';
import { StandardCostService } from './services/standard-cost.service.js';
import { CostService } from './services/cost.service.js';
import { CostAnalysisService } from './services/cost-analysis.service.js';
import { PeriodEndService } from './services/period-end.service.js';
import { FinancialReportService } from './services/financial-report.service.js';
import { ErpCostElement } from './entities/erp-cost-element.entity.js';
import {
  CostElementQueryDto,
  CreateCostElementDto,
} from './dto/cost-element.dto.js';

@ApiTags('ERP 企业资源计划')
@ApiBearerAuth()
@Controller('api/v1/erp')
export class ErpController {
  constructor(
    private readonly customerSvc: CustomerService,
    private readonly quotationSvc: QuotationService,
    private readonly soSvc: SalesOrderService,
    private readonly shipmentSvc: ShipmentService,
    private readonly returnSvc: SalesReturnService,
    private readonly reconSvc: ErpReconciliationService,
    private readonly receivableSvc: ReceivableService,
    private readonly payableSvc: PayableService,
    private readonly analyticsSvc: ErpAnalyticsService,
    private readonly accountSvc: AccountService,
    private readonly voucherSvc: VoucherService,
    private readonly ledgerSvc: LedgerService,
    private readonly costCenterSvc: CostCenterService,
    private readonly stdCostSvc: StandardCostService,
    private readonly costSvc: CostService,
    private readonly costAnalysisSvc: CostAnalysisService,
    private readonly periodEndSvc: PeriodEndService,
    private readonly financialReportSvc: FinancialReportService,
    @InjectRepository(ErpCostElement)
    private readonly costElementRepo: Repository<ErpCostElement>,
  ) {}

  // ── 客户 ──────────────────────────────────────────────────────────────────

  @Get('customers')
  @ApiOperation({ summary: '客户列表' })
  getCustomers(
    @CurrentTenant() tenantId: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('keyword') keyword?: string,
  ) {
    return this.customerSvc.findAll(tenantId, {
      type: type as any,
      status: status as any,
      keyword,
    });
  }

  @Post('customers')
  @ApiOperation({ summary: '创建客户' })
  createCustomer(
    @CurrentTenant() tenantId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.customerSvc.create(tenantId, body);
  }

  @Get('customers/:id')
  @ApiOperation({ summary: '客户详情' })
  getCustomer(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.customerSvc.findOne(tenantId, id);
  }

  @Patch('customers/:id')
  @ApiOperation({ summary: '更新客户' })
  updateCustomer(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.customerSvc.update(tenantId, id, body);
  }

  @Delete('customers/:id')
  @ApiOperation({ summary: '删除客户' })
  removeCustomer(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.customerSvc.remove(tenantId, id);
  }

  @Get('customers/:id/quotation-history')
  @ApiOperation({ summary: '客户历史报价' })
  getQuotationHistory(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    return this.customerSvc.getQuotationHistory(
      tenantId,
      id,
      limit ? Number(limit) : 10,
    );
  }

  @Post('customers/:id/credit-check')
  @ApiOperation({ summary: '信用额度校验' })
  checkCredit(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() body: { orderAmount: number },
  ) {
    return this.customerSvc.checkCreditLimit(tenantId, id, body.orderAmount);
  }

  @Patch('customers/:id/credit-limit')
  @ApiOperation({ summary: '更新信用额度' })
  updateCreditLimit(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() body: { creditLimit: number },
  ) {
    return this.customerSvc.updateCreditLimit(tenantId, id, body.creditLimit);
  }

  // ── 报价 ──────────────────────────────────────────────────────────────────

  @Get('quotations')
  @ApiOperation({ summary: '报价单列表' })
  getQuotations(
    @CurrentTenant() tenantId: string,
    @Query() query: Record<string, unknown>,
  ) {
    return this.quotationSvc.findAll(tenantId, query);
  }

  @Post('quotations')
  @ApiOperation({ summary: '创建报价单' })
  createQuotation(
    @CurrentTenant() tenantId: string,
    @Body() body: Parameters<QuotationService['create']>[1],
  ) {
    return this.quotationSvc.create(tenantId, body);
  }

  @Get('quotations/:id')
  @ApiOperation({ summary: '报价单详情' })
  getQuotation(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.quotationSvc.findOne(tenantId, id);
  }

  @Patch('quotations/:id/send')
  @ApiOperation({ summary: '发送报价单' })
  sendQuotation(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.quotationSvc.send(tenantId, id);
  }

  @Patch('quotations/:id/accept')
  @ApiOperation({ summary: '接受报价单' })
  acceptQuotation(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.quotationSvc.accept(tenantId, id);
  }

  @Patch('quotations/:id/reject')
  @ApiOperation({ summary: '拒绝报价单' })
  rejectQuotation(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.quotationSvc.reject(tenantId, id);
  }

  @Post('quotations/:id/convert')
  @ApiOperation({ summary: '报价单转销售订单' })
  convertQuotation(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() body: { createdBy?: string },
  ) {
    return this.quotationSvc.convertToOrder(tenantId, id, body.createdBy);
  }

  // ── 销售订单 ──────────────────────────────────────────────────────────────

  @Get('sales-orders')
  @ApiOperation({ summary: '销售订单列表' })
  getSalesOrders(
    @CurrentTenant() tenantId: string,
    @Query() query: Record<string, unknown>,
  ) {
    return this.soSvc.findAll(tenantId, query);
  }

  @Post('sales-orders')
  @ApiOperation({ summary: '创建销售订单' })
  createSalesOrder(
    @CurrentTenant() tenantId: string,
    @Body() body: Record<string, unknown>,
  ) {
    // 兼容 { data, lines } 和扁平对象两种格式
    const data = (body.data as Record<string, unknown>) ?? body;
    const lines = (body.lines as Record<string, unknown>[]) ?? [];
    return this.soSvc.create(tenantId, data as any, lines as any);
  }

  @Get('sales-orders/:id')
  @ApiOperation({ summary: '销售订单详情' })
  getSalesOrder(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.soSvc.findOne(tenantId, id);
  }

  @Patch('sales-orders/:id/confirm')
  @ApiOperation({ summary: '确认销售订单' })
  confirmSalesOrder(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.soSvc.confirm(tenantId, id);
  }

  @Patch('sales-orders/:id/change')
  @ApiOperation({ summary: '变更销售订单' })
  changeSalesOrder(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() body: { changes: Parameters<SalesOrderService['changeOrder']>[2]; changedBy: string; reason: string },
  ) {
    return this.soSvc.changeOrder(
      tenantId,
      id,
      body.changes,
      body.changedBy,
      body.reason,
    );
  }

  @Get('sales-orders/:id/progress')
  @ApiOperation({ summary: '订单进度跟踪' })
  getSalesOrderProgress(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.soSvc.getProgress(tenantId, id);
  }

  // ── 发货 ──────────────────────────────────────────────────────────────────

  @Get('shipments')
  @ApiOperation({ summary: '发货单列表' })
  getShipments(
    @CurrentTenant() tenantId: string,
    @Query() query: Record<string, unknown>,
  ) {
    return this.shipmentSvc.findAll(tenantId, query);
  }

  @Post('shipments')
  @ApiOperation({ summary: '创建发货单' })
  createShipment(@CurrentTenant() tenantId: string, @Body() body: Parameters<ShipmentService['create']>[1]) {
    return this.shipmentSvc.create(tenantId, body);
  }

  @Patch('shipments/:id/ship')
  @ApiOperation({ summary: '确认发货' })
  ship(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.shipmentSvc.ship(tenantId, id);
  }

  @Put('shipments/:id/logistics')
  @ApiOperation({ summary: '更新物流信息' })
  updateLogistics(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() body: Parameters<ShipmentService['updateLogistics']>[2],
  ) {
    return this.shipmentSvc.updateLogistics(tenantId, id, body);
  }

  @Patch('shipments/:id/confirm-delivery')
  @ApiOperation({ summary: '签收确认' })
  confirmDelivery(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.shipmentSvc.confirmDelivery(tenantId, id);
  }

  // ── 销售退货 ──────────────────────────────────────────────────────────────

  @Get('sales-returns')
  @ApiOperation({ summary: '销售退货列表' })
  getSalesReturns(
    @CurrentTenant() tenantId: string,
    @Query() query: Record<string, unknown>,
  ) {
    return this.returnSvc.findAll(tenantId, query);
  }

  @Post('sales-returns')
  @ApiOperation({ summary: '创建销售退货' })
  createSalesReturn(@CurrentTenant() tenantId: string, @Body() body: Parameters<SalesReturnService['create']>[1]) {
    return this.returnSvc.create(tenantId, body);
  }

  @Get('sales-returns/:id')
  @ApiOperation({ summary: '销售退货详情' })
  getSalesReturn(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.returnSvc.findOne(tenantId, id);
  }

  @Patch('sales-returns/:id/start-inspection')
  @ApiOperation({ summary: '开始质检' })
  startInspection(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.returnSvc.startInspection(tenantId, id);
  }

  @Patch('sales-returns/:id/accept')
  @ApiOperation({ summary: '质检通过' })
  acceptReturn(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.returnSvc.accept(tenantId, id);
  }

  @Patch('sales-returns/:id/reject')
  @ApiOperation({ summary: '质检拒绝' })
  rejectReturn(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() body: { reason: string },
  ) {
    return this.returnSvc.reject(tenantId, id, body.reason);
  }

  // ── 销售对账 ──────────────────────────────────────────────────────────────

  @Get('sales-reconciliations')
  @ApiOperation({ summary: '销售对账单列表' })
  getReconciliations(
    @CurrentTenant() tenantId: string,
    @Query() query: Record<string, unknown>,
  ) {
    return this.reconSvc.findAll(tenantId, query);
  }

  @Post('sales-reconciliations')
  @ApiOperation({ summary: '创建销售对账单' })
  createReconciliation(@CurrentTenant() tenantId: string, @Body() body: Parameters<ErpReconciliationService['create']>[1]) {
    return this.reconSvc.create(tenantId, body);
  }

  @Get('sales-reconciliations/:id')
  @ApiOperation({ summary: '销售对账单详情' })
  getReconciliation(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.reconSvc.findOne(tenantId, id);
  }

  @Patch('sales-reconciliations/:id/confirm')
  @ApiOperation({ summary: '确认销售对账' })
  confirmReconciliation(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.reconSvc.confirm(tenantId, id);
  }

  // ── 应收账款 ──────────────────────────────────────────────────────────────

  @Get('receivables')
  @ApiOperation({ summary: '应收账款列表' })
  getReceivables(
    @CurrentTenant() tenantId: string,
    @Query() query: Record<string, unknown>,
  ) {
    return this.receivableSvc.findAll(tenantId, query);
  }

  @Get('receivables/aging')
  @ApiOperation({ summary: '应收账款账龄分析' })
  getAgingAnalysis(@CurrentTenant() tenantId: string) {
    return this.receivableSvc.getAgingAnalysis(tenantId);
  }

  @Get('receivables/reminders')
  @ApiOperation({ summary: '催收提醒' })
  getReminders(
    @CurrentTenant() tenantId: string,
    @Query('daysAhead') daysAhead?: string,
  ) {
    return this.receivableSvc.getOverdueReminders(
      tenantId,
      daysAhead ? Number(daysAhead) : 7,
    );
  }

  @Patch('receivables/:id/payment')
  @ApiOperation({ summary: '记录收款' })
  recordReceivablePayment(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() body: { paidAmount: number },
  ) {
    return this.receivableSvc.recordPayment(tenantId, id, body.paidAmount);
  }

  // ── 应付账款 ──────────────────────────────────────────────────────────────

  @Get('payables')
  @ApiOperation({ summary: '应付账款列表' })
  getPayables(
    @CurrentTenant() tenantId: string,
    @Query() query: Record<string, unknown>,
  ) {
    return this.payableSvc.findAll(tenantId, query);
  }

  @Get('payables/:id')
  @ApiOperation({ summary: '应付账款详情' })
  getPayable(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.payableSvc.findOne(tenantId, id);
  }

  @Get('payables/:id/payment-plan')
  @ApiOperation({ summary: '付款计划' })
  getPaymentPlan(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.payableSvc.getPaymentPlan(tenantId, id);
  }

  @Patch('payables/:id/payment')
  @ApiOperation({ summary: '记录付款' })
  recordPayablePayment(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() body: { paidAmount: number },
  ) {
    return this.payableSvc.recordPayment(tenantId, id, body.paidAmount);
  }

  @Patch('payables/:id/payment-plan/:index')
  @ApiOperation({ summary: '更新付款计划项' })
  updatePaymentPlanItem(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Param('index') index: string,
    @Body() body: { status: 'PENDING' | 'PAID' },
  ) {
    return this.payableSvc.updatePaymentPlanItem(
      tenantId,
      id,
      Number(index),
      body.status,
    );
  }

  // ── 分析 ──────────────────────────────────────────────────────────────────

  @Get('analytics/sales-trend')
  @ApiOperation({ summary: '销售趋势分析' })
  getSalesTrend(
    @CurrentTenant() tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('groupBy') groupBy: 'month' | 'quarter' | 'year' = 'month',
  ) {
    return this.analyticsSvc.getSalesTrend(tenantId, {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      groupBy,
    });
  }

  @Get('analytics/customers')
  @ApiOperation({ summary: '客户分析' })
  getCustomerAnalysis(
    @CurrentTenant() tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
  ) {
    return this.analyticsSvc.getCustomerAnalysis(tenantId, {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: limit ? Number(limit) : 20,
    });
  }

  @Get('analytics/products')
  @ApiOperation({ summary: '产品分析' })
  getProductAnalysis(
    @CurrentTenant() tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
  ) {
    return this.analyticsSvc.getProductAnalysis(tenantId, {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: limit ? Number(limit) : 20,
    });
  }

  @Get('analytics/regions')
  @ApiOperation({ summary: '区域分析' })
  getRegionAnalysis(
    @CurrentTenant() tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.analyticsSvc.getRegionAnalysis(tenantId, {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  // ── 科目 ──────────────────────────────────────────────────────────────────

  @Get('accounts')
  @ApiOperation({ summary: '科目列表' })
  getAccounts(
    @CurrentTenant() tenantId: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('keyword') keyword?: string,
  ) {
    type AccountFindAllQuery = NonNullable<Parameters<AccountService['findAll']>[1]>;
    return this.accountSvc.findAll(tenantId, {
      type: type as AccountFindAllQuery['type'],
      status: status as AccountFindAllQuery['status'],
      keyword,
    });
  }

  @Post('accounts')
  @ApiOperation({ summary: '创建科目' })
  createAccount(
    @CurrentTenant() tenantId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.accountSvc.create(tenantId, body);
  }

  @Get('accounts/tree')
  @ApiOperation({ summary: '科目树' })
  getAccountTree(@CurrentTenant() tenantId: string) {
    return this.accountSvc.buildTree(tenantId);
  }

  @Get('accounts/:id')
  @ApiOperation({ summary: '科目详情' })
  getAccount(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.accountSvc.findOne(tenantId, id);
  }

  @Patch('accounts/:id')
  @ApiOperation({ summary: '更新科目' })
  updateAccount(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.accountSvc.update(tenantId, id, body);
  }

  @Patch('accounts/:id/dimensions')
  @ApiOperation({ summary: '更新辅助核算维度' })
  updateAccountDimensions(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() body: { dimensions: Record<string, unknown> },
  ) {
    return this.accountSvc.updateAuxiliaryDimensions(
      tenantId,
      id,
      body.dimensions,
    );
  }

  // ── 凭证 ──────────────────────────────────────────────────────────────────

  @Get('vouchers')
  @ApiOperation({ summary: '凭证列表' })
  getVouchers(
    @CurrentTenant() tenantId: string,
    @Query('status') status?: string,
    @Query('voucherType') voucherType?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    type VoucherFindAllQuery = NonNullable<Parameters<VoucherService['findAll']>[1]>;
    return this.voucherSvc.findAll(tenantId, {
      status: status as VoucherFindAllQuery['status'],
      voucherType: voucherType as VoucherFindAllQuery['voucherType'],
      startDate,
      endDate,
    });
  }

  @Post('vouchers')
  @ApiOperation({ summary: '手工创建凭证' })
  createVoucher(
    @CurrentTenant() tenantId: string,
    @Body() body: { data: Parameters<VoucherService['create']>[1]; lines: Parameters<VoucherService['create']>[2] },
  ) {
    return this.voucherSvc.create(tenantId, body.data, body.lines);
  }

  @Get('vouchers/by-source')
  @ApiOperation({ summary: '按来源查询凭证' })
  getVouchersBySource(
    @CurrentTenant() tenantId: string,
    @Query('sourceType') sourceType: string,
    @Query('sourceId') sourceId: string,
  ) {
    return this.voucherSvc.findBySource(tenantId, sourceType, sourceId);
  }

  @Get('vouchers/:id')
  @ApiOperation({ summary: '凭证详情' })
  getVoucher(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.voucherSvc.findOne(tenantId, id);
  }

  @Patch('vouchers/:id/approve')
  @ApiOperation({ summary: '审核凭证' })
  approveVoucher(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.voucherSvc.approve(tenantId, id);
  }

  @Patch('vouchers/:id/post')
  @ApiOperation({ summary: '过账凭证' })
  postVoucher(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.voucherSvc.post(tenantId, id);
  }

  @Patch('vouchers/:id/reverse')
  @ApiOperation({ summary: '反过账凭证' })
  reverseVoucher(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() body: { createdBy?: string },
  ) {
    return this.voucherSvc.reverse(tenantId, id, body.createdBy);
  }

  // ── 账簿 ──────────────────────────────────────────────────────────────────

  @Get('ledger/general')
  @ApiOperation({ summary: '总账' })
  getGeneralLedger(
    @CurrentTenant() tenantId: string,
    @Query('accountId') accountId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('period') period?: string,
  ) {
    return this.ledgerSvc.getGeneralLedger(tenantId, {
      accountId,
      startDate,
      endDate,
      period,
    });
  }

  @Get('ledger/detail')
  @ApiOperation({ summary: '明细账' })
  getDetailLedger(
    @CurrentTenant() tenantId: string,
    @Query('accountId') accountId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.ledgerSvc.getDetailLedger(tenantId, {
      accountId,
      startDate,
      endDate,
    });
  }

  @Get('ledger/balance-sheet-accounts')
  @ApiOperation({ summary: '科目余额表' })
  getBalanceSheetAccounts(
    @CurrentTenant() tenantId: string,
    @Query('period') period: string,
  ) {
    return this.ledgerSvc.getBalanceSheet(tenantId, period);
  }

  @Get('ledger/journal')
  @ApiOperation({ summary: '日记账' })
  getJournal(
    @CurrentTenant() tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('voucherType') voucherType?: string,
  ) {
    type JournalQuery = Parameters<LedgerService['getJournal']>[1];
    return this.ledgerSvc.getJournal(tenantId, {
      startDate,
      endDate,
      voucherType: voucherType as JournalQuery['voucherType'],
    });
  }

  // ── 成本中心 ──────────────────────────────────────────────────────────────

  @Get('cost-centers')
  @ApiOperation({ summary: '成本中心列表' })
  getCostCenters(@CurrentTenant() tenantId: string) {
    return this.costCenterSvc.findAll(tenantId);
  }

  @Post('cost-centers')
  @ApiOperation({ summary: '创建成本中心' })
  createCostCenter(
    @CurrentTenant() tenantId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.costCenterSvc.create(tenantId, body);
  }

  @Get('cost-centers/tree')
  @ApiOperation({ summary: '成本中心树' })
  getCostCenterTree(@CurrentTenant() tenantId: string) {
    return this.costCenterSvc.buildTree(tenantId);
  }

  // ── 标准成本 ──────────────────────────────────────────────────────────────

  @Get('standard-costs')
  @ApiOperation({ summary: '标准成本列表' })
  getStandardCosts(
    @CurrentTenant() tenantId: string,
    @Query('materialId') materialId?: string,
  ) {
    return this.stdCostSvc.findAll(tenantId, { materialId });
  }

  @Post('standard-costs')
  @ApiOperation({ summary: '创建标准成本' })
  createStandardCost(@CurrentTenant() tenantId: string, @Body() body: Parameters<StandardCostService['create']>[1]) {
    return this.stdCostSvc.create(tenantId, body);
  }

  @Post('standard-costs/calculate')
  @ApiOperation({ summary: 'BOM 成本卷积' })
  calculateStandardCost(
    @CurrentTenant() tenantId: string,
    @Body()
    body: {
      materialId: string;
      bomLines: Parameters<StandardCostService['calculateFromBom']>[2];
      laborQuota: number;
      overheadRate: number;
    },
  ) {
    return this.stdCostSvc.calculateFromBom(
      tenantId,
      body.materialId,
      body.bomLines,
      body.laborQuota,
      body.overheadRate,
    );
  }

  // ── 成本分析 ──────────────────────────────────────────────────────────────

  @Get('cost-analysis/variance')
  @ApiOperation({ summary: '成本差异分析' })
  getCostVariance(
    @CurrentTenant() tenantId: string,
    @Query('period') period: string,
    @Query('materialId') materialId?: string,
  ) {
    return this.costAnalysisSvc.getVarianceAnalysis(
      tenantId,
      period,
      materialId,
    );
  }

  @Get('cost-analysis/product-cost')
  @ApiOperation({ summary: '产品成本表' })
  getProductCost(
    @CurrentTenant() tenantId: string,
    @Query('period') period: string,
  ) {
    return this.costAnalysisSvc.getProductCostReport(tenantId, period);
  }

  @Get('cost-analysis/cost-breakdown')
  @ApiOperation({ summary: '成本构成表' })
  getCostBreakdown(
    @CurrentTenant() tenantId: string,
    @Query('period') period: string,
  ) {
    return this.costAnalysisSvc.getCostBreakdownReport(tenantId, period);
  }

  // ── 期末处理 ──────────────────────────────────────────────────────────────

  @Post('period-end/closing-transfer')
  @ApiOperation({ summary: '期末结转' })
  closingTransfer(
    @CurrentTenant() tenantId: string,
    @Body() body: { period: string },
  ) {
    return this.periodEndSvc.closingTransfer(tenantId, body.period);
  }

  @Get('period-end/reconcile')
  @ApiOperation({ summary: '期末对账' })
  reconcile(
    @CurrentTenant() tenantId: string,
    @Query('period') period: string,
  ) {
    return this.periodEndSvc.reconcile(tenantId, period);
  }

  @Post('period-end/lock')
  @ApiOperation({ summary: '期末结账' })
  lockPeriod(
    @CurrentTenant() tenantId: string,
    @Body() body: { period: string },
  ) {
    return this.periodEndSvc.lockPeriod(tenantId, body.period);
  }

  @Get('period-end/is-locked')
  @ApiOperation({ summary: '检查期间是否锁定' })
  isPeriodLocked(
    @CurrentTenant() tenantId: string,
    @Query('period') period: string,
  ) {
    return this.periodEndSvc.isPeriodLocked(tenantId, period);
  }

  // ── 财务报表 ──────────────────────────────────────────────────────────────

  @Get('reports/balance-sheet')
  @ApiOperation({ summary: '资产负债表' })
  getBalanceSheet(
    @CurrentTenant() tenantId: string,
    @Query('date') date: string,
  ) {
    return this.financialReportSvc.getBalanceSheet(tenantId, date);
  }

  @Get('reports/income-statement')
  @ApiOperation({ summary: '利润表' })
  getIncomeStatement(
    @CurrentTenant() tenantId: string,
    @Query('period') period?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.financialReportSvc.getIncomeStatement(tenantId, {
      period,
      startDate,
      endDate,
    });
  }

  @Get('reports/cash-flow')
  @ApiOperation({ summary: '现金流量表' })
  getCashFlow(
    @CurrentTenant() tenantId: string,
    @Query('period') period: string,
  ) {
    return this.financialReportSvc.getCashFlow(tenantId, period);
  }

  @Get('reports/dept-pnl')
  @ApiOperation({ summary: '部门损益' })
  getDeptPnl(
    @CurrentTenant() tenantId: string,
    @Query('period') period: string,
  ) {
    return this.financialReportSvc.getDeptPnl(tenantId, period);
  }

  @Get('reports/product-pnl')
  @ApiOperation({ summary: '产品损益' })
  getProductPnl(
    @CurrentTenant() tenantId: string,
    @Query('period') period: string,
  ) {
    return this.financialReportSvc.getProductPnl(tenantId, period);
  }

  @Get('reports/project-pnl')
  @ApiOperation({ summary: '项目损益' })
  getProjectPnl(
    @CurrentTenant() tenantId: string,
    @Query('period') period: string,
  ) {
    return this.financialReportSvc.getProjectPnl(tenantId, period);
  }

  // ── 成本要素 ──────────────────────────────────────────────────────────────

  @Get('cost-elements')
  @ApiOperation({ summary: '成本要素列表' })
  async getCostElements(
    @CurrentTenant() tenantId: string,
    @Query() query: CostElementQueryDto,
  ) {
    const tid = tenantId;
    const qb = this.costElementRepo
      .createQueryBuilder('e')
      .where('e.tenantId = :tid', { tid });
    if (query.keyword)
      qb.andWhere('(e.code LIKE :kw OR e.name LIKE :kw)', {
        kw: `%${query.keyword}%`,
      });
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    qb.skip((page - 1) * pageSize).take(pageSize);
    const [list, total] = await qb.getManyAndCount();
    return { list, total };
  }

  @Post('cost-elements')
  @ApiOperation({ summary: '创建成本要素' })
  async createCostElement(
    @CurrentTenant() tenantId: string,
    @Body() body: CreateCostElementDto,
  ) {
    const tid = tenantId;
    const entity = this.costElementRepo.create({
      tenantId: tid,
      code: body.code,
      name: body.name,
      elementType: body.elementType ?? body.type!,
      status: body.status,
    } as unknown as Partial<ErpCostElement>);
    return this.costElementRepo.save(entity);
  }

  @Put('cost-elements/:id')
  @ApiOperation({ summary: '更新成本要素' })
  async updateCostElement(
    @Param('id') id: string,
    @Body() body: Partial<CreateCostElementDto>,
  ) {
    const patch: Partial<ErpCostElement> = {
      code: body.code,
      name: body.name,
      elementType: body.elementType ?? body.type,
      status: body.status,
    } as unknown as Partial<ErpCostElement>;
    await this.costElementRepo.update(id, patch);
    return this.costElementRepo.findOne({ where: { id } });
  }
}


