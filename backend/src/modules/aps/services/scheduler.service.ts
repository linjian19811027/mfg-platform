import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  ApsSchedule,
  ApsScheduleStatus,
} from '../entities/aps-schedule.entity';
import { ApsResource } from '../entities/aps-resource.entity';
import {
  ApsPriorityRule,
  ApsPriorityRuleType,
} from '../entities/aps-priority-rule.entity';
import { ApsCalendarService } from './aps-calendar.service';
import {
  MessageService,
  MESSAGE_SERVICE,
} from '../../../shared/message/message.interface.js';
import { v4 as uuidv4 } from 'uuid';

export interface ScheduleInput {
  woId: string;
  wooId?: string;
  resourceId: string;
  requiredHours: number;
  priority?: number;
  deliveryDate?: Date;
  profit?: number;
  /** BOM 父工单 APS ID（根工单为 null） */
  parentWoId?: string;
  /** BOM 层级（根=0） */
  bomLevel?: number;
  /** 根工单 APS ID */
  rootWoId?: string;
}

export interface ScheduleForwardOptions {
  startFrom?: Date;
  isSimulation?: boolean;
  priorityRuleType?: string;
}

export interface ScheduledResult extends ApsSchedule {
  estimatedDelivery: Date;
}

export interface BackwardResult {
  woId: string;
  latestStart: Date;
  latestEnd: Date;
  slack: number;
}

export interface TimeSlot {
  start: Date;
  end: Date;
}

@Injectable()
export class SchedulerService {
  constructor(
    @InjectRepository(ApsSchedule)
    private readonly scheduleRepo: Repository<ApsSchedule>,
    @InjectRepository(ApsResource)
    private readonly resourceRepo: Repository<ApsResource>,
    @InjectRepository(ApsPriorityRule)
    private readonly priorityRuleRepo: Repository<ApsPriorityRule>,
    private readonly calendarService: ApsCalendarService,
    @Inject(MESSAGE_SERVICE) private readonly messageService: MessageService,
  ) {}

  // ─── 正向排程 ────────────────────────────────────────────────────────────────

  async scheduleForward(
    tenantId: string,
    inputs: ScheduleInput[],
    options: ScheduleForwardOptions = {},
  ): Promise<ScheduledResult[]> {
    const {
      startFrom = new Date(),
      isSimulation = false,
      priorityRuleType,
    } = options;

    const sorted = this._sortByPriority(
      inputs,
      priorityRuleType ?? ApsPriorityRuleType.DELIVERY_DATE,
    );

    const results: ScheduledResult[] = [];

    for (const input of sorted) {
      const slot = await this.findNextAvailableSlot(
        tenantId,
        input.resourceId,
        input.requiredHours,
        startFrom,
      );

      const schedule = this.scheduleRepo.create({
        tenantId,
        woId: input.woId,
        wooId: input.wooId,
        resourceId: input.resourceId,
        scheduledStart: slot.start,
        scheduledEnd: slot.end,
        priority: input.priority ?? 5,
        status: ApsScheduleStatus.SCHEDULED,
        isSimulation: isSimulation ? 1 : 0,
      });

      const saved = await this.scheduleRepo.save(schedule);

      results.push({
        ...saved,
        estimatedDelivery: slot.end,
      });
    }

    if (!isSimulation) {
      const scheduleIds = results.map((r) => r.id);
      // 构建 woId → BOM 层级信息映射，传给 releaseWorkOrders
      const bomMeta = new Map(
        inputs.map((i) => [
          i.woId,
          {
            parentWoId: i.parentWoId,
            bomLevel: i.bomLevel,
            rootWoId: i.rootWoId,
          },
        ]),
      );
      await this.releaseWorkOrders(tenantId, scheduleIds, bomMeta);
    }

    return results;
  }

  // ─── 发布派工单 ───────────────────────────────────────────────────────────────

  /**
   * @param bomMeta 可选：woId → BOM 层级信息映射，由 scheduleForward 传入
   */
  async releaseWorkOrders(
    tenantId: string,
    scheduleIds: string[],
    bomMeta?: Map<
      string,
      { parentWoId?: string; bomLevel?: number; rootWoId?: string }
    >,
  ): Promise<ApsSchedule[]> {
    const schedules = await this.scheduleRepo.find({
      where: {
        tenantId,
        id: In(scheduleIds),
        status: ApsScheduleStatus.SCHEDULED,
      },
    });

    for (const s of schedules) {
      s.status = ApsScheduleStatus.CONFIRMED;
    }
    const updated = await this.scheduleRepo.save(schedules);

    await this.messageService.publish({
      eventId: uuidv4(),
      eventType: 'WORK_ORDER_RELEASED',
      tenantId,
      sourceModule: 'APS',
      targetModule: 'MES',
      payload: {
        schedules: updated.map((s) => {
          const meta = bomMeta?.get(s.woId);
          return {
            scheduleId: s.id,
            woId: s.woId,
            wooId: s.wooId,
            resourceId: s.resourceId,
            scheduledStart: s.scheduledStart,
            scheduledEnd: s.scheduledEnd,
            priority: s.priority,
            parentWoId: meta?.parentWoId ?? null,
            bomLevel: meta?.bomLevel ?? 0,
            rootWoId: meta?.rootWoId ?? null,
          };
        }),
        tenantId,
      },
      createdAt: new Date(),
    });

    return updated;
  }

  // ─── 反向排程 ────────────────────────────────────────────────────────────────

  async scheduleBackward(
    tenantId: string,
    inputs: ScheduleInput[],
    deadlines: Map<string, Date>,
  ): Promise<BackwardResult[]> {
    const now = new Date();
    const results: BackwardResult[] = [];

    for (const input of inputs) {
      const deadline = deadlines.get(input.woId);
      if (!deadline) continue;

      const durationMs = input.requiredHours * 60 * 60 * 1000;
      const latestStart = new Date(deadline.getTime() - durationMs);
      const latestEnd = deadline;

      // slack = 最迟开工时间 - 当前时间（小时）
      const slackMs = latestStart.getTime() - now.getTime();
      const slack = slackMs / (60 * 60 * 1000);

      results.push({
        woId: input.woId,
        latestStart,
        latestEnd,
        slack,
      });
    }

    return results;
  }

  // ─── 找下一个可用时间槽 ───────────────────────────────────────────────────────

  async findNextAvailableSlot(
    tenantId: string,
    resourceId: string,
    requiredHours: number,
    notBefore: Date,
  ): Promise<TimeSlot> {
    const durationMs = requiredHours * 60 * 60 * 1000;

    // 查询 notBefore 之后该资源的已排程记录（排除已取消），按开始时间升序
    const existing = await this.scheduleRepo
      .createQueryBuilder('s')
      .where('s.tenant_id = :tenantId', { tenantId })
      .andWhere('s.resource_id = :resourceId', { resourceId })
      .andWhere('s.scheduled_end > :notBefore', { notBefore })
      .andWhere('s.status != :cancelled', {
        cancelled: ApsScheduleStatus.CANCELLED,
      })
      .orderBy('s.scheduled_start', 'ASC')
      .getMany();

    // 尝试从 notBefore 开始找第一个足够大的空隙
    let cursor = notBefore;

    for (const schedule of existing) {
      const gapMs = schedule.scheduledStart.getTime() - cursor.getTime();
      if (gapMs >= durationMs) {
        // 此空隙足够
        return { start: cursor, end: new Date(cursor.getTime() + durationMs) };
      }
      // 移动游标到当前排程结束后
      if (schedule.scheduledEnd.getTime() > cursor.getTime()) {
        cursor = schedule.scheduledEnd;
      }
    }

    // 所有已排程之后直接排
    return { start: cursor, end: new Date(cursor.getTime() + durationMs) };
  }

  // ─── 取消排程 ────────────────────────────────────────────────────────────────

  async cancelSchedule(
    tenantId: string,
    scheduleId: string,
  ): Promise<ApsSchedule> {
    const schedule = await this.scheduleRepo.findOne({
      where: { id: scheduleId, tenantId },
    });
    if (!schedule) {
      throw new NotFoundException(`ApsSchedule #${scheduleId} not found`);
    }
    schedule.status = ApsScheduleStatus.CANCELLED;
    return this.scheduleRepo.save(schedule);
  }

  // ─── 查询工单的所有排程记录 ───────────────────────────────────────────────────

  async getSchedulesByWo(
    tenantId: string,
    woId: string,
  ): Promise<ApsSchedule[]> {
    return this.scheduleRepo.find({
      where: { tenantId, woId },
      order: { scheduledStart: 'ASC' },
    });
  }

  // ─── 私有：优先级排序 ─────────────────────────────────────────────────────────

  private _sortByPriority(
    inputs: ScheduleInput[],
    ruleType: string,
  ): ScheduleInput[] {
    const copy = [...inputs];

    switch (ruleType) {
      case ApsPriorityRuleType.DELIVERY_DATE:
        return copy.sort((a, b) => {
          const da = a.deliveryDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
          const db = b.deliveryDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
          return da - db;
        });

      case ApsPriorityRuleType.FIFO:
        // 保持输入顺序
        return copy;

      case ApsPriorityRuleType.CUSTOMER_PRIORITY:
      case ApsPriorityRuleType.PROFIT:
        return copy.sort((a, b) => (a.priority ?? 5) - (b.priority ?? 5));

      default:
        // 默认按交期
        return copy.sort((a, b) => {
          const da = a.deliveryDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
          const db = b.deliveryDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
          return da - db;
        });
    }
  }
}
