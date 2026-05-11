import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
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

interface CreateEquipmentDto {
  equipmentCode: string;
  equipmentName: string;
  equipmentType: string;
  category: string;
  parentId?: string;
  workshopId?: string;
  productionLineId?: string;
  workstationId?: string;
  location?: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  purchaseDate?: Date;
  installDate?: Date;
  commissionDate?: Date;
  warrantyExpiry?: Date;
  qrCode?: string;
  imageUrl?: string;
  remark?: string;
}

interface UpdateEquipmentDto extends Partial<CreateEquipmentDto> {}

interface EquipmentQueryDto {
  workshopId?: string;
  productionLineId?: string;
  status?: EquipmentStatus;
  equipmentType?: string;
  page?: number;
  pageSize?: number;
}

export interface EquipmentTreeNode extends EamEquipment {
  children: EquipmentTreeNode[];
}

// ─── 状态 → 事件类型映射 ──────────────────────────────────────────────────────

const STATUS_TO_EVENT: Record<EquipmentStatus, EquipmentEventType> = {
  [EquipmentStatus.MAINTENANCE]: EquipmentEventType.MAINTENANCE,
  [EquipmentStatus.FAULT]: EquipmentEventType.REPAIR,
  [EquipmentStatus.SCRAPPED]: EquipmentEventType.SCRAP,
  [EquipmentStatus.RUNNING]: EquipmentEventType.COMMISSION,
  [EquipmentStatus.IDLE]: EquipmentEventType.COMMISSION,
};

@Injectable()
export class EquipmentService {
  constructor(
    @InjectRepository(EamEquipment)
    private readonly equipRepo: Repository<EamEquipment>,
    @InjectRepository(EamEquipmentHistory)
    private readonly historyRepo: Repository<EamEquipmentHistory>,
    @Inject(MESSAGE_SERVICE)
    private readonly messageBus: MessageService,
  ) {}

  // ─── CRUD ─────────────────────────────────────────────────────────────────

  async create(
    tenantId: string,
    dto: CreateEquipmentDto,
  ): Promise<EamEquipment> {
    const equipment = this.equipRepo.create({ ...dto, tenantId });
    return this.equipRepo.save(equipment);
  }

  async findAll(
    tenantId: string,
    query: EquipmentQueryDto,
  ): Promise<{ data: EamEquipment[]; total: number }> {
    const {
      workshopId,
      productionLineId,
      status,
      equipmentType,
      page = 1,
      pageSize = 20,
    } = query;

    const qb = this.equipRepo
      .createQueryBuilder('e')
      .where('e.tenantId = :tenantId', { tenantId });

    if (workshopId) qb.andWhere('e.workshopId = :workshopId', { workshopId });
    if (productionLineId)
      qb.andWhere('e.productionLineId = :productionLineId', {
        productionLineId,
      });
    if (status) qb.andWhere('e.status = :status', { status });
    if (equipmentType)
      qb.andWhere('e.equipmentType = :equipmentType', { equipmentType });

    const [data, total] = await qb
      .orderBy('e.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { data, total };
  }

  async findOne(tenantId: string, id: string): Promise<EamEquipment> {
    const equipment = await this.equipRepo.findOne({ where: { id, tenantId } });
    if (!equipment) throw new NotFoundException(`设备 ${id} 不存在`);
    return equipment;
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateEquipmentDto,
  ): Promise<EamEquipment> {
    const equipment = await this.findOne(tenantId, id);
    Object.assign(equipment, dto);
    return this.equipRepo.save(equipment);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const equipment = await this.findOne(tenantId, id);
    await this.equipRepo.remove(equipment);
  }

  // ─── 设备树（任务1.3）────────────────────────────────────────────────────

  async getTree(
    tenantId: string,
    workshopId?: string,
  ): Promise<EquipmentTreeNode[]> {
    const qb = this.equipRepo
      .createQueryBuilder('e')
      .where('e.tenantId = :tenantId', { tenantId });
    if (workshopId) qb.andWhere('e.workshopId = :workshopId', { workshopId });

    const all = await qb.orderBy('e.createdAt', 'ASC').getMany();
    return this.buildTree(all, null);
  }

  private buildTree(
    all: EamEquipment[],
    parentId: string | null,
  ): EquipmentTreeNode[] {
    return all
      .filter((e) => (e.parentId ?? null) === parentId)
      .map((e) => ({
        ...e,
        children: this.buildTree(all, e.id),
      }));
  }

  // ─── 状态流转（任务1.3 + 1.6）────────────────────────────────────────────

  async changeStatus(
    tenantId: string,
    id: string,
    newStatus: EquipmentStatus,
    operatorId: string,
    reason: string,
  ): Promise<EamEquipment> {
    const equipment = await this.findOne(tenantId, id);
    const oldStatus = equipment.status;
    equipment.status = newStatus;
    const saved = await this.equipRepo.save(equipment);

    await this.writeHistory(tenantId, id, newStatus, operatorId, reason);

    await this.messageBus.publish({
      eventId: uuidv4(),
      eventType: 'EQUIPMENT_STATUS_CHANGED',
      tenantId,
      sourceModule: 'EAM',
      targetModule: 'APS',
      payload: {
        equipmentId: id,
        oldStatus,
        newStatus,
        operatorId,
        reason,
      },
      createdAt: new Date(),
    });

    return saved;
  }

  // ─── 二维码查询（任务1.8）────────────────────────────────────────────────

  async findByQrCode(tenantId: string, qrCode: string): Promise<EamEquipment> {
    const equipment = await this.equipRepo.findOne({
      where: { qrCode, tenantId },
    });
    if (!equipment)
      throw new NotFoundException(`二维码 ${qrCode} 对应设备不存在`);
    return equipment;
  }

  // ─── 私有：写履历（任务1.6）──────────────────────────────────────────────

  private async writeHistory(
    tenantId: string,
    equipmentId: string,
    newStatus: EquipmentStatus,
    operatorId: string,
    description: string,
  ): Promise<EamEquipmentHistory> {
    const eventType =
      STATUS_TO_EVENT[newStatus] ?? EquipmentEventType.COMMISSION;
    const history = this.historyRepo.create({
      tenantId,
      equipmentId,
      eventType,
      eventDate: new Date(),
      description,
      operatorId,
    });
    return this.historyRepo.save(history);
  }
}
