import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WmsSafetyStock } from '../entities/wms-safety-stock.entity.js';
import { WmsInventory } from '../entities/wms-inventory.entity.js';
import { TenantContext } from '../../../shared/tenant/tenant.context.js';

export interface StockAlert {
  materialId: string;
  warehouseId?: string;
  safetyQty: number;
  currentQty: number;
  shortage: number;
}

/**
 * 安全库存预警服务
 * 每小时检查一次库存水位，低于安全库存时记录告警
 */
@Injectable()
export class SafetyStockAlertService {
  private readonly logger = new Logger(SafetyStockAlertService.name);

  /** 最近一次告警结果缓存（供 API 查询） */
  private lastAlerts: StockAlert[] = [];
  private lastCheckTime: Date | null = null;

  constructor(
    @InjectRepository(WmsSafetyStock)
    private readonly ssRepo: Repository<WmsSafetyStock>,
    @InjectRepository(WmsInventory)
    private readonly invRepo: Repository<WmsInventory>,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async checkSafetyStock() {
    try {
      const tenantId = TenantContext.getCurrentTenant();
      if (!tenantId) return; // 无租户上下文时跳过

      // 查询所有启用预警的安全库存配置
      const safetyStocks = await this.ssRepo.find({
        where: { tenantId, status: 'ACTIVE', alertEnabled: 1 as any },
      });

      if (safetyStocks.length === 0) return;

      const alerts: StockAlert[] = [];

      for (const ss of safetyStocks) {
        // 查询该物料在指定仓库（或全部仓库）的总库存
        const qb = this.invRepo
          .createQueryBuilder('inv')
          .select('SUM(inv.quantity)', 'totalQty')
          .where('inv.tenant_id = :tenantId', { tenantId })
          .andWhere('inv.material_id = :materialId', { materialId: ss.materialId })
          .andWhere('inv.status = :status', { status: 'AVAILABLE' });

        if (ss.warehouseId) {
          qb.innerJoin('wms_location', 'loc', 'loc.id = inv.location_id')
            .andWhere('loc.warehouse_id = :warehouseId', { warehouseId: ss.warehouseId });
        }

        const result = await qb.getRawOne<{ totalQty: string }>();
        const currentQty = Number(result?.totalQty ?? 0);
        const safetyQty = Number(ss.safetyQty);

        if (currentQty < safetyQty) {
          alerts.push({
            materialId: ss.materialId,
            warehouseId: ss.warehouseId,
            safetyQty,
            currentQty,
            shortage: safetyQty - currentQty,
          });
        }
      }

      this.lastAlerts = alerts;
      this.lastCheckTime = new Date();

      if (alerts.length > 0) {
        this.logger.warn(
          `⚠️ 库存预警：${alerts.length} 个物料低于安全库存`,
        );
        for (const a of alerts) {
          this.logger.warn(
            `  物料 ${a.materialId}：当前 ${a.currentQty}，安全库存 ${a.safetyQty}，缺口 ${a.shortage}`,
          );
        }
      } else {
        this.logger.log('✅ 安全库存检查通过，无预警');
      }
    } catch (err) {
      this.logger.error('安全库存检查失败', (err as Error).stack);
    }
  }

  /** 获取最近一次检查结果（供 API 查询） */
  getAlerts() {
    return {
      alerts: this.lastAlerts,
      lastCheckTime: this.lastCheckTime,
      total: this.lastAlerts.length,
    };
  }
}
