import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EamEquipmentHistory, EquipmentEventType } from '../entities/eam-equipment-history.entity.js';

@Injectable()
export class EquipmentHistoryService {
  constructor(
    @InjectRepository(EamEquipmentHistory)
    private readonly historyRepo: Repository<EamEquipmentHistory>,
  ) {}

  async findByEquipment(tenantId: string, equipmentId: string): Promise<EamEquipmentHistory[]> {
    return this.historyRepo
      .find({
        where: { tenantId, equipmentId },
        order: { eventDate: 'DESC' },
      });
  }

  async findByEquipmentAndType(
    tenantId: string,
    equipmentId: string,
    eventType: EquipmentEventType,
  ): Promise<EamEquipmentHistory[]> {
    return this.historyRepo
      .find({
        where: { tenantId, equipmentId, eventType },
        order: { eventDate: 'DESC' },
      });
  }
}
