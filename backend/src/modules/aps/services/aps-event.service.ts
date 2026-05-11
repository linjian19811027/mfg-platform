import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import {
  ApsSchedule,
  ApsScheduleStatus,
} from '../entities/aps-schedule.entity';
import { ApsResourceStatus } from '../entities/aps-resource.entity';
import { SchedulerService, ScheduleInput } from './scheduler.service';
import { ReplanService } from './replan.service';
import { ApsResourceService } from './aps-resource.service';
import {
  MessageService,
  MESSAGE_SERVICE,
  DomainEvent,
} from '../../../shared/message/message.interface.js';

@Injectable()
export class ApsEventService implements OnModuleInit {
  private readonly logger = new Logger(ApsEventService.name);

  constructor(
    @InjectRepository(ApsSchedule)
    private readonly scheduleRepo: Repository<ApsSchedule>,
    private readonly schedulerService: SchedulerService,
    private readonly replanService: ReplanService,
    private readonly apsResourceService: ApsResourceService,
    @Inject(MESSAGE_SERVICE) private readonly messageService: MessageService,
  ) {}

  onModuleInit(): void {
    this.messageService.subscribe('PRODUCTION_COMPLETED', (event) =>
      this.handleProductionCompleted(event),
    );
    this.messageService.subscribe('SALES_ORDER_CONFIRMED', (event) =>
      this.handleSalesOrderConfirmed(event),
    );
    this.messageService.subscribe('EQUIPMENT_STATUS_CHANGED', (event) =>
      this.handleEquipmentStatusChanged(event),
    );
  }

  // ─── 任务 3.13：生产完工事件 ──────────────────────────────────────────────────

  private async handleProductionCompleted(event: DomainEvent): Promise<void> {
    const { woId, actualStart, actualEnd, tenantId } = event.payload as {
      woId: string;
      wooId?: string;
      actualStart: string | Date;
      actualEnd: string | Date;
      tenantId: string;
    };

    try {
      const schedules = await this.scheduleRepo.find({
        where: { tenantId, woId },
        order: { scheduledEnd: 'DESC' },
      });

      if (schedules.length === 0) {
        this.logger.warn(
          `PRODUCTION_COMPLETED: no schedule found for woId=${woId}`,
        );
        return;
      }

      const schedule = schedules[0];
      const actualEndDate = new Date(actualEnd);
      const scheduledEndMs = schedule.scheduledEnd.getTime();
      const actualEndMs = actualEndDate.getTime();

      const delayHours = (actualEndMs - scheduledEndMs) / 3600000;
      const onTime = delayHours <= 0;

      schedule.status = ApsScheduleStatus.COMPLETED;

      await this.scheduleRepo.save(schedule);

      await this.messageService.publish({
        eventId: uuidv4(),
        eventType: 'APS_SCHEDULE_COMPLETED',
        tenantId,
        sourceModule: 'APS',
        payload: {
          scheduleId: schedule.id,
          woId,
          delayHours,
          onTime,
          actualStart,
          actualEnd,
        },
        createdAt: new Date(),
      });

      this.logger.log(
        `PRODUCTION_COMPLETED: woId=${woId} delayHours=${delayHours.toFixed(2)} onTime=${onTime}`,
      );
    } catch (err) {
      this.logger.error(
        `PRODUCTION_COMPLETED handler error: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }

  // ─── 任务 3.20：销售订单确认事件 ─────────────────────────────────────────────

  private async handleSalesOrderConfirmed(event: DomainEvent): Promise<void> {
    const { soId, soNo, deliveryDate, lines, tenantId } = event.payload as {
      soId: string;
      soNo: string;
      customerId: string;
      deliveryDate: string | Date;
      lines: Array<{
        soLineId: string;
        materialId: string;
        qty: number;
        resourceId?: string;
        requiredHours?: number;
        priority?: number;
      }>;
      tenantId: string;
    };

    try {
      const delivery = new Date(deliveryDate);

      // 如果订单行包含足够的排程信息，直接调用 SchedulerService 正向排程
      const schedulableLines = lines.filter(
        (l) => l.resourceId && l.requiredHours,
      );

      if (schedulableLines.length > 0) {
        const inputs: ScheduleInput[] = schedulableLines.map((l) => ({
          woId: l.soLineId,
          resourceId: l.resourceId!,
          requiredHours: l.requiredHours!,
          priority: l.priority ?? 5,
          deliveryDate: delivery,
        }));

        await this.schedulerService.scheduleForward(tenantId, inputs, {
          startFrom: new Date(),
        });

        this.logger.log(
          `SALES_ORDER_CONFIRMED: soId=${soId} soNo=${soNo} scheduled ${inputs.length} lines`,
        );
      } else {
        // 信息不足，发布排程请求事件，由下游处理
        await this.messageService.publish({
          eventId: uuidv4(),
          eventType: 'APS_SCHEDULE_REQUESTED',
          tenantId,
          sourceModule: 'APS',
          payload: { soId, soNo, deliveryDate, lines },
          createdAt: new Date(),
        });

        this.logger.log(
          `SALES_ORDER_CONFIRMED: soId=${soId} soNo=${soNo} published APS_SCHEDULE_REQUESTED`,
        );
      }
    } catch (err) {
      this.logger.error(
        `SALES_ORDER_CONFIRMED handler error: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }

  // ─── 任务 3.21：设备状态变更事件 ─────────────────────────────────────────────

  private async handleEquipmentStatusChanged(
    event: DomainEvent,
  ): Promise<void> {
    const { resourceId, newStatus, tenantId } = event.payload as {
      resourceId: string;
      newStatus: ApsResourceStatus;
      tenantId: string;
    };

    try {
      // 并行：更新资源状态 + 触发重排
      await Promise.all([
        this.apsResourceService.updateStatus(tenantId, resourceId, newStatus),
        this.replanService.handleEquipmentStatusChange(
          tenantId,
          resourceId,
          newStatus,
        ),
      ]);

      this.logger.log(
        `EQUIPMENT_STATUS_CHANGED: resourceId=${resourceId} newStatus=${newStatus}`,
      );
    } catch (err) {
      this.logger.error(
        `EQUIPMENT_STATUS_CHANGED handler error: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }
}
