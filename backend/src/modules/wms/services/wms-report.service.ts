import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WmsInventory } from '../entities/wms-inventory.entity.js';
import { TenantContext } from '../../../shared/tenant/tenant.context.js';

@Injectable()
export class WmsReportService {
  constructor(
    @InjectRepository(WmsInventory)
    private readonly invRepo: Repository<WmsInventory>,
  ) {}

  // ── 3.16 库存台账 ─────────────────────────────────────────────────────────

  async getLedger(query: {
    warehouseId?: string;
    materialId?: string;
    page?: number;
    pageSize?: number;
  }) {
    const tenantId = TenantContext.requireCurrentTenant();
    const { warehouseId, materialId, page = 1, pageSize = 50 } = query;
    // 确保分页参数为整数，防止注入
    const safePageSize = Math.min(
      Math.max(1, Math.floor(Number(pageSize))),
      200,
    );
    const safeOffset = Math.max(
      0,
      Math.floor((Number(page) - 1) * safePageSize),
    );

    let sql = `
      SELECT inv.material_id, inv.material_code, inv.material_name,
             inv.batch_id, inv.location_id,
             inv.quantity, inv.available_qty, inv.locked_qty,
             inv.uom_id, inv.status, inv.quality_status, inv.updated_at,
             loc.code as location_code, loc.warehouse_id
      FROM wms_inventory inv
      JOIN wms_location loc ON loc.id = inv.location_id
      WHERE inv.tenant_id = ?
    `;
    const params: unknown[] = [tenantId];

    if (warehouseId) {
      sql += ' AND loc.warehouse_id = ?';
      params.push(warehouseId);
    }
    if (materialId) {
      sql += ' AND inv.material_id = ?';
      params.push(materialId);
    }

    sql += ` ORDER BY inv.material_id, inv.location_id LIMIT ${safePageSize} OFFSET ${safeOffset}`;

    return this.invRepo.manager.query(sql, params);
  }

  // ── 3.16 收发存报表（期初+入库-出库=期末） ───────────────────────────────

  async getMovementReport(query: {
    startDate: string;
    endDate: string;
    materialId?: string;
    warehouseId?: string;
  }) {
    const tenantId = TenantContext.requireCurrentTenant();
    const { startDate, endDate, materialId, warehouseId } = query;

    let sql = `
      SELECT
        tx.material_id,
        tx.material_code,
        tx.material_name,
        SUM(CASE WHEN tx.tx_type = 'RECEIPT' THEN tx.quantity ELSE 0 END) as receipt_qty,
        SUM(CASE WHEN tx.tx_type = 'ISSUE'   THEN tx.quantity ELSE 0 END) as issue_qty,
        SUM(CASE WHEN tx.tx_type = 'ADJUST' AND tx.quantity > 0 THEN tx.quantity ELSE 0 END) as adjust_in,
        SUM(CASE WHEN tx.tx_type = 'ADJUST' AND tx.quantity < 0 THEN ABS(tx.quantity) ELSE 0 END) as adjust_out,
        tx.uom_id
      FROM wms_stock_transaction tx
      WHERE tx.tenant_id = ? AND tx.tx_time BETWEEN ? AND ?
    `;
    const params: unknown[] = [tenantId, startDate, endDate];

    if (materialId) {
      sql += ' AND tx.material_id = ?';
      params.push(materialId);
    }
    sql +=
      ' GROUP BY tx.material_id, mat.code, mat.name, tx.uom_id ORDER BY tx.material_id';

    return this.invRepo.manager.query(sql, params);
  }

  // ── 3.16 库存周转分析 ─────────────────────────────────────────────────────

  async getTurnoverReport(query: { days?: number; warehouseId?: string }) {
    const tenantId = TenantContext.requireCurrentTenant();
    const days = query.days ?? 30;

    const sql = `
      SELECT
        tx.material_id,
        SUM(CASE WHEN tx.tx_type = 'ISSUE' THEN tx.quantity ELSE 0 END) as issued_qty,
        AVG(inv.quantity) as avg_inventory,
        CASE WHEN AVG(inv.quantity) > 0
          THEN ROUND(SUM(CASE WHEN tx.tx_type = 'ISSUE' THEN tx.quantity ELSE 0 END) / AVG(inv.quantity), 2)
          ELSE 0
        END as turnover_rate
      FROM wms_stock_transaction tx
      JOIN wms_inventory inv ON inv.material_id = tx.material_id AND inv.tenant_id = tx.tenant_id
      WHERE tx.tenant_id = ?
        AND tx.tx_time >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY tx.material_id
      ORDER BY turnover_rate ASC
    `;

    return this.invRepo.manager.query(sql, [tenantId, days]);
  }

  // ── 3.17 实时库存查询 ─────────────────────────────────────────────────────

  async getInventory(query: {
    warehouseId?: string;
    zoneId?: string;
    locationId?: string;
    materialId?: string;
    batchId?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }) {
    const tenantId = TenantContext.requireCurrentTenant();
    const { page = 1, pageSize = 50 } = query;

    const qb = this.invRepo
      .createQueryBuilder('inv')
      .where('inv.tenant_id = :tenantId', { tenantId });

    if (query.locationId)
      qb.andWhere('inv.location_id = :loc', { loc: query.locationId });
    if (query.materialId)
      qb.andWhere('inv.material_id = :mat', { mat: query.materialId });
    if (query.batchId)
      qb.andWhere('inv.batch_id = :batch', { batch: query.batchId });
    if (query.status)
      qb.andWhere('inv.status = :status', { status: query.status });

    if (query.warehouseId || query.zoneId) {
      qb.innerJoin('wms_location', 'loc', 'loc.id = inv.location_id');
      if (query.warehouseId)
        qb.andWhere('loc.warehouse_id = :wh', { wh: query.warehouseId });
      if (query.zoneId)
        qb.andWhere('loc.zone_id = :zone', { zone: query.zoneId });
    }

    const [items, total] = await qb
      .orderBy('inv.material_id', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { items, total };
  }
}
