import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { EamLubrication } from '../entities/eam-lubrication.entity.js';

// ─── DTOs ────────────────────────────────────────────────────────────────────

interface LubricationPointDto {
  equipmentId: string;
  lubricationPoint: string;
  lubricantType: string;
  lubricantSpec?: string;
  intervalDays: number;
}

interface LubricationRecordDto {
  lubricationDate: Date;
  quantity?: number;
  unit?: string;
  operatorId?: string;
  remark?: string;
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class LubricationService {
  constructor(
    @InjectRepository(EamLubrication)
    private readonly lubRepo: Repository<EamLubrication>,
  ) {}

  async upsertPoint(
    tenantId: string,
    dto: LubricationPointDto,
  ): Promise<EamLubrication> {
    const existing = await this.lubRepo.findOne({
      where: {
        tenantId,
        equipmentId: dto.equipmentId,
        lubricationPoint: dto.lubricationPoint,
      },
    });

    if (existing) {
      Object.assign(existing, {
        lubricantType: dto.lubricantType,
        lubricantSpec: dto.lubricantSpec,
        intervalDays: dto.intervalDays,
      });
      return this.lubRepo.save(existing);
    }

    const point = this.lubRepo.create({ ...dto, tenantId });
    return this.lubRepo.save(point);
  }

  async recordLubrication(
    tenantId: string,
    id: string,
    dto: LubricationRecordDto,
  ): Promise<EamLubrication> {
    const point = await this.lubRepo.findOne({ where: { id, tenantId } });
    if (!point) throw new NotFoundException(`润滑点 ${id} 不存在`);

    const lubDate = new Date(dto.lubricationDate);
    const nextDate = new Date(lubDate);
    nextDate.setDate(nextDate.getDate() + point.intervalDays);

    point.lubricationDate = lubDate;
    point.lastLubricationDate = lubDate;
    point.nextLubricationDate = nextDate;

    if (dto.quantity !== undefined) point.quantity = String(dto.quantity);
    if (dto.unit !== undefined) point.unit = dto.unit;
    if (dto.operatorId !== undefined) point.operatorId = dto.operatorId;
    if (dto.remark !== undefined) point.remark = dto.remark;

    return this.lubRepo.save(point);
  }

  async findDuePoints(
    tenantId: string,
    daysAhead = 7,
  ): Promise<EamLubrication[]> {
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + daysAhead);
    deadline.setHours(23, 59, 59, 999);

    return this.lubRepo
      .createQueryBuilder('l')
      .where('l.tenantId = :tenantId', { tenantId })
      .andWhere('l.nextLubricationDate <= :deadline', { deadline })
      .orderBy('l.nextLubricationDate', 'ASC')
      .getMany();
  }

  async findByEquipment(
    tenantId: string,
    equipmentId: string,
  ): Promise<EamLubrication[]> {
    return this.lubRepo.find({
      where: { tenantId, equipmentId },
      order: { lubricationPoint: 'ASC' },
    });
  }
}
