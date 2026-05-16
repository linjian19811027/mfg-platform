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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { SafetyStockAlertService } from './services/safety-stock-alert.service.js';
import { Repository } from 'typeorm';
import { InventoryService } from './services/inventory.service.js';
import { ReceiptService, ReceiptRequest } from './services/receipt.service.js';
import { IssueService, IssueRequest } from './services/issue.service.js';
import { StockTakeService } from './services/stock-take.service.js';
import { WmsReportService } from './services/wms-report.service.js';
import { LocationStrategyService } from './services/location-strategy.service.js';
import { WmsWarehouse } from './entities/wms-warehouse.entity.js';
import { WmsSafetyStock } from './entities/wms-safety-stock.entity.js';
import { WmsBarcodeRule } from './entities/wms-barcode-rule.entity.js';
import {
  WmsPickTask,
  WmsPickTaskLine,
} from './entities/wms-pick-task.entity.js';
import { WmsStockTake } from './entities/wms-stock-take.entity.js';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator.js';
import {
  StockTakeListQueryDto,
  WarehouseListQueryDto,
  SafetyStockListQueryDto,
  PickTaskListQueryDto,
  CreateWarehouseDto,
  CreateSafetyStockDto,
  CreateBarcodeRuleDto,
} from './dto/wms-admin.dto.js';

@ApiTags('WMS 仓储管理系统')
@ApiBearerAuth()
@Controller('api/v1/wms')
export class WmsController {
  constructor(
    private readonly invSvc: InventoryService,
    private readonly receiptSvc: ReceiptService,
    private readonly issueSvc: IssueService,
    private readonly stockTakeSvc: StockTakeService,
    private readonly reportSvc: WmsReportService,
    private readonly strategySvc: LocationStrategyService,
    private readonly alertSvc: SafetyStockAlertService,
    @InjectRepository(WmsWarehouse)
    private readonly warehouseRepo: Repository<WmsWarehouse>,
    @InjectRepository(WmsSafetyStock)
    private readonly safetyStockRepo: Repository<WmsSafetyStock>,
    @InjectRepository(WmsBarcodeRule)
    private readonly barcodeRuleRepo: Repository<WmsBarcodeRule>,
    @InjectRepository(WmsPickTask)
    private readonly pickTaskRepo: Repository<WmsPickTask>,
    @InjectRepository(WmsPickTaskLine)
    private readonly pickTaskLineRepo: Repository<WmsPickTaskLine>,
    @InjectRepository(WmsStockTake)
    private readonly stockTakeRepo: Repository<WmsStockTake>,
  ) {}

  // ── 库存查询 ──────────────────────────────────────────────────────────────

  @Get('inventory')
  @ApiOperation({ summary: '实时库存查询（多维度筛选）' })
  getInventory(
    @Query() query: Parameters<WmsReportService['getInventory']>[0],
  ) {
    return this.reportSvc.getInventory(query);
  }

  @Get('inventory/transactions')
  @ApiOperation({ summary: '库存流水查询' })
  getTransactions(@Query() query: Parameters<InventoryService['findAll']>[0]) {
    return this.invSvc.findAll(query);
  }

  // ── 入库 ──────────────────────────────────────────────────────────────────

  @Post('receipts')
  @ApiOperation({ summary: '入库（采购/生产/退货/调拨/其他）' })
  receipt(@Body() body: ReceiptRequest) {
    return this.receiptSvc.receive(body);
  }

  @Post('putaway')
  @ApiOperation({ summary: '上架作业（暂存区→目标库位）' })
  putaway(@Body() body: Parameters<ReceiptService['putaway']>[0]) {
    return this.receiptSvc.putaway(body);
  }

  @Get('putaway/recommend')
  @ApiOperation({ summary: '推荐上架库位' })
  recommendPutaway(
    @Query('materialId') materialId: string,
    @Query('warehouseId') warehouseId: string,
    @Query('abcClass') abcClass?: string,
  ) {
    return this.strategySvc.recommendPutaway(materialId, warehouseId, abcClass);
  }

  // ── 出库 ──────────────────────────────────────────────────────────────────

  @Post('issues')
  @ApiOperation({ summary: '出库（生产领料/销售/调拨/其他）' })
  issue(@Body() body: IssueRequest) {
    return this.issueSvc.issue(body);
  }

  // ── 移库 ──────────────────────────────────────────────────────────────────

  @Post('inventory/transfer')
  @ApiOperation({ summary: '库位间移库' })
  transfer(@Body() body: Parameters<InventoryService['transfer']>[0]) {
    return this.invSvc.transfer(body);
  }

  // ── 库存调整 ──────────────────────────────────────────────────────────────

  @Post('inventory/adjust')
  @ApiOperation({ summary: '库存调整（盘盈/盘亏）' })
  adjust(@Body() body: Parameters<InventoryService['adjust']>[0]) {
    return this.invSvc.adjust(body);
  }

  @Post('inventory/lock')
  @ApiOperation({ summary: '冻结库存（质检/召回/盘点）' })
  lock(@Body() body: Parameters<InventoryService['lock']>[0]) {
    return this.invSvc.lock(body);
  }

  @Post('inventory/unlock')
  @ApiOperation({ summary: '释放冻结库存' })
  unlock(@Body() body: Parameters<InventoryService['unlock']>[0]) {
    return this.invSvc.unlock(body);
  }

  // ── 拣货任务 ──────────────────────────────────────────────────────────────

  @Post('pick-tasks')
  @ApiOperation({ summary: '创建拣货任务' })
  createPickTask(@Body() body: Parameters<IssueService['createPickTask']>[0]) {
    return this.issueSvc.createPickTask(body);
  }

  @Post('pick-tasks/:id/verify')
  @ApiOperation({ summary: '拣货复核' })
  verifyPickTask(
    @Param('id') id: string,
    @Body() body: { verifiedLines: { lineId: string; pickedQty: number }[] },
  ) {
    return this.issueSvc.verifyPickTask(id, body.verifiedLines);
  }

  // ── 盘点 ──────────────────────────────────────────────────────────────────

  @Get('stock-takes')
  @ApiOperation({ summary: '盘点单列表' })
  async getStockTakes(
    @CurrentTenant() tenantId: string,
    @Query() query: StockTakeListQueryDto,
  ) {
    const tid = tenantId;
    const qb = this.stockTakeRepo
      .createQueryBuilder('s')
      .where('s.tenantId = :tid', { tid });
    if (query.status)
      qb.andWhere('s.status = :status', { status: query.status });
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    qb.skip((page - 1) * pageSize)
      .take(pageSize)
      .orderBy('s.createdAt', 'DESC');
    const [list, total] = await qb.getManyAndCount();
    return { list, total };
  }

  @Post('stock-takes')
  @ApiOperation({ summary: '创建盘点单' })
  createStockTake(@Body() body: Parameters<StockTakeService['create']>[0]) {
    return this.stockTakeSvc.create(body);
  }

  @Patch('stock-takes/:id/start')
  @ApiOperation({ summary: '开始盘点' })
  startStockTake(@Param('id') id: string) {
    return this.stockTakeSvc.start(id);
  }

  @Post('stock-takes/lines/:lineId/count')
  @ApiOperation({ summary: '录入盘点数量' })
  countLine(
    @Param('lineId') lineId: string,
    @Body() body: { countQty: number; countedBy?: string },
  ) {
    return this.stockTakeSvc.count(lineId, body.countQty, body.countedBy);
  }

  @Get('stock-takes/:id/diff')
  @ApiOperation({ summary: '盘点差异分析' })
  getDiff(@Param('id') id: string) {
    return this.stockTakeSvc.getDiffAnalysis(id);
  }

  @Patch('stock-takes/:id/approve')
  @ApiOperation({ summary: '审批并调整库存' })
  @HttpCode(HttpStatus.NO_CONTENT)
  approveStockTake(
    @Param('id') id: string,
    @Body() body: { approvedBy?: string },
  ) {
    return this.stockTakeSvc.approve(id, body.approvedBy);
  }

  // ── 报表 ──────────────────────────────────────────────────────────────────

  @Get('reports/ledger')
  @ApiOperation({ summary: '库存台账' })
  getLedger(@Query() query: Parameters<WmsReportService['getLedger']>[0]) {
    return this.reportSvc.getLedger(query);
  }

  @Get('reports/movement')
  @ApiOperation({ summary: '收发存报表' })
  getMovement(
    @Query() query: Parameters<WmsReportService['getMovementReport']>[0],
  ) {
    return this.reportSvc.getMovementReport(query);
  }

  @Get('reports/turnover')
  @ApiOperation({ summary: '库存周转分析' })
  getTurnover(@Query() query: { days?: number; warehouseId?: string }) {
    return this.reportSvc.getTurnoverReport(query);
  }

  // ── 仓库主数据 ────────────────────────────────────────────────────────────

  @Get('warehouses')
  @ApiOperation({ summary: '仓库列表' })
  async getWarehouses(
    @CurrentTenant() tenantId: string,
    @Query() query: WarehouseListQueryDto,
  ) {
    const tid = tenantId;
    const qb = this.warehouseRepo
      .createQueryBuilder('w')
      .where('w.tenantId = :tid', { tid });
    if (query.status)
      qb.andWhere('w.status = :status', { status: query.status });
    const [list, total] = await qb.getManyAndCount();
    return { list, total };
  }

  @Post('warehouses')
  @ApiOperation({ summary: '创建仓库' })
  async createWarehouse(
    @CurrentTenant() tenantId: string,
    @Body() body: CreateWarehouseDto,
  ) {
    const tid = tenantId;
    const entity = this.warehouseRepo.create({ ...body, tenantId: tid });
    return this.warehouseRepo.save(entity);
  }

  @Put('warehouses/:id')
  @ApiOperation({ summary: '更新仓库' })
  async updateWarehouse(@Param('id') id: string, @Body() body: any) {
    await this.warehouseRepo.update(id, body);
    return this.warehouseRepo.findOne({ where: { id } });
  }

  // ── 安全库存 ──────────────────────────────────────────────────────────────

  @Get('safety-stocks')
  @ApiOperation({ summary: '安全库存列表' })
  async getSafetyStocks(
    @CurrentTenant() tenantId: string,
    @Query() query: SafetyStockListQueryDto,
  ) {
    const tid = tenantId;
    const qb = this.safetyStockRepo
      .createQueryBuilder('s')
      .where('s.tenantId = :tid', { tid });
    if (query.materialId)
      qb.andWhere('s.materialId = :mid', { mid: query.materialId });
    const [list, total] = await qb.getManyAndCount();
    return { list, total };
  }

  @Post('safety-stocks')
  @ApiOperation({ summary: '创建安全库存' })
  async createSafetyStock(
    @CurrentTenant() tenantId: string,
    @Body() body: CreateSafetyStockDto,
  ) {
    const tid = tenantId;
    const entity = this.safetyStockRepo.create({ ...body, tenantId: tid });
    return this.safetyStockRepo.save(entity);
  }

  @Put('safety-stocks/:id')
  @ApiOperation({ summary: '更新安全库存' })
  async updateSafetyStock(@Param('id') id: string, @Body() body: any) {
    await this.safetyStockRepo.update(id, body);
    return this.safetyStockRepo.findOne({ where: { id } });
  }

  @Delete('safety-stocks/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除安全库存' })
  async deleteSafetyStock(@Param('id') id: string) {
    await this.safetyStockRepo.delete(id);
  }

  @Get('safety-stocks/alerts')
  @ApiOperation({ summary: '库存预警（低于安全库存的物料列表）' })
  getSafetyStockAlerts() {
    return this.alertSvc.getAlerts();
  }

  // ── 条码规则 ──────────────────────────────────────────────────────────────

  @Get('barcode-rules')
  @ApiOperation({ summary: '条码规则列表' })
  async getBarcodeRules(@CurrentTenant() tenantId: string) {
    const tid = tenantId;
    const list = await this.barcodeRuleRepo.find({ where: { tenantId: tid } });
    return { list, total: list.length };
  }

  @Post('barcode-rules')
  @ApiOperation({ summary: '创建条码规则' })
  async createBarcodeRule(
    @CurrentTenant() tenantId: string,
    @Body() body: CreateBarcodeRuleDto,
  ) {
    const tid = tenantId;
    const entity = this.barcodeRuleRepo.create({ ...body, tenantId: tid });
    return this.barcodeRuleRepo.save(entity);
  }

  @Put('barcode-rules/:id')
  @ApiOperation({ summary: '更新条码规则' })
  async updateBarcodeRule(@Param('id') id: string, @Body() body: any) {
    await this.barcodeRuleRepo.update(id, body);
    return this.barcodeRuleRepo.findOne({ where: { id } });
  }

  // ── 拣货任务列表 ──────────────────────────────────────────────────────────

  @Get('pick-tasks')
  @ApiOperation({ summary: '拣货任务列表' })
  async getPickTasks(
    @CurrentTenant() tenantId: string,
    @Query() query: PickTaskListQueryDto,
  ) {
    const tid = tenantId;
    const qb = this.pickTaskRepo
      .createQueryBuilder('p')
      .where('p.tenantId = :tid', { tid });
    if (query.status)
      qb.andWhere('p.status = :status', { status: query.status });
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    qb.skip((page - 1) * pageSize)
      .take(pageSize)
      .orderBy('p.createdAt', 'DESC');
    const [list, total] = await qb.getManyAndCount();
    return { list, total };
  }
}
