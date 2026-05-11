import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

import { CurrentTenant } from '../auth/decorators/current-tenant.decorator.js';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InspectionService } from './services/inspection.service.js';
import { InspectionStandardService } from './services/inspection-standard.service.js';
import { NonconformanceService } from './services/nonconformance.service.js';
import { SpcService } from './services/spc.service.js';
import { QmsCustomerComplaint, QmsRecall } from './entities/qms-sip.entity.js';
import {
  QmsComplaintQueryDto,
  QmsRecallQueryDto,
} from './dto/qms-query.dto.js';
import {
  CreateComplaintDto,
  UpdateComplaintDto,
  CreateRecallDto,
  UpdateRecallDto,
} from './dto/qms-issue.dto.js';

@ApiTags('QMS 质量管理系统')
@ApiBearerAuth()
@Controller('api/v1/qms')
export class QmsController {
  constructor(
    private readonly inspSvc: InspectionService,
    private readonly stdSvc: InspectionStandardService,
    private readonly ncSvc: NonconformanceService,
    private readonly spcSvc: SpcService,
    @InjectRepository(QmsCustomerComplaint)
    private readonly complaintRepo: Repository<QmsCustomerComplaint>,
    @InjectRepository(QmsRecall)
    private readonly recallRepo: Repository<QmsRecall>,
  ) {}

  // ── 检验标准 ──────────────────────────────────────────────────────────────

  @Get('standards')
  @ApiOperation({ summary: '检验标准列表' })
  getStandards(
    @Query() query: Parameters<InspectionStandardService['findAll']>[0],
  ) {
    return this.stdSvc.findAll(query);
  }

  @Get('standards/:id')
  @ApiOperation({ summary: '检验标准详情' })
  getStandard(@Param('id') id: string) {
    return this.stdSvc.findOne(id);
  }

  @Post('standards')
  @ApiOperation({ summary: '创建检验标准' })
  createStandard(@Body() body: Record<string, unknown>) {
    return this.stdSvc.create(body);
  }

  @Post('standards/:id/version')
  @ApiOperation({ summary: '创建新版本' })
  createVersion(
    @Param('id') id: string,
    @Body() body: { changes: Record<string, unknown>; reason?: string },
  ) {
    return this.stdSvc.createVersion(id, body.changes, body.reason);
  }

  // ── 检验记录 ──────────────────────────────────────────────────────────────

  @Get('inspections')
  @ApiOperation({ summary: '检验记录列表' })
  getInspections(@Query() query: Parameters<InspectionService['findAll']>[0]) {
    return this.inspSvc.findAll(query);
  }

  @Post('inspections')
  @ApiOperation({ summary: '创建检验任务' })
  createInspection(@Body() body: Parameters<InspectionService['create']>[0]) {
    return this.inspSvc.create(body);
  }

  @Patch('inspections/:id/result')
  @ApiOperation({ summary: '录入检验结果（自动判定）' })
  submitResult(
    @Param('id') id: string,
    @Body() body: Omit<Parameters<InspectionService['submit']>[0], 'irId'>,
  ) {
    return this.inspSvc.submit({ ...body, irId: id });
  }

  @Post('first-inspections')
  @ApiOperation({ summary: '首检任务创建' })
  createFirstInspection(
    @Body() body: Parameters<InspectionService['create']>[0],
  ) {
    return this.inspSvc.create({ ...body, inspectionType: 'FIRST' });
  }

  @Post('final-inspections/inbound')
  @ApiOperation({ summary: '入库检验' })
  createInboundInspection(
    @Body() body: Parameters<InspectionService['create']>[0],
  ) {
    return this.inspSvc.create({ ...body, inspectionType: 'FQC' });
  }

  @Post('final-inspections/outbound')
  @ApiOperation({ summary: '出货检验' })
  createOutboundInspection(
    @Body() body: Parameters<InspectionService['create']>[0],
  ) {
    return this.inspSvc.create({ ...body, inspectionType: 'OQC' });
  }

  // ── 不合格品 ──────────────────────────────────────────────────────────────

  @Get('nonconformances')
  @ApiOperation({ summary: '不合格品列表' })
  getNcs(@Query() query: Parameters<NonconformanceService['findAll']>[0]) {
    return this.ncSvc.findAll(query);
  }

  @Get('nonconformances/:id')
  @ApiOperation({ summary: '不合格品详情' })
  getNc(@Param('id') id: string) {
    return this.ncSvc.findOne(id);
  }

  @Post('nonconformances')
  @ApiOperation({ summary: '创建不合格品记录' })
  createNc(@Body() body: Record<string, unknown>) {
    return this.ncSvc.create(body);
  }

  @Patch('nonconformances/:id/disposition')
  @ApiOperation({ summary: '处置决策（返工/返修/报废/让步接收）' })
  disposeNc(
    @Param('id') id: string,
    @Body() body: { status: string; disposition?: string },
  ) {
    return this.ncSvc.transition(id, body.status, body.disposition);
  }

  @Post('nonconformances/:id/rework')
  @ApiOperation({ summary: '返工跟踪' })
  reworkNc(
    @Param('id') id: string,
    @Body() body: { reworkWoId: string; reworkCost?: number },
  ) {
    return this.ncSvc.rework(id, body.reworkWoId, body.reworkCost);
  }

  // ── 纠正措施 ──────────────────────────────────────────────────────────────

  @Get('corrective-actions')
  @ApiOperation({ summary: '纠正措施列表' })
  getCapas(@Query() query: Parameters<NonconformanceService['findAll']>[0]) {
    return this.ncSvc.findAllCa(query);
  }

  @Post('corrective-actions')
  @ApiOperation({ summary: '创建纠正措施' })
  createCa(@Body() body: Record<string, unknown>) {
    return this.ncSvc.createCa(body);
  }

  @Put('corrective-actions/:id')
  @ApiOperation({ summary: '更新纠正措施（5Why/鱼骨图）' })
  updateCa(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.ncSvc.updateCa(id, body);
  }

  @Post('corrective-actions/:id/verify')
  @ApiOperation({ summary: '效果验证' })
  verifyCa(
    @Param('id') id: string,
    @Body() body: { result: string; verifiedBy: string },
  ) {
    return this.ncSvc.verifyCa(id, body.result, body.verifiedBy);
  }

  // ── SPC ───────────────────────────────────────────────────────────────────

  @Post('spc/data-points')
  @ApiOperation({ summary: '录入 SPC 数据点' })
  addSpcPoint(@Body() body: Parameters<SpcService['addDataPoint']>[0]) {
    return this.spcSvc.addDataPoint(body);
  }

  @Get('spc/chart/:itemId')
  @ApiOperation({ summary: 'SPC 控制图数据' })
  getSpcChart(@Param('itemId') itemId: string, @Query('limit') limit?: string) {
    return this.spcSvc.getChartData(itemId, limit ? Number(limit) : 50);
  }

  // ── 质量追溯 ──────────────────────────────────────────────────────────────

  @Get('traceability')
  @ApiOperation({ summary: '质量追溯（按批次/工单）' })
  getTraceability(
    @Query('batchId') batchId?: string,
    @Query('woId') woId?: string,
  ) {
    // 委托给 TraceabilityService（Phase 1 已实现）
    return {
      batchId,
      woId,
      message: 'Use /api/v1/base/batches/:id/trace for full traceability',
    };
  }

  // ── 客户投诉 ──────────────────────────────────────────────────────────────

  @Get('complaints')
  @ApiOperation({ summary: '客户投诉列表' })
  async getComplaints(
    @CurrentTenant() tenantId: string,
    @Query() query: QmsComplaintQueryDto,
  ) {
    const tid = tenantId;
    const qb = this.complaintRepo
      .createQueryBuilder('c')
      .where('c.tenantId = :tid', { tid });
    if (query.status)
      qb.andWhere('c.status = :status', { status: query.status });
    const page = Number(query.page ?? 1);
    const pageSize = Number(query.pageSize ?? 20);
    qb.skip((page - 1) * pageSize)
      .take(pageSize)
      .orderBy('c.createdAt', 'DESC');
    const [list, total] = await qb.getManyAndCount();
    return { list, total };
  }

  @Post('complaints')
  @ApiOperation({ summary: '创建客户投诉' })
  async createComplaint(
    @CurrentTenant() tenantId: string,
    @Body() body: CreateComplaintDto,
  ) {
    const tid = tenantId;
    const no = `CC-${Date.now()}`;
    const entity = this.complaintRepo.create({
      ...body,
      tenantId: tid,
      complaintNo: body.complaintNo || no,
    });
    return this.complaintRepo.save(entity);
  }

  @Put('complaints/:id')
  @ApiOperation({ summary: '更新客户投诉' })
  async updateComplaint(
    @Param('id') id: string,
    @Body() body: UpdateComplaintDto,
  ) {
    await this.complaintRepo.update(id, body);
    return this.complaintRepo.findOne({ where: { id } });
  }

  // ── 召回管理 ──────────────────────────────────────────────────────────────

  @Get('recalls')
  @ApiOperation({ summary: '召回列表' })
  async getRecalls(
    @CurrentTenant() tenantId: string,
    @Query() query: QmsRecallQueryDto,
  ) {
    const tid = tenantId;
    const qb = this.recallRepo
      .createQueryBuilder('r')
      .where('r.tenantId = :tid', { tid });
    if (query.status)
      qb.andWhere('r.status = :status', { status: query.status });
    const page = Number(query.page ?? 1);
    const pageSize = Number(query.pageSize ?? 20);
    qb.skip((page - 1) * pageSize)
      .take(pageSize)
      .orderBy('r.createdAt', 'DESC');
    const [list, total] = await qb.getManyAndCount();
    return { list, total };
  }

  @Post('recalls')
  @ApiOperation({ summary: '创建召回' })
  async createRecall(
    @CurrentTenant() tenantId: string,
    @Body() body: CreateRecallDto,
  ) {
    const tid = tenantId;
    const no = `RC-${Date.now()}`;
    const entity = this.recallRepo.create({
      ...body,
      tenantId: tid,
      recallNo: body.recallNo || no,
      affectedBatches: body.affectedBatches || [],
    });
    return this.recallRepo.save(entity);
  }

  @Put('recalls/:id')
  @ApiOperation({ summary: '更新召回' })
  async updateRecall(@Param('id') id: string, @Body() body: UpdateRecallDto) {
    await this.recallRepo.update(id, body);
    return this.recallRepo.findOne({ where: { id } });
  }
}
