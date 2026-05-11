import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import {
  WmsStockTake,
  WmsStockTakeLine,
} from '../entities/wms-stock-take.entity.js';
import { WmsInventory } from '../entities/wms-inventory.entity.js';
import { InventoryService } from './inventory.service.js';
import { TenantContext } from '../../../shared/tenant/tenant.context.js';

@Injectable()
export class StockTakeService {
  constructor(
    @InjectRepository(WmsStockTake)
    private readonly takeRepo: Repository<WmsStockTake>,
    @InjectRepository(WmsStockTakeLine)
    private readonly lineRepo: Repository<WmsStockTakeLine>,
    @InjectRepository(WmsInventory)
    private readonly invRepo: Repository<WmsInventory>,
    private readonly inventorySvc: InventoryService,
    private readonly dataSource: DataSource,
  ) {}

  // ── 创建盘点单 ────────────────────────────────────────────────────────────

  async create(params: {
    takeType: 'PERIODIC' | 'DYNAMIC' | 'FULL';
    warehouseId?: string;
    zoneId?: string;
    materialIds?: string[];
    abcClass?: string;
    plannedDate?: Date;
    createdBy?: string;
  }): Promise<WmsStockTake> {
    const tenantId = TenantContext.requireCurrentTenant();

    // ── 事务保障：盘点单头创建 + 明细行生成 原子执行，防止有单头无明细 ──
    return this.dataSource.transaction(async (em) => {
      const count = await em.count(WmsStockTake, { where: { tenantId } });
      const stNo = `ST-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

      const take = await em.save(
        em.create(WmsStockTake, {
          tenantId,
          stNo,
          takeType: params.takeType,
          warehouseId: params.warehouseId,
          zoneId: params.zoneId,
          status: 'DRAFT',
          plannedDate: params.plannedDate,
          createdBy: params.createdBy,
        }),
      );

      // 自动生成盘点明细（与盘点单头在同一事务）
      await this.generateLines(take.id, tenantId, params, em);

      return take;
    });
  }

  private async generateLines(
    takeId: string,
    tenantId: string,
    params: {
      warehouseId?: string;
      zoneId?: string;
      materialIds?: string[];
      abcClass?: string;
    },
    em?: any,
  ): Promise<void> {
    const lineRepo = em ? em.getRepository(WmsStockTakeLine) : this.lineRepo;
    const invMgr = em ?? this.invRepo.manager;
    let sql = `
      SELECT inv.id, inv.material_id, inv.batch_id, inv.location_id,
             inv.quantity as book_qty, inv.uom_id
      FROM wms_inventory inv
      JOIN wms_location loc ON loc.id = inv.location_id
      WHERE inv.tenant_id = ?
    `;
    const p: unknown[] = [tenantId];

    if (params.warehouseId) {
      sql += ' AND loc.warehouse_id = ?';
      p.push(params.warehouseId);
    }
    if (params.zoneId) {
      sql += ' AND loc.zone_id = ?';
      p.push(params.zoneId);
    }
    if (params.abcClass) {
      sql += ' AND loc.abc_class = ?';
      p.push(params.abcClass);
    }
    if (params.materialIds?.length) {
      sql += ` AND inv.material_id IN (${params.materialIds.map(() => '?').join(',')})`;
      p.push(...params.materialIds);
    }

    const rows = await invMgr.query(sql, p);

    if (rows.length > 0) {
      const lines = rows.map((r: any) =>
        lineRepo.create({
          tenantId,
          stockTakeId: takeId,
          locationId: r.location_id,
          materialId: r.material_id,
          batchId: r.batch_id,
          bookQty: Number(r.book_qty),
          uomId: r.uom_id,
          status: 'PENDING',
        }),
      );
      await lineRepo.save(lines);
    }
  }

  // ── 开始盘点（冻结库存） ──────────────────────────────────────────────────

  async start(takeId: string): Promise<WmsStockTake> {
    const tenantId = TenantContext.requireCurrentTenant();
    const take = await this.takeRepo.findOne({
      where: { id: takeId, tenantId },
    });
    if (!take) throw new NotFoundException('WMS_STOCK_TAKE_NOT_FOUND');
    if (take.status !== 'DRAFT')
      throw new BadRequestException('WMS_STOCK_TAKE_NOT_DRAFT');

    await this.takeRepo.update(takeId, {
      status: 'IN_PROGRESS',
      startedAt: new Date(),
    });
    return { ...take, status: 'IN_PROGRESS' };
  }

  // ── 录入盘点数量（盲盘/明盘） ─────────────────────────────────────────────

  async count(
    lineId: string,
    countQty: number,
    countedBy?: string,
  ): Promise<WmsStockTakeLine> {
    const tenantId = TenantContext.requireCurrentTenant();
    const line = await this.lineRepo.findOne({
      where: { id: lineId, tenantId },
    });
    if (!line) throw new NotFoundException('WMS_STOCK_TAKE_LINE_NOT_FOUND');

    const diffQty = countQty - Number(line.bookQty);
    await this.lineRepo.update(lineId, {
      countQty,
      diffQty,
      status: 'COUNTED',
      countedBy,
      countedAt: new Date(),
    });
    return { ...line, countQty, diffQty, status: 'COUNTED' };
  }

  // ── 差异分析 ──────────────────────────────────────────────────────────────

  async getDiffAnalysis(takeId: string): Promise<{
    lines: WmsStockTakeLine[];
    totalDiff: number;
    diffCount: number;
  }> {
    const tenantId = TenantContext.requireCurrentTenant();
    const lines = await this.lineRepo.find({
      where: { stockTakeId: takeId, tenantId },
      order: { diffQty: 'ASC' },
    });

    const diffLines = lines.filter(
      (l) => l.diffQty !== null && Number(l.diffQty) !== 0,
    );
    const totalDiff = diffLines.reduce(
      (s, l) => s + Math.abs(Number(l.diffQty ?? 0)),
      0,
    );

    return { lines: diffLines, totalDiff, diffCount: diffLines.length };
  }

  // ── 审批并调整库存 ────────────────────────────────────────────────────────

  async approve(takeId: string, approvedBy?: string): Promise<void> {
    const tenantId = TenantContext.requireCurrentTenant();
    const take = await this.takeRepo.findOne({
      where: { id: takeId, tenantId },
    });
    if (!take) throw new NotFoundException('WMS_STOCK_TAKE_NOT_FOUND');

    const lines = await this.lineRepo.find({
      where: { stockTakeId: takeId, tenantId, status: 'COUNTED' } as any,
    });

    // ── 事务保障：循环库存调整 + 明细状态更新 + 关闭盘点单 必须同生共死 ──
    await this.dataSource.transaction(async (em) => {
      for (const line of lines) {
        if (!line.diffQty || Number(line.diffQty) === 0) continue;

        // 库存调整（inventorySvc.adjust 内部已有实务，这里直接用 em 操作同一北次连接避免嵌套事务）
        const inv = await em.findOne(WmsInventory, {
          where: {
            tenantId,
            materialId: line.materialId,
            ...(line.batchId
              ? { batchId: line.batchId }
              : { batchId: IsNull() }),
            locationId: line.locationId,
          },
        });
        if (inv) {
          const newQty = Number(inv.quantity) + Number(line.diffQty);
          if (newQty >= 0) {
            await em.update(WmsInventory, inv.id, {
              quantity: newQty,
              availableQty: Math.max(
                0,
                Number(inv.availableQty) + Number(line.diffQty),
              ),
            });
          }
        }

        await em.update(WmsStockTakeLine, line.id, { status: 'ADJUSTED' });
      }

      await em.update(
        WmsStockTake,
        { id: takeId, tenantId },
        { status: 'CLOSED', completedAt: new Date() },
      );
    });
  }
}
