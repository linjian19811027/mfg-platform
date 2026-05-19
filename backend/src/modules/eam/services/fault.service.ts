import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import {
  EamFaultRecord,
  FaultSource,
  FaultSeverity,
  FaultStatus,
} from '../entities/eam-fault-record.entity.js';
import { EamFaultKnowledge } from '../entities/eam-fault-knowledge.entity.js';
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

interface ReportFaultDto {
  equipmentId: string;
  faultSource: FaultSource;
  faultType: string;
  faultDescription: string;
  severity: FaultSeverity;
  reportedBy?: string;
}

interface RespondFaultDto {
  assignedTo: string;
}

interface DiagnoseFaultDto {
  diagnosisResult: string;
  rootCause: string;
  repairMethod: string;
}

interface StartRepairDto {
  startRepairAt?: Date;
}

interface CompleteRepairDto {
  endRepairAt: Date;
  laborHours?: number;
  laborCost?: number;
  materialCost?: number;
  productionLoss?: number;
}

interface VerifyFaultDto {
  verifiedBy: string;
  verificationNote?: string;
}

interface FaultQueryDto {
  equipmentId?: string;
  status?: FaultStatus;
  severity?: FaultSeverity;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  pageSize?: number;
}

interface MtbfMttrResult {
  mtbf: number;
  mttr: number;
  faultCount: number;
  totalDowntimeHours: number;
}

interface FaultAnalyticsQuery {
  equipmentId?: string;
  startDate?: Date;
  endDate?: Date;
}

interface FaultAnalyticsResult {
  byType: Array<{ faultType: string; count: number }>;
  trend: Array<{ month: string; count: number }>;
  totalLoss: number;
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class FaultService {
  constructor(
    @InjectRepository(EamFaultRecord)
    private readonly faultRepo: Repository<EamFaultRecord>,
    @InjectRepository(EamFaultKnowledge)
    private readonly knowledgeRepo: Repository<EamFaultKnowledge>,
    @InjectRepository(EamEquipment)
    private readonly equipRepo: Repository<EamEquipment>,
    @InjectRepository(EamEquipmentHistory)
    private readonly historyRepo: Repository<EamEquipmentHistory>,
    @Inject(MESSAGE_SERVICE)
    private readonly messageBus: MessageService,
    private readonly dataSource: DataSource,
  ) {}

  // ─── 2.1 故障报修 ─────────────────────────────────────────────────────────

  async reportFault(
    tenantId: string,
    dto: ReportFaultDto,
  ): Promise<EamFaultRecord> {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000).toString();
    const faultCode = `FAULT-${dateStr}-${rand}`;

    // ── 事务保障：故障记录 + 设备状态更新 + 履历写入 原子执行 ──
    const saved = await this.dataSource.transaction(async (em) => {
      const record = em.create(EamFaultRecord, {
        tenantId,
        faultCode,
        equipmentId: dto.equipmentId,
        faultSource: dto.faultSource,
        faultType: dto.faultType,
        faultDescription: dto.faultDescription,
        severity: dto.severity,
        status: FaultStatus.REPORTED,
        reportedAt: now,
        reportedBy: dto.reportedBy,
      });
      const savedRecord = await em.save(EamFaultRecord, record);

      // 更新设备状态为 FAULT（与故障记录在同一事务）
      await em.update(
        EamEquipment,
        { id: dto.equipmentId, tenantId },
        { status: EquipmentStatus.FAULT },
      );

      // 写设备履历（与故障记录在同一事务）
      await em.save(
        EamEquipmentHistory,
        em.create(EamEquipmentHistory, {
          tenantId,
          equipmentId: dto.equipmentId,
          eventType: EquipmentEventType.REPAIR,
          eventDate: now,
          description: `故障报修：${faultCode}，类型：${dto.faultType}，描述：${dto.faultDescription}`,
        }),
      );

      return savedRecord;
    });

    // 重复故障预警在事务外执行（发消息不影响主流程回滚）
    await this.checkRepeatFault(tenantId, dto.equipmentId);

    return saved;
  }

  // ─── 2.1 故障响应 ─────────────────────────────────────────────────────────

  async respondFault(
    tenantId: string,
    id: string,
    dto: RespondFaultDto,
  ): Promise<EamFaultRecord> {
    const record = await this.findOne(tenantId, id);
    if (record.status !== FaultStatus.REPORTED) {
      throw new BadRequestException(
        `故障状态必须为 REPORTED，当前状态：${record.status}`,
      );
    }
    record.respondedAt = new Date();
    record.assignedTo = dto.assignedTo;
    record.status = FaultStatus.RESPONDING;
    return this.faultRepo.save(record);
  }

  // ─── 2.1 故障诊断 ─────────────────────────────────────────────────────────

  async diagnoseFault(
    tenantId: string,
    id: string,
    dto: DiagnoseFaultDto,
  ): Promise<EamFaultRecord> {
    const record = await this.findOne(tenantId, id);
    if (record.status !== FaultStatus.RESPONDING) {
      throw new BadRequestException(
        `故障状态必须为 RESPONDING，当前状态：${record.status}`,
      );
    }
    record.diagnosisResult = dto.diagnosisResult;
    record.rootCause = dto.rootCause;
    record.repairMethod = dto.repairMethod;
    record.status = FaultStatus.DIAGNOSING;
    return this.faultRepo.save(record);
  }

  // ─── 2.1 开始维修 ─────────────────────────────────────────────────────────

  async startRepair(
    tenantId: string,
    id: string,
    dto: StartRepairDto,
  ): Promise<EamFaultRecord> {
    const record = await this.findOne(tenantId, id);
    if (record.status !== FaultStatus.DIAGNOSING) {
      throw new BadRequestException(
        `故障状态必须为 DIAGNOSING，当前状态：${record.status}`,
      );
    }
    record.startRepairAt = dto.startRepairAt ?? new Date();
    record.status = FaultStatus.REPAIRING;
    return this.faultRepo.save(record);
  }

  // ─── 2.1 维修完成 ─────────────────────────────────────────────────────────

  async completeRepair(
    tenantId: string,
    id: string,
    dto: CompleteRepairDto,
  ): Promise<EamFaultRecord> {
    const record = await this.findOne(tenantId, id);
    if (record.status !== FaultStatus.REPAIRING) {
      throw new BadRequestException(
        `故障状态必须为 REPAIRING，当前状态：${record.status}`,
      );
    }
    record.endRepairAt = dto.endRepairAt;
    if (dto.laborHours !== undefined)
      record.laborHours = String(dto.laborHours);
    if (dto.laborCost !== undefined) record.laborCost = String(dto.laborCost);
    if (dto.materialCost !== undefined)
      record.materialCost = String(dto.materialCost);
    if (dto.productionLoss !== undefined)
      record.productionLoss = String(dto.productionLoss);
    record.status = FaultStatus.VERIFIED;
    return this.faultRepo.save(record);
  }

  // ─── 2.1 + 2.3 维修验收 + 关闭 ───────────────────────────────────────────

  async verifyAndClose(
    tenantId: string,
    id: string,
    dto: VerifyFaultDto,
  ): Promise<EamFaultRecord> {
    const record = await this.findOne(tenantId, id);
    if (record.status !== FaultStatus.VERIFIED) {
      throw new BadRequestException(
        `故障状态必须为 VERIFIED，当前状态：${record.status}`,
      );
    }

    // ── 事务保障：故障关闭 + 设备状态恢复 + 履历写入 原子执行 ──
    const saved = await this.dataSource.transaction(async (em) => {
      record.verifiedAt = new Date();
      record.verifiedBy = dto.verifiedBy;
      record.status = FaultStatus.CLOSED;
      const savedRecord = await em.save(EamFaultRecord, record);

      // 恢复设备状态为 IDLE（与故障关闭在同一事务，失败则设备状态不变）
      await em.update(
        EamEquipment,
        { id: record.equipmentId, tenantId },
        { status: EquipmentStatus.IDLE },
      );

      // 写设备履历（与故障关闭在同一事务）
      await em.save(
        EamEquipmentHistory,
        em.create(EamEquipmentHistory, {
          tenantId,
          equipmentId: record.equipmentId,
          eventType: EquipmentEventType.REPAIR,
          eventDate: new Date(),
          description: `故障维修完成并验收关闭：${record.faultCode}，验收人：${dto.verifiedBy}${dto.verificationNote ? '，备注：' + dto.verificationNote : ''}`,
          relatedTaskId: record.id,
        }),
      );

      return savedRecord;
    });

    // 发布事件在事务外执行（消息总线失败不应影响核心业务回滚）
    await this.messageBus.publish({
      eventId: uuidv4(),
      eventType: 'EQUIPMENT_STATUS_CHANGED',
      tenantId,
      sourceModule: 'EAM',
      targetModule: 'APS',
      payload: {
        equipmentId: record.equipmentId,
        oldStatus: EquipmentStatus.FAULT,
        newStatus: EquipmentStatus.IDLE,
        reason: `故障 ${record.faultCode} 维修验收关闭`,
        faultId: record.id,
      },
      createdAt: new Date(),
    });

    return saved;
  }

  // ─── 查询列表 ─────────────────────────────────────────────────────────────

  async findAll(
    tenantId: string,
    query: FaultQueryDto,
  ): Promise<{ data: EamFaultRecord[]; total: number }> {
    const {
      equipmentId,
      status,
      severity,
      startDate,
      endDate,
      page = 1,
      pageSize = 20,
    } = query;

    const qb = this.faultRepo
      .createQueryBuilder('f')
      .leftJoin('eam_equipment', 'eq', 'eq.id = f.equipment_id AND eq.tenant_id = f.tenant_id')
      .addSelect('eq.equipment_name', 'equipmentName')
      .addSelect('eq.equipment_code', 'equipmentCode')
      .where('f.tenantId = :tenantId', { tenantId });

    if (equipmentId)
      qb.andWhere('f.equipmentId = :equipmentId', { equipmentId });
    if (status) qb.andWhere('f.status = :status', { status });
    if (severity) qb.andWhere('f.severity = :severity', { severity });
    if (startDate) qb.andWhere('f.reportedAt >= :startDate', { startDate });
    if (endDate) qb.andWhere('f.reportedAt <= :endDate', { endDate });

    const { entities, raw } = await qb
      .orderBy('f.reportedAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getRawAndEntities();
    const total = await qb.getCount();
    const data = entities.map((e, i) => ({
      ...e,
      equipmentName: raw[i]?.equipmentName,
      equipmentCode: raw[i]?.equipmentCode,
    }));

    return { data, total };
  }

  // ─── 查询单条 ─────────────────────────────────────────────────────────────

  async findOne(tenantId: string, id: string): Promise<EamFaultRecord> {
    const record = await this.faultRepo.findOne({ where: { id, tenantId } });
    if (!record) throw new NotFoundException(`故障记录 ${id} 不存在`);
    return record;
  }

  // ─── 2.4 重复故障预警 ─────────────────────────────────────────────────────

  async checkRepeatFault(
    tenantId: string,
    equipmentId: string,
  ): Promise<boolean> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const count = await this.faultRepo
      .createQueryBuilder('f')
      .where('f.tenantId = :tenantId', { tenantId })
      .andWhere('f.equipmentId = :equipmentId', { equipmentId })
      .andWhere('f.reportedAt >= :since', { since: thirtyDaysAgo })
      .getCount();

    if (count >= 3) {
      await this.messageBus.publish({
        eventId: uuidv4(),
        eventType: 'FAULT_REPEAT_ALERT',
        tenantId,
        sourceModule: 'EAM',
        payload: {
          equipmentId,
          faultCountIn30Days: count,
          alertMessage: `设备 ${equipmentId} 近30天内故障次数达到 ${count} 次，请关注`,
        },
        createdAt: new Date(),
      });
      return true;
    }
    return false;
  }

  // ─── 2.5 MTBF/MTTR 计算 ──────────────────────────────────────────────────

  async calculateMtbfMttr(
    tenantId: string,
    equipmentId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<MtbfMttrResult> {
    const faults = await this.faultRepo
      .createQueryBuilder('f')
      .where('f.tenantId = :tenantId', { tenantId })
      .andWhere('f.equipmentId = :equipmentId', { equipmentId })
      .andWhere('f.reportedAt >= :startDate', { startDate })
      .andWhere('f.reportedAt <= :endDate', { endDate })
      .getMany();

    const faultCount = faults.length;
    if (faultCount === 0) {
      return { mtbf: 0, mttr: 0, faultCount: 0, totalDowntimeHours: 0 };
    }

    // 总时间（小时）
    const totalHours =
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);

    // 总故障时间（小时）
    let totalDowntimeHours = 0;
    let repairedCount = 0;
    let totalRepairHours = 0;

    for (const f of faults) {
      if (f.endRepairAt && f.reportedAt) {
        const downHours =
          (new Date(f.endRepairAt).getTime() -
            new Date(f.reportedAt).getTime()) /
          (1000 * 60 * 60);
        totalDowntimeHours += downHours;
        totalRepairHours += downHours;
        repairedCount++;
      }
    }

    // MTBF = (总时间 - 总故障时间) / 故障次数
    const mtbf = (totalHours - totalDowntimeHours) / faultCount;

    // MTTR = 总维修时间 / 维修次数（只统计有 endRepairAt 的）
    const mttr = repairedCount > 0 ? totalRepairHours / repairedCount : 0;

    return {
      mtbf: Math.round(mtbf * 100) / 100,
      mttr: Math.round(mttr * 100) / 100,
      faultCount,
      totalDowntimeHours: Math.round(totalDowntimeHours * 100) / 100,
    };
  }

  // ─── 2.6 故障知识库检索 ───────────────────────────────────────────────────

  async searchKnowledge(
    tenantId: string,
    keyword: string,
  ): Promise<EamFaultKnowledge[]> {
    const results = await this.knowledgeRepo
      .createQueryBuilder('k')
      .where('k.tenantId = :tenantId', { tenantId })
      .andWhere(
        '(k.keywords LIKE :kw OR k.faultSymptoms LIKE :kw OR k.faultType LIKE :kw)',
        { kw: `%${keyword}%` },
      )
      .orderBy('k.usageCount', 'DESC')
      .getMany();

    // 找到后 usageCount++
    if (results.length > 0) {
      const ids = results.map((r) => r.id);
      await this.knowledgeRepo
        .createQueryBuilder()
        .update(EamFaultKnowledge)
        .set({ usageCount: () => 'usage_count + 1' })
        .where('id IN (:...ids)', { ids })
        .execute();
    }

    return results;
  }

  // ─── 2.7 故障分析 ─────────────────────────────────────────────────────────

  async faultAnalytics(
    tenantId: string,
    query: FaultAnalyticsQuery,
  ): Promise<FaultAnalyticsResult> {
    const { equipmentId, startDate, endDate } = query;

    const baseQb = () => {
      const qb = this.faultRepo
        .createQueryBuilder('f')
        .where('f.tenantId = :tenantId', { tenantId });
      if (equipmentId)
        qb.andWhere('f.equipmentId = :equipmentId', { equipmentId });
      if (startDate) qb.andWhere('f.reportedAt >= :startDate', { startDate });
      if (endDate) qb.andWhere('f.reportedAt <= :endDate', { endDate });
      return qb;
    };

    // 故障分类统计
    const byTypeRows = await baseQb()
      .select('f.faultType', 'faultType')
      .addSelect('COUNT(f.id)', 'count')
      .groupBy('f.faultType')
      .orderBy('count', 'DESC')
      .getRawMany();

    const byType = byTypeRows.map((r) => ({
      faultType: r.faultType as string,
      count: parseInt(r.count ?? '0', 10),
    }));

    // 故障趋势（按月）
    const trendRows = await baseQb()
      .select("DATE_FORMAT(f.reportedAt, '%Y-%m')", 'month')
      .addSelect('COUNT(f.id)', 'count')
      .groupBy('month')
      .orderBy('month', 'ASC')
      .getRawMany();

    const trend = trendRows.map((r) => ({
      month: r.month as string,
      count: parseInt(r.count ?? '0', 10),
    }));

    // 故障损失汇总
    const lossRow = await baseQb()
      .select(
        'SUM(COALESCE(f.productionLoss, 0) + COALESCE(f.laborCost, 0) + COALESCE(f.materialCost, 0))',
        'totalLoss',
      )
      .getRawOne();

    const totalLoss = parseFloat(lossRow?.totalLoss ?? '0');

    return { byType, trend, totalLoss };
  }
}
