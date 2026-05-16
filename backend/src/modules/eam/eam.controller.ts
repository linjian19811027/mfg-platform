import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Request } from 'express';

import { EquipmentService } from './services/equipment.service.js';
import { EquipmentTechSpecService } from './services/equipment-tech-spec.service.js';
import { EquipmentFinanceService } from './services/equipment-finance.service.js';
import { EquipmentDocumentService } from './services/equipment-document.service.js';
import { MaintenanceService } from './services/maintenance.service.js';
import { MaintenanceAnalyticsService } from './services/maintenance-analytics.service.js';
import { InspectionService } from './services/inspection.service.js';
import { LubricationService } from './services/lubrication.service.js';
import { FaultService } from './services/fault.service.js';
import { OeeService } from './services/oee.service.js';
import { SparePartService } from './services/spare-part.service.js';
import { EquipmentHistoryService } from './services/equipment-history.service.js';

@ApiTags('EAM 设备管理')
@Controller('api/v1/eam')
export class EamController {
  constructor(
    private readonly equipmentService: EquipmentService,
    private readonly techSpecService: EquipmentTechSpecService,
    private readonly financeService: EquipmentFinanceService,
    private readonly documentService: EquipmentDocumentService,
    private readonly maintenanceService: MaintenanceService,
    private readonly maintenanceAnalyticsService: MaintenanceAnalyticsService,
    private readonly inspectionService: InspectionService,
    private readonly lubricationService: LubricationService,
    private readonly faultService: FaultService,
    private readonly oeeService: OeeService,
    private readonly sparePartService: SparePartService,
    private readonly historyService: EquipmentHistoryService,
  ) {}

  private tenantId(req: Request): string {
    const tid = (req as any).user?.tenantId;
    if (!tid) throw new Error('EAM: tenantId not found in request context');
    return tid;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 设备台账
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('equipment')
  @ApiOperation({ summary: '设备列表' })
  @ApiQuery({ name: 'workshopId', required: false })
  @ApiQuery({ name: 'productionLineId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'equipmentType', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  findEquipment(@Req() req: Request, @Query() query: any) {
    return this.equipmentService.findAll(this.tenantId(req), query);
  }

  @Post('equipment')
  @ApiOperation({ summary: '创建设备' })
  createEquipment(@Req() req: Request, @Body() body: any) {
    return this.equipmentService.create(this.tenantId(req), body);
  }

  @Get('equipment/tree')
  @ApiOperation({ summary: '设备树' })
  @ApiQuery({ name: 'workshopId', required: false })
  getEquipmentTree(
    @Req() req: Request,
    @Query('workshopId') workshopId?: string,
  ) {
    return this.equipmentService.getTree(this.tenantId(req), workshopId);
  }

  @Get('equipment/qrcode/:code')
  @ApiOperation({ summary: '二维码查询设备' })
  findByQrCode(@Req() req: Request, @Param('code') code: string) {
    return this.equipmentService.findByQrCode(this.tenantId(req), code);
  }

  @Get('equipment/performance-ranking')
  @ApiOperation({ summary: '设备绩效排名' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  performanceRanking(
    @Req() req: Request,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<any> {
    const start = startDate
      ? new Date(startDate)
      : new Date(Date.now() - 30 * 86400000);
    const end = endDate ? new Date(endDate) : new Date();
    return this.oeeService.performanceRanking(this.tenantId(req), start, end);
  }

  @Get('equipment/:id')
  @ApiOperation({ summary: '设备详情' })
  findOneEquipment(@Req() req: Request, @Param('id') id: string) {
    return this.equipmentService.findOne(this.tenantId(req), id);
  }

  @Put('equipment/:id')
  @ApiOperation({ summary: '更新设备' })
  updateEquipment(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.equipmentService.update(this.tenantId(req), id, body);
  }

  @Put('equipment/:id/status')
  @ApiOperation({ summary: '设备状态变更' })
  changeEquipmentStatus(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.equipmentService.changeStatus(
      this.tenantId(req),
      id,
      body.newStatus,
      body.operatorId,
      body.reason,
    );
  }

  @Get('equipment/:id/tech-specs')
  @ApiOperation({ summary: '技术参数列表' })
  getTechSpecs(@Req() req: Request, @Param('id') id: string) {
    return this.techSpecService.findByEquipment(this.tenantId(req), id);
  }

  @Post('equipment/:id/tech-specs')
  @ApiOperation({ summary: '保存技术参数' })
  saveTechSpecs(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const specs = Array.isArray(body) ? body : (body.specs ?? []);
    return this.techSpecService.saveSpecs(this.tenantId(req), id, specs);
  }

  @Get('equipment/:id/finance')
  @ApiOperation({ summary: '设备财务信息' })
  getFinance(@Req() req: Request, @Param('id') id: string) {
    return this.financeService.findByEquipment(this.tenantId(req), id);
  }

  @Post('equipment/:id/finance')
  @ApiOperation({ summary: '保存财务信息' })
  saveFinance(@Req() req: Request, @Param('id') id: string, @Body() body: any) {
    return this.financeService.upsert(this.tenantId(req), id, body);
  }

  @Get('equipment/:id/history')
  @ApiOperation({ summary: '设备变更历史' })
  getHistory(@Req() req: Request, @Param('id') id: string) {
    return this.historyService.findByEquipment(this.tenantId(req), id);
  }

  @Post('equipment/:id/documents')
  @ApiOperation({ summary: '记录文档上传' })
  recordDocument(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.documentService.recordDocumentUpload(
      this.tenantId(req),
      id,
      body.fileId,
      body.fileName,
      body.version,
      body.operatorId,
    );
  }

  @Get('equipment/:id/documents')
  @ApiOperation({ summary: '设备文档列表' })
  getDocuments(@Req() req: Request, @Param('id') id: string) {
    return this.documentService.findDocuments(this.tenantId(req), id);
  }

  @Get('equipment/:id/mtbf-mttr')
  @ApiOperation({ summary: 'MTBF/MTTR 统计' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  getMtbfMttr(
    @Req() req: Request,
    @Param('id') id: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<any> {
    const start = startDate
      ? new Date(startDate)
      : new Date(Date.now() - 90 * 86400000);
    const end = endDate ? new Date(endDate) : new Date();
    return this.faultService.calculateMtbfMttr(
      this.tenantId(req),
      id,
      start,
      end,
    );
  }

  @Get('equipment/:id/oee')
  @ApiOperation({ summary: '设备 OEE 记录' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  getOeeRecords(
    @Req() req: Request,
    @Param('id') id: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate
      ? new Date(startDate)
      : new Date(Date.now() - 30 * 86400000);
    const end = endDate ? new Date(endDate) : new Date();
    return this.oeeService.findRecords(this.tenantId(req), id, start, end);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 维保管理
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('maintenance/strategies')
  @ApiOperation({ summary: '维保策略列表' })
  @ApiQuery({ name: 'equipmentId', required: false })
  findStrategies(
    @Req() req: Request,
    @Query('equipmentId') equipmentId?: string,
  ) {
    return this.maintenanceService.findStrategies(
      this.tenantId(req),
      equipmentId,
    );
  }

  @Post('maintenance/strategies')
  @ApiOperation({ summary: '创建维保策略' })
  createStrategy(@Req() req: Request, @Body() body: any) {
    return this.maintenanceService.createStrategy(this.tenantId(req), body);
  }

  @Put('maintenance/strategies/:id')
  @ApiOperation({ summary: '更新维保策略' })
  updateStrategy(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.maintenanceService.updateStrategy(this.tenantId(req), id, body);
  }

  @Get('maintenance/plans')
  @ApiOperation({ summary: '维保计划列表' })
  @ApiQuery({ name: 'equipmentId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'planType', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  findPlans(@Req() req: Request, @Query() query: any) {
    const q = { ...query };
    if (q.startDate) q.startDate = new Date(q.startDate);
    if (q.endDate) q.endDate = new Date(q.endDate);
    return this.maintenanceService.findPlans(this.tenantId(req), q);
  }

  @Post('maintenance/plans')
  @ApiOperation({ summary: '创建维保计划' })
  createPlan(@Req() req: Request, @Body() body: any) {
    return this.maintenanceService.createPlan(this.tenantId(req), body);
  }

  @Put('maintenance/plans/:id')
  @ApiOperation({ summary: '更新维保计划' })
  updatePlan(@Req() req: Request, @Param('id') id: string, @Body() body: any) {
    return this.maintenanceService.updatePlan(this.tenantId(req), id, body);
  }

  @Delete('maintenance/plans/:id')
  @ApiOperation({ summary: '取消维保计划' })
  cancelPlan(@Req() req: Request, @Param('id') id: string) {
    return this.maintenanceService.cancelPlan(this.tenantId(req), id);
  }

  @Post('maintenance/tasks/:id/complete')
  @ApiOperation({ summary: '完成维保任务' })
  completeTask(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.maintenanceService.completeTask(this.tenantId(req), id, body);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 点检 & 润滑
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('inspection-records')
  @ApiOperation({ summary: '创建点检记录' })
  createInspection(@Req() req: Request, @Body() body: any) {
    return this.inspectionService.createRecord(this.tenantId(req), body);
  }

  @Get('inspection-records')
  @ApiOperation({ summary: '点检记录列表' })
  @ApiQuery({ name: 'equipmentId', required: true })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  findInspections(@Req() req: Request, @Query() query: any) {
    const { equipmentId, startDate, endDate, ...rest } = query;
    const q: any = { ...rest };
    if (startDate) q.startDate = new Date(startDate);
    if (endDate) q.endDate = new Date(endDate);
    return this.inspectionService.findRecords(
      this.tenantId(req),
      equipmentId,
      q,
    );
  }

  @Get('lubrication-records')
  @ApiOperation({ summary: '润滑记录列表' })
  @ApiQuery({ name: 'equipmentId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  async getLubricationRecords(
    @Req() req: Request,
    @Query('equipmentId') equipmentId?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ) {
    const tenantId = this.tenantId(req);
    if (equipmentId) {
      const list = await this.lubricationService.findByEquipment(
        tenantId,
        equipmentId,
      );
      return { list, total: list.length, page: 1, pageSize: list.length };
    }
    const due = await this.lubricationService.findDuePoints(tenantId, 365);
    const p = parseInt(page, 10);
    const ps = parseInt(pageSize, 10);
    const start = (p - 1) * ps;
    return {
      list: due.slice(start, start + ps),
      total: due.length,
      page: p,
      pageSize: ps,
    };
  }

  @Post('lubrication-records')
  @ApiOperation({ summary: '润滑点 upsert' })
  upsertLubricationPoint(@Req() req: Request, @Body() body: any) {
    return this.lubricationService.upsertPoint(this.tenantId(req), body);
  }

  @Put('lubrication-records/:id')
  @ApiOperation({ summary: '记录润滑操作' })
  recordLubrication(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.lubricationService.recordLubrication(
      this.tenantId(req),
      id,
      body,
    );
  }

  @Get('lubrication-records/due')
  @ApiOperation({ summary: '到期润滑点' })
  @ApiQuery({ name: 'daysAhead', required: false })
  getDueLubrication(
    @Req() req: Request,
    @Query('daysAhead') daysAhead?: string,
  ) {
    return this.lubricationService.findDuePoints(
      this.tenantId(req),
      daysAhead ? parseInt(daysAhead, 10) : 7,
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 故障管理
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('fault-records')
  @ApiOperation({ summary: '故障列表' })
  @ApiQuery({ name: 'equipmentId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'severity', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  findFaults(@Req() req: Request, @Query() query: any) {
    const q = { ...query };
    if (q.startDate) q.startDate = new Date(q.startDate);
    if (q.endDate) q.endDate = new Date(q.endDate);
    return this.faultService.findAll(this.tenantId(req), q);
  }

  @Post('fault-records')
  @ApiOperation({ summary: '故障报修' })
  reportFault(@Req() req: Request, @Body() body: any) {
    return this.faultService.reportFault(this.tenantId(req), body);
  }

  @Get('fault-records/:id')
  @ApiOperation({ summary: '故障详情' })
  findOneFault(@Req() req: Request, @Param('id') id: string) {
    return this.faultService.findOne(this.tenantId(req), id);
  }

  @Put('fault-records/:id/respond')
  @ApiOperation({ summary: '故障响应' })
  respondFault(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.faultService.respondFault(this.tenantId(req), id, body);
  }

  @Put('fault-records/:id/diagnose')
  @ApiOperation({ summary: '故障诊断' })
  diagnoseFault(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.faultService.diagnoseFault(this.tenantId(req), id, body);
  }

  @Put('fault-records/:id/start-repair')
  @ApiOperation({ summary: '开始维修' })
  startRepair(@Req() req: Request, @Param('id') id: string, @Body() body: any) {
    return this.faultService.startRepair(this.tenantId(req), id, body);
  }

  @Put('fault-records/:id/complete-repair')
  @ApiOperation({ summary: '维修完成' })
  completeRepair(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.faultService.completeRepair(this.tenantId(req), id, body);
  }

  @Put('fault-records/:id/verify-close')
  @ApiOperation({ summary: '验收关闭' })
  verifyClose(@Req() req: Request, @Param('id') id: string, @Body() body: any) {
    return this.faultService.verifyAndClose(this.tenantId(req), id, body);
  }

  @Get('fault-knowledge/search')
  @ApiOperation({ summary: '故障知识库检索' })
  @ApiQuery({ name: 'keyword', required: true })
  searchKnowledge(@Req() req: Request, @Query('keyword') keyword: string) {
    return this.faultService.searchKnowledge(this.tenantId(req), keyword);
  }

  @Post('fault-knowledge')
  @ApiOperation({ summary: '创建故障知识库条目' })
  createKnowledge(@Req() req: Request, @Body() body: any) {
    return this.sparePartService.createKnowledge(this.tenantId(req), body);
  }

  @Get('fault-knowledge')
  @ApiOperation({ summary: '故障知识库列表' })
  @ApiQuery({ name: 'equipmentType', required: false })
  @ApiQuery({ name: 'faultType', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  findKnowledge(@Req() req: Request, @Query() query: any) {
    return this.sparePartService.findKnowledge(this.tenantId(req), query);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 备件管理
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('spare-parts/inventory')
  @ApiOperation({ summary: '实时库存查询' })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'lowStock', required: false })
  getInventory(@Req() req: Request, @Query() query: any): Promise<any> {
    return this.sparePartService.getInventory(this.tenantId(req), query);
  }

  @Get('spare-parts')
  @ApiOperation({ summary: '备件列表' })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'keyword', required: false })
  @ApiQuery({ name: 'lowStock', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  findSpareParts(@Req() req: Request, @Query() query: any) {
    return this.sparePartService.findAll(this.tenantId(req), query);
  }

  @Post('spare-parts')
  @ApiOperation({ summary: '创建备件' })
  createSparePart(@Req() req: Request, @Body() body: any) {
    return this.sparePartService.create(this.tenantId(req), body);
  }

  @Get('spare-parts/:id')
  @ApiOperation({ summary: '备件详情' })
  findOneSparePart(@Req() req: Request, @Param('id') id: string) {
    return this.sparePartService.findOne(this.tenantId(req), id);
  }

  @Put('spare-parts/:id')
  @ApiOperation({ summary: '更新备件' })
  updateSparePart(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.sparePartService.update(this.tenantId(req), id, body);
  }

  @Post('spare-parts/:id/issue')
  @ApiOperation({ summary: '领用出库' })
  issueSparePart(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.sparePartService.issue(this.tenantId(req), id, body);
  }

  @Post('spare-parts/:id/receive')
  @ApiOperation({ summary: '备件入库' })
  receiveSparePart(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.sparePartService.receive(this.tenantId(req), id, body);
  }

  @Post('spare-part-issues')
  @ApiOperation({ summary: '领用申请' })
  applyIssue(@Req() req: Request, @Body() body: any) {
    return this.sparePartService.applyIssue(this.tenantId(req), body);
  }

  @Put('spare-part-issues/:id/approve')
  @ApiOperation({ summary: '审批领用' })
  approveIssue(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.sparePartService.approveIssue(
      this.tenantId(req),
      id,
      body.approverId,
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OEE
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('oee')
  @ApiOperation({ summary: '录入 OEE 数据' })
  createOee(@Req() req: Request, @Body() body: any) {
    return this.oeeService.calculate(this.tenantId(req), body);
  }

  @Get('oee')
  @ApiOperation({ summary: 'OEE 记录查询' })
  @ApiQuery({ name: 'equipmentId', required: true })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  getOee(
    @Req() req: Request,
    @Query('equipmentId') equipmentId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate
      ? new Date(startDate)
      : new Date(Date.now() - 30 * 86400000);
    const end = endDate ? new Date(endDate) : new Date();
    return this.oeeService.findRecords(
      this.tenantId(req),
      equipmentId,
      start,
      end,
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 分析
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('analytics/maintenance')
  @ApiOperation({ summary: '维保分析' })
  @ApiQuery({ name: 'equipmentId', required: false })
  @ApiQuery({ name: 'months', required: false })
  maintenanceAnalytics(
    @Req() req: Request,
    @Query('equipmentId') equipmentId?: string,
    @Query('months') months?: string,
  ): Promise<any> {
    return this.maintenanceAnalyticsService.maintenanceCostTrend(
      this.tenantId(req),
      equipmentId,
      months ? parseInt(months, 10) : 12,
    );
  }

  @Get('analytics/fault')
  @ApiOperation({ summary: '故障分析' })
  @ApiQuery({ name: 'equipmentId', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  faultAnalytics(
    @Req() req: Request,
    @Query('equipmentId') equipmentId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<any> {
    return this.faultService.faultAnalytics(this.tenantId(req), {
      equipmentId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  @Get('analytics/spare-parts')
  @ApiOperation({ summary: '备件分析' })
  @ApiQuery({ name: 'equipmentId', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'slowMovingDays', required: false })
  sparePartAnalytics(@Req() req: Request, @Query() query: any): Promise<any> {
    const q: any = {};
    if (query.equipmentId) q.equipmentId = query.equipmentId;
    if (query.startDate) q.startDate = new Date(query.startDate);
    if (query.endDate) q.endDate = new Date(query.endDate);
    if (query.slowMovingDays)
      q.slowMovingDays = parseInt(query.slowMovingDays, 10);
    return this.sparePartService.analytics(this.tenantId(req), q);
  }

  // ── 备件流水 ──────────────────────────────────────────────────────────────

  @Get('spare-part-transactions')
  @ApiOperation({ summary: '备件流水记录' })
  @ApiQuery({ name: 'sparePartId', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  getSparePartTransactions(@Req() req: Request, @Query() query: any) {
    return this.sparePartService.findTransactions(this.tenantId(req), query);
  }
}
