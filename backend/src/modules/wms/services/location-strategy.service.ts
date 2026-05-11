import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WmsInventory } from '../entities/wms-inventory.entity.js';
import { WmsLocation } from '../entities/wms-location.entity.js';
import { TenantContext } from '../../../shared/tenant/tenant.context.js';

export type PickStrategy = 'FIFO' | 'LIFO' | 'ABC' | 'FEFO' | 'MANUAL';

export interface PickCandidate {
  locationId: string;
  batchId?: string;
  availableQty: number;
  locationCode?: string;
  abcClass?: string;
  batchCreatedAt?: Date;
  expireAt?: Date;
}

@Injectable()
export class LocationStrategyService {
  constructor(
    @InjectRepository(WmsInventory)
    private readonly invRepo: Repository<WmsInventory>,
    @InjectRepository(WmsLocation)
    private readonly locRepo: Repository<WmsLocation>,
  ) {}

  /**
   * 按策略推荐出库批次和库位
   * 返回按策略排序的候选列表，调用方按顺序扣减直到满足需求量
   */
  async recommend(
    materialId: string,
    requiredQty: number,
    strategy: PickStrategy = 'FIFO',
    warehouseId?: string,
    specificBatchId?: string,
  ): Promise<PickCandidate[]> {
    const tenantId = TenantContext.requireCurrentTenant();

    // 查可用库存，JOIN 批次和库位信息
    let sql = `
      SELECT inv.id, inv.location_id, inv.batch_id, inv.available_qty,
             loc.code as location_code, loc.abc_class,
             mb.created_at as batch_created_at, mb.expire_at
      FROM wms_inventory inv
      JOIN wms_location loc ON loc.id = inv.location_id
      LEFT JOIN material_batch mb ON mb.id = inv.batch_id
      WHERE inv.tenant_id = ? AND inv.material_id = ?
        AND inv.status = 'AVAILABLE' AND inv.available_qty > 0
    `;
    const params: unknown[] = [tenantId, materialId];

    if (warehouseId) {
      sql += ' AND loc.warehouse_id = ?';
      params.push(warehouseId);
    }
    if (specificBatchId) {
      sql += ' AND inv.batch_id = ?';
      params.push(specificBatchId);
    }

    // 按策略排序（MySQL 不支持 NULLS LAST，用 CASE WHEN 替代）
    switch (strategy) {
      case 'FIFO':
        sql +=
          ' ORDER BY CASE WHEN batch_created_at IS NULL THEN 1 ELSE 0 END ASC, batch_created_at ASC, inv.id ASC';
        break;
      case 'LIFO':
        sql +=
          ' ORDER BY CASE WHEN batch_created_at IS NULL THEN 1 ELSE 0 END ASC, batch_created_at DESC, inv.id DESC';
        break;
      case 'FEFO':
        sql +=
          ' ORDER BY CASE WHEN mb.expire_at IS NULL THEN 1 ELSE 0 END ASC, mb.expire_at ASC, batch_created_at ASC';
        break;
      case 'ABC':
        sql += ' ORDER BY loc.abc_class ASC, batch_created_at ASC';
        break;
      default:
        sql += ' ORDER BY inv.id ASC';
    }

    const rows = await this.invRepo.manager.query(sql, params);

    return rows.map((r: any) => ({
      locationId: r.location_id,
      batchId: r.batch_id,
      availableQty: Number(r.available_qty),
      locationCode: r.location_code,
      abcClass: r.abc_class,
      batchCreatedAt: r.batch_created_at
        ? new Date(r.batch_created_at)
        : undefined,
      expireAt: r.expire_at ? new Date(r.expire_at) : undefined,
    }));
  }

  /**
   * 推荐上架库位（入库时）
   * 按 ABC 分类、空闲空间推荐
   */
  async recommendPutaway(
    materialId: string,
    warehouseId: string,
    abcClass?: string,
  ): Promise<WmsLocation | null> {
    const tenantId = TenantContext.requireCurrentTenant();

    const qb = this.locRepo
      .createQueryBuilder('loc')
      .where(
        'loc.tenant_id = :tenantId AND loc.warehouse_id = :warehouseId AND loc.status = :status',
        { tenantId, warehouseId, status: 'ACTIVE' },
      )
      .andWhere('loc.type = :type', { type: 'STORAGE' });

    if (abcClass) qb.andWhere('loc.abc_class = :abc', { abc: abcClass });

    // 优先选择已有该物料的库位（减少碎片）
    const existing = await this.invRepo.findOne({
      where: { tenantId, materialId, status: 'AVAILABLE' } as any,
      order: { updatedAt: 'DESC' },
    });
    if (existing) {
      const loc = await this.locRepo.findOne({
        where: { id: existing.locationId, tenantId },
      });
      if (loc) return loc;
    }

    return qb.orderBy('loc.abc_class', 'ASC').getOne();
  }
}
