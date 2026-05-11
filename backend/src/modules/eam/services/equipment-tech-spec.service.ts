import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  EamEquipmentTechSpec,
  ParamType,
} from '../entities/eam-equipment-tech-spec.entity.js';

// ─── DTO ─────────────────────────────────────────────────────────────────────

interface TechSpecDto {
  paramName: string;
  paramCode: string;
  paramValue: string;
  paramUnit?: string;
  paramType?: ParamType;
  isCustom?: boolean;
  sortOrder?: number;
}

@Injectable()
export class EquipmentTechSpecService {
  constructor(
    @InjectRepository(EamEquipmentTechSpec)
    private readonly specRepo: Repository<EamEquipmentTechSpec>,
  ) {}

  // ─── 获取设备所有技术参数 ─────────────────────────────────────────────────

  async findByEquipment(
    tenantId: string,
    equipmentId: string,
  ): Promise<EamEquipmentTechSpec[]> {
    return this.specRepo.find({
      where: { tenantId, equipmentId },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  // ─── 批量保存（upsert by paramCode + equipmentId）────────────────────────

  async saveSpecs(
    tenantId: string,
    equipmentId: string,
    specs: TechSpecDto[],
  ): Promise<EamEquipmentTechSpec[]> {
    const results: EamEquipmentTechSpec[] = [];

    for (const dto of specs) {
      const existing = await this.specRepo.findOne({
        where: { tenantId, equipmentId, paramCode: dto.paramCode },
      });

      if (existing) {
        Object.assign(existing, {
          paramName: dto.paramName,
          paramValue: dto.paramValue,
          paramUnit: dto.paramUnit,
          paramType: dto.paramType ?? existing.paramType,
          isCustom: dto.isCustom ? 1 : 0,
          sortOrder: dto.sortOrder ?? existing.sortOrder,
        });
        results.push(await this.specRepo.save(existing));
      } else {
        const spec = this.specRepo.create({
          tenantId,
          equipmentId,
          paramName: dto.paramName,
          paramCode: dto.paramCode,
          paramValue: dto.paramValue,
          paramUnit: dto.paramUnit,
          paramType: dto.paramType ?? ParamType.TEXT,
          isCustom: dto.isCustom ? 1 : 0,
          sortOrder: dto.sortOrder ?? 0,
        });
        results.push(await this.specRepo.save(spec));
      }
    }

    return results;
  }

  // ─── 删除单个参数 ─────────────────────────────────────────────────────────

  async remove(tenantId: string, id: string): Promise<void> {
    const spec = await this.specRepo.findOne({ where: { id, tenantId } });
    if (!spec) throw new NotFoundException(`技术参数 ${id} 不存在`);
    await this.specRepo.remove(spec);
  }
}
