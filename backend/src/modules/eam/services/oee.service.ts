import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { v4 as uuidv4 } from 'uuid';
import { EamOeeRecord } from '../entities/eam-oee-record.entity.js';
import { EamFaultRecord } from '../entities/eam-fault-record.entity.js';
import {
  EamMaintenanceTask,
  MaintenanceTaskStatus,
} from '../entities/eam-maintenance-task.entity.js';
import {
  MessageService,
  MESSAGE_SERVICE,
} from '../../../shared/message/message.interface.js';

// ─── DTOs ────────────────────────────────────────────────────────────────────

interface OeeInputDto {
  equipmentId: string;
  recordDate: Date;
  shift?: string;
  plannedTime: number; // 分钟
  actualRunTime: number; // 分钟
  downTime?: number; // 分钟
  theoreticalOutput: number;
  actualOutput: number;
  qualifiedOutput: number;
  oeeTarget?: number; // 默认 0.85
}

interface UtilizationResult {
  plannedUtilization: number;
  actualUtilization: number;
  calendarMinutes: number;
}

interface FaultRateResult {
  faultCount: number;
  totalFaultMinutes: number;
  productionLoss: number;
  costLoss: number;
}

interface MaintenanceCostResult {
  laborCost: number;
  materialCost: number;
  totalCost: number;
  taskCount: number;
}

interface PerformanceRankItem {
  equipmentId: string;
  avgOee: number;
  avgAvailability: number;
  avgPerformance: number;
  avgQuality: number;
  rank: number;
}

// ─── 工具函数 ─────────────────────────────────────────────────────────────────

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function toDecimalStr(value: number): string {
  return value.toFixed(4);
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class OeeService {
  constructor(
    @InjectRepository(EamOeeRecord)
    private readonly oeeRepo: Repository<EamOeeRecord>,
    @InjectRepository(EamFaultRecord)
    private readonly faultRepo: Repository<EamFaultRecord>,
    @InjectRepository(EamMaintenanceTask)
    private readonly taskRepo: Repository<EamMaintenanceTask>,
    @Inject(MESSAGE_SERVICE)
    private readonly messageBus: MessageService,
  ) {}

  // ─── 3.1 计算并保存 OEE ───────────────────────────────────────────────────

  async calculate(tenantId: string, dto: OeeInputDto): Promise<EamOeeRecord> {
    const {
      equipmentId,
      recordDate,
      shift,
      plannedTime,
      actualRunTime,
      downTime = 0,
      theoreticalOutput,
      actualOutput,
      qualifiedOutput,
      oeeTarget = 0.85,
    } = dto;

    // 计算三率
    const availability = clamp(
      plannedTime > 0 ? actualRunTime / plannedTime : 0,
    );
    const performance = clamp(
      theoreticalOutput > 0 ? actualOutput / theoreticalOutput : 0,
    );
    const quality = clamp(
      actualOutput > 0 ? qualifiedOutput / actualOutput : 0,
    );
    const oee = availability * performance * quality;

    const record = this.oeeRepo.create({
      tenantId,
      equipmentId,
      recordDate,
      shift,
      plannedTime: toDecimalStr(plannedTime),
      actualRunTime: toDecimalStr(actualRunTime),
      downTime: toDecimalStr(downTime),
      theoreticalOutput: toDecimalStr(theoreticalOutput),
      actualOutput: toDecimalStr(actualOutput),
      qualifiedOutput: toDecimalStr(qualifiedOutput),
      availability: toDecimalStr(availability),
      performance: toDecimalStr(performance),
      quality: toDecimalStr(quality),
      oee: toDecimalStr(oee),
    });
    const saved = await this.oeeRepo.save(record);

    // 3.7 OEE 低于目标预警
    if (oee < oeeTarget) {
      await this.messageBus.publish({
        eventId: uuidv4(),
        eventType: 'OEE_BELOW_TARGET',
        tenantId,
        sourceModule: 'EAM',
        payload: {
          equipmentId,
          oee: toDecimalStr(oee),
          oeeTarget: toDecimalStr(oeeTarget),
          recordDate,
          shift,
        },
        createdAt: new Date(),
      });
    }

    // 3.8 发布 OEE_UPDATED 事件
    await this.messageBus.publish({
      eventId: uuidv4(),
      eventType: 'OEE_UPDATED',
      tenantId,
      sourceModule: 'EAM',
      targetModule: 'APS',
      payload: {
        equipmentId,
        oee: toDecimalStr(oee),
        availability: toDecimalStr(availability),
        performance: toDecimalStr(performance),
        quality: toDecimalStr(quality),
        recordDate,
      },
      createdAt: new Date(),
    });

    return saved;
  }

  // ─── 3.2 设备利用率 ───────────────────────────────────────────────────────

  async utilization(
    tenantId: string,
    equipmentId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<UtilizationResult> {
    const row = await this.oeeRepo
      .createQueryBuilder('o')
      .select('SUM(o.plannedTime)', 'sumPlanned')
      .addSelect('SUM(o.actualRunTime)', 'sumActual')
      .where('o.tenantId = :tenantId', { tenantId })
      .andWhere('o.equipmentId = :equipmentId', { equipmentId })
      .andWhere('o.recordDate >= :startDate', { startDate })
      .andWhere('o.recordDate <= :endDate', { endDate })
      .getRawOne();

    const calendarMinutes =
      (endDate.getTime() - startDate.getTime()) / (1000 * 60);

    const sumPlanned = parseFloat(row?.sumPlanned ?? '0');
    const sumActual = parseFloat(row?.sumActual ?? '0');

    const plannedUtilization =
      calendarMinutes > 0 ? clamp(sumPlanned / calendarMinutes) : 0;
    const actualUtilization =
      calendarMinutes > 0 ? clamp(sumActual / calendarMinutes) : 0;

    return {
      plannedUtilization: Math.round(plannedUtilization * 10000) / 10000,
      actualUtilization: Math.round(actualUtilization * 10000) / 10000,
      calendarMinutes: Math.round(calendarMinutes),
    };
  }

  // ─── 3.3 故障率统计 ───────────────────────────────────────────────────────

  async faultRate(
    tenantId: string,
    equipmentId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<FaultRateResult> {
    const row = await this.faultRepo
      .createQueryBuilder('f')
      .select('COUNT(f.id)', 'faultCount')
      .addSelect(
        'SUM(CASE WHEN f.endRepairAt IS NOT NULL THEN TIMESTAMPDIFF(MINUTE, f.reportedAt, f.endRepairAt) ELSE 0 END)',
        'totalFaultMinutes',
      )
      .addSelect('SUM(COALESCE(f.productionLoss, 0))', 'productionLoss')
      .addSelect(
        'SUM(COALESCE(f.laborCost, 0) + COALESCE(f.materialCost, 0))',
        'costLoss',
      )
      .where('f.tenantId = :tenantId', { tenantId })
      .andWhere('f.equipmentId = :equipmentId', { equipmentId })
      .andWhere('f.reportedAt >= :startDate', { startDate })
      .andWhere('f.reportedAt <= :endDate', { endDate })
      .getRawOne();

    return {
      faultCount: parseInt(row?.faultCount ?? '0', 10),
      totalFaultMinutes: parseInt(row?.totalFaultMinutes ?? '0', 10),
      productionLoss: parseFloat(row?.productionLoss ?? '0'),
      costLoss: parseFloat(row?.costLoss ?? '0'),
    };
  }

  // ─── 3.4 维保成本统计 ─────────────────────────────────────────────────────

  async maintenanceCost(
    tenantId: string,
    equipmentId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<MaintenanceCostResult> {
    const row = await this.taskRepo
      .createQueryBuilder('t')
      .select('SUM(COALESCE(t.laborCost, 0))', 'laborCost')
      .addSelect('SUM(COALESCE(t.materialCost, 0))', 'materialCost')
      .addSelect(
        'SUM(COALESCE(t.laborCost, 0) + COALESCE(t.materialCost, 0))',
        'totalCost',
      )
      .addSelect('COUNT(t.id)', 'taskCount')
      .where('t.tenantId = :tenantId', { tenantId })
      .andWhere('t.equipmentId = :equipmentId', { equipmentId })
      .andWhere('t.status = :status', {
        status: MaintenanceTaskStatus.COMPLETED,
      })
      .andWhere('t.scheduledDate >= :startDate', { startDate })
      .andWhere('t.scheduledDate <= :endDate', { endDate })
      .getRawOne();

    return {
      laborCost: parseFloat(row?.laborCost ?? '0'),
      materialCost: parseFloat(row?.materialCost ?? '0'),
      totalCost: parseFloat(row?.totalCost ?? '0'),
      taskCount: parseInt(row?.taskCount ?? '0', 10),
    };
  }

  // ─── 3.5 设备绩效排名 ─────────────────────────────────────────────────────

  async performanceRanking(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<PerformanceRankItem[]> {
    const rows = await this.oeeRepo
      .createQueryBuilder('o')
      .select('o.equipmentId', 'equipmentId')
      .addSelect('AVG(o.oee)', 'avgOee')
      .addSelect('AVG(o.availability)', 'avgAvailability')
      .addSelect('AVG(o.performance)', 'avgPerformance')
      .addSelect('AVG(o.quality)', 'avgQuality')
      .where('o.tenantId = :tenantId', { tenantId })
      .andWhere('o.recordDate >= :startDate', { startDate })
      .andWhere('o.recordDate <= :endDate', { endDate })
      .groupBy('o.equipmentId')
      .orderBy('avgOee', 'DESC')
      .getRawMany();

    return rows.map((r, index) => ({
      equipmentId: r.equipmentId as string,
      avgOee: Math.round(parseFloat(r.avgOee ?? '0') * 10000) / 10000,
      avgAvailability:
        Math.round(parseFloat(r.avgAvailability ?? '0') * 10000) / 10000,
      avgPerformance:
        Math.round(parseFloat(r.avgPerformance ?? '0') * 10000) / 10000,
      avgQuality: Math.round(parseFloat(r.avgQuality ?? '0') * 10000) / 10000,
      rank: index + 1,
    }));
  }

  // ─── 3.6 每日 OEE 汇总（凌晨2点）────────────────────────────────────────

  @Cron('0 2 * * *')
  async dailySummary(): Promise<void> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const yesterdayEnd = new Date(yesterday);
    yesterdayEnd.setHours(23, 59, 59, 999);

    // 按 tenantId + equipmentId 聚合昨天的 OEE 记录
    const rows = await this.oeeRepo
      .createQueryBuilder('o')
      .select('o.tenantId', 'tenantId')
      .addSelect('o.equipmentId', 'equipmentId')
      .addSelect('AVG(o.oee)', 'avgOee')
      .addSelect('AVG(o.availability)', 'avgAvailability')
      .addSelect('AVG(o.performance)', 'avgPerformance')
      .addSelect('AVG(o.quality)', 'avgQuality')
      .addSelect('COUNT(o.id)', 'recordCount')
      .where('o.recordDate >= :start', { start: yesterday })
      .andWhere('o.recordDate <= :end', { end: yesterdayEnd })
      .groupBy('o.tenantId')
      .addGroupBy('o.equipmentId')
      .getRawMany();

    for (const row of rows) {
      await this.messageBus.publish({
        eventId: uuidv4(),
        eventType: 'OEE_DAILY_SUMMARY',
        tenantId: row.tenantId as string,
        sourceModule: 'EAM',
        payload: {
          equipmentId: row.equipmentId as string,
          date: yesterday.toISOString().slice(0, 10),
          avgOee: parseFloat(row.avgOee ?? '0'),
          avgAvailability: parseFloat(row.avgAvailability ?? '0'),
          avgPerformance: parseFloat(row.avgPerformance ?? '0'),
          avgQuality: parseFloat(row.avgQuality ?? '0'),
          recordCount: parseInt(row.recordCount ?? '0', 10),
        },
        createdAt: new Date(),
      });
    }
  }

  // ─── 查询 OEE 记录 ────────────────────────────────────────────────────────

  async findRecords(
    tenantId: string,
    equipmentId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<EamOeeRecord[]> {
    return this.oeeRepo
      .createQueryBuilder('o')
      .where('o.tenantId = :tenantId', { tenantId })
      .andWhere('o.equipmentId = :equipmentId', { equipmentId })
      .andWhere('o.recordDate >= :startDate', { startDate })
      .andWhere('o.recordDate <= :endDate', { endDate })
      .orderBy('o.recordDate', 'ASC')
      .getMany();
  }
}
