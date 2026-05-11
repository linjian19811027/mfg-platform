import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ApsResource,
  ApsResourceStatus,
  ApsResourceType,
} from '../entities/aps-resource.entity';
import {
  ApsSchedule,
  ApsScheduleStatus,
} from '../entities/aps-schedule.entity';

// ─── 物料齐套 ────────────────────────────────────────────────────────────────

export interface MaterialItem {
  materialId: string;
  requiredQty: number;
  availableQty: number;
}

export interface MaterialShortage {
  materialId: string;
  requiredQty: number;
  availableQty: number;
  shortageQty: number;
}

export interface MaterialReadinessResult {
  ready: boolean;
  shortages: MaterialShortage[];
}

// ─── 设备能力 ────────────────────────────────────────────────────────────────

export interface EquipmentCapacityResult {
  feasible: boolean;
  reason?: string;
  availableHours: number;
  scheduledHours: number;
}

// ─── 工装可用 ────────────────────────────────────────────────────────────────

export interface ToolAvailabilityItem {
  resourceId: string;
  available: boolean;
  reason?: string;
}

// ─── 综合约束 ────────────────────────────────────────────────────────────────

export interface AllConstraintsInput {
  woId: string;
  resourceId: string;
  requiredHours: number;
  startDate: Date | string;
  endDate: Date | string;
  materials?: MaterialItem[];
  toolIds?: string[];
}

export interface AllConstraintsResult {
  passed: boolean;
  failures: string[];
}

@Injectable()
export class ConstraintCheckService {
  constructor(
    @InjectRepository(ApsResource)
    private readonly resourceRepo: Repository<ApsResource>,
    @InjectRepository(ApsSchedule)
    private readonly scheduleRepo: Repository<ApsSchedule>,
  ) {}

  // ─── 1. 物料齐套检查 ──────────────────────────────────────────────────────

  async checkMaterialReadiness(
    _tenantId: string,
    _woId: string,
    materials: MaterialItem[],
  ): Promise<MaterialReadinessResult> {
    const shortages: MaterialShortage[] = [];

    for (const m of materials) {
      const required = Number(m.requiredQty);
      const available = Number(m.availableQty);
      if (available < required) {
        shortages.push({
          materialId: m.materialId,
          requiredQty: required,
          availableQty: available,
          shortageQty: required - available,
        });
      }
    }

    return { ready: shortages.length === 0, shortages };
  }

  // ─── 2. 设备能力约束 ──────────────────────────────────────────────────────

  async checkEquipmentCapacity(
    tenantId: string,
    resourceId: string,
    requiredHours: number,
    startDate: Date | string,
    endDate: Date | string,
  ): Promise<EquipmentCapacityResult> {
    // 查询资源
    const resource = await this.resourceRepo.findOne({
      where: { id: resourceId, tenantId },
    });
    if (!resource) {
      return {
        feasible: false,
        reason: `资源 #${resourceId} 不存在`,
        availableHours: 0,
        scheduledHours: 0,
      };
    }

    if (resource.status !== ApsResourceStatus.AVAILABLE) {
      return {
        feasible: false,
        reason: `资源 ${resource.name}（${resource.code}）当前状态为 ${resource.status}，不可用`,
        availableHours: 0,
        scheduledHours: 0,
      };
    }

    // 计算时间窗口总小时数（作为可用工时上限）
    const startMs = new Date(startDate).getTime();
    const endMs = new Date(endDate).getTime();
    const windowHours = (endMs - startMs) / (1000 * 60 * 60);
    const availableHours =
      windowHours * Number(resource.capacity) * Number(resource.efficiency);

    // 查询已排程工时
    const scheduledHours = await this._getScheduledHours(
      tenantId,
      resourceId,
      startDate,
      endDate,
    );

    const remainingHours = availableHours - scheduledHours;
    const feasible = remainingHours >= requiredHours;

    const result: EquipmentCapacityResult = {
      feasible,
      availableHours,
      scheduledHours,
    };
    if (!feasible) {
      result.reason = `产能不足：剩余 ${remainingHours.toFixed(2)}h，需求 ${requiredHours.toFixed(2)}h（可用 ${availableHours.toFixed(2)}h，已占用 ${scheduledHours.toFixed(2)}h）`;
    }

    return result;
  }

  // ─── 3. 模具/工装可用约束 ─────────────────────────────────────────────────

  async checkToolAvailability(
    tenantId: string,
    toolResourceIds: string[],
    requiredDate: Date | string,
  ): Promise<ToolAvailabilityItem[]> {
    if (toolResourceIds.length === 0) return [];

    // 批量查询工装资源
    const resources = await this.resourceRepo
      .createQueryBuilder('r')
      .where('r.tenant_id = :tenantId', { tenantId })
      .andWhere('r.id IN (:...ids)', { ids: toolResourceIds })
      .andWhere('r.type IN (:...types)', {
        types: [ApsResourceType.TOOL, ApsResourceType.FIXTURE],
      })
      .getMany();

    const resourceMap = new Map<string, ApsResource>(
      resources.map((r) => [r.id, r]),
    );

    // 查询 requiredDate 当天有冲突的排程（非取消状态）
    const dayStart = new Date(requiredDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(requiredDate);
    dayEnd.setHours(23, 59, 59, 999);

    const conflictSchedules = await this.scheduleRepo
      .createQueryBuilder('s')
      .where('s.tenant_id = :tenantId', { tenantId })
      .andWhere('s.resource_id IN (:...ids)', { ids: toolResourceIds })
      .andWhere('s.status != :cancelled', {
        cancelled: ApsScheduleStatus.CANCELLED,
      })
      .andWhere('s.scheduled_start <= :dayEnd', { dayEnd })
      .andWhere('s.scheduled_end >= :dayStart', { dayStart })
      .getMany();

    const conflictResourceIds = new Set(
      conflictSchedules.map((s) => s.resourceId),
    );

    return toolResourceIds.map((id) => {
      const resource = resourceMap.get(id);

      if (!resource) {
        return {
          resourceId: id,
          available: false,
          reason: `资源 #${id} 不存在或类型不是 TOOL/FIXTURE`,
        };
      }

      if (resource.status !== ApsResourceStatus.AVAILABLE) {
        return {
          resourceId: id,
          available: false,
          reason: `${resource.name}（${resource.code}）当前状态为 ${resource.status}，不可用`,
        };
      }

      if (conflictResourceIds.has(id)) {
        return {
          resourceId: id,
          available: false,
          reason: `${resource.name}（${resource.code}）在 ${new Date(requiredDate).toLocaleDateString()} 已有排程冲突`,
        };
      }

      return { resourceId: id, available: true };
    });
  }

  // ─── 4. 综合约束检查 ──────────────────────────────────────────────────────

  async checkAllConstraints(
    tenantId: string,
    input: AllConstraintsInput,
  ): Promise<AllConstraintsResult> {
    const failures: string[] = [];

    // 4.1 物料齐套
    if (input.materials && input.materials.length > 0) {
      const matResult = await this.checkMaterialReadiness(
        tenantId,
        input.woId,
        input.materials,
      );
      if (!matResult.ready) {
        for (const s of matResult.shortages) {
          failures.push(
            `物料 #${s.materialId} 缺料：需求 ${s.requiredQty}，可用 ${s.availableQty}，缺口 ${s.shortageQty}`,
          );
        }
      }
    }

    // 4.2 设备能力
    const eqResult = await this.checkEquipmentCapacity(
      tenantId,
      input.resourceId,
      input.requiredHours,
      input.startDate,
      input.endDate,
    );
    if (!eqResult.feasible) {
      failures.push(eqResult.reason ?? '设备能力不足');
    }

    // 4.3 工装可用
    if (input.toolIds && input.toolIds.length > 0) {
      const toolResults = await this.checkToolAvailability(
        tenantId,
        input.toolIds,
        input.startDate,
      );
      for (const t of toolResults) {
        if (!t.available) {
          failures.push(t.reason ?? `工装 #${t.resourceId} 不可用`);
        }
      }
    }

    return { passed: failures.length === 0, failures };
  }

  // ─── 私有：计算已排程工时 ─────────────────────────────────────────────────

  private async _getScheduledHours(
    tenantId: string,
    resourceId: string,
    startDate: Date | string,
    endDate: Date | string,
  ): Promise<number> {
    const schedules = await this.scheduleRepo
      .createQueryBuilder('s')
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
