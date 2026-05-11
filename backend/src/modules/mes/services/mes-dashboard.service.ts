import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MesWorkOrder } from '../entities/mes-work-order.entity.js';
import { TenantContext } from '../../../shared/tenant/tenant.context.js';

@Injectable()
export class MesDashboardService {
  constructor(
    @InjectRepository(MesWorkOrder)
    private readonly woRepo: Repository<MesWorkOrder>,
  ) {}

  // ── 生产进度看板 ──────────────────────────────────────────────────────────

  async getProductionDashboard(): Promise<Record<string, unknown>> {
    const tenantId = TenantContext.requireCurrentTenant();

    const [statusStats, todayOutput] = await Promise.all([
      // 各状态工单数量
      this.woRepo.manager.query(
        `SELECT status, COUNT(*) as count, SUM(planned_qty) as planned_qty, SUM(completed_qty) as completed_qty
         FROM mes_work_order WHERE tenant_id = ? GROUP BY status`,
        [tenantId],
      ),
      // 今日产出
      this.woRepo.manager.query(
        `SELECT SUM(completed_qty) as today_output, SUM(scrap_qty) as today_scrap
         FROM mes_production_report
         WHERE tenant_id = ? AND report_type = 'COMPLETE'
           AND DATE(report_time) = CURDATE()`,
        [tenantId],
      ),
    ]);

    const inProgress = statusStats.find((s: any) => s.status === 'IN_PROGRESS');
    const totalPlanned = statusStats.reduce(
      (s: number, r: any) => s + Number(r.planned_qty ?? 0),
      0,
    );
    const totalCompleted = statusStats.reduce(
      (s: number, r: any) => s + Number(r.completed_qty ?? 0),
      0,
    );

    return {
      statusStats,
      inProgressCount: Number(inProgress?.count ?? 0),
      overallProgress:
        totalPlanned > 0
          ? Math.round((totalCompleted / totalPlanned) * 100)
          : 0,
      todayOutput: Number(todayOutput[0]?.today_output ?? 0),
      todayScrap: Number(todayOutput[0]?.today_scrap ?? 0),
    };
  }

  // ── 工位作业看板 ──────────────────────────────────────────────────────────

  async getWorkstationDashboard(
    workCenterId: string,
  ): Promise<Record<string, unknown>> {
    const tenantId = TenantContext.requireCurrentTenant();

    const [activeOps, pendingWos] = await Promise.all([
      this.woRepo.manager.query(
        `SELECT woo.id, woo.operation_name, woo.status, woo.completed_qty, woo.planned_qty,
                wo.wo_no, wo.material_id, wo.priority
         FROM mes_work_order_operation woo
         JOIN mes_work_order wo ON wo.id = woo.wo_id
         WHERE woo.tenant_id = ? AND woo.work_center_id = ? AND woo.status IN ('PENDING','IN_PROGRESS')
         ORDER BY wo.priority ASC, woo.sequence ASC
         LIMIT 20`,
        [tenantId, workCenterId],
      ),
      this.woRepo.manager.query(
        `SELECT COUNT(*) as count FROM mes_work_order
         WHERE tenant_id = ? AND work_center_id = ? AND status = 'RELEASED'`,
        [tenantId, workCenterId],
      ),
    ]);

    return {
      workCenterId,
      activeOperations: activeOps,
      pendingWorkOrders: Number(pendingWos[0]?.count ?? 0),
    };
  }

  // ── 质量看板 ──────────────────────────────────────────────────────────────

  async getQualityDashboard(): Promise<Record<string, unknown>> {
    const tenantId = TenantContext.requireCurrentTenant();

    const [scrapStats, ncStats] = await Promise.all([
      this.woRepo.manager.query(
        `SELECT DATE(report_time) as date,
                SUM(completed_qty) as good_qty, SUM(scrap_qty) as scrap_qty
         FROM mes_production_report
         WHERE tenant_id = ? AND report_type IN ('COMPLETE','SCRAP')
           AND report_time >= DATE_SUB(NOW(), INTERVAL 7 DAY)
         GROUP BY DATE(report_time) ORDER BY date`,
        [tenantId],
      ),
      this.woRepo.manager
        .query(
          `SELECT COUNT(*) as open_nc FROM qms_nonconformance
         WHERE tenant_id = ? AND status = 'OPEN'`,
          [tenantId],
        )
        .catch(() => [{ open_nc: 0 }]),
    ]);

    const totalGood = scrapStats.reduce(
      (s: number, r: any) => s + Number(r.good_qty ?? 0),
      0,
    );
    const totalScrap = scrapStats.reduce(
      (s: number, r: any) => s + Number(r.scrap_qty ?? 0),
      0,
    );
    const passRate =
      totalGood + totalScrap > 0
        ? Math.round((totalGood / (totalGood + totalScrap)) * 10000) / 100
        : 100;

    return {
      last7Days: scrapStats,
      passRate,
      openNonconformances: Number(ncStats[0]?.open_nc ?? 0),
    };
  }

  // ── 设备看板 ──────────────────────────────────────────────────────────────

  async getEquipmentDashboard(): Promise<Record<string, unknown>> {
    const tenantId = TenantContext.requireCurrentTenant();

    const failures = await this.woRepo.manager.query(
      `SELECT pr.equipment_id, pr.exception_type, pr.exception_reason, pr.report_time
       FROM mes_production_report pr
       WHERE pr.tenant_id = ? AND pr.report_type = 'EXCEPTION'
         AND pr.exception_type = 'MACHINE_DOWN'
         AND pr.report_time >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
       ORDER BY pr.report_time DESC`,
      [tenantId],
    );

    return { recentFailures: failures, failureCount: failures.length };
  }

  // ── 班组看板 ──────────────────────────────────────────────────────────────

  async getTeamDashboard(): Promise<Record<string, unknown>> {
    const tenantId = TenantContext.requireCurrentTenant();

    const teamOutput = await this.woRepo.manager.query(
      `SELECT pr.operator_id,
              SUM(pr.completed_qty) as output,
              SUM(pr.scrap_qty) as scrap,
              COUNT(*) as report_count
       FROM mes_production_report pr
       WHERE pr.tenant_id = ? AND pr.report_type = 'COMPLETE'
         AND DATE(pr.report_time) = CURDATE()
       GROUP BY pr.operator_id
       ORDER BY output DESC`,
      [tenantId],
    );

    return { todayTeamOutput: teamOutput };
  }
}
