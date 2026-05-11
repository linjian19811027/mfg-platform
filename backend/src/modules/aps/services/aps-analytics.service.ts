import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ApsSchedule,
  ApsScheduleStatus,
} from '../entities/aps-schedule.entity';
import { ApsResource } from '../entities/aps-resource.entity';
import { CapacityService } from './capacity.service';

// ─── 产能分析 ─────────────────────────────────────────────────────────────────

export interface CapacityResourceItem {
  resourceId: string;
  resourceName: string;
  loadRate: number;
  loadHours: number;
  availableHours: number;
}

export interface CapacityBottleneck {
  resourceId: string;
  resourceName: string;
  loadRate: number;
}

export interface CapacityGapItem {
  resourceId: string;
  resourceName: string;
  gapHours: number;
}

export interface CapacityAnalysisResult {
  resources: CapacityResourceItem[];
  bottlenecks: CapacityBottleneck[];
  gaps: CapacityGapItem[];
}

// ─── 交期分析 ─────────────────────────────────────────────────────────────────

export interface DelayedOrder {
  woId: string;
  scheduledEnd: Date;
  delayHours: number;
}

export type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface RiskOrder {
  woId: string;
  scheduledEnd: Date;
  riskLevel: RiskLevel;
}

export interface DeliveryAnalysisResult {
  totalOrders: number;
  onTimeCount: number;
  onTimeRate: number;
  delayedOrders: DelayedOrder[];
  riskOrders: RiskOrder[];
}

// ─── 甘特图数据 ───────────────────────────────────────────────────────────────

export interface GanttScheduleItem {
  scheduleId: string;
  woId: string;
  start: Date;
  end: Date;
  status: ApsScheduleStatus;
}

export interface GanttResourceRow {
  resourceId: string;
  resourceName: string;
  schedules: GanttScheduleItem[];
}

export interface GanttOrderScheduleItem {
  scheduleId: string;
  resourceId: string;
  start: Date;
  end: Date;
  status: ApsScheduleStatus;
}

export interface GanttOrderRow {
  woId: string;
  schedules: GanttOrderScheduleItem[];
}

export type GanttData = GanttResourceRow[] | GanttOrderRow[];

// ─── 延迟风险阈值（小时）────────────────────────────────────────────────────────
const RISK_HIGH_HOURS = 0; // scheduledEnd 已超过 deliveryDate
const RISK_MEDIUM_HOURS = 24; // 距 deliveryDate 不足 24 小时
const RISK_LOW_HOURS = 72; // 距 deliveryDate 不足 72 小时

@Injectable()
export class ApsAnalyticsService {
  constructor(
    @InjectRepository(ApsSchedule)
    private readonly scheduleRepo: Repository<ApsSchedule>,
    @InjectRepository(ApsResource)
    private readonly resourceRepo: Repository<ApsResource>,
    private readonly capacityService: CapacityService,
  ) {}

  // ─── 3.16 产能分析 ──────────────────────────────────────────────────────────

  async getCapacityAnalysis(
    tenantId: string,
    startDate: Date | string,
    endDate: Date | string,
  ): Promise<CapacityAnalysisResult> {
    const summaries = await this.capacityService.getAllResourcesLoadRate(
      tenantId,
      startDate,
      endDate,
    );

    const resources: CapacityResourceItem[] = summaries.map((s) => ({
      resourceId: s.resourceId,
      resourceName: s.resourceName,
      loadRate: s.loadRate,
      loadHours: s.loadHours,
      availableHours: s.availableHours,
    }));

    // 瓶颈：负荷率 > 80%
    const bottlenecks: CapacityBottleneck[] = summaries
      .filter((s) => s.loadRate > 0.8)
      .map((s) => ({
        resourceId: s.resourceId,
        resourceName: s.resourceName,
        loadRate: s.loadRate,
      }));

    // 产能缺口：负荷率 > 100%，缺口 = (loadRate - 1) * availableHours
    const gaps: CapacityGapItem[] = summaries
      .filter((s) => s.loadRate > 1.0)
      .map((s) => ({
        resourceId: s.resourceId,
        resourceName: s.resourceName,
        gapHours: (s.loadRate - 1) * s.availableHours,
      }));

    return { resources, bottlenecks, gaps };
  }

  // ─── 3.17 交期分析 ──────────────────────────────────────────────────────────

  async getDeliveryAnalysis(
    tenantId: string,
    startDate: Date | string,
    endDate: Date | string,
  ): Promise<DeliveryAnalysisResult> {
    // 查询时间范围内的排程记录（非取消）
    const schedules = await this.scheduleRepo
      .createQueryBuilder('s')
      .where('s.tenant_id = :tenantId', { tenantId })
      .andWhere('s.status != :cancelled', {
        cancelled: ApsScheduleStatus.CANCELLED,
      })
      .andWhere('s.scheduled_start >= :startDate', { startDate })
      .andWhere('s.scheduled_start <= :endDate', { endDate })
      .orderBy('s.scheduled_end', 'ASC')
      .getMany();

    // 按 woId 聚合，取每个工单最晚的 scheduledEnd 作为预计完工时间
    const woEndMap = new Map<string, Date>();
    for (const s of schedules) {
      const existing = woEndMap.get(s.woId);
      if (!existing || s.scheduledEnd > existing) {
        woEndMap.set(s.woId, s.scheduledEnd);
      }
    }

    const totalOrders = woEndMap.size;

    // 基准交期：以查询结束日期作为统一基准（简化方案）
    const baselineDate = new Date(endDate);

    let onTimeCount = 0;
    const delayedOrders: DelayedOrder[] = [];
    const riskOrders: RiskOrder[] = [];

    for (const [woId, scheduledEnd] of woEndMap) {
      const diffMs = scheduledEnd.getTime() - baselineDate.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      if (diffMs <= 0) {
        // scheduledEnd <= baselineDate → 准时
        onTimeCount++;
      } else {
        // 已延迟
        delayedOrders.push({ woId, scheduledEnd, delayHours: diffHours });
      }

      // 风险评估（基于距基准的剩余时间）
      const remainHours =
        (baselineDate.getTime() - scheduledEnd.getTime()) / (1000 * 60 * 60);

      if (diffHours > RISK_HIGH_HOURS) {
        // 已超期
        riskOrders.push({ woId, scheduledEnd, riskLevel: 'HIGH' });
      } else if (remainHours < RISK_MEDIUM_HOURS) {
        // 距截止不足 24 小时
        riskOrders.push({ woId, scheduledEnd, riskLevel: 'MEDIUM' });
      } else if (remainHours < RISK_LOW_HOURS) {
        // 距截止不足 72 小时
        riskOrders.push({ woId, scheduledEnd, riskLevel: 'LOW' });
      }
    }

    const onTimeRate = totalOrders > 0 ? onTimeCount / totalOrders : 0;

    return { totalOrders, onTimeCount, onTimeRate, delayedOrders, riskOrders };
  }

  // ─── 3.18 甘特图数据 ────────────────────────────────────────────────────────

  async getGanttData(
    tenantId: string,
    type: 'resource' | 'order',
    startDate: Date | string,
    endDate: Date | string,
  ): Promise<GanttData> {
    const schedules = await this.scheduleRepo
      .createQueryBuilder('s')
      .where('s.tenant_id = :tenantId', { tenantId })
      .andWhere('s.status != :cancelled', {
        cancelled: ApsScheduleStatus.CANCELLED,
      })
      .andWhere('s.scheduled_start < :endDate', { endDate })
      .andWhere('s.scheduled_end > :startDate', { startDate })
      .orderBy('s.scheduled_start', 'ASC')
      .getMany();

    if (type === 'resource') {
      return this._buildResourceGantt(tenantId, schedules);
    }

    return this._buildOrderGantt(schedules);
  }

  // ─── 私有：按资源分组甘特图 ──────────────────────────────────────────────────

  private async _buildResourceGantt(
    tenantId: string,
    schedules: ApsSchedule[],
  ): Promise<GanttResourceRow[]> {
    // 获取所有涉及的资源 ID
    const resourceIds = [...new Set(schedules.map((s) => s.resourceId))];

    if (resourceIds.length === 0) return [];

    const resources = await this.resourceRepo
      .createQueryBuilder('r')
      .where('r.tenant_id = :tenantId', { tenantId })
      .andWhere('r.id IN (:...ids)', { ids: resourceIds })
      .getMany();

    const resourceMap = new Map<string, ApsResource>(
      resources.map((r) => [r.id, r]),
    );

    // 按资源分组
    const grouped = new Map<string, ApsSchedule[]>();
    for (const s of schedules) {
      const list = grouped.get(s.resourceId) ?? [];
      list.push(s);
      grouped.set(s.resourceId, list);
    }

    const rows: GanttResourceRow[] = [];
    for (const [resourceId, items] of grouped) {
      const resource = resourceMap.get(resourceId);
      rows.push({
        resourceId,
        resourceName: resource?.name ?? resourceId,
        schedules: items.map((s) => ({
          scheduleId: s.id,
          woId: s.woId,
          start: s.scheduledStart,
          end: s.scheduledEnd,
          status: s.status,
        })),
      });
    }

    // 按资源名称排序
    rows.sort((a, b) => a.resourceName.localeCompare(b.resourceName));

    return rows;
  }

  // ─── 私有：按工单分组甘特图 ──────────────────────────────────────────────────

  private _buildOrderGantt(schedules: ApsSchedule[]): GanttOrderRow[] {
    const grouped = new Map<string, ApsSchedule[]>();
    for (const s of schedules) {
      const list = grouped.get(s.woId) ?? [];
      list.push(s);
      grouped.set(s.woId, list);
    }

    const rows: GanttOrderRow[] = [];
    for (const [woId, items] of grouped) {
      rows.push({
        woId,
        schedules: items.map((s) => ({
          scheduleId: s.id,
          resourceId: s.resourceId,
          start: s.scheduledStart,
          end: s.scheduledEnd,
          status: s.status,
        })),
      });
    }

    // 按 woId 排序
    rows.sort((a, b) => a.woId.localeCompare(b.woId));

    return rows;
  }
}
