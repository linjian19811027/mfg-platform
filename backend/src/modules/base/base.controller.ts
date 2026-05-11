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
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OrganizationService } from './services/organization.service.js';
import { UomService } from './services/uom.service.js';
import { BatchService, BatchQuery } from './services/batch.service.js';
import { SysFile } from '../file/entities/sys-file.entity.js';
import { TenantContext } from '../../shared/tenant/tenant.context.js';

@ApiTags('基础主数据')
@ApiBearerAuth()
@Controller('api/v1/base')
export class BaseController {
  constructor(
    private readonly orgService: OrganizationService,
    private readonly uomService: UomService,
    private readonly batchService: BatchService,
    @InjectRepository(SysFile) private readonly fileRepo: Repository<SysFile>,
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
}
