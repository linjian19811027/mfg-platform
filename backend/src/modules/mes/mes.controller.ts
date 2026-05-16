import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import {
  WorkOrderService,
  WorkOrderQuery,
} from './services/work-order.service.js';
import {
  MaterialKitService,
  IssueRequest,
} from './services/material-kit.service.js';
import {
  ProductionReportService,
  ReportRequest,
} from './services/production-report.service.js';
import {
  OperationService,
  OperationQuery,
} from './services/operation.service.js';
import { MesQualityService } from './services/mes-quality.service.js';
import { MesDashboardService } from './services/mes-dashboard.service.js';
import {
  AutoReceiptConfigService,
  CreateConfigDto,
} from './services/auto-receipt-config.service.js';
import { ReceiptLogService } from './services/receipt-log.service.js';
import { WorkOrderTreeService } from './services/work-order-tree.service.js';
import { CriticalPathService } from './services/critical-path.service.js';
import { MaterialReadinessService } from './services/material-readiness.service.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator.js';
import { JwtPayload } from '../auth/strategies/jwt.strategy.js';
import { CascadeCancelService } from './services/cascade-cancel.service.js';

@ApiTags('MES 制造执行系统')
@ApiBearerAuth()
@Controller('api/v1/mes')
export class MesController {
  constructor(
    private readonly woSvc: WorkOrderService,
    private readonly kitSvc: MaterialKitService,
    private readonly reportSvc: ProductionReportService,
    private readonly opSvc: OperationService,
    private readonly qualitySvc: MesQualityService,
    private readonly dashboardSvc: MesDashboardService,
    private readonly configSvc: AutoReceiptConfigService,
    private readonly receiptLogSvc: ReceiptLogService,
    private readonly treeSvc: WorkOrderTreeService,
    private readonly criticalPathSvc: CriticalPathService,
    private readonly readinessSvc: MaterialReadinessService,
    private readonly cascadeCancelSvc: CascadeCancelService,
  ) {}

  // ── 工单 ──────────────────────────────────────────────────────────────────

  @Get('work-orders')
  @ApiOperation({ summary: '工单列表（多维度筛选）' })
  getWorkOrders(@Query() query: WorkOrderQuery) {
    return this.woSvc.findAll(query);
  }

  @Get('work-orders/:id')
  @ApiOperation({ summary: '工单详情（含工序进度）' })
  getWorkOrder(@Param('id') id: string) {
    return this.woSvc.findOne(id);
  }

  @Post('work-orders')
  @ApiOperation({ summary: '创建工单' })
  createWorkOrder(@Body() body: Record<string, unknown>) {
    return this.woSvc.create(body);
  }

  @Put('work-orders/:id')
  @ApiOperation({ summary: '更新工单' })
  updateWorkOrder(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.woSvc.update(id, body);
  }

  @Patch('work-orders/:id/status')
  @ApiOperation({ summary: '工单状态流转' })
  transitionWorkOrder(
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    return this.woSvc.transition(id, body.status);
  }

  @Patch('work-orders/:id/priority')
  @ApiOperation({ summary: '调整工单优先级（1-10）' })
  adjustPriority(@Param('id') id: string, @Body() body: { priority: number }) {
    return this.woSvc.adjustPriority(id, body.priority);
  }

  @Post('work-orders/:id/split')
  @ApiOperation({ summary: '工单拆分' })
  splitWorkOrder(
    @Param('id') id: string,
    @Body() body: { splitQtys: number[]; reason?: string; createdBy?: string },
  ) {
    return this.woSvc.split(id, body.splitQtys, body.reason, body.createdBy);
  }

  @Post('work-orders/merge')
  @ApiOperation({ summary: '工单合并' })
  mergeWorkOrders(
    @Body() body: { sourceIds: string[]; reason?: string; createdBy?: string },
  ) {
    return this.woSvc.merge(body.sourceIds, body.reason, body.createdBy);
  }

  // ── 齐套检查 & 领料 ───────────────────────────────────────────────────────

  @Get('work-orders/:id/kit-check')
  @ApiOperation({ summary: '物料齐套检查' })
  kitCheck(@Param('id') id: string) {
    return this.kitSvc.checkKit(id);
  }

  @Post('work-orders/:id/material-issues')
  @ApiOperation({ summary: '扫码领料' })
  issueMaterials(
    @Param('id') id: string,
    @Body() body: { items: IssueRequest[]; operatorId?: string },
  ) {
    return this.kitSvc.issue(id, body.items, body.operatorId);
  }

  @Post('work-orders/:id/material-returns')
  @ApiOperation({ summary: '物料退料' })
  returnMaterials(
    @Param('id') id: string,
    @Body() body: { items: IssueRequest[]; operatorId?: string },
  ) {
    return this.kitSvc.return(id, body.items, body.operatorId);
  }

  @Post('work-orders/:id/material-supplements')
  @ApiOperation({ summary: '物料补料（超耗/报废补领）' })
  supplementMaterials(
    @Param('id') id: string,
    @Body()
    body: {
      items: (IssueRequest & { reason: 'OVER_CONSUMPTION' | 'SCRAP' })[];
      operatorId?: string;
    },
  ) {
    return this.kitSvc.supplement(id, body.items, body.operatorId);
  }

  @Get('work-orders/:id/material-issues')
  @ApiOperation({ summary: '领料记录查询' })
  getMaterialIssues(@Param('id') id: string, @Query('type') type?: string) {
    return this.kitSvc.findIssues(id, type);
  }

  // ── 报工 ──────────────────────────────────────────────────────────────────

  @Post('work-orders/:id/report')
  @ApiOperation({ summary: '报工（START/COMPLETE/SCRAP/TRANSFER/EXCEPTION）' })
  report(@Param('id') id: string, @Body() body: Omit<ReportRequest, 'woId'>) {
    return this.reportSvc.report({ ...body, woId: id });
  }

  @Get('production-reports')
  @ApiOperation({ summary: '报工记录查询' })
  getReports(
    @Query()
    query: {
      operatorId?: string;
      woId?: string;
      page?: number;
      pageSize?: number;
    },
  ) {
    return this.reportSvc.findAll(query);
  }

  @Get('labor-records')
  @ApiOperation({ summary: '工时记录查询' })
  getLaborRecords(
    @Query()
    query: {
      operatorId?: string;
      woId?: string;
      startDate?: string;
      endDate?: string;
      page?: number;
      pageSize?: number;
    },
  ) {
    return this.reportSvc.findAllLabor(query);
  }

  @Put('production-reports/:id/correct')
  @ApiOperation({ summary: '报工修正（仅班长/质检员）' })
  correctReport(
    @Param('id') id: string,
    @Body() body: { completedQty?: number; scrapQty?: number; reason: string },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.reportSvc.correct(id, body, user?.roles ?? []);
  }

  // ── 工序操作 ──────────────────────────────────────────────────────────────

  @Get('operations')
  @ApiOperation({ summary: '工序列表（含工单号和物料名称）' })
  getOperations(@Query() query: OperationQuery) {
    return this.opSvc.findAll(query);
  }

  @Post('operations/:id/start')
  @ApiOperation({ summary: '开工确认（四项前置检查）' })
  startOperation(
    @Param('id') id: string,
    @Body()
    body: {
      operatorId?: string;
      equipmentId?: string;
      materialConfirmed?: boolean;
      routingConfirmed?: boolean;
    },
  ) {
    return this.opSvc.start(id, body);
  }

  @Post('operations/:id/complete')
  @ApiOperation({ summary: '完工扫码' })
  completeOperation(
    @Param('id') id: string,
    @Body()
    body: {
      completedQty: number;
      scrapQty?: number;
      actualHours?: number;
      outputBatchId?: string;
    },
  ) {
    return this.opSvc.complete(id, body);
  }

  @Post('operations/:id/first-inspection')
  @ApiOperation({ summary: '触发首检' })
  @HttpCode(HttpStatus.NO_CONTENT)
  triggerFirstInspection(
    @Param('id') id: string,
    @Body() body: { inspectorId?: string },
  ) {
    return this.qualitySvc.triggerFirstInspection(id, body.inspectorId);
  }

  @Post('operations/:id/exception')
  @ApiOperation({ summary: '异常报工' })
  @HttpCode(HttpStatus.NO_CONTENT)
  reportException(
    @Param('id') id: string,
    @Body()
    body: { exceptionType: string; reason: string; equipmentId?: string },
  ) {
    return this.opSvc.reportException(id, body);
  }

  // ── 质量 ──────────────────────────────────────────────────────────────────

  @Post('nonconformances')
  @ApiOperation({ summary: '不合格品处理' })
  handleNonconformance(
    @Body() body: Parameters<MesQualityService['handleNonconformance']>[0],
  ) {
    return this.qualitySvc.handleNonconformance(body);
  }

  @Get('work-orders/:id/traceability')
  @ApiOperation({ summary: '质量追溯（人/机/料/法/环）' })
  getTraceability(@Param('id') id: string) {
    return this.qualitySvc.getTraceability(id);
  }

  // ── 看板 ──────────────────────────────────────────────────────────────────

  @Get('dashboards/production')
  @ApiOperation({ summary: '生产进度看板' })
  getProductionDashboard() {
    return this.dashboardSvc.getProductionDashboard();
  }

  @Get('dashboards/workstation/:id')
  @ApiOperation({ summary: '工位作业看板' })
  getWorkstationDashboard(@Param('id') id: string) {
    return this.dashboardSvc.getWorkstationDashboard(id);
  }

  @Get('dashboards/quality')
  @ApiOperation({ summary: '质量看板' })
  getQualityDashboard() {
    return this.dashboardSvc.getQualityDashboard();
  }

  @Get('dashboards/equipment')
  @ApiOperation({ summary: '设备看板' })
  getEquipmentDashboard() {
    return this.dashboardSvc.getEquipmentDashboard();
  }

  @Get('dashboards/team')
  @ApiOperation({ summary: '班组看板' })
  getTeamDashboard() {
    return this.dashboardSvc.getTeamDashboard();
  }

  // ── 自动入库配置 ──────────────────────────────────────────────────────────

  @Get('auto-receipt-config')
  @ApiOperation({ summary: '查询自动入库配置列表' })
  getAutoReceiptConfigs(
    @Query()
    query: {
      matchType?: string;
      matchValue?: string;
      page?: number;
      pageSize?: number;
    },
  ) {
    return this.configSvc.findAll(query);
  }

  @Post('auto-receipt-config')
  @ApiOperation({ summary: '创建自动入库配置' })
  createAutoReceiptConfig(@Body() body: CreateConfigDto) {
    return this.configSvc.create(body);
  }

  @Put('auto-receipt-config/:id')
  @ApiOperation({ summary: '更新自动入库配置' })
  updateAutoReceiptConfig(
    @Param('id') id: string,
    @Body() body: Partial<CreateConfigDto>,
  ) {
    return this.configSvc.update(id, body);
  }

  @Delete('auto-receipt-config/:id')
  @ApiOperation({ summary: '删除自动入库配置（检查在途日志）' })
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteAutoReceiptConfig(@Param('id') id: string) {
    return this.configSvc.delete(id);
  }

  @Patch('auto-receipt-config/:id/toggle')
  @ApiOperation({ summary: '启用/停用自动入库配置' })
  toggleAutoReceiptConfig(@Param('id') id: string) {
    return this.configSvc.toggle(id);
  }

  // ── 入库日志 ──────────────────────────────────────────────────────────────

  @Get('receipt-logs')
  @ApiOperation({ summary: '查询入库日志（支持按状态/工单筛选）' })
  getReceiptLogs(
    @Query()
    query: {
      woId?: string;
      status?: string;
      triggerType?: string;
      page?: number;
      pageSize?: number;
    },
  ) {
    return this.receiptLogSvc.findAll(query);
  }

  @Post('receipt-logs/:id/retry')
  @ApiOperation({ summary: '手动重试失败的入库日志' })
  retryReceiptLog(@Param('id') id: string) {
    return this.receiptLogSvc.retry(id);
  }

  // ── 多层级工单父子关联 ────────────────────────────────────────────────────

  @Get('work-orders/:id/tree')
  @ApiOperation({ summary: '工单树（含进度、关键路径标记）' })
  async getWorkOrderTree(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    const nodes = await this.treeSvc.getTree(tenantId, id);
    const tree = this.treeSvc.buildTree(nodes);
    const completionPct = this.treeSvc.calcCompletionPct(nodes);
    const truncated = nodes[0]?.truncated ?? false;
    return { tree, completionPct, totalNodes: nodes.length, truncated };
  }

  @Get('work-orders/:id/critical-path')
  @ApiOperation({ summary: '关键路径工单列表 + EarliestFinishTime' })
  getWorkOrderCriticalPath(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.criticalPathSvc.getCriticalPath(tenantId, id);
  }

  @Get('work-orders/:id/readiness')
  @ApiOperation({ summary: '物料齐套明细' })
  async getWorkOrderReadiness(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    const isReady = await this.readinessSvc.checkAllReady(tenantId, id);
    return { woId: id, isAllReady: isReady };
  }

  @Get('work-orders/:id/cancel-preview')
  @ApiOperation({ summary: '级联取消预览（返回可取消子工单列表）' })
  getCancelPreview(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.cascadeCancelSvc.previewCascadeCancel(tenantId, id);
  }

  @Post('work-orders/:id/cancel')
  @ApiOperation({ summary: '取消工单（支持级联取消）' })
  async cancelWorkOrder(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body()
    body: {
      cascade: boolean;
      reason: string;
      operatorId?: string;
      tenantId?: string;
    },
  ) {
    if (body.cascade) {
      return this.cascadeCancelSvc.executeCascadeCancel(
        tenantId,
        id,
        body.reason,
        body.operatorId ?? 'system',
      );
    }
    // 非级联：仅取消父工单本身，子工单 parentWoId 置 null
    return this.woSvc.transition(id, 'CANCELLED');
  }

  @Patch('work-orders/:id/parent')
  @ApiOperation({ summary: '修改父工单关联（自动重算 rootWoId/bomLevel）' })
  updateWorkOrderParent(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body()
    body: { parentWoId: string | null; operatorId?: string; tenantId?: string },
  ) {
    return this.treeSvc.updateParent(
      tenantId,
      id,
      body.parentWoId,
      body.operatorId,
    );
  }
}
