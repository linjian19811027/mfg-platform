import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  EamEquipmentHistory,
  EquipmentEventType,
} from '../entities/eam-equipment-history.entity.js';

@Injectable()
export class EquipmentDocumentService {
  constructor(
    @InjectRepository(EamEquipmentHistory)
    private readonly historyRepo: Repository<EamEquipmentHistory>,
  ) {}

  // ─── 记录文档上传（写入履历）─────────────────────────────────────────────

  async recordDocumentUpload(
    tenantId: string,
    equipmentId: string,
    fileId: string,
    fileName: string,
    version: string,
    operatorId: string,
  ): Promise<EamEquipmentHistory> {
    const description = `document:${fileName}:v${version}:fileId=${fileId}`;
    const history = this.historyRepo.create({
      tenantId,
      equipmentId,
      eventType: EquipmentEventType.MODIFICATION,
      eventDate: new Date(),
      description,
      operatorId,
    });
    return this.historyRepo.save(history);
  }

  // ─── 查询设备文档列表 ─────────────────────────────────────────────────────

  async findDocuments(
    tenantId: string,
    equipmentId: string,
  ): Promise<EamEquipmentHistory[]> {
    const records = await this.historyRepo.find({
      where: {
        tenantId,
        equipmentId,
        eventType: EquipmentEventType.MODIFICATION,
      },
      order: { eventDate: 'DESC' },
    });

    // 筛选 description 包含 'document:' 的记录
    return records.filter((r) => r.description?.startsWith('document:'));
  }
}
