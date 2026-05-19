import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { OrganizationService } from './services/organization.service.js';
import { UomService } from './services/uom.service.js';
import { BatchService, BatchQuery } from './services/batch.service.js';
import { WorkCenterService } from './services/work-center.service.js';
import { SysFile } from '../file/entities/sys-file.entity.js';
import { SysNumberingRule } from './entities/sys-numbering-rule.entity.js';
import { MfgWorkCenter } from './entities/mfg-work-center.entity.js';
import { ShiftService } from './services/shift.service.js';
import { CertificationTypeService } from './services/certification-type.service.js';
import { TenantContext } from '../../shared/tenant/tenant.context.js';
import { escapeLikePattern } from '../../shared/utils/sanitize.js';

@ApiTags('基础主数据')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/base')
export class BaseController {
  constructor(
    private readonly orgService: OrganizationService,
    private readonly uomService: UomService,
    private readonly batchService: BatchService,
    private readonly workCenterSvc: WorkCenterService,
    private readonly shiftSvc: ShiftService,
    private readonly certTypeSvc: CertificationTypeService,
    @InjectRepository(SysFile) private readonly fileRepo: Repository<SysFile>,
    @InjectRepository(SysNumberingRule)
    private readonly ruleRepo: Repository<SysNumberingRule>,
  ) {}

  // ── 组织架构 ──────────────────────────────────────────
  @Get('organizations/tree')
  @ApiOperation({ summary: '组织树' })
  getOrgTree(@Query('type') type?: string) {
    return this.orgService.getTree(type);
  }

  @Post('organizations')
  @ApiOperation({ summary: '创建组织节点' })
  createOrg(@Body() body: Record<string, unknown>) {
    return this.orgService.create(body);
  }

  @Put('organizations/:id')
  @ApiOperation({ summary: '更新组织' })
  updateOrg(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.orgService.update(id, body);
  }

  @Delete('organizations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除组织（叶节点）' })
  deleteOrg(@Param('id') id: string) {
    return this.orgService.delete(id);
  }

  // ── 计量单位 ──────────────────────────────────────────
  @Get('uoms')
  @ApiOperation({ summary: '计量单位列表' })
  getUoms() {
    return this.uomService.findAll();
  }

  @Post('uoms')
  @ApiOperation({ summary: '创建计量单位' })
  createUom(@Body() body: Record<string, unknown>) {
    return this.uomService.create(body);
  }

  @Post('uoms/convert')
  @ApiOperation({ summary: '单位换算' })
  convertUom(
    @Body() body: { fromUomId: string; toUomId: string; quantity: number },
  ) {
    return this.uomService
      .convert(body.fromUomId, body.toUomId, body.quantity)
      .then((result) => ({ result }));
  }

  // ── 物料批次 ──────────────────────────────────────────
  @Get('batches')
  @ApiOperation({ summary: '批次列表' })
  getBatches(@Query() query: BatchQuery) {
    return this.batchService.findAll(query);
  }

  @Get('batches/:id')
  @ApiOperation({ summary: '批次详情' })
  getBatch(@Param('id') id: string) {
    return this.batchService.findOne(id);
  }

  @Post('batches')
  @ApiOperation({ summary: '创建批次' })
  createBatch(@Body() body: Record<string, unknown>) {
    return this.batchService.create(body);
  }

  @Put('batches/:id')
  @ApiOperation({ summary: '更新批次' })
  updateBatch(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.batchService.update(id, body);
  }

  // ── 文件管理 ──────────────────────────────────────────
  @Get('files')
  @ApiOperation({ summary: '文件列表' })
  async getFiles(
    @Query('fileName') fileName?: string,
    @Query('fileType') fileType?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ) {
    const tenantId = TenantContext.requireCurrentTenant();
    const p = parseInt(page, 10);
    const ps = parseInt(pageSize, 10);
    const qb = this.fileRepo
      .createQueryBuilder('f')
      .where('f.tenantId = :tenantId', { tenantId })
      .orderBy('f.createdAt', 'DESC')
      .skip((p - 1) * ps)
      .take(ps);
    if (fileName)
      qb.andWhere('f.originalName LIKE :fileName', {
        fileName: `%${fileName}%`,
      });
    if (fileType)
      qb.andWhere('f.mimeType LIKE :fileType', { fileType: `%${fileType}%` });
    const [list, total] = await qb.getManyAndCount();
    return { list, total, page: p, pageSize: ps };
  }
  @Delete('files/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除文件记录' })
  async deleteFile(@Param('id') id: string) {
    const tenantId = TenantContext.requireCurrentTenant();
    await this.fileRepo.delete({ id, tenantId });
  }

  // ── 编码规则管理 ──────────────────────────────────────────
  @Get('numbering-rules')
  @ApiOperation({ summary: '编码规则列表' })
  async getNumberingRules(
    @Query('businessKey') businessKey?: string,
    @Query('keyword') keyword?: string,
  ) {
    const tenantId = TenantContext.requireCurrentTenant();
    const qb = this.ruleRepo.createQueryBuilder('r')
      .where('r.tenant_id = :tenantId', { tenantId });
    if (businessKey) qb.andWhere('r.business_key = :businessKey', { businessKey });
    if (keyword) qb.andWhere('(r.name LIKE :kw OR r.code LIKE :kw)', { kw: `%${escapeLikePattern(keyword)}%` });
    const list = await qb.getMany();
    return { list, total: list.length };
  }

  @Post('numbering-rules')
  @ApiOperation({ summary: '创建编码规则' })
  createNumberingRule(@Body() body: any) {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.ruleRepo.save(this.ruleRepo.create({ ...body, tenantId }));
  }

  @Put('numbering-rules/:id')
  @ApiOperation({ summary: '更新编码规则' })
  async updateNumberingRule(@Param('id') id: string, @Body() body: any) {
    await this.ruleRepo.update(id, body);
    return this.ruleRepo.findOne({ where: { id } });
  }

  @Delete('numbering-rules/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除编码规则' })
  deleteNumberingRule(@Param('id') id: string) {
    return this.ruleRepo.softDelete(id);
  }

  // ── 工作中心（工种绑定） ─────────────────────────────────

  @Get('work-centers')
  getWorkCenters() {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.workCenterSvc.findAll(tenantId);
  }

  @Post('work-centers')
  createWorkCenter(@Body() dto: { name: string; code?: string; type?: string; jobTypeId?: number }) {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.workCenterSvc.create(tenantId, dto);
  }

  @Put('work-centers/:id')
  updateWorkCenter(
    @Param('id') id: string,
    @Body() dto: { name?: string; code?: string; type?: string; jobTypeId?: number; enabled?: number },
  ) {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.workCenterSvc.update(tenantId, Number(id), dto);
  }

  @Delete('work-centers/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteWorkCenter(@Param('id') id: string) {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.workCenterSvc.delete(tenantId, Number(id));
  }

  // ── 班次管理 ──────────────────────────────────────────────────

  @Get('shifts')
  @ApiOperation({ summary: '班次列表（仅启用）' })
  getShifts() {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.shiftSvc.findAll(tenantId);
  }

  @Get('shifts/all')
  @ApiOperation({ summary: '班次列表（全部）' })
  getAllShifts() {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.shiftSvc.findAllAdmin(tenantId);
  }

  @Post('shifts')
  @ApiOperation({ summary: '创建班次' })
  createShift(@Body() dto: { code: string; name: string; startTime: string; endTime: string; enabled?: number }) {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.shiftSvc.create(tenantId, dto);
  }

  @Put('shifts/:id')
  @ApiOperation({ summary: '更新班次' })
  updateShift(
    @Param('id') id: string,
    @Body() dto: { code?: string; name?: string; startTime?: string; endTime?: string; enabled?: number },
  ) {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.shiftSvc.update(tenantId, Number(id), dto);
  }

  @Delete('shifts/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除班次' })
  deleteShift(@Param('id') id: string) {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.shiftSvc.delete(tenantId, Number(id));
  }

  // ── 认证类型管理 ──────────────────────────────────────────────

  @Get('certification-types')
  @ApiOperation({ summary: '认证类型列表' })
  getCertTypes() {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.certTypeSvc.findAll(tenantId);
  }

  @Post('certification-types')
  @ApiOperation({ summary: '创建认证类型' })
  createCertType(@Body() dto: { code: string; name: string; isMandatory?: number; defaultValidityMonths?: number }) {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.certTypeSvc.create(tenantId, dto);
  }

  @Put('certification-types/:id')
  @ApiOperation({ summary: '更新认证类型' })
  updateCertType(
    @Param('id') id: string,
    @Body() dto: { code?: string; name?: string; isMandatory?: number; defaultValidityMonths?: number },
  ) {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.certTypeSvc.update(tenantId, Number(id), dto);
  }

  @Delete('certification-types/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除认证类型' })
  deleteCertType(@Param('id') id: string) {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.certTypeSvc.delete(tenantId, Number(id));
  }
}
