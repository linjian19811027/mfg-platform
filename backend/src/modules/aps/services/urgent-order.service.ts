import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual, Not } from 'typeorm';
import {
  ApsSchedule,
  ApsScheduleStatus,
} from '../entities/aps-schedule.entity';
import { SchedulerService } from './scheduler.service';

// ─── 输入 / 输出类型 ──────────────────────────────────────────────────────────

export interface UrgentOrderInput {
  woId: string;
  resourceId: string;
  requiredHours: number;
  requiredDate: Date;
  priority?: number;
}

export interface ImpactAnalysis {
  affectedSchedules: ApsSchedule[];
  totalDelayHours: number;
}

export interface InsertUrgentOrderResult {
  urgentSchedule: ApsSchedule;
  rescheduled: ApsSchedule[];
  impact: {
    affectedCount: number;
    totalDelayHours: number;
  };
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class UrgentOrderService {
  constructor(
    @InjectRepository(ApsSchedule)
    private readonly scheduleRepo: Repository<ApsSchedule>,
    private readonly schedulerService: SchedulerService,
  ) {}

  /**
   * 影响分析：找出在 requiredDate 前后、同一资源上会被推迟的工单
   */
  async analyzeImpact(
    tenantId: string,
    urgentInput: UrgentOrderInput,
  ): Promise<ImpactAnalysis> {
    const { resourceId, requiredDate, requiredHours } = urgentInput;

    // 查询该资源在 requiredDate 之后（含当天）的已排程工单，按开始时间升序
    const scheduled = await this.scheduleRepo.find({
      where: {
        tenantId,
        resourceId,
        status: Not(ApsScheduleStatus.CANCELLED),
        scheduledStart: MoreThanOrEqual(requiredDate),
      },
      order: { scheduledStart: 'ASC' },
    });

    if (scheduled.length === 0) {
      return { affectedSchedules: [], totalDelayHours: 0 };
    }

    // 紧急工单占用的时间（毫秒）
    const urgentDurationMs = requiredHours * 60 * 60 * 1000;

    // 所有排在 requiredDate 之后的工单都会被整体后移
    // 延迟量 = 紧急工单时长（最坏情况：全部顺延）
    const delayHours = urgentDurationMs / (60 * 60 * 1000);

    return {
      affectedSchedules: scheduled,
      totalDelayHours: delayHours * scheduled.length,
    };
  }

  /**
   * 插入紧急工单，并对受影响工单进行局部重排
   */
  async insertUrgentOrder(
    tenantId: string,
    urgentInput: UrgentOrderInput,
    forceInsert = false,
  ): Promise<InsertUrgentOrderResult> {
    const {
      woId,
      resourceId,
      requiredHours,
      requiredDate,
      priority = 1,
    } = urgentInput;

    // 1. 影响分析
    const impact = await this.analyzeImpact(tenantId, urgentInput);

    // 2. 创建紧急工单排程（priority=1，插到队列最前面）
    const urgentDurationMs = requiredHours * 60 * 60 * 1000;
    const urgentEnd = new Date(requiredDate.getTime() + urgentDurationMs);

    const urgentSchedule = this.scheduleRepo.create({
      tenantId,
      woId,
      resourceId,
      scheduledStart: requiredDate,
      scheduledEnd: urgentEnd,
      priority,
      status: ApsScheduleStatus.SCHEDULED,
      isSimulation: 0,
    });

    const savedUrgent = await this.scheduleRepo.save(urgentSchedule);

    // 3. 对受影响工单进行局部重排（从紧急工单结束时间开始，依次找下一个可用时间槽）
    const rescheduled: ApsSchedule[] = [];

    if (impact.affectedSchedules.length > 0) {
      let cursor = urgentEnd;

      for (const affected of impact.affectedSchedules) {
        const durationMs =
          affected.scheduledEnd.getTime() - affected.scheduledStart.getTime();
        const durationHours = durationMs / (60 * 60 * 1000);

        // 找下一个可用时间槽（从 cursor 开始）
        const slot = await this.schedulerService.findNextAvailableSlot(
          tenantId,
          resourceId,
          durationHours,
          cursor,
        );

        affected.scheduledStart = slot.start;
        affected.scheduledEnd = slot.end;

        const saved = await this.scheduleRepo.save(affected);
        rescheduled.push(saved);

        // 下一个工单从本工单结束后开始
        cursor = slot.end;
      }
    }

    return {
      urgentSchedule: savedUrgent,
      rescheduled,
      impact: {
        affectedCount: impact.affectedSchedules.length,
        totalDelayHours: impact.totalDelayHours,
      },
    };
  }
}
