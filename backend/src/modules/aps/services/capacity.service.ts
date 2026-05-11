import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApsCalendarService } from './aps-calendar.service';
import {
  ApsResource,
  ApsResourceStatus,
} from '../entities/aps-resource.entity';
import {
  ApsSchedule,
  ApsScheduleStatus,
} from '../entities/aps-schedule.entity';

export interface ResourceAvailableHoursResult {
  totalHours: number;
  calendarHours: number;
  efficiency: number;
}

export interface ResourceLoadRateResult {
  loadHours: number;
  availableHours: number;
  loadRate: number;
}

export interface CapacityGapResult {
  available: boolean;
  gapHours: number;
  message?: string;
}

export interface InfiniteCapacityOrder {
  woId: string;
  resourceId: string;
  requiredHours: number;
  requiredDate: Date | string;
}

export interface InfiniteCapacityCheckResult {
  woId: string;
  resourceId: string;
  feasible: boolean;
  reason?: string;
}

export interface ResourceLoadSummary {
  resourceId: string;
  resourceName: string;
  loadRate: number;
  loadHours: number;
  availableHours: number;
}

@Injectable()
export class CapacityService {
  constructor(
    private readonly calendarService: ApsCalendarService,
    @InjectRepository(ApsResource)
    private readonly resourceRepo: Repository<ApsResource>,
    @InjectRepository(ApsSchedule)
    private readonly scheduleRepo: Repository<ApsSchedule>,
  ) {}

  /**
   * 计算资源在日期范围内的可用工时（日历工时 × 效率系数）
   */
  async getResourceAvailableHours(
    tenantId: string,
    resourceId: string,
    startDate: Date | string,
    endDate: Date | string,
  ): Promise<ResourceAvailableHoursResult> {
    const resource = await this.resourceRepo.findOne({
      where: { id: resourceId, tenantId },
    });
    if (!resource) {
      throw new NotFoundException(`ApsResource #${resourceId} not found`);
    }

    const calendarHours = await this.calendarService.getWorkingHoursBetween(
      tenantId,
      resourceId,
      startDate,
      endDate,
    );

    const efficiency = Number(resource.efficiency);
    const totalHours = calendarHours * efficiency;

    return { totalHours, calendarHours, efficiency };
  }

  /**
   * 计算资源负荷率（已排程工时 / 可用工时）
   */
  async getResourceLoadRate(
    tenantId: string,
    resourceId: string,
    startDate: Date | string,
    endDate: Date | string,
  ): Promise<ResourceLoadRateResult> {
    const { totalHours: availableHours } = await this.getResourceAvailableHours(
      tenantId,
      resourceId,
      startDate,
      endDate,
    );

    const loadHours = await this._getScheduledHours(
      tenantId,
      resourceId,
      startDate,
      endDate,
    );

    const loadRate = availableHours > 0 ? loadHours / availableHours : 0;

    return { loadHours, availableHours, loadRate };
  }

  /**
   * 产能缺口检查：可用工时 - 已占用工时 - requiredHours
   */
  async checkCapacityGap(
    tenantId: string,
    resourceId: string,
    requiredHours: number,
    startDate: Date | string,
    endDate: Date | string,
  ): Promise<CapacityGapResult> {
    const { totalHours: availableHours } = await this.getResourceAvailableHours(
      tenantId,
      resourceId,
      startDate,
      endDate,
    );

    const loadHours = await this._getScheduledHours(
      tenantId,
      resourceId,
      startDate,
      endDate,
    );

    const gapHours = availableHours - loadHours - requiredHours;
    const available = gapHours >= 0;

    const result: CapacityGapResult = { available, gapHours };
    if (!available) {
      result.message = `产能不足：缺口 ${Math.abs(gapHours).toFixed(2)} 小时（可用 ${availableHours.toFixed(2)}h，已占用 ${loadHours.toFixed(2)}h，需求 ${requiredHours.toFixed(2)}h）`;
    }

    return result;
  }

  /**
   * 无限产能模式快速验证：忽略产能限制，只检查资源是否存在且状态为 AVAILABLE
   */
  async getInfiniteCapacityCheck(
    tenantId: string,
    orders: InfiniteCapacityOrder[],
  ): Promise<InfiniteCapacityCheckResult[]> {
    if (orders.length === 0) return [];

    // 批量查询涉及的资源，减少 DB 查询次数
    const resourceIds = [...new Set(orders.map((o) => o.resourceId))];
    const resources = await this.resourceRepo
      .createQueryBuilder('r')
      .where('r.tenant_id = :tenantId', { tenantId })
      .andWhere('r.id IN (:...ids)', { ids: resourceIds })
      .getMany();

    const resourceMap = new Map<string, ApsResource>(
      resources.map((r) => [r.id, r]),
    );

    return orders.map((order) => {
      const resource = resourceMap.get(order.resourceId);

      if (!resource) {
        return {
          woId: order.woId,
          resourceId: order.resourceId,
          feasible: false,
          reason: `资源 #${order.resourceId} 不存在`,
        };
      }

      if (resource.status !== ApsResourceStatus.AVAILABLE) {
        return {
          woId: order.woId,
          resourceId: order.resourceId,
          feasible: false,
          reason: `资源 ${resource.name}（${resource.code}）当前状态为 ${resource.status}，不可用`,
        };
      }

      return {
        woId: order.woId,
        resourceId: order.resourceId,
        feasible: true,
      };
    });
  }

  /**
   * 所有资源的负荷率汇总，按 loadRate 降序排列（瓶颈识别）
   */
  async getAllResourcesLoadRate(
    tenantId: string,
    startDate: Date | string,
    endDate: Date | string,
  ): Promise<ResourceLoadSummary[]> {
    const resources = await this.resourceRepo.find({ where: { tenantId } });

    const results = await Promise.all(
      resources.map(async (resource) => {
        const { loadHours, availableHours, loadRate } =
          await this.getResourceLoadRate(
            tenantId,
            resource.id,
            startDate,
            endDate,
          );
        return {
          resourceId: resource.id,
          resourceName: resource.name,
          loadRate,
          loadHours,
          availableHours,
        };
      }),
    );

    // 按负荷率降序排列，便于识别瓶颈
    return results.sort((a, b) => b.loadRate - a.loadRate);
  }

  /**
   * 查询资源在时间范围内的已排程工时（毫秒转小时）
   * 只统计非取消状态的排程
   */
  private async _getScheduledHours(
    tenantId: string,
    resourceId: string,
    startDate: Date | string,
    endDate: Date | string,
  ): Promise<number> {
    const schedules = await this.scheduleRepo
      .createQueryBuilder('s')
      .select(['s.scheduled_start', 's.scheduled_end'])
      .where('s.tenant_id = :tenantId', { tenantId })
      .andWhere('s.resource_id = :resourceId', { resourceId })
      .andWhere('s.status != :cancelled', {
        cancelled: ApsScheduleStatus.CANCELLED,
      })
      .andWhere('s.scheduled_start < :endDate', { endDate })
      .andWhere('s.scheduled_end > :startDate', { startDate })
      .getMany();

    const startMs = new Date(startDate).getTime();
    const endMs = new Date(endDate).getTime();

    let totalMs = 0;
    for (const s of schedules) {
      // 裁剪到查询范围内
      const clampedStart = Math.max(
        new Date(s.scheduledStart).getTime(),
        startMs,
      );
      const clampedEnd = Math.min(new Date(s.scheduledEnd).getTime(), endMs);
      if (clampedEnd > clampedStart) {
        totalMs += clampedEnd - clampedStart;
      }
    }

    return totalMs / (1000 * 60 * 60);
  }
}
