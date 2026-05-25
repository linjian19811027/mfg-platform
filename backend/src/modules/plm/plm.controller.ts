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
  UploadedFile,
  UseInterceptors,
  Res,
  HttpCode,
  HttpStatus,
  StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Response } from 'express';
import { MaterialService, MaterialQuery } from './services/material.service.js';
import { MaterialCodeService } from './services/material-code.service.js';
import { MaterialExcelService } from './services/material-excel.service.js';
import { BomService } from './services/bom.service.js';
import { BomExcelService } from './services/bom-excel.service.js';
import { RoutingService, RoutingQuery } from './services/routing.service.js';
import { ChangeService } from './services/change.service.js';
import { DocumentService } from './services/document.service.js';
import { StandardOperationService } from './services/standard-operation.service.js';
import { PlmMaterialCategory } from './entities/plm-material-category.entity.js';
import { PlmMaterialCodeRule } from './entities/plm-material-code-rule.entity.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator.js';
import { JwtPayload } from '../auth/strategies/jwt.strategy.js';

@ApiTags('PLM 产品生命周期管理')
@ApiBearerAuth()
@Controller('api/v1/plm')
export class PlmController {
  constructor(
    private readonly materialSvc: MaterialService,
    private readonly codeSvc: MaterialCodeService,
    private readonly excelSvc: MaterialExcelService,
    private readonly bomSvc: BomService,
    private readonly bomExcelSvc: BomExcelService,
    private readonly routingSvc: RoutingService,
    private readonly changeSvc: ChangeService,
    private readonly docSvc: DocumentService,
    private readonly stdOpSvc: StandardOperationService,
    @InjectRepository(PlmMaterialCategory)
    private readonly categoryRepo: Repository<PlmMaterialCategory>,
    @InjectRepository(PlmMaterialCodeRule)
    private readonly codeRuleRepo: Repository<PlmMaterialCodeRule>,
  ) {}

  // ── 物料分类 ──────────────────────────────────────────────────────────────

  @Get('materials/categories')
  @ApiOperation({ summary: '物料分类树' })
  async getCategories(@CurrentTenant() tenantId: string) {
    const tid = tenantId;
    const all = await this.categoryRepo.find({
      where: { tenantId: tid },
      order: { sortOrder: 'ASC' },
    });
    // 构建树
    const map = new Map(
      all.map((c) => [c.id, { ...c, children: [] as any[] }]),
    );
    const roots: any[] = [];
    for (const node of map.values()) {
      if (node.parentId) {
        map.get(node.parentId)?.children.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  }

  @Post('materials/categories')
  @ApiOperation({ summary: '创建物料分类' })
  async createCategory(@CurrentTenant() tenantId: string, @Body() body: any) {
    const tid = tenantId;
    const entity = this.categoryRepo.create({ ...body, tenantId: tid });
    return this.categoryRepo.save(entity);
  }

  @Put('materials/categories/:id')
  @ApiOperation({ summary: '更新物料分类' })
  async updateCategory(@Param('id') id: string, @Body() body: any) {
    await this.categoryRepo.update(id, body);
    return this.categoryRepo.findOne({ where: { id } });
  }

  @Delete('materials/categories/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除物料分类' })
  async deleteCategory(@Param('id') id: string) {
    await this.categoryRepo.delete(id);
  }

  // ── 物料编码规则 ──────────────────────────────────────────────────────────

  @Get('materials/code-rules')
  @ApiOperation({ summary: '编码规则列表' })
  async getCodeRules(@CurrentTenant() tenantId: string) {
    const tid = tenantId;
    const list = await this.codeRuleRepo.find({ where: { tenantId: tid } });
    return { list, total: list.length };
  }

  @Post('materials/code-rules')
  @ApiOperation({ summary: '创建编码规则' })
  async createCodeRule(@CurrentTenant() tenantId: string, @Body() body: any) {
    const tid = tenantId;
    const entity = this.codeRuleRepo.create({ ...body, tenantId: tid });
    return this.codeRuleRepo.save(entity);
  }

  @Put('materials/code-rules/:id')
  @ApiOperation({ summary: '更新编码规则' })
  async updateCodeRule(@Param('id') id: string, @Body() body: any) {
    await this.codeRuleRepo.update(id, body);
    return this.codeRuleRepo.findOne({ where: { id } });
  }

  // ── 物料主数据 ────────────────────────────────────────────────────────────

  @Get('materials')
  @ApiOperation({ summary: '物料列表（多维度筛选）' })
  getMaterials(@Query() query: MaterialQuery) {
    return this.materialSvc.findAll(query);
  }

  @Get('materials/export')
  @ApiOperation({ summary: '物料 Excel 导出' })
  async exportMaterials(
    @Query() query: { categoryId?: string; status?: string; type?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const buffer = await this.excelSvc.export(query);
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="materials.xlsx"',
    });
    return new StreamableFile(buffer);
  }

  @Get('materials/import-template')
  @ApiOperation({ summary: '下载物料导入模板' })
  async getMaterialTemplate(@Res({ passthrough: true }) res: Response) {
    const buffer = await this.excelSvc.template();
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="material-template.xlsx"',
    });
    return new StreamableFile(buffer);
  }

  @Get('materials/:id')
  @ApiOperation({ summary: '物料详情' })
  getMaterial(@Param('id') id: string) {
    return this.materialSvc.findOne(id);
  }

  @Get('materials/:id/where-used')
  @ApiOperation({ summary: '物料被哪些 BOM 使用（反查）' })
  getMaterialBomUsage(@Param('id') id: string) {
    return this.materialSvc.findBomUsage(id);
  }

  @Get('materials/:id/substitutes')
  @ApiOperation({ summary: '物料替代关系列表' })
  getSubstitutes(@Param('id') id: string) {
    return this.materialSvc.findSubstitutes(id);
  }

  @Post('materials')
  @ApiOperation({ summary: '创建物料' })
  createMaterial(@Body() body: Record<string, unknown>) {
    return this.materialSvc.create(body);
  }

  @Post('materials/import')
  @ApiOperation({ summary: '物料 Excel 批量导入' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  importMaterials(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new Error('请上传 Excel 文件');
    }
    return this.excelSvc.import(file.buffer);
  }

  @Put('materials/:id')
  @ApiOperation({ summary: '更新物料' })
  updateMaterial(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.materialSvc.update(id, body);
  }

  @Patch('materials/:id/status')
  @ApiOperation({ summary: '物料状态流转' })
  changeMaterialStatus(
    @Param('id') id: string,
    @Body() body: { status: string },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.materialSvc.changeStatus(id, body.status, user?.roles ?? []);
  }

  @Post('materials/:id/substitutes')
  @ApiOperation({ summary: '添加替代关系' })
  addSubstitute(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.materialSvc.addSubstitute({ ...body, materialId: id });
  }

  @Post('materials/:id/drawings')
  @ApiOperation({ summary: '上传图纸/文档' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  uploadDrawing(
    @Param('id') id: string,
    @UploadedFile() file?: Express.Multer.File,
    @Body() body?: { docType?: string; tags?: string; uploadedBy?: string },
  ) {
    if (!file) {
      throw new Error('请上传文件');
    }
    const tags = body?.tags ? body.tags.split(',') : undefined;
    return this.docSvc.upload(
      file,
      'MATERIAL',
      id,
      body?.docType ?? 'DRAWING',
      body?.uploadedBy ?? '0',
      tags,
    );
  }

  // ── BOM ───────────────────────────────────────────────────────────────────

  @Get('boms')
  @ApiOperation({ summary: 'BOM 列表' })
  getBoms(
    @Query('materialId') materialId?: string,
    @Query('keyword') keyword?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.bomSvc.findAll({
      materialId,
      keyword,
      status,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
    });
  }

  @Get('boms/compare')
  @ApiOperation({ summary: 'BOM 版本对比' })
  compareBoms(@Query('v1') v1: string, @Query('v2') v2: string) {
    return this.bomSvc.compare(v1, v2);
  }

  @Get('boms/import-template')
  @ApiOperation({ summary: '下载 BOM 导入模板' })
  async getBomTemplate(@Res({ passthrough: true }) res: Response) {
    const buffer = await this.bomExcelSvc.template();
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="bom-template.xlsx"',
    });
    return new StreamableFile(buffer);
  }

  @Get('boms/:id')
  @ApiOperation({ summary: 'BOM 详情（含明细）' })
  getBom(@Param('id') id: string) {
    return this.bomSvc.findOne(id);
  }

  @Get('boms/:id/expand')
  @ApiOperation({ summary: 'BOM 正展（树形展开）' })
  expandBom(@Param('id') id: string, @Query('depth') depth?: string) {
    return this.bomSvc.expand(id, depth ? Number(depth) : 99);
  }

  @Get('boms/:id/where-used')
  @ApiOperation({ summary: 'BOM 反展（反查上级）' })
  bomWhereUsed(@Param('id') id: string) {
    return this.bomSvc.whereUsed(id);
  }

  @Get('boms/:id/cost')
  @ApiOperation({ summary: 'BOM 成本卷积' })
  rollupCost(@Param('id') id: string) {
    return this.bomSvc.rollupCost(id).then((cost) => ({ cost }));
  }

  @Get('boms/:id/export')
  @ApiOperation({ summary: 'BOM Excel 导出' })
  async exportBom(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const buffer = await this.bomExcelSvc.export(id);
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="bom-${id}.xlsx"`,
    });
    return new StreamableFile(buffer);
  }

  @Delete('boms/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除 BOM' })
  deleteBom(@Param('id') id: string) {
    return this.bomSvc.delete(id);
  }

  @Post('boms/:id/activate')
  @ApiOperation({ summary: '激活 BOM（DRAFT → ACTIVE）' })
  activateBom(@Param('id') id: string) {
    return this.bomSvc.activate(id);
  }

  @Post('boms/:id/deactivate')
  @ApiOperation({ summary: '停用 BOM（ACTIVE → INACTIVE）' })
  deactivateBom(@Param('id') id: string) {
    return this.bomSvc.deactivate(id);
  }

  @Post('boms/:id/obsolete')
  @ApiOperation({ summary: '废止 BOM（→ OBSOLETE）' })
  obsoleteBom(@Param('id') id: string) {
    return this.bomSvc.obsolete(id);
  }

  @Post('boms')
  @ApiOperation({ summary: '创建 BOM' })
  createBom(
    @Body()
    body: {
      bom: Record<string, unknown>;
      lines?: Record<string, unknown>[];
      copyFromBomId?: string;
    },
  ) {
    return this.bomSvc.create(
      { ...body.bom, copyFromBomId: body.copyFromBomId },
      body.lines ?? [],
    );
  }

  @Post('boms/import')
  @ApiOperation({ summary: 'BOM Excel 批量导入' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  importBoms(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new Error('请上传 Excel 文件');
    }
    return this.bomExcelSvc.import(file.buffer);
  }

  @Post('boms/:id/lines')
  @ApiOperation({ summary: '添加 BOM 明细行' })
  addBomLine(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.bomSvc.addLine(id, body);
  }

  @Put('boms/lines/:lineId')
  @ApiOperation({ summary: '更新 BOM 明细行' })
  updateBomLine(
    @Param('lineId') lineId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.bomSvc.updateLine(lineId, body);
  }

  @Delete('boms/lines/:lineId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除 BOM 明细行' })
  removeBomLine(@Param('lineId') lineId: string) {
    return this.bomSvc.removeLine(lineId);
  }

  // ── 工艺路线 ──────────────────────────────────────────────────────────────

  @Get('routings')
  @ApiOperation({ summary: '工艺路线列表' })
  getRoutings(@Query() query: RoutingQuery) {
    return this.routingSvc.findAll(query);
  }

  @Get('routings/:id')
  @ApiOperation({ summary: '工艺路线详情（含工序）' })
  getRouting(@Param('id') id: string) {
    return this.routingSvc.findOne(id);
  }

  @Get('routings/:id/impact')
  @ApiOperation({ summary: '变更影响分析（在制工单）' })
  getRoutingImpact(@Param('id') id: string) {
    return this.routingSvc.findAffectedWorkOrders(id);
  }

  @Post('routings')
  @ApiOperation({ summary: '创建工艺路线' })
  createRouting(
    @Body()
    body: {
      routing: Record<string, unknown>;
      operations?: Record<string, unknown>[];
    },
  ) {
    return this.routingSvc.create(body.routing, body.operations ?? []);
  }

  @Delete('routings/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除工艺路线' })
  deleteRouting(@Param('id') id: string) {
    return this.routingSvc.delete(id);
  }

  @Post('routings/:id/copy')
  @ApiOperation({ summary: '复制工艺路线' })
  copyRouting(
    @Param('id') id: string,
    @Body() body: { targetMaterialId?: string },
  ) {
    return this.routingSvc.copyRouting(id, body.targetMaterialId);
  }

  @Post('routings/:id/activate')
  @ApiOperation({ summary: '激活工艺路线版本' })
  activateRouting(@Param('id') id: string) {
    return this.routingSvc.activate(id);
  }

  @Post('routings/:id/retire')
  @ApiOperation({ summary: '废止工艺路线（ACTIVE → OBSOLETE）' })
  retireRouting(@Param('id') id: string) {
    return this.routingSvc.retire(id);
  }

  @Put('routings/:id')
  @ApiOperation({ summary: '更新工艺路线' })
  updateRouting(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.routingSvc.update(id, body);
  }

  @Post('routings/:id/operations')
  @ApiOperation({ summary: '添加工序' })
  addOperation(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.routingSvc.addOperation(id, body);
  }

  @Put('routings/operations/:opId')
  @ApiOperation({ summary: '更新工序' })
  updateOperation(
    @Param('opId') opId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.routingSvc.updateOperation(opId, body);
  }

  @Delete('routings/operations/:opId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除工序' })
  removeOperation(@Param('opId') opId: string) {
    return this.routingSvc.removeOperation(opId);
  }

  // ── 变更管理 ECR/ECN ──────────────────────────────────────────────────────

  @Get('ecrs')
  @ApiOperation({ summary: 'ECR 变更申请列表' })
  getEcrs(
    @Query('status') status?: string,
    @Query('keyword') keyword?: string,
  ) {
    return this.changeSvc.findAllEcr(status, keyword);
  }

  @Get('ecrs/:id')
  @ApiOperation({ summary: 'ECR 详情' })
  getEcr(@Param('id') id: string) {
    return this.changeSvc.findOneEcr(id);
  }

  @Post('ecrs')
  @ApiOperation({ summary: '创建变更申请 ECR' })
  createEcr(@Body() body: Record<string, unknown>) {
    return this.changeSvc.createEcr(body);
  }

  @Put('ecrs/:id')
  @ApiOperation({ summary: '更新 ECR（仅 DRAFT 状态）' })
  updateEcr(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.changeSvc.updateEcr(id, body);
  }

  @Patch('ecrs/:id/submit')
  @ApiOperation({ summary: '提交 ECR 审批' })
  submitEcr(@Param('id') id: string, @Body() body: { operatorId: string }) {
    return this.changeSvc.transitionEcr(id, 'submit', body.operatorId);
  }

  @Patch('ecrs/:id/approve')
  @ApiOperation({ summary: '审批通过 ECR' })
  approveEcr(@Param('id') id: string, @Body() body: { operatorId: string }) {
    return this.changeSvc.transitionEcr(id, 'approve', body.operatorId);
  }

  @Patch('ecrs/:id/reject')
  @ApiOperation({ summary: '驳回 ECR' })
  rejectEcr(@Param('id') id: string, @Body() body: { operatorId: string }) {
    return this.changeSvc.transitionEcr(id, 'reject', body.operatorId);
  }

  @Get('ecns')
  @ApiOperation({ summary: 'ECN 变更通知列表' })
  getEcns(@Query('ecrId') ecrId?: string) {
    return this.changeSvc.findAllEcn(ecrId);
  }

  @Get('ecns/:id')
  @ApiOperation({ summary: 'ECN 详情' })
  getEcn(@Param('id') id: string) {
    return this.changeSvc.findOneEcn(id);
  }

  @Post('ecns')
  @ApiOperation({ summary: '签发 ECN 变更通知' })
  issueEcn(@Body() body: Record<string, unknown> & { issuedBy?: string }) {
    return this.changeSvc.issueEcn(body, body.issuedBy ?? '0');
  }

  @Patch('ecns/:id/complete')
  @ApiOperation({ summary: '完成 ECN 执行' })
  completeEcn(@Param('id') id: string) {
    return this.changeSvc.completeEcn(id);
  }

  // ── 文档管理 ──────────────────────────────────────────────────────────────

  @Get('documents/search')
  @ApiOperation({ summary: '文档检索（按名称/标签）' })
  searchDocuments(
    @Query('keyword') keyword: string,
    @Query('refType') refType?: string,
    @Query('docType') docType?: string,
  ) {
    return this.docSvc.search(keyword ?? '', refType, docType);
  }

  @Get('documents')
  @ApiOperation({ summary: '查询对象关联文档' })
  getDocuments(
    @Query('refType') refType: string,
    @Query('refId') refId: string,
    @Query('latestOnly') latestOnly?: string,
  ) {
    return this.docSvc.findByRef(refType, refId, latestOnly !== 'false');
  }

  @Post('documents')
  @ApiOperation({ summary: '上传文档' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  uploadDocument(
    @UploadedFile() file: Express.Multer.File,
    @Body()
    body: {
      refType: string;
      refId: string;
      docType: string;
      uploadedBy?: string;
      tags?: string;
    },
  ) {
    const tags = body.tags ? body.tags.split(',') : undefined;
    return this.docSvc.upload(
      file,
      body.refType,
      body.refId,
      body.docType,
      body.uploadedBy ?? '0',
      tags,
    );
  }

  @Delete('documents/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除文档' })
  deleteDocument(@Param('id') id: string) {
    return this.docSvc.delete(id);
  }

  // ── 标准工序库 ────────────────────────────────────────────────────────────

  @Get('standard-operations')
  @ApiOperation({ summary: '标准工序列表' })
  getStandardOperations(
    @Query() query: { keyword?: string; status?: string; page?: string; pageSize?: string },
  ) {
    return this.stdOpSvc.findAll({
      ...query,
      page: query.page ? Number(query.page) : 1,
      pageSize: query.pageSize ? Number(query.pageSize) : 20,
    });
  }

  @Get('standard-operations/:id')
  @ApiOperation({ summary: '标准工序详情' })
  getStandardOperation(@Param('id') id: string) {
    return this.stdOpSvc.findOne(id);
  }

  @Post('standard-operations')
  @ApiOperation({ summary: '创建标准工序' })
  createStandardOperation(@Body() body: any) {
    return this.stdOpSvc.create(body);
  }

  @Put('standard-operations/:id')
  @ApiOperation({ summary: '更新标准工序' })
  updateStandardOperation(@Param('id') id: string, @Body() body: any) {
    return this.stdOpSvc.update(id, body);
  }

  @Delete('standard-operations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除标准工序' })
  deleteStandardOperation(@Param('id') id: string) {
    return this.stdOpSvc.remove(id);
  }
}
