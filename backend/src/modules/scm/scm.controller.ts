import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

import { CurrentTenant } from '../auth/decorators/current-tenant.decorator.js';
import { SupplierService } from './services/supplier.service.js';
import { SupplierOnboardingService } from './services/supplier-onboarding.service.js';
import { PurchaseRequestService } from './services/purchase-request.service.js';
import { PurchaseOrderService } from './services/purchase-order.service.js';
import { AsnService } from './services/asn.service.js';
import { ReceiptService } from './services/receipt.service.js';
import { InquiryService } from './services/inquiry.service.js';
import { PriceAgreementService } from './services/price-agreement.service.js';
import { ReconciliationService } from './services/reconciliation.service.js';
import { ScmAnalyticsService } from './services/scm-analytics.service.js';

import { ScmListQueryDto } from './dto/scm-common.dto.js';

@ApiTags('SCM 供应链管理')
@ApiBearerAuth()
@Controller('api/v1/scm')
export class ScmController {
  constructor(
    private readonly supplierSvc: SupplierService,
    private readonly onboardingSvc: SupplierOnboardingService,
    private readonly prSvc: PurchaseRequestService,
    private readonly poSvc: PurchaseOrderService,
    private readonly asnSvc: AsnService,
    private readonly receiptSvc: ReceiptService,
    private readonly inquirySvc: InquiryService,
    private readonly paSvc: PriceAgreementService,
    private readonly reconSvc: ReconciliationService,
    private readonly analyticsSvc: ScmAnalyticsService,
  ) {}

  // ── 供应商 ────────────────────────────────────────────────────────────────

  @Get('suppliers/performance-ranking')
  @ApiOperation({ summary: '供应商绩效排名' })
  getPerformanceRanking(
    @CurrentTenant() tenantId: string,
    @Query('limit') limit?: string,
  ) {
    return this.supplierSvc.getPerformanceRanking(
      tenantId,
      limit ? Number(limit) : 20,
    );
  }

  @Get('suppliers')
  @ApiOperation({ summary: '供应商列表' })
  getSuppliers(
    @CurrentTenant() tenantId: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('keyword') keyword?: string,
    @Query('region') region?: string,
    @Query('minScore') minScore?: string,
    @Query('maxScore') maxScore?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    return this.supplierSvc.findAll(tenantId, {
      type: type as any,
      status,
      keyword,
      region,
      minScore: minScore ? Number(minScore) : undefined,
      maxScore: maxScore ? Number(maxScore) : undefined,
      sortBy: sortBy as any,
      sortOrder: sortOrder as any,
    });
  }

  @Post('suppliers')
  @ApiOperation({ summary: '创建供应商' })
  createSupplier(
    @CurrentTenant() tenantId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.supplierSvc.create(tenantId, body);
  }

  @Get('suppliers/:id')
  @ApiOperation({ summary: '供应商详情' })
  getSupplier(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.supplierSvc.findOne(tenantId, id);
  }

  @Patch('suppliers/:id')
  @ApiOperation({ summary: '更新供应商' })
  updateSupplier(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.supplierSvc.update(tenantId, id, body);
  }

  @Patch('suppliers/:id/grade')
  @ApiOperation({ summary: '调整供应商等级' })
  adjustGrade(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() body: {
      newType: Parameters<SupplierService['adjustGrade']>[2];
      adjustedBy: Parameters<SupplierService['adjustGrade']>[3];
      reason: Parameters<SupplierService['adjustGrade']>[4];
    },
  ) {
    return this.supplierSvc.adjustGrade(
      tenantId,
      id,
      body.newType,
      body.adjustedBy,
      body.reason,
    );
  }

  @Post('suppliers/:id/onboarding')
  @ApiOperation({ summary: '发起供应商准入流程' })
  initiateOnboarding(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() body: { initiatorId: string },
  ) {
    return this.onboardingSvc.initiate(tenantId, id, body.initiatorId);
  }

  @Patch('suppliers/onboarding/:onboardingId/advance')
  @ApiOperation({ summary: '推进供应商准入流程' })
  advanceOnboarding(
    @CurrentTenant() tenantId: string,
    @Param('onboardingId') onboardingId: string,
    @Body()
    body: { approverId: string; result: 'PASS' | 'REJECT'; remarks?: string },
  ) {
    return this.onboardingSvc.advance(
      tenantId,
      onboardingId,
      body.approverId,
      body.result,
      body.remarks,
    );
  }

  @Get('suppliers/:id/expiring-qualifications')
  @ApiOperation({ summary: '供应商资质效期预警' })
  getExpiringQualifications(
    @CurrentTenant() tenantId: string,
    @Param('id') _id: string,
    @Query('daysAhead') daysAhead?: string,
  ) {
    return this.supplierSvc.getExpiringQualifications(
      tenantId,
      daysAhead ? Number(daysAhead) : 30,
    );
  }

  // ── 采购申请 ──────────────────────────────────────────────────────────────

  @Get('purchase-requests')
  @ApiOperation({ summary: '采购申请列表' })
  getPurchaseRequests(
    @CurrentTenant() tenantId: string,
    @Query() query: ScmListQueryDto,
  ) {
    return this.prSvc.findAll(tenantId, query as Parameters<PurchaseRequestService['findAll']>[1]);
  }

  @Post('purchase-requests')
  @ApiOperation({ summary: '创建采购申请' })
  createPurchaseRequest(
    @CurrentTenant() tenantId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.prSvc.create(tenantId, body);
  }

  @Get('purchase-requests/:id')
  @ApiOperation({ summary: '采购申请详情' })
  getPurchaseRequest(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.prSvc.findOne(tenantId, id);
  }

  @Patch('purchase-requests/:id')
  @ApiOperation({ summary: '更新采购申请' })
  updatePurchaseRequest(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.prSvc.update(tenantId, id, body);
  }

  @Patch('purchase-requests/:id/submit')
  @ApiOperation({ summary: '提交采购申请审批' })
  submitPurchaseRequest(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.prSvc.submit(tenantId, id);
  }

  @Patch('purchase-requests/:id/approve')
  @ApiOperation({ summary: '审批通过采购申请' })
  approvePurchaseRequest(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body()
    body: { approverId: string; approvedAmount: number; remarks?: string },
  ) {
    return this.prSvc.approve(
      tenantId,
      id,
      body.approverId,
      body.approvedAmount,
      body.remarks,
    );
  }

  @Patch('purchase-requests/:id/reject')
  @ApiOperation({ summary: '审批拒绝采购申请' })
  rejectPurchaseRequest(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() body: { approverId: string; remarks?: string },
  ) {
    return this.prSvc.reject(tenantId, id, body.approverId, body.remarks);
  }

  // ── 采购订单 ──────────────────────────────────────────────────────────────

  @Get('purchase-orders')
  @ApiOperation({ summary: '采购订单列表' })
  getPurchaseOrders(
    @CurrentTenant() tenantId: string,
    @Query() query: ScmListQueryDto,
  ) {
    return this.poSvc.findAll(tenantId, query as Parameters<PurchaseOrderService['findAll']>[1]);
  }

  @Post('purchase-orders')
  @ApiOperation({ summary: '创建采购订单' })
  createPurchaseOrder(
    @CurrentTenant() tenantId: string,
    @Body() body: { data: Parameters<PurchaseOrderService['create']>[1]; lines: Parameters<PurchaseOrderService['create']>[2] },
  ) {
    return this.poSvc.create(tenantId, body.data, body.lines);
  }

  @Get('purchase-orders/:id')
  @ApiOperation({ summary: '采购订单详情' })
  getPurchaseOrder(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.poSvc.findOne(tenantId, id);
  }

  @Patch('purchase-orders/:id/confirm')
  @ApiOperation({ summary: '确认采购订单' })
  confirmPurchaseOrder(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.poSvc.confirm(tenantId, id);
  }

  @Patch('purchase-orders/:id/change')
  @ApiOperation({ summary: '变更采购订单' })
  changePurchaseOrder(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() body: {
      changes: Parameters<PurchaseOrderService['changeOrder']>[2];
      changedBy: Parameters<PurchaseOrderService['changeOrder']>[3];
      reason: Parameters<PurchaseOrderService['changeOrder']>[4];
    },
  ) {
    return this.poSvc.changeOrder(
      tenantId,
      id,
      body.changes,
      body.changedBy,
      body.reason,
    );
  }

  @Get('purchase-orders/:id/tracking')
  @ApiOperation({ summary: '采购订单跟踪' })
  getPurchaseOrderTracking(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.poSvc.getTracking(tenantId, id);
  }

  // ── ASN ───────────────────────────────────────────────────────────────────

  @Get('asns')
  @ApiOperation({ summary: 'ASN 到货通知列表' })
  getAsns(@CurrentTenant() tenantId: string, @Query() query: ScmListQueryDto) {
    return this.asnSvc.findAll(tenantId, query as Parameters<AsnService['findAll']>[1]);
  }

  @Post('asns')
  @ApiOperation({ summary: '创建 ASN 到货通知' })
  createAsn(@CurrentTenant() tenantId: string, @Body() body: Parameters<AsnService['create']>[1]) {
    return this.asnSvc.create(tenantId, body);
  }

  @Patch('asns/:id/receive')
  @ApiOperation({ summary: '接收 ASN' })
  receiveAsn(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.asnSvc.receive(tenantId, id);
  }

  @Patch('asns/:id/cancel')
  @ApiOperation({ summary: '取消 ASN' })
  cancelAsn(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.asnSvc.cancel(tenantId, id);
  }

  // ── 到货记录 ──────────────────────────────────────────────────────────────

  @Get('receipts')
  @ApiOperation({ summary: '到货记录列表' })
  getReceipts(
    @CurrentTenant() tenantId: string,
    @Query() query: ScmListQueryDto,
  ) {
    return this.receiptSvc.findAll(tenantId, query as Parameters<ReceiptService['findAll']>[1]);
  }

  @Post('receipts')
  @ApiOperation({ summary: '创建到货记录' })
  createReceipt(@CurrentTenant() tenantId: string, @Body() body: Parameters<ReceiptService['create']>[1]) {
    return this.receiptSvc.create(tenantId, body);
  }

  @Patch('receipts/:id/start-inspection')
  @ApiOperation({ summary: '开始检验' })
  startInspection(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.receiptSvc.startInspection(tenantId, id);
  }

  @Patch('receipts/:id/confirm')
  @ApiOperation({ summary: '确认到货' })
  confirmReceipt(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() body: { confirmedItems: Parameters<ReceiptService['confirm']>[2] },
  ) {
    return this.receiptSvc.confirm(tenantId, id, body.confirmedItems);
  }

  @Patch('receipts/:id/reject')
  @ApiOperation({ summary: '拒绝到货' })
  rejectReceipt(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() body: { reason: string },
  ) {
    return this.receiptSvc.reject(tenantId, id, body.reason);
  }

  @Post('receipts/:id/exceptions')
  @ApiOperation({ summary: '记录到货异常' })
  createException(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body()
    body: Parameters<ReceiptService['createException']>[2],
  ) {
    return this.receiptSvc.createException(tenantId, id, body);
  }

  @Get('receipts/:id/exceptions')
  @ApiOperation({ summary: '查询到货异常列表' })
  getExceptions(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.receiptSvc.findExceptions(tenantId, id);
  }

  @Patch('receipts/exceptions/:exceptionId/process')
  @ApiOperation({ summary: '开始处理到货异常' })
  processException(
    @CurrentTenant() tenantId: string,
    @Param('exceptionId') exceptionId: string,
    @Body() body: { handlingNotes?: string },
  ) {
    return this.receiptSvc.processException(
      tenantId,
      exceptionId,
      body.handlingNotes,
    );
  }

  @Patch('receipts/exceptions/:exceptionId/close')
  @ApiOperation({ summary: '关闭到货异常' })
  closeException(
    @CurrentTenant() tenantId: string,
    @Param('exceptionId') exceptionId: string,
    @Body() body: { handlingNotes?: string },
  ) {
    return this.receiptSvc.closeException(
      tenantId,
      exceptionId,
      body.handlingNotes,
    );
  }

  // ── 询价 ──────────────────────────────────────────────────────────────────

  @Get('inquiries')
  @ApiOperation({ summary: '询价单列表' })
  getInquiries(
    @CurrentTenant() tenantId: string,
    @Query() query: ScmListQueryDto,
  ) {
    return this.inquirySvc.findAll(tenantId, query as Parameters<InquiryService['findAll']>[1]);
  }

  @Post('inquiries')
  @ApiOperation({ summary: '创建询价单' })
  createInquiry(@CurrentTenant() tenantId: string, @Body() body: Parameters<InquiryService['create']>[1]) {
    return this.inquirySvc.create(tenantId, body);
  }

  @Get('inquiries/:id')
  @ApiOperation({ summary: '询价单详情' })
  getInquiry(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.inquirySvc.findOne(tenantId, id);
  }

  @Patch('inquiries/:id/send')
  @ApiOperation({ summary: '发送询价单给供应商' })
  sendInquiry(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() body: { supplierIds: string[] },
  ) {
    return this.inquirySvc.send(tenantId, id, body.supplierIds);
  }

  @Post('inquiries/:id/quotes')
  @ApiOperation({ summary: '提交报价' })
  submitQuote(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body()
    body: {
      supplierId: string;
      quotedPrice: number;
      quotedLeadDays: number;
      remarks?: string;
    },
  ) {
    return this.inquirySvc.submitQuote(tenantId, id, body.supplierId, {
      quotedPrice: body.quotedPrice,
      quotedLeadDays: body.quotedLeadDays,
      remarks: body.remarks,
    });
  }

  @Get('inquiries/:id/comparison')
  @ApiOperation({ summary: '询价比价分析' })
  getComparison(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.inquirySvc.getComparison(tenantId, id);
  }

  @Patch('inquiries/:id/select')
  @ApiOperation({ summary: '择优选择供应商' })
  selectSupplier(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() body: { lineId: string },
  ) {
    return this.inquirySvc.selectSupplier(tenantId, id, body.lineId);
  }

  // ── 价格协议 ──────────────────────────────────────────────────────────────

  @Get('price-agreements')
  @ApiOperation({ summary: '价格协议列表' })
  getPriceAgreements(
    @CurrentTenant() tenantId: string,
    @Query() query: ScmListQueryDto,
  ) {
    return this.paSvc.findAll(tenantId, query as Parameters<PriceAgreementService['findAll']>[1]);
  }

  @Post('price-agreements')
  @ApiOperation({ summary: '创建价格协议' })
  createPriceAgreement(@CurrentTenant() tenantId: string, @Body() body: Parameters<PriceAgreementService['create']>[1]) {
    return this.paSvc.create(tenantId, body);
  }

  @Get('price-agreements/:id')
  @ApiOperation({ summary: '价格协议详情' })
  getPriceAgreement(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.paSvc.findOne(tenantId, id);
  }

  @Patch('price-agreements/:id/expire')
  @ApiOperation({ summary: '手动过期价格协议' })
  expirePriceAgreement(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.paSvc.expire(tenantId, id);
  }

  @Patch('price-agreements/:id/cancel')
  @ApiOperation({ summary: '取消价格协议' })
  cancelPriceAgreement(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.paSvc.cancel(tenantId, id);
  }

  @Post('price-approvals')
  @ApiOperation({ summary: '价格审批检查' })
  checkPriceApproval(
    @CurrentTenant() tenantId: string,
    @Body()
    body: {
      supplierId: string;
      materialId: string;
      quantity: number;
      proposedPrice: number;
    },
  ) {
    return this.paSvc.checkPriceApproval(
      tenantId,
      body.supplierId,
      body.materialId,
      body.quantity,
      body.proposedPrice,
    );
  }

  @Get('materials/:materialId/price-history')
  @ApiOperation({ summary: '物料历史价格' })
  getPriceHistory(
    @CurrentTenant() tenantId: string,
    @Param('materialId') materialId: string,
    @Query('supplierId') supplierId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.paSvc.getPriceHistory(tenantId, materialId, {
      supplierId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  @Get('materials/:materialId/price-curve')
  @ApiOperation({ summary: '物料价格曲线' })
  getPriceCurve(
    @CurrentTenant() tenantId: string,
    @Param('materialId') materialId: string,
    @Query('supplierId') supplierId?: string,
    @Query('months') months?: string,
  ) {
    return this.paSvc.getPriceCurve(
      tenantId,
      materialId,
      supplierId,
      months ? Number(months) : 6,
    );
  }

  // ── 对账 ──────────────────────────────────────────────────────────────────

  @Get('reconciliations')
  @ApiOperation({ summary: '对账单列表' })
  getReconciliations(
    @CurrentTenant() tenantId: string,
    @Query() query: ScmListQueryDto,
  ) {
    return this.reconSvc.findAll(tenantId, query as Parameters<ReconciliationService['findAll']>[1]);
  }

  @Post('reconciliations')
  @ApiOperation({ summary: '创建对账单' })
  createReconciliation(@CurrentTenant() tenantId: string, @Body() body: Parameters<ReconciliationService['create']>[1]) {
    return this.reconSvc.create(tenantId, body);
  }

  @Get('reconciliations/:id')
  @ApiOperation({ summary: '对账单详情' })
  getReconciliation(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.reconSvc.findOne(tenantId, id);
  }

  @Patch('reconciliations/:id/confirm')
  @ApiOperation({ summary: '确认对账' })
  confirmReconciliation(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.reconSvc.confirm(tenantId, id);
  }

  @Patch('reconciliations/:id/push-payable')
  @ApiOperation({ summary: '手动推送应付账款' })
  pushPayable(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.reconSvc.pushPayable(tenantId, id);
  }

  // ── 到货异常全局列表 ──────────────────────────────────────────────────────

  @Get('receipt-exceptions')
  @ApiOperation({ summary: '到货异常列表（全局）' })
  getAllExceptions(
    @CurrentTenant() tenantId: string,
    @Query() query: ScmListQueryDto,
  ) {
    // 委托给 receiptSvc 查询所有异常
    return this.receiptSvc.findAllExceptions(tenantId, query);
  }

  // ── 供应商资质（全局列表）────────────────────────────────────────────────

  @Get('supplier-qualifications')
  @ApiOperation({ summary: '供应商资质列表' })
  getQualifications(@CurrentTenant() tenantId: string) {
    return this.supplierSvc.getExpiringQualifications(tenantId, 36500);
  }

  @Post('supplier-qualifications')
  @ApiOperation({ summary: '创建供应商资质' })
  createQualification(@CurrentTenant() tenantId: string, @Body() body: Record<string, unknown>) {
    return this.supplierSvc.createQualification(tenantId, body);
  }

  @Patch('supplier-qualifications/:id')
  @ApiOperation({ summary: '更新供应商资质' })
  updateQualification(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.supplierSvc.updateQualification(tenantId, id, body);
  }

  // ── 分析 ──────────────────────────────────────────────────────────────────

  @Get('analytics/amount')
  @ApiOperation({ summary: '采购金额分析' })
  getAmountAnalysis(
    @CurrentTenant() tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('groupBy') groupBy: 'month' | 'quarter' | 'year' = 'month',
  ) {
    return this.analyticsSvc.getAmountAnalysis(tenantId, {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      groupBy,
    });
  }

  @Get('analytics/suppliers')
  @ApiOperation({ summary: '供应商分析' })
  getSupplierAnalysis(
    @CurrentTenant() tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
  ) {
    return this.analyticsSvc.getSupplierAnalysis(tenantId, {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: limit ? Number(limit) : 20,
    });
  }

  @Get('analytics/materials')
  @ApiOperation({ summary: '品类分析' })
  getMaterialAnalysis(
    @CurrentTenant() tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
  ) {
    return this.analyticsSvc.getMaterialAnalysis(tenantId, {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: limit ? Number(limit) : 20,
    });
  }

  @Get('analytics/delivery-trend')
  @ApiOperation({ summary: '交期达成率趋势' })
  getDeliveryTrend(
    @CurrentTenant() tenantId: string,
    @Query('months') months?: string,
  ) {
    return this.analyticsSvc.getDeliveryTrend(
      tenantId,
      months ? Number(months) : 6,
    );
  }
}

