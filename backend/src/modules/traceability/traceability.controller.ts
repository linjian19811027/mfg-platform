import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import {
  TraceBatchService,
  ManualCreateBatchDto,
  BatchQueryDto,
} from './services/trace-batch.service.js';
import {
  TraceLinkService,
  ManualCreateLinkDto,
} from './services/trace-link.service.js';
import { ForwardTraceService } from './services/forward-trace.service.js';
import { BackwardTraceService } from './services/backward-trace.service.js';
import {
  RecallService,
  RecallAssessmentQueryDto,
} from './services/recall.service.js';
import { TraceReportService } from './services/trace-report.service.js';
import {
  TraceabilityAnalyticsService,
  CoverageQueryDto,
} from './services/traceability-analytics.service.js';
import { TenantContext } from '../../shared/tenant/tenant.context.js';

@UseGuards(JwtAuthGuard)
@Controller('api/v1/traceability')
export class TraceabilityController {
  constructor(
    private readonly batchSvc: TraceBatchService,
    private readonly linkSvc: TraceLinkService,
    private readonly forwardSvc: ForwardTraceService,
    private readonly backwardSvc: BackwardTraceService,
    private readonly recallSvc: RecallService,
    private readonly reportSvc: TraceReportService,
    private readonly analyticsSvc: TraceabilityAnalyticsService,
  ) {}

  // ── 追溯批次 ──────────────────────────────────────────────────────────────

  @Get('batches')
  findAll(@Query() query: BatchQueryDto) {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.batchSvc.findAll(tenantId, query);
  }

  @Get('batches/export')
  async exportExcel(@Query() query: BatchQueryDto, @Res() res: Response) {
    const tenantId = TenantContext.requireCurrentTenant();
    const buffer = await this.batchSvc.exportExcel(tenantId, query);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=trace-batches.xlsx',
    );
    res.send(buffer);
  }

  @Get('batches/scan/:traceCode')
  findByTraceCode(@Param('traceCode') traceCode: string) {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.batchSvc.findByTraceCode(tenantId, traceCode);
  }

  @Get('batches/:id')
  findOne(@Param('id') id: string) {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.batchSvc.findOne(tenantId, id);
  }

  @Post('batches/manual')
  manualCreate(@Body() dto: ManualCreateBatchDto, @CurrentUser() user: any) {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.batchSvc.manualCreate(tenantId, dto, user?.userId ?? 'system');
  }

  // ── 追溯查询 ──────────────────────────────────────────────────────────────

  @Get('forward/:batchId')
  forwardTrace(
    @Param('batchId') batchId: string,
    @Query() filters: { materialCode?: string; inventoryStatus?: string },
    @CurrentUser() user: any,
  ) {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.forwardSvc.trace(tenantId, batchId, filters, user?.userId);
  }

  @Get('backward/:batchId')
  backwardTrace(@Param('batchId') batchId: string, @CurrentUser() user: any) {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.backwardSvc.trace(tenantId, batchId, user?.userId);
  }

  @Post('links/manual')
  manualCreateLink(@Body() dto: ManualCreateLinkDto, @CurrentUser() user: any) {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.linkSvc.manualCreate(tenantId, dto, user?.userId ?? 'system');
  }

  // ── 召回评估 ──────────────────────────────────────────────────────────────

  @Post('recall/assess')
  assess(@Body() body: { problemBatchId: string }, @CurrentUser() user: any) {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.recallSvc.assess(
      tenantId,
      body.problemBatchId,
      user?.userId ?? 'system',
    );
  }

  @Get('recall/assessments')
  findAllAssessments(@Query() query: RecallAssessmentQueryDto) {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.recallSvc.findAll(tenantId, query);
  }

  @Get('recall/assessments/:id')
  findOneAssessment(@Param('id') id: string) {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.recallSvc.findOne(tenantId, id);
  }

  @Get('recall/progress/:id')
  getRecallProgress(@Param('id') id: string) {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.recallSvc.getProgress(tenantId, id);
  }

  // ── 追溯报告 ──────────────────────────────────────────────────────────────

  @Post('reports/generate')
  generateReport(
    @Body() body: { batchId: string; format: 'PDF' | 'EXCEL' },
    @CurrentUser() user: any,
  ) {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.reportSvc.generate(
      tenantId,
      body.batchId,
      body.format,
      user?.userId ?? 'system',
    );
  }

  @Post('reports/batch')
  batchGenerateReports(
    @Body() body: { batchIds: string[] },
    @CurrentUser() user: any,
  ) {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.reportSvc.batchGenerate(
      tenantId,
      body.batchIds,
      user?.userId ?? 'system',
    );
  }

  @Get('reports/:id/download')
  downloadReport(@Param('id') id: string) {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.reportSvc.download(tenantId, id);
  }

  // ── 看板 & 统计 ───────────────────────────────────────────────────────────

  @Get('dashboard')
  getDashboard() {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.analyticsSvc.getDashboard(tenantId);
  }

  @Get('coverage')
  getCoverage(@Query() query: CoverageQueryDto) {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.analyticsSvc.getCoverage(tenantId, query);
  }

  @Get('consistency-check')
  consistencyCheck() {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.analyticsSvc.consistencyCheck(tenantId);
  }
}
