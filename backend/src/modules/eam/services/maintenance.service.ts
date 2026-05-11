import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { v4 as uuidv4 } from 'uuid';
import {
  EamMaintenancePlan,
  MaintenancePlanType,
  MaintenancePlanStatus,
} from '../entities/eam-maintenance-plan.entity.js';
import {
  EamMaintenanceStrategy,
  StrategyType,
  TriggerType,
} from '../entities/eam-maintenance-strategy.entity.js';
import {
  EamMaintenanceTask,
  MaintenanceTaskType,
  TaskPriority,
  MaintenanceTaskStatus,
} from '../entities/eam-maintenance-task.entity.js';
import {
  EamEquipment,
  EquipmentStatus,
} from '../entities/eam-equipment.entity.js';
import {
  EamEquipmentHistory,
  EquipmentEventType,
} from '../entities/eam-equipment-history.entity.js';
import {
  MessageService,
  MESSAGE_SERVICE,
} from '../../../shared/message/message.interface.js';

// ─── DTOs ────────────────────────────────────────────────────────────────────

interface CreateStrategyDto {
  strategyCode: string;
  strategyName: string;
  strategyType: StrategyType;
  equipmentId?: string;
  equipmentType?: string;
  triggerType: TriggerType;
  intervalDays?: number;
  intervalHours?: number;
  conditionThreshold?: string;
  advanceNoticeDays?: number;
}

interface CreatePlanDto {
  planCode: string;
  planName: string;
  equipmentId: string;
  strategyId?: string;
  planType: MaintenancePlanType;
  plannedDate: Date;
  plannedDuration: number;
  maintenanceContent: string;
  requiredSkills?: string;
  assignedTo?: string;
}

interface PlanQueryDto {
  equipmentId?: string;
  status?: MaintenancePlanStatus;
  planType?: MaintenancePlanType;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  pageSize?: number;
}

interface CompleteTaskDto {
  endTime: Date;
  laborHours?: number;
  laborCost?: number;
  materialCost?: number;
  result: string;
  operatorId: string;
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class MaintenanceService {
  constructor(
    @InjectRepository(EamMaintenancePlan)
    private readonly planRepo: Repository<EamMaintenancePlan>,
    @InjectRepository(EamMaintenanceStrategy)
    private readonly strategyRepo: Repository<EamMaintenanceStrategy>,
    @InjectRepository(EamMaintenanceTask)
    private readonly taskRepo: Repository<EamMaintenanceTask>,
    @InjectRepository(EamEquipment)
    private readonly equipRepo: Repository<EamEquipment>,
    @InjectRepository(EamEquipmentHistory)
    private readonly historyRepo: Repository<EamEquipmentHistory>,
    @Inject(MESSAGE_SERVICE)
    private readonly messageBus: MessageService,
    private readonly dataSource: DataSource,
  ) {}

  // ─── 维保策略 CRUD ────────────────────────────────────────────────────────

  async createStrategy(
    tenantId: string,
    dto: CreateStrategyDto,
  ): Promise<EamMaintenanceStrategy> {
    const data: Record<string, unknown> = {
      ...dto,
      tenantId,
      intervalHours:
        dto.intervalHours !== undefined ? String(dto.intervalHours) : undefined,
    };
    const strategy = this.strategyRepo.create(data as any);
    const saved = await this.strategyRepo.save(strategy as any);
    return saved as unknown as EamMaintenanceStrategy;
  }

  async findStrategies(
    tenantId: string,
    equipmentId?: string,
  ): Promise<EamMaintenanceStrategy[]> {
    const where: Record<string, unknown> = { tenantId };
    if (equipmentId) where['equipmentId'] = equipmentId;
    return this.strategyRepo.find({
      where: where as any,
      order: { createdAt: 'DESC' },
    });
  }

  async updateStrategy(
    tenantId: string,
    id: string,
    dto: Partial<CreateStrategyDto>,
  ): Promise<EamMaintenanceStrategy> {
    const strategy = await this.strategyRepo.findOne({
      where: { id, tenantId },
    });
    if (!strategy) throw new NotFoundException(`维保策略 ${id} 不存在`);
    if (dto.intervalHours !== undefined) {
      (strategy as any).intervalHours = String(dto.intervalHours);
      const { intervalHours: _h, ...rest } = dto;
      Object.assign(strategy, rest);
    } else {
      Object.assign(strategy, dto);
    }
    return this.strategyRepo.save(strategy);
  }

  // ─── 维保计划 CRUD ────────────────────────────────────────────────────────

  async createPlan(
    tenantId: string,
    dto: CreatePlanDto,
  ): Promise<EamMaintenancePlan> {
    const data: Record<string, unknown> = {
      ...dto,
      tenantId,
      status: MaintenancePlanStatus.PENDING,
      plannedDuration: String(dto.plannedDuration),
    };
    const plan = this.planRepo.create(data as any);
    const saved = await this.planRepo.save(plan as any);
    return saved as unknown as EamMaintenancePlan;
  }

  async findPlans(
    tenantId: string,
    query: PlanQueryDto,
  ): Promise<{ data: EamMaintenancePlan[]; total: number }> {
    const {
      equipmentId,
      status,
      planType,
      startDate,
      endDate,
      page = 1,
      pageSize = 20,
    } = query;

    const qb = this.planRepo
      .createQueryBuilder('p')
      .where('p.tenantId = :tenantId', { tenantId });

    if (equipmentId)
      qb.andWhere('p.equipmentId = :equipmentId', { equipmentId });
    if (status) qb.andWhere('p.status = :status', { status });
    if (planType) qb.andWhere('p.planType = :planType', { planType });
    if (startDate) qb.andWhere('p.plannedDate >= :startDate', { startDate });
    if (endDate) qb.andWhere('p.plannedDate <= :endDate', { endDate });

    const [data, total] = await qb
      .orderBy('p.plannedDate', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { data, total };
  }

  async updatePlan(
    tenantId: string,
    id: string,
    dto: Partial<CreatePlanDto>,
  ): Promise<EamMaintenancePlan> {
    const plan = await this.planRepo.findOne({ where: { id, tenantId } });
    if (!plan) throw new NotFoundException(`维保计划 ${id} 不存在`);
    if (dto.plannedDuration !== undefined) {
      (plan as any).plannedDuration = String(dto.plannedDuration);
      const { plannedDuration: _d, ...rest } = dto;
      Object.assign(plan, rest);
    } else {
      Object.assign(plan, dto);
    }
    return this.planRepo.save(plan);
  }

  async cancelPlan(tenantId: string, id: string): Promise<EamMaintenancePlan> {
    const plan = await this.planRepo.findOne({ where: { id, tenantId } });
    if (!plan) throw new NotFoundException(`维保计划 ${id} 不存在`);
    plan.status = MaintenancePlanStatus.CANCELLED;
    return this.planRepo.save(plan);
  }

  // ─── 任务自动生成（每天凌晨1点）─────────────────────────────────────────

  @Cron('0 1 * * *')
  async autoGenerateTasks(): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const plans = await this.planRepo
      .createQueryBuilder('p')
      .where('p.status = :status', { status: MaintenancePlanStatus.PENDING })
      .andWhere('p.plannedDate >= :today', { today })
      .andWhere('p.plannedDate < :tomorrow', { tomorrow })
      .getMany();

    for (const plan of plans) {
      const existing = await this.taskRepo.findOne({
        where: { planId: plan.id },
      });
      if (existing) continue;

      const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
      const task = this.taskRepo.create({
        tenantId: plan.tenantId,
        taskCode: `TASK-${plan.planCode}-${dateStr}`,
        planId: plan.id,
        equipmentId: plan.equipmentId,
        taskType: MaintenanceTaskType.PREVENTIVE,
        priority: TaskPriority.MEDIUM,
        status: MaintenanceTaskStatus.PENDING,
        scheduledDate: plan.plannedDate,
        assignedTo: plan.assignedTo,
      });
      await this.taskRepo.save(task);
    }
  }

  async generateTasksForPlan(
    tenantId: string,
    planId: string,
  ): Promise<EamMaintenanceTask[]> {
    const plan = await this.planRepo.findOne({
      where: { id: planId, tenantId },
    });
    if (!plan) throw new NotFoundException(`维保计划 ${planId} 不存在`);

    const existing = await this.taskRepo.findOne({ where: { planId } });
    if (existing) return [existing];

    const dateStr = new Date(plan.plannedDate)
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, '');

    const task = this.taskRepo.create({
      tenantId,
      taskCode: `TASK-${plan.planCode}-${dateStr}`,
      planId: plan.id,
      equipmentId: plan.equipmentId,
      taskType: MaintenanceTaskType.PREVENTIVE,
      priority: TaskPriority.MEDIUM,
      status: MaintenanceTaskStatus.PENDING,
      scheduledDate: plan.plannedDate,
      assignedTo: plan.assignedTo,
    });

    const saved = await this.taskRepo.save(task);
    return [saved];
  }

  // ─── 到期提醒（每天上午8点）──────────────────────────────────────────────

  @Cron('0 8 * * *')
  async sendDueReminders(): Promise<void> {
    const plans = await this.planRepo
      .createQueryBuilder('p')
      .where('p.status = :status', { status: MaintenancePlanStatus.PENDING })
      .getMany();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const plan of plans) {
      let advanceDays = 3;

      if (plan.strategyId) {
        const strategy = await this.strategyRepo.findOne({
          where: { id: plan.strategyId },
        });
        if (strategy) advanceDays = strategy.advanceNoticeDays ?? 3;
      }

      const reminderDate = new Date(today);
      reminderDate.setDate(reminderDate.getDate() + advanceDays);

      const plannedDate = new Date(plan.plannedDate);
      plannedDate.setHours(0, 0, 0, 0);

      if (plannedDate.getTime() === reminderDate.getTime()) {
        await this.messageBus.publish({
          eventId: uuidv4(),
          eventType: 'MAINTENANCE_DUE_REMINDER',
          tenantId: plan.tenantId,
          sourceModule: 'EAM',
          payload: {
            planId: plan.id,
            equipmentId: plan.equipmentId,
            plannedDate: plan.plannedDate,
            planName: plan.planName,
          },
          createdAt: new Date(),
        });
      }
    }
  }

  // ─── 维保完成（任务1.13）─────────────────────────────────────────────────

  async completeTask(
    tenantId: string,
    taskId: string,
    dto: CompleteTaskDto,
  ): Promise<EamMaintenanceTask> {
    const task = await this.taskRepo.findOne({
      where: { id: taskId, tenantId },
    });
    if (!task) throw new NotFoundException(`维保任务 ${taskId} 不存在`);

    const totalCost = (dto.laborCost ?? 0) + (dto.materialCost ?? 0);

    // ── 事务保障：任务完成 + 计划关闭 + 设备状态恢复 + 履历写入 四步原子执行 ──
    const savedTask = await this.dataSource.transaction(async (em) => {
      task.status = MaintenanceTaskStatus.COMPLETED;
      task.endTime = dto.endTime;
      task.laborHours =
        dto.laborHours !== undefined ? String(dto.laborHours) : undefined;
      task.laborCost =
        dto.laborCost !== undefined ? String(dto.laborCost) : undefined;
      task.materialCost =
        dto.materialCost !== undefined ? String(dto.materialCost) : undefined;
      task.totalCost = String(totalCost);
      task.result = dto.result;
      const saved = await em.save(EamMaintenanceTask, task);

      // 关闭维保计划（与任务完成在同一事务）
      if (task.planId) {
        await em.update(
          EamMaintenancePlan,
          { id: task.planId, tenantId },
          {
            status: MaintenancePlanStatus.COMPLETED,
            actualEndTime: dto.endTime,
          },
        );
      }

      // 恢复设备状态为 IDLE（与任务完成在同一事务，失败则设备仍处于维修状态）
      await em.update(
        EamEquipment,
        { id: task.equipmentId, tenantId },
        { status: EquipmentStatus.IDLE },
      );

      // 写设备履历（与任务完成在同一事务）
      await em.save(
        EamEquipmentHistory,
        em.create(EamEquipmentHistory, {
          tenantId,
          equipmentId: task.equipmentId,
          eventType: EquipmentEventType.MAINTENANCE,
          eventDate: dto.endTime,
          description: `维保任务完成：${task.taskCode}，结果：${dto.result}`,
          operatorId: dto.operatorId,
          cost: String(totalCost),
          relatedTaskId: task.id,
        }),
      );

      return saved;
    });

    // 发布事件在事务外执行（消息总线失败不应影响核心业务回滚）
    await this.messageBus.publish({
      eventId: uuidv4(),
      eventType: 'EQUIPMENT_STATUS_CHANGED',
      tenantId,
      sourceModule: 'EAM',
      targetModule: 'APS',
      payload: {
        equipmentId: task.equipmentId,
        oldStatus: EquipmentStatus.MAINTENANCE,
        newStatus: EquipmentStatus.IDLE,
        operatorId: dto.operatorId,
        reason: `维保任务 ${task.taskCode} 完成`,
      },
      createdAt: new Date(),
    });

    return savedTask;
  }

  // ─── 检查重叠 ─────────────────────────────────────────────────────────────

  async checkOverlap(
    tenantId: string,
    equipmentId: string,
    scheduledDate: Date,
    excludeTaskId?: string,
  ): Promise<boolean> {
    const dateStr = new Date(scheduledDate).toISOString().slice(0, 10);

    const qb = this.taskRepo
      .createQueryBuilder('t')
      .where('t.tenantId = :tenantId', { tenantId })
      .andWhere('t.equipmentId = :equipmentId', { equipmentId })
      .andWhere('t.status != :cancelled', {
        cancelled: MaintenanceTaskStatus.CANCELLED,
      })
      .andWhere('DATE(t.scheduledDate) = :dateStr', { dateStr });

    if (excludeTaskId) {
      qb.andWhere('t.id != :excludeTaskId', { excludeTaskId });
    }

    const count = await qb.getCount();
    return count > 0;
  }
}
