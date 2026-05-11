import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, MoreThan } from 'typeorm';
import {
  ApsSchedule,
  ApsScheduleStatus,
} from '../entities/aps-schedule.entity';
import {
  ApsResource,
  ApsResourceStatus,
} from '../entities/aps-resource.entity';
import { SchedulerService } from './scheduler.service';
import {
  MessageService,
  MESSAGE_SERVICE,
} from '../../../shared/message/message.interface.js';
import { v4 as uuidv4 } from 'uuid';

// ─── 输入 / 输出类型 ──────────────────────────────────────────────────────────

export interface OrderChanges {
  newDeliveryDate?: Date;
  newRequiredHours?: number;
}

export interface ReplanByOrderChangeResult {
  rescheduled: ApsSchedule[];
  feasible: boolean;
  estimatedEnd: Date;
}

export interface ReplanByEquipmentFailureResult {
  affected: number;
  rescheduled: ApsSchedule[];
}

export interface ReplanByMaterialDelayResult {
  rescheduled: ApsSchedule[];
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class ReplanService {
  constructor(
    @InjectRepository(ApsSchedule)
    private readonly scheduleRepo: Repository<ApsSchedule>,
    @InjectRepository(ApsResource)
    private readonly resourceRepo: Repository<ApsResource>,
    private readonly schedulerService: SchedulerService,
    @Inject(MESSAGE_SERVICE) private readonly messageService: MessageService,
  ) {}

  /**
   * 3.10 订单变更触发局部重排
   * changes: { newDeliveryDate?, newRequiredHours? }
   */
  async replanByOrderChange(
    tenantId: string,
    woId: string,
    changes: OrderChanges,
  ): Promise<ReplanByOrderChangeResult> {
    const { newDeliveryDate, newRequiredHours } = changes;

    // 查询该 woId 的所有排程，按开始时间升序
    const schedules = await this.scheduleRepo.find({
      where: { tenantId, woId },
      order: { scheduledStart: 'ASC' },
    });

    if (schedules.length === 0) {
      const now = new Date();
      return { rescheduled: [], feasible: true, estimatedEnd: now };
    }

    const rescheduled: ApsSchedule[] = [];

    // 如果工时变化，重新计算 scheduledEnd
    if (newRequiredHours !== undefined) {
      const durationMs = newRequiredHours * 60 * 60 * 1000;
      for (const s of schedules) {
        s.scheduledEnd = new Date(s.scheduledStart.getTime() + durationMs);
        const saved = await this.scheduleRepo.save(s);
        rescheduled.push(saved);
      }
    }

    // 取最新的排程列表（可能已被上面更新）
    const current = rescheduled.length > 0 ? rescheduled : schedules;
    const lastSchedule = current[current.length - 1];
    const estimatedEnd = lastSchedule.scheduledEnd;

    // 如果交期变化，检查是否满足新交期
    let feasible = true;
    if (newDeliveryDate !== undefined) {
      feasible = estimatedEnd <= newDeliveryDate;

      // 不满足则重排：从当前时间开始，为每条排程找下一个可用时间槽
      if (!feasible) {
        let cursor = new Date();
        const replanResult: ApsSchedule[] = [];

        for (const s of current) {
          const durationMs =
            s.scheduledEnd.getTime() - s.scheduledStart.getTime();
          const durationHours = durationMs / (60 * 60 * 1000);

          const slot = await this.schedulerService.findNextAvailableSlot(
            tenantId,
            s.resourceId,
            durationHours,
            cursor,
          );

          s.scheduledStart = slot.start;
          s.scheduledEnd = slot.end;
          const saved = await this.scheduleRepo.save(s);
          replanResult.push(saved);
          cursor = slot.end;
        }

        const newEstimatedEnd =
          replanResult[replanResult.length - 1].scheduledEnd;
        feasible = newEstimatedEnd <= newDeliveryDate;

        await this.messageService.publish({
          eventId: uuidv4(),
          eventType: 'APS_REPLAN_ORDER_CHANGE',
          tenantId,
          sourceModule: 'APS',
          targetModule: 'APS',
          payload: { woId, changes, feasible, estimatedEnd: newEstimatedEnd },
          createdAt: new Date(),
        });

        return {
          rescheduled: replanResult,
          feasible,
          estimatedEnd: newEstimatedEnd,
        };
      }
    }

    return { rescheduled, feasible, estimatedEnd };
  }

  /**
   * 3.11 设备故障触发重排
   * 将故障资源在 failureStart 之后的排程转移到备用资源或推迟 8 小时
   */
  async replanByEquipmentFailure(
    tenantId: string,
    resourceId: string,
    failureStart: Date,
    alternativeResourceId?: string,
  ): Promise<ReplanByEquipmentFailureResult> {
    // 查询该资源在 failureStart 之后的 SCHEDULED/CONFIRMED 排程
    const affected = await this.scheduleRepo.find({
      where: {
        tenantId,
        resourceId,
        status: In([ApsScheduleStatus.SCHEDULED, ApsScheduleStatus.CONFIRMED]),
        scheduledStart: MoreThan(failureStart),
      },
      order: { scheduledStart: 'ASC' },
    });

    if (affected.length === 0) {
      return { affected: 0, rescheduled: [] };
    }

    const rescheduled: ApsSchedule[] = [];

    if (alternativeResourceId) {
      // 转移到备用资源：为每条排程在备用资源上找下一个可用时间槽
      let cursor = failureStart;

      for (const s of affected) {
        const durationMs =
          s.scheduledEnd.getTime() - s.scheduledStart.getTime();
        const durationHours = durationMs / (60 * 60 * 1000);

        const slot = await this.schedulerService.findNextAvailableSlot(
          tenantId,
          alternativeResourceId,
          durationHours,
          cursor,
        );

        s.resourceId = alternativeResourceId;
        s.scheduledStart = slot.start;
        s.scheduledEnd = slot.end;
        const saved = await this.scheduleRepo.save(s);
        rescheduled.push(saved);
        cursor = slot.end;
      }
    } else {
      // 推迟 8 小时
      const delayMs = 8 * 60 * 60 * 1000;

      for (const s of affected) {
        s.scheduledStart = new Date(s.scheduledStart.getTime() + delayMs);
        s.scheduledEnd = new Date(s.scheduledEnd.getTime() + delayMs);
        const saved = await this.scheduleRepo.save(s);
        rescheduled.push(saved);
      }
    }

    await this.messageService.publish({
      eventId: uuidv4(),
      eventType: 'APS_REPLAN_EQUIPMENT_FAILURE',
      tenantId,
      sourceModule: 'APS',
      targetModule: 'APS',
      payload: {
        resourceId,
        failureStart,
        alternativeResourceId,
        affectedCount: affected.length,
      },
      createdAt: new Date(),
    });

    return { affected: affected.length, rescheduled };
  }

  /**
   * 3.12 物料延迟触发重排
   * 将该 woId 的排程整体推迟 delayHours
   */
  async replanByMaterialDelay(
    tenantId: string,
    woId: string,
    delayHours: number,
    alternativeMaterialId?: string,
  ): Promise<ReplanByMaterialDelayResult> {
    const schedules = await this.scheduleRepo.find({
      where: { tenantId, woId },
      order: { scheduledStart: 'ASC' },
    });

    if (schedules.length === 0) {
      return { rescheduled: [] };
    }

    const delayMs = delayHours * 60 * 60 * 1000;
    const rescheduled: ApsSchedule[] = [];

    for (const s of schedules) {
      s.scheduledStart = new Date(s.scheduledStart.getTime() + delayMs);
      s.scheduledEnd = new Date(s.scheduledEnd.getTime() + delayMs);
      const saved = await this.scheduleRepo.save(s);
      rescheduled.push(saved);
    }

    await this.messageService.publish({
      eventId: uuidv4(),
      eventType: 'APS_REPLAN_MATERIAL_DELAY',
      tenantId,
      sourceModule: 'APS',
      targetModule: 'APS',
      payload: { woId, delayHours, alternativeMaterialId },
      createdAt: new Date(),
    });

    return { rescheduled };
  }

  /**
   * 处理设备状态变更事件
   * BREAKDOWN/REPAIR/MAINTENANCE → 触发重排；AVAILABLE → 不做重排
   */
  async handleEquipmentStatusChange(
    tenantId: string,
    resourceId: string,
    newStatus: ApsResourceStatus,
  ): Promise<ReplanByEquipmentFailureResult | null> {
    const failureStatuses: ApsResourceStatus[] = [
      ApsResourceStatus.BREAKDOWN,
      ApsResourceStatus.REPAIR,
      ApsResourceStatus.MAINTENANCE,
    ];

    if (!failureStatuses.includes(newStatus)) {
      // 设备恢复，不做重排
      return null;
    }

    // 查询资源，获取备用资源列表
    const resource = await this.resourceRepo.findOne({
      where: { id: resourceId, tenantId },
    });

    const alternativeResourceId = resource?.alternativeResources?.[0];

    return this.replanByEquipmentFailure(
      tenantId,
      resourceId,
      new Date(),
      alternativeResourceId,
    );
  }
}
