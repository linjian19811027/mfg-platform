import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { ApsSchedule } from '../entities/aps-schedule.entity.js';
import {
  ApsResource,
  ApsResourceStatus,
} from '../entities/aps-resource.entity.js';
import {
  EamMaintenancePlan,
  MaintenancePlanStatus,
} from '../../eam/entities/eam-maintenance-plan.entity.js';
import { ReplanService } from './replan.service.js';
import { ApsResourceService } from './aps-resource.service.js';
import {
  MessageService,
  MESSAGE_SERVICE,
  DomainEvent,
} from '../../../shared/message/message.interface.js';

// ─── EAM 设备状态 → APS 资源状态映射 ─────────────────────────────────────────

const EAM_TO_APS_STATUS: Record<string, ApsResourceStatus> = {
  FAULT: ApsResourceStatus.BREAKDOWN,
  MAINTENANCE: ApsResourceStatus.MAINTENANCE,
  RUNNING: ApsResourceStatus.AVAILABLE,
  IDLE: ApsResourceStatus.AVAILABLE,
  SCRAPPED: ApsResourceStatus.BREAKDOWN,
};

@Injectable()
export class ApsEamService implements OnModuleInit {
  private readonly logger = new Logger(ApsEamService.name);

  constructor(
    @InjectRepository(ApsSchedule)
    private readonly scheduleRepo: Repository<ApsSchedule>,
    @InjectRepository(ApsResource)
    private readonly resourceRepo: Repository<ApsResource>,
    @InjectRepository(EamMaintenancePlan)
    private readonly maintenancePlanRepo: Repository<EamMaintenancePlan>,
    private readonly replanService: ReplanService,
    private readonly apsResourceService: ApsResourceService,
    @Inject(MESSAGE_SERVICE)
    private readonly messageBus: MessageService,
  ) {}

  onModuleInit(): void {
    // 5.2 订阅 EQUIPMENT_STATUS_CHANGED 事件
    this.messageBus.subscribe('EQUIPMENT_STATUS_CHANGED', (event) =>
      this.handleEquipmentStatusChanged(event),
    );
    // 订阅 OEE_UPDATED 事件（3.8 APS 产能系数更新）
    this.messageBus.subscribe('OEE_UPDATED', (event) =>
      this.handleOeeUpdated(event),
    );
  }

  // ─── 5.1 排程时读取维保计划，返回不可用时段 ──────────────────────────────

  async getMaintenanceBlockedSlots(
    tenantId: string,
    resourceId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<
    Array<{ start: Date; end: Date; planId: string; planName: string }>
  > {
    const plans = await this.maintenancePlanRepo
      .createQueryBuilder('p')
      .where('p.tenantId = :tenantId', { tenantId })
      .andWhere('p.equipmentId = :resourceId', { resourceId })
      .andWhere('p.plannedDate >= :startDate', { startDate })
      .andWhere('p.plannedDate <= :endDate', { endDate })
      .andWhere('p.status != :cancelled', {
        cancelled: MaintenancePlanStatus.CANCELLED,
      })
      .getMany();

    return plans.map((plan) => {
      const day = new Date(plan.plannedDate);
      const start = new Date(day);
      start.setHours(0, 0, 0, 0);
      const end = new Date(day);
      end.setHours(23, 59, 59, 999);
      return {
        start,
        end,
        planId: plan.id,
        planName: plan.planName,
      };
    });
  }

  // ─── 5.1 检查某时间段是否与维保计划冲突 ──────────────────────────────────

  async isBlockedByMaintenance(
    tenantId: string,
    resourceId: string,
    slotStart: Date,
    slotEnd: Date,
  ): Promise<boolean> {
    const slots = await this.getMaintenanceBlockedSlots(
      tenantId,
      resourceId,
      slotStart,
      slotEnd,
    );

    return slots.some((slot) => slot.start < slotEnd && slot.end > slotStart);
  }

  // ─── 5.2 处理设备状态变更 ─────────────────────────────────────────────────

  private async handleEquipmentStatusChanged(
    event: DomainEvent,
  ): Promise<void> {
    const { equipmentId, newStatus, tenantId } = event.payload as {
      equipmentId: string;
      newStatus: string;
      tenantId: string;
    };

    const effectiveTenantId = tenantId ?? event.tenantId;

    try {
      const apsStatus = EAM_TO_APS_STATUS[newStatus];
      if (!apsStatus) {
        this.logger.warn(
          `ApsEamService: unknown EAM status ${newStatus}, skipping`,
        );
        return;
      }

      // 查找对应 APS 资源（code = equipmentId 或 attributes.equipmentId = equipmentId）
      const resource = await this.findResourceByEquipmentId(
        effectiveTenantId,
        equipmentId,
      );
      if (!resource) {
        this.logger.debug(
          `ApsEamService: no APS resource found for equipmentId=${equipmentId}`,
        );
        return;
      }

      await this.apsResourceService.updateStatus(
        effectiveTenantId,
        resource.id,
        apsStatus,
      );

      this.logger.log(
        `ApsEamService: equipmentId=${equipmentId} → resourceId=${resource.id} status=${apsStatus}`,
      );

      // 若新状态是 FAULT，触发局部重排
      if (newStatus === 'FAULT') {
        await this.handleEquipmentFault(
          effectiveTenantId,
          equipmentId,
          new Date(),
        );
      }
    } catch (err) {
      this.logger.error(
        `ApsEamService.handleEquipmentStatusChanged error: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }

  // ─── 5.3 设备故障时触发局部重排 ──────────────────────────────────────────

  async handleEquipmentFault(
    tenantId: string,
    equipmentId: string,
    faultTime: Date,
  ): Promise<void> {
    try {
      const resource = await this.findResourceByEquipmentId(
        tenantId,
        equipmentId,
      );
      if (!resource) {
        this.logger.warn(
          `ApsEamService.handleEquipmentFault: no resource for equipmentId=${equipmentId}`,
        );
        return;
      }

      const alternativeResourceId = resource.alternativeResources?.[0];

      await this.replanService.replanByEquipmentFailure(
        tenantId,
        resource.id,
        faultTime,
        alternativeResourceId,
      );

      await this.messageBus.publish({
        eventId: uuidv4(),
        eventType: 'APS_REPLAN_TRIGGERED',
        tenantId,
        sourceModule: 'APS',
        targetModule: 'APS',
        payload: {
          equipmentId,
          resourceId: resource.id,
          faultTime,
          alternativeResourceId,
          trigger: 'EQUIPMENT_FAULT',
        },
        createdAt: new Date(),
      });

      this.logger.log(
        `ApsEamService: replan triggered for equipmentId=${equipmentId} resourceId=${resource.id}`,
      );
    } catch (err) {
      this.logger.error(
        `ApsEamService.handleEquipmentFault error: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }

  // ─── OEE 更新时调整 APS 资源效率系数 ─────────────────────────────────────

  private async handleOeeUpdated(event: DomainEvent): Promise<void> {
    const { equipmentId, oee } = event.payload as {
      equipmentId: string;
      oee: string | number;
    };

    const tenantId = event.tenantId;

    try {
      const resource = await this.findResourceByEquipmentId(
        tenantId,
        equipmentId,
      );
      if (!resource) return;

      const efficiency = typeof oee === 'string' ? parseFloat(oee) : oee;
      resource.efficiency = efficiency;
      await this.resourceRepo.save(resource);

      this.logger.log(
        `ApsEamService: OEE updated equipmentId=${equipmentId} efficiency=${efficiency}`,
      );
    } catch (err) {
      this.logger.error(
        `ApsEamService.handleOeeUpdated error: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }

  // ─── 私有：按 equipmentId 查找 APS 资源 ──────────────────────────────────

  private async findResourceByEquipmentId(
    tenantId: string,
    equipmentId: string,
  ): Promise<ApsResource | null> {
    // 先按 code 匹配
    const byCode = await this.resourceRepo.findOne({
      where: { tenantId, code: equipmentId },
    });
    if (byCode) return byCode;

    // 再按 attributes.equipmentId 匹配（JSON 字段）
    const byAttr = await this.resourceRepo
      .createQueryBuilder('r')
      .where('r.tenantId = :tenantId', { tenantId })
      .andWhere(
        "JSON_UNQUOTE(JSON_EXTRACT(r.attributes, '$.equipmentId')) = :equipmentId",
        {
          equipmentId,
        },
      )
      .getOne();

    return byAttr ?? null;
  }
}
