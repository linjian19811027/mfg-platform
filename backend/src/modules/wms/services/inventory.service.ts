import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { WmsInventory } from '../entities/wms-inventory.entity.js';
import { WmsStockTransaction } from '../entities/wms-stock-transaction.entity.js';
import { WmsSafetyStock } from '../entities/wms-safety-stock.entity.js';
import { TenantContext } from '../../../shared/tenant/tenant.context.js';

export interface InventoryQuery {
  warehouseId?: string;
  zoneId?: string;
  locationId?: string;
  materialId?: string;
  batchId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export interface StockOpParams {
  materialId: string;
  batchId?: string;
  locationId: string;
  quantity: number;
  uomId: string;
  sourceType?: string;
  sourceId?: string;
  operatorId?: string;
  remark?: string;
}

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(WmsInventory)
    private readonly invRepo: Repository<WmsInventory>,
    @InjectRepository(WmsStockTransaction)
    private readonly txRepo: Repository<WmsStockTransaction>,
    @InjectRepository(WmsSafetyStock)
    private readonly ssRepo: Repository<WmsSafetyStock>,
    private readonly dataSource: DataSource,
  ) {}

  // ── 查询 ──────────────────────────────────────────────────────────────────

  async findAll(query: InventoryQuery): Promise<{
    items: (WmsInventory & {
      materialCode?: string;
      materialName?: string;
      locationCode?: string;
      locationName?: string;
      warehouseName?: string;
    })[];
    total: number;
  }> {
    const tenantId = TenantContext.requireCurrentTenant();
    const {
      locationId,
      materialId,
      batchId,
      status,
      page = 1,
      pageSize = 50,
    } = query;

    const qb = this.invRepo
      .createQueryBuilder('inv')
      .where('inv.tenant_id = :tenantId', { tenantId });

    if (locationId)
      qb.andWhere('inv.location_id = :locationId', { locationId });
    if (materialId)
      qb.andWhere('inv.material_id = :materialId', { materialId });
    if (batchId) qb.andWhere('inv.batch_id = :batchId', { batchId });
    if (status) qb.andWhere('inv.status = :status', { status });

    // 按仓库/库区过滤（JOIN location）
    if (query.warehouseId || query.zoneId) {
      qb.innerJoin('wms_location', 'loc', 'loc.id = inv.location_id');
      if (query.warehouseId)
        qb.andWhere('loc.warehouse_id = :wh', { wh: query.warehouseId });
      if (query.zoneId)
        qb.andWhere('loc.zone_id = :zone', { zone: query.zoneId });
    }

    const [invs, total] = await qb
      .orderBy('inv.updated_at', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    // 批量查物料名称（QueryBuilder 替代原生 SQL）
    const matIds = [...new Set(invs.map((i) => i.materialId).filter(Boolean))];
    const matMap = new Map<string, { code: string; name: string }>();
    if (matIds.length > 0) {
      const mats = await this.invRepo.manager
        .createQueryBuilder()
        .select(['m.id AS id', 'm.code AS code', 'm.name AS name'])
        .from('plm_material', 'm')
        .where('m.id IN (:...ids)', { ids: matIds })
        .getRawMany<{ id: string; code: string; name: string }>();
      mats.forEach((m) =>
        matMap.set(String(m.id), { code: m.code, name: m.name }),
      );
    }

    // 批量查库位和仓库名称（QueryBuilder 替代原生 SQL）
    const locIds = [...new Set(invs.map((i) => i.locationId).filter(Boolean))];
    const locMap = new Map<
      string,
      { code: string; name: string; warehouseId: string }
    >();
    if (locIds.length > 0) {
      const locs = await this.invRepo.manager
        .createQueryBuilder()
        .select([
          'l.id AS id',
          'l.code AS code',
          'l.name AS name',
          'l.warehouse_id AS warehouse_id',
        ])
        .from('wms_location', 'l')
        .where('l.id IN (:...ids)', { ids: locIds })
        .getRawMany<{
          id: string;
          code: string;
          name: string;
          warehouse_id: string;
        }>();
      locs.forEach((l) =>
        locMap.set(String(l.id), {
          code: l.code,
          name: l.name,
          warehouseId: String(l.warehouse_id),
        }),
      );
    }

    const whIds = [
      ...new Set(
        [...locMap.values()].map((l) => l.warehouseId).filter(Boolean),
      ),
    ];
    const whMap = new Map<string, string>();
    if (whIds.length > 0) {
      const whs = await this.invRepo.manager
        .createQueryBuilder()
        .select(['w.id AS id', 'w.name AS name'])
        .from('wms_warehouse', 'w')
        .where('w.id IN (:...ids)', { ids: whIds })
        .getRawMany<{ id: string; name: string }>();
      whs.forEach((w) => whMap.set(String(w.id), w.name));
    }

    const items = invs.map((i) => {
      const mat = matMap.get(i.materialId);
      const loc = locMap.get(i.locationId);
      return {
        ...i,
        materialCode: mat?.code,
        materialName: mat?.name,
        locationCode: loc?.code,
        locationName: loc?.name,
        warehouseName: loc ? whMap.get(loc.warehouseId) : undefined,
      };
    });

    return { items, total };
  }

  // ── 3.5 入库 ──────────────────────────────────────────────────────────────

  async receipt(params: StockOpParams): Promise<WmsInventory> {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.dataSource.transaction(async (mgr) => {
      const inv = await this.upsertInventory(mgr, tenantId, params, 'ADD');
      await this.writeTx(
        mgr,
        tenantId,
        'RECEIPT',
        params,
        null,
        params.locationId,
      );
      await this.checkSafetyStock(tenantId, params.materialId);
      return inv;
    });
  }

  // ── 3.5 出库 ──────────────────────────────────────────────────────────────

  async issue(params: StockOpParams): Promise<WmsInventory> {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.dataSource.transaction(async (mgr) => {
      const inv = await this.upsertInventory(mgr, tenantId, params, 'SUB');
      await this.writeTx(
        mgr,
        tenantId,
        'ISSUE',
        params,
        params.locationId,
        null,
      );
      return inv;
    });
  }

  // ── 3.5 冻结 ──────────────────────────────────────────────────────────────

  async lock(
    params: StockOpParams & {
      freezeReason: 'QC_HOLD' | 'RECALL_HOLD' | 'STOCKTAKE_HOLD';
    },
  ): Promise<WmsInventory> {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.dataSource.transaction(async (mgr) => {
      const inv = await this.getInventory(mgr, tenantId, params);
      if (Number(inv.availableQty) < params.quantity) {
        throw new BadRequestException('WMS_INSUFFICIENT_AVAILABLE');
      }
      await mgr.update(WmsInventory, inv.id, {
        availableQty: Number(inv.availableQty) - params.quantity,
        lockedQty: Number(inv.lockedQty) + params.quantity,
        freezeReason: params.freezeReason,
      });
      await this.writeTx(mgr, tenantId, 'LOCK', params, null, null);
      return {
        ...inv,
        availableQty: Number(inv.availableQty) - params.quantity,
        lockedQty: Number(inv.lockedQty) + params.quantity,
      };
    });
  }

  // ── 3.5 释放冻结 ──────────────────────────────────────────────────────────

  async unlock(params: StockOpParams): Promise<WmsInventory> {
    const tenantId = TenantContext.requireCurrentTenant();
    return this._unlockWithTenant(tenantId, params);
  }

  /** 供事件处理等非 HTTP 上下文调用，直接传入 tenantId */
  async unlockByTenant(
    tenantId: string,
    params: StockOpParams & { qualityStatus?: string },
  ): Promise<WmsInventory | null> {
    return this._unlockWithTenant(tenantId, params);
  }

  private async _unlockWithTenant(
    tenantId: string,
    params: StockOpParams & { qualityStatus?: string },
  ): Promise<WmsInventory> {
    return this.dataSource.transaction(async (mgr) => {
      const inv = await this.getInventory(mgr, tenantId, params);
      if (Number(inv.lockedQty) < params.quantity) {
        throw new BadRequestException('WMS_INSUFFICIENT_LOCKED');
      }
      const remaining = Number(inv.lockedQty) - params.quantity;
      await mgr.update(WmsInventory, inv.id, {
        availableQty: Number(inv.availableQty) + params.quantity,
        lockedQty: remaining,
        freezeReason: remaining <= 0 ? undefined : inv.freezeReason,
        ...(params.qualityStatus
          ? { qualityStatus: params.qualityStatus }
          : {}),
      });
      await this.writeTx(mgr, tenantId, 'UNLOCK', params, null, null);
      return {
        ...inv,
        availableQty: Number(inv.availableQty) + params.quantity,
      };
    });
  }

  // ── 3.5 调整 ──────────────────────────────────────────────────────────────

  async adjust(
    params: StockOpParams & { adjustQty: number },
  ): Promise<WmsInventory> {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.dataSource.transaction(async (mgr) => {
      const inv = await this.getInventory(mgr, tenantId, params);
      const newQty = Number(inv.quantity) + params.adjustQty;
      if (newQty < 0) throw new BadRequestException('WMS_ADJUST_NEGATIVE');
      await mgr.update(WmsInventory, inv.id, {
        quantity: newQty,
        availableQty: Math.max(0, Number(inv.availableQty) + params.adjustQty),
      });
      await this.writeTx(
        mgr,
        tenantId,
        'ADJUST',
        { ...params, quantity: params.adjustQty },
        null,
        null,
      );
      return { ...inv, quantity: newQty };
    });
  }

  // ── 3.6 库位转移 ──────────────────────────────────────────────────────────

  async transfer(params: {
    materialId: string;
    batchId?: string;
    fromLocationId: string;
    toLocationId: string;
    quantity: number;
    uomId: string;
    operatorId?: string;
    remark?: string;
    newStatus?: string;
  }): Promise<void> {
    const tenantId = TenantContext.requireCurrentTenant();
    await this.dataSource.transaction(async (mgr) => {
      // 出原库位
      await this.upsertInventory(
        mgr,
        tenantId,
        {
          ...params,
          locationId: params.fromLocationId,
        },
        'SUB',
      );
      // 入目标库位
      await this.upsertInventory(
        mgr,
        tenantId,
        {
          ...params,
          locationId: params.toLocationId,
          ...(params.newStatus ? {} : {}),
        },
        'ADD',
      );
      await this.writeTx(
        mgr,
        tenantId,
        'TRANSFER',
        {
          ...params,
          locationId: params.fromLocationId,
        },
        params.fromLocationId,
        params.toLocationId,
      );
    });
  }

  // ── 3.9 安全库存预警检查 ──────────────────────────────────────────────────

  async checkSafetyStock(tenantId: string, materialId: string): Promise<void> {
    const ss = await this.ssRepo.findOne({
      where: { tenantId, materialId, alertEnabled: 1 } as any,
    });
    if (!ss) return;

    const [row] = await this.invRepo.manager.query(
      `SELECT SUM(available_qty) as total FROM wms_inventory
       WHERE tenant_id = ? AND material_id = ? AND status = 'AVAILABLE'`,
      [tenantId, materialId],
    );
    const total = Number(row?.total ?? 0);
    if (total < Number(ss.safetyQty)) {
      // 写入告警事件（通过事件总线）
      await this.invRepo.manager
        .query(
          `INSERT INTO sys_event_store (event_id, tenant_id, event_type, source_module, payload, status, created_at)
         VALUES (?, ?, 'SAFETY_STOCK_ALERT', 'WMS', ?, 'PENDING', NOW())`,
          [
            uuidv4(),
            tenantId,
            JSON.stringify({
              materialId,
              current: total,
              safetyQty: ss.safetyQty,
            }),
          ],
        )
        .catch(() => {}); // 告警失败不影响主流程
    }
  }

  // ── 私有辅助 ──────────────────────────────────────────────────────────────

  private async upsertInventory(
    mgr: any,
    tenantId: string,
    params: StockOpParams,
    op: 'ADD' | 'SUB',
  ): Promise<WmsInventory> {
    const existing = await mgr.findOne(WmsInventory, {
      where: {
        tenantId,
        materialId: params.materialId,
        batchId: params.batchId ?? null,
        locationId: params.locationId,
      },
    });

    if (op === 'SUB') {
      if (!existing) throw new NotFoundException('WMS_INVENTORY_NOT_FOUND');
      const newQty = Number(existing.quantity) - params.quantity;
      const newAvail = Number(existing.availableQty) - params.quantity;
      if (newQty < 0) throw new BadRequestException('WMS_INSUFFICIENT_STOCK');
      if (newAvail < 0)
        throw new BadRequestException('WMS_INSUFFICIENT_AVAILABLE');
      await mgr.update(WmsInventory, existing.id, {
        quantity: newQty,
        availableQty: newAvail,
      });
      return { ...existing, quantity: newQty, availableQty: newAvail };
    }

    // ADD
    if (existing) {
      const newQty = Number(existing.quantity) + params.quantity;
      const newAvail = Number(existing.availableQty) + params.quantity;
      await mgr.update(WmsInventory, existing.id, {
        quantity: newQty,
        availableQty: newAvail,
      });
      return { ...existing, quantity: newQty, availableQty: newAvail };
    }

    return mgr.save(
      mgr.create(WmsInventory, {
        tenantId,
        materialId: params.materialId,
        batchId: params.batchId,
        locationId: params.locationId,
        quantity: params.quantity,
        availableQty: params.quantity,
        lockedQty: 0,
        uomId: params.uomId,
        status: 'AVAILABLE',
      }),
    );
  }

  private async getInventory(
    mgr: any,
    tenantId: string,
    params: StockOpParams,
  ): Promise<WmsInventory> {
    const inv = await mgr.findOne(WmsInventory, {
      where: {
        tenantId,
        materialId: params.materialId,
        batchId: params.batchId ?? null,
        locationId: params.locationId,
      },
    });
    if (!inv) throw new NotFoundException('WMS_INVENTORY_NOT_FOUND');
    return inv;
  }

  private async writeTx(
    mgr: any,
    tenantId: string,
    txType: string,
    params: StockOpParams,
    fromLocationId: string | null,
    toLocationId: string | null,
  ): Promise<void> {
    const txNo = `TX-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    await mgr.save(
      mgr.create(WmsStockTransaction, {
        tenantId,
        txNo,
        txType,
        materialId: params.materialId,
        batchId: params.batchId,
        fromLocationId: fromLocationId ?? undefined,
        toLocationId: toLocationId ?? undefined,
        quantity: params.quantity,
        uomId: params.uomId,
        sourceType: params.sourceType,
        sourceId: params.sourceId,
        operatorId: params.operatorId,
        txTime: new Date(),
        remark: params.remark,
      }),
    );
  }
}
