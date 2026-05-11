import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import {
  EamInspectionRecord,
  InspectionType,
  InspectionOverallResult,
} from '../entities/eam-inspection-record.entity.js';
import {
  MessageService,
  MESSAGE_SERVICE,
} from '../../../shared/message/message.interface.js';

// ─── DTOs ────────────────────────────────────────────────────────────────────

interface CreateInspectionDto {
  equipmentId: string;
  inspectionType: InspectionType;
  inspectionDate: Date;
  inspectorId: string;
  checkItems: Array<{
    itemName: string;
    standard: string;
    actualValue: string;
    result: 'NORMAL' | 'ABNORMAL';
    remark?: string;
  }>;
  overallResult: InspectionOverallResult;
  abnormalDescription?: string;
}

interface InspectionQueryDto {
  startDate?: Date;
  endDate?: Date;
  page?: number;
  pageSize?: number;
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class InspectionService {
  constructor(
    @InjectRepository(EamInspectionRecord)
    private readonly recordRepo: Repository<EamInspectionRecord>,
    @Inject(MESSAGE_SERVICE)
    private readonly messageBus: MessageService,
  ) {}

  async createRecord(
    tenantId: string,
    dto: CreateInspectionDto,
  ): Promise<EamInspectionRecord> {
    const record = this.recordRepo.create({ ...dto, tenantId });
    const saved = await this.recordRepo.save(record);

    if (
      saved.overallResult === InspectionOverallResult.ABNORMAL ||
      saved.overallResult === InspectionOverallResult.NEEDS_REPAIR
    ) {
      await this.handleAbnormal(tenantId, saved);
    }

    return saved;
  }

  async findRecords(
    tenantId: string,
    equipmentId: string,
    query: InspectionQueryDto,
  ): Promise<{ data: EamInspectionRecord[]; total: number }> {
    const { startDate, endDate, page = 1, pageSize = 20 } = query;

    const qb = this.recordRepo
      .createQueryBuilder('r')
      .where('r.tenantId = :tenantId', { tenantId })
      .andWhere('r.equipmentId = :equipmentId', { equipmentId });

    if (startDate) qb.andWhere('r.inspectionDate >= :startDate', { startDate });
    if (endDate) qb.andWhere('r.inspectionDate <= :endDate', { endDate });

    const [data, total] = await qb
      .orderBy('r.inspectionDate', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { data, total };
  }

  private async handleAbnormal(
    tenantId: string,
    record: EamInspectionRecord,
  ): Promise<void> {
    await this.messageBus.publish({
      eventId: uuidv4(),
      eventType: 'INSPECTION_ABNORMAL',
      tenantId,
      sourceModule: 'EAM',
      payload: {
        inspectionRecordId: record.id,
        equipmentId: record.equipmentId,
        overallResult: record.overallResult,
        abnormalDescription: record.abnormalDescription,
        checkItems: record.checkItems,
        inspectionDate: record.inspectionDate,
        inspectorId: record.inspectorId,
      },
      createdAt: new Date(),
    });
  }
}
