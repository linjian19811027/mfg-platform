import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  EamMaintenanceTask,
  MaintenanceTaskStatus,
} from '../entities/eam-maintenance-task.entity.js';
import { EamMaintenancePlan } from '../entities/eam-maintenance-plan.entity.js';
import { EamFaultRecord } from '../entities/eam-fault-record.entity.js';

// ─── Result Types ─────────────────────────────────────────────────────────────

interface CostTrendItem {
  month: string;
  totalCost: number;
  taskCount: number;
}

interface FaultTrendItem {
  month: string;
  faultCount: number;
  totalDowntime: number; // 分钟
}

interface EffectivenessResult {
  currentMtbf: number;
  previousMtbf: number;
  improvement: number; // 百分比
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class MaintenanceAnalyticsService {
  constructor(
    @InjectRepository(EamMaintenanceTask)
    private readonly taskRepo: Repository<EamMaintenanceTask>,
    @InjectRepository(EamMaintenancePlan)
    private readonly planRepo: Repository<EamMaintenancePlan>,
    @InjectRepository(EamFaultRecord)
    private readonly faultRepo: Repository<EamFaultRecord>,
  ) {}

  // ─── 维保成本趋势（按月汇总）──────────────────────────────────────────────

  async maintenanceCostTrend(
    tenantId: string,
    equipmentId?: string,
    months = 12,
  ): Promise<CostTrendItem[]> {
    const qb = this.taskRepo
      .createQueryBuilder('t')
      .select("DATE_FORMAT(t.scheduledDate, '%Y-%m')", 'month')
      .addSelect(
        'SUM(COALESCE(t.laborCost, 0) + COALESCE(t.materialCost, 0))',
        'totalCost',
      )
      .addSelect('COUNT(t.id)', 'taskCount')
      .where('t.tenantId = :tenantId', { tenantId })
      .andWhere('t.status = :status', {
        status: MaintenanceTaskStatus.COMPLETED,
      })
      .andWhere(
        't.scheduledDate >= DATE_SUB(CURDATE(), INTERVAL :months MONTH)',
        { months },
      )
      .groupBy('month')
      .orderBy('month', 'ASC');

    if (equipmentId) {
      qb.andWhere('t.equipmentId = :equipmentId', { equipmentId });
    }

    const rows = await qb.getRawMany();
    return rows.map((r) => ({
      month: r.month as string,
      totalCost: parseFloat(r.totalCost ?? '0'),
      taskCount: parseInt(r.taskCount ?? '0', 10),
    }));
  }

  // ─── 故障趋势（按月统计）─────────────────────────────────────────────────

  async faultTrend(
    tenantId: string,
    equipmentId?: string,
    months = 12,
  ): Promise<FaultTrendItem[]> {
    const qb = this.faultRepo
      .createQueryBuilder('f')
      .select("DATE_FORMAT(f.reportedAt, '%Y-%m')", 'month')
      .addSelect('COUNT(f.id)', 'faultCount')
      .addSelect(
        'SUM(CASE WHEN f.endRepairAt IS NOT NULL THEN TIMESTAMPDIFF(MINUTE, f.reportedAt, f.endRepairAt) ELSE 0 END)',
        'totalDowntime',
      )
      .where('f.tenantId = :tenantId', { tenantId })
      .andWhere('f.reportedAt >= DATE_SUB(CURDATE(), INTERVAL :months MONTH)', {
        months,
      })
      .groupBy('month')
      .orderBy('month', 'ASC');

    if (equipmentId) {
      qb.andWhere('f.equipmentId = :equipmentId', { equipmentId });
    }

    const rows = await qb.getRawMany();
    return rows.map((r) => ({
      month: r.month as string,
      faultCount: parseInt(r.faultCount ?? '0', 10),
      totalDowntime: parseInt(r.totalDowntime ?? '0', 10),
    }));
  }

  // ─── MTBF 计算 ────────────────────────────────────────────────────────────

  async calculateMtbf(
    tenantId: string,
    equipmentId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    const faults = await this.faultRepo
      .createQueryBuilder('f')
      .where('f.tenantId = :tenantId', { tenantId })
      .andWhere('f.equipmentId = :equipmentId', { equipmentId })
      .andWhere('f.reportedAt >= :startDate', { startDate })
      .andWhere('f.reportedAt <= :endDate', { endDate })
      .getMany();

    const faultCount = faults.length;
    if (faultCount === 0) return 0;

    // 总时间（小时）
    const totalHours =
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);

    // 总故障时间（小时）
    const totalFaultHours = faults.reduce((sum, f) => {
      if (f.endRepairAt && f.reportedAt) {
        return (
          sum +
          (f.endRepairAt.getTime() - f.reportedAt.getTime()) / (1000 * 60 * 60)
        );
      }
      return sum;
    }, 0);

    const operatingHours = totalHours - totalFaultHours;
    return operatingHours / faultCount;
  }

  // ─── 维保效果评估 ─────────────────────────────────────────────────────────

  async maintenanceEffectiveness(
    tenantId: string,
    equipmentId: string,
  ): Promise<EffectivenessResult> {
    const now = new Date();

    // 当前3个月
    const currentEnd = now;
    const currentStart = new Date(now);
    currentStart.setMonth(currentStart.getMonth() - 3);

    // 前3个月
    const previousEnd = new Date(currentStart);
    const previousStart = new Date(previousEnd);
    previousStart.setMonth(previousStart.getMonth() - 3);

    const [currentMtbf, previousMtbf] = await Promise.all([
      this.calculateMtbf(tenantId, equipmentId, currentStart, currentEnd),
      this.calculateMtbf(tenantId, equipmentId, previousStart, previousEnd),
    ]);

    let improvement = 0;
    if (previousMtbf > 0) {
      improvement = ((currentMtbf - previousMtbf) / previousMtbf) * 100;
    }

    return {
      currentMtbf: Math.round(currentMtbf * 100) / 100,
      previousMtbf: Math.round(previousMtbf * 100) / 100,
      improvement: Math.round(improvement * 100) / 100,
    };
  }
}
