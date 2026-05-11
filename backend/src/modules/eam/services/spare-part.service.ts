import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import {
  EamSparePart,
  SparePartCategory,
} from '../entities/eam-spare-part.entity.js';
import {
  EamSparePartTransaction,
  SparePartTransactionType,
} from '../entities/eam-spare-part-transaction.entity.js';
import { EamFaultKnowledge } from '../entities/eam-fault-knowledge.entity.js';
import {
  MessageService,
  MESSAGE_SERVICE,
} from '../../../shared/message/message.interface.js';

// ─── DTOs ────────────────────────────────────────────────────────────────────

interface CreatePartDto {
  partCode: string;
  partName: string;
  specification?: string;
  category: SparePartCategory;
  unit: string;
  safetyStock?: number;
  maxStock?: number;
  location?: string;
  unitCost?: number;
  supplier?: string;
  leadTimeDays?: number;
}

interface PartQueryDto {
  category?: SparePartCategory;
  keyword?: string;
  lowStock?: boolean;
  page?: number;
  pageSize?: number;
}

interface IssueDto {
  quantity: number;
  relatedTaskId?: string;
  relatedEquipmentId?: string;
  operatorId?: string;
  remark?: string;
}

interface ReceiveDto {
  quantity: number;
  unitCost?: number;
  operatorId?: string;
  remark?: string;
}

interface InventoryQueryDto {
  category?: SparePartCategory;
  lowStock?: boolean;
}

interface InventoryItem {
  partId: string;
  partCode: string;
  partName: string;
  currentStock: number;
  safetyStock: number;
  isBelowSafety: boolean;
}

interface IssueApplicationDto {
  partId: string;
  quantity: number;
  relatedTaskId?: string;
  relatedEquipmentId?: string;
  applicantId: string;
  remark?: string;
}

interface AnalyticsQueryDto {
  equipmentId?: string;
  startDate?: Date;
  endDate?: Date;
  slowMovingDays?: number;
}

interface SparePartAnalytics {
  consumption: Array<{ partId: string; partCode: string; totalQty: number }>;
  slowMoving: EamSparePart[];
}

interface CreateKnowledgeDto {
  equipmentType: string;
  faultType: string;
  faultSymptoms: string;
  possibleCauses: string;
  diagnosisSteps: string;
  repairSolution: string;
  preventiveMeasures?: string;
  keywords: string;
  createdBy?: string;
}

interface KnowledgeQueryDto {
  equipmentType?: string;
  faultType?: string;
  page?: number;
  pageSize?: number;
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class SparePartService {
  constructor(
    @InjectRepository(EamSparePart)
    private readonly partRepo: Repository<EamSparePart>,
    @InjectRepository(EamSparePartTransaction)
    private readonly txRepo: Repository<EamSparePartTransaction>,
    @InjectRepository(EamFaultKnowledge)
    private readonly knowledgeRepo: Repository<EamFaultKnowledge>,
    @Inject(MESSAGE_SERVICE)
    private readonly messageBus: MessageService,
  ) {}

  // ─── 4.1 备件台账 CRUD ────────────────────────────────────────────────────

  async create(tenantId: string, dto: CreatePartDto): Promise<EamSparePart> {
    const part = this.partRepo.create({
      tenantId,
      partCode: dto.partCode,
      partName: dto.partName,
      specification: dto.specification,
      category: dto.category,
      unit: dto.unit,
      currentStock: '0',
      safetyStock:
        dto.safetyStock !== undefined ? String(dto.safetyStock) : '0',
      maxStock: dto.maxStock !== undefined ? String(dto.maxStock) : undefined,
      location: dto.location,
      unitCost: dto.unitCost !== undefined ? String(dto.unitCost) : undefined,
      supplier: dto.supplier,
      leadTimeDays: dto.leadTimeDays,
    });
    return this.partRepo.save(part);
  }

  async findAll(
    tenantId: string,
    query: PartQueryDto,
  ): Promise<{ data: EamSparePart[]; total: number }> {
    const { category, keyword, lowStock, page = 1, pageSize = 20 } = query;

    const qb = this.partRepo
      .createQueryBuilder('p')
      .where('p.tenantId = :tenantId', { tenantId })
      .andWhere('p.isActive = 1');

    if (category) qb.andWhere('p.category = :category', { category });
    if (keyword) {
      qb.andWhere('(p.partCode LIKE :kw OR p.partName LIKE :kw)', {
        kw: `%${keyword}%`,
      });
    }
    if (lowStock) {
      qb.andWhere(
        'CAST(p.currentStock AS DECIMAL(10,3)) <= CAST(p.safetyStock AS DECIMAL(10,3))',
      );
    }

    const [data, total] = await qb
      .orderBy('p.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { data, total };
  }

  async findOne(tenantId: string, id: string): Promise<EamSparePart> {
    const part = await this.partRepo.findOne({ where: { id, tenantId } });
    if (!part) throw new NotFoundException(`备件 ${id} 不存在`);
    return part;
  }

  async update(
    tenantId: string,
    id: string,
    dto: Partial<CreatePartDto>,
  ): Promise<EamSparePart> {
    const part = await this.findOne(tenantId, id);
    const updateData: Partial<EamSparePart> = {};
    if (dto.partCode !== undefined) updateData.partCode = dto.partCode;
    if (dto.partName !== undefined) updateData.partName = dto.partName;
    if (dto.specification !== undefined)
      updateData.specification = dto.specification;
    if (dto.category !== undefined) updateData.category = dto.category;
    if (dto.unit !== undefined) updateData.unit = dto.unit;
    if (dto.safetyStock !== undefined)
      updateData.safetyStock = String(dto.safetyStock);
    if (dto.maxStock !== undefined) updateData.maxStock = String(dto.maxStock);
    if (dto.location !== undefined) updateData.location = dto.location;
    if (dto.unitCost !== undefined) updateData.unitCost = String(dto.unitCost);
    if (dto.supplier !== undefined) updateData.supplier = dto.supplier;
    if (dto.leadTimeDays !== undefined)
      updateData.leadTimeDays = dto.leadTimeDays;
    Object.assign(part, updateData);
    return this.partRepo.save(part);
  }

  // ─── 4.1 领用出库（非负约束）+ 写流水 ────────────────────────────────────

  async issue(
    tenantId: string,
    partId: string,
    dto: IssueDto,
  ): Promise<EamSparePartTransaction> {
    const part = await this.findOne(tenantId, partId);
    const currentStock = parseFloat(part.currentStock);

    if (currentStock < dto.quantity) {
      throw new BadRequestException(`库存不足，当前库存: ${currentStock}`);
    }

    const stockBefore = currentStock;
    const stockAfter = currentStock - dto.quantity;

    part.currentStock = stockAfter.toFixed(3);
    await this.partRepo.save(part);

    const tx = this.txRepo.create({
      tenantId,
      partId,
      transactionType: SparePartTransactionType.OUT,
      quantity: (-dto.quantity).toFixed(3),
      stockBefore: stockBefore.toFixed(3),
      stockAfter: stockAfter.toFixed(3),
      unitCost: part.unitCost,
      totalCost:
        part.unitCost !== undefined
          ? String(parseFloat(part.unitCost) * dto.quantity)
          : undefined,
      relatedTaskId: dto.relatedTaskId,
      relatedEquipmentId: dto.relatedEquipmentId,
      operatorId: dto.operatorId,
      remark: dto.remark,
      transactionDate: new Date(),
    });
    const saved = await this.txRepo.save(tx);

    await this.checkSafetyStock(tenantId, part);

    return saved;
  }

  // ─── 4.1 入库 + 写流水 ───────────────────────────────────────────────────

  async receive(
    tenantId: string,
    partId: string,
    dto: ReceiveDto,
  ): Promise<EamSparePartTransaction> {
    const part = await this.findOne(tenantId, partId);
    const currentStock = parseFloat(part.currentStock);

    const stockBefore = currentStock;
    const stockAfter = currentStock + dto.quantity;

    part.currentStock = stockAfter.toFixed(3);
    if (dto.unitCost !== undefined) part.unitCost = String(dto.unitCost);
    await this.partRepo.save(part);

    const unitCostStr =
      dto.unitCost !== undefined ? String(dto.unitCost) : part.unitCost;
    const tx = this.txRepo.create({
      tenantId,
      partId,
      transactionType: SparePartTransactionType.IN,
      quantity: dto.quantity.toFixed(3),
      stockBefore: stockBefore.toFixed(3),
      stockAfter: stockAfter.toFixed(3),
      unitCost: unitCostStr,
      totalCost:
        unitCostStr !== undefined
          ? String(parseFloat(unitCostStr) * dto.quantity)
          : undefined,
      operatorId: dto.operatorId,
      remark: dto.remark,
      transactionDate: new Date(),
    });
    return this.txRepo.save(tx);
  }

  // ─── 4.2 实时库存查询 ─────────────────────────────────────────────────────

  async getInventory(
    tenantId: string,
    query: InventoryQueryDto,
  ): Promise<InventoryItem[]> {
    const { category, lowStock } = query;

    const qb = this.partRepo
      .createQueryBuilder('p')
      .where('p.tenantId = :tenantId', { tenantId })
      .andWhere('p.isActive = 1');

    if (category) qb.andWhere('p.category = :category', { category });

    const parts = await qb.orderBy('p.partCode', 'ASC').getMany();

    const items: InventoryItem[] = parts.map((p) => {
      const current = parseFloat(p.currentStock);
      const safety = parseFloat(p.safetyStock);
      return {
        partId: p.id,
        partCode: p.partCode,
        partName: p.partName,
        currentStock: current,
        safetyStock: safety,
        isBelowSafety: current <= safety,
      };
    });

    if (lowStock) {
      return items.filter((i) => i.isBelowSafety);
    }
    return items;
  }

  // ─── 4.3 领用申请（申请→待审批）─────────────────────────────────────────

  async applyIssue(
    tenantId: string,
    dto: IssueApplicationDto,
  ): Promise<EamSparePartTransaction> {
    const part = await this.findOne(tenantId, dto.partId);

    // 创建 PENDING 状态的流水（quantity 为负，但库存暂不扣减）
    const tx = this.txRepo.create({
      tenantId,
      partId: dto.partId,
      transactionType: SparePartTransactionType.OUT,
      quantity: (-dto.quantity).toFixed(3),
      stockBefore: part.currentStock,
      stockAfter: part.currentStock, // 待审批，库存暂不变
      operatorId: dto.applicantId,
      relatedTaskId: dto.relatedTaskId,
      relatedEquipmentId: dto.relatedEquipmentId,
      remark: `[PENDING_APPROVAL] ${dto.remark ?? ''}`,
      transactionDate: new Date(),
    });
    return this.txRepo.save(tx);
  }

  // ─── 4.3 审批领用（审批通过→实际出库）───────────────────────────────────

  async approveIssue(
    tenantId: string,
    txId: string,
    approverId: string,
  ): Promise<EamSparePartTransaction> {
    const tx = await this.txRepo.findOne({ where: { id: txId, tenantId } });
    if (!tx) throw new NotFoundException(`领用申请 ${txId} 不存在`);

    if (!tx.remark?.includes('[PENDING_APPROVAL]')) {
      throw new BadRequestException('该流水不是待审批状态');
    }

    const quantity = Math.abs(parseFloat(tx.quantity));
    const part = await this.findOne(tenantId, tx.partId);
    const currentStock = parseFloat(part.currentStock);

    if (currentStock < quantity) {
      throw new BadRequestException(`库存不足，当前库存: ${currentStock}`);
    }

    const stockBefore = currentStock;
    const stockAfter = currentStock - quantity;

    part.currentStock = stockAfter.toFixed(3);
    await this.partRepo.save(part);

    tx.stockBefore = stockBefore.toFixed(3);
    tx.stockAfter = stockAfter.toFixed(3);
    tx.remark = (tx.remark ?? '')
      .replace('[PENDING_APPROVAL]', `[APPROVED:${approverId}]`)
      .trim();
    const saved = await this.txRepo.save(tx);

    await this.checkSafetyStock(tenantId, part);

    return saved;
  }

  // ─── 4.4 安全库存预警（内部调用）────────────────────────────────────────

  private async checkSafetyStock(
    tenantId: string,
    part: EamSparePart,
  ): Promise<void> {
    const currentStock = parseFloat(part.currentStock);
    const safetyStock = parseFloat(part.safetyStock);

    if (currentStock <= safetyStock) {
      await this.messageBus.publish({
        eventId: uuidv4(),
        eventType: 'SPARE_PART_REORDER',
        tenantId,
        sourceModule: 'EAM',
        targetModule: 'SCM',
        payload: {
          partId: part.id,
          partCode: part.partCode,
          partName: part.partName,
          currentStock,
          safetyStock,
          suggestedOrderQty: safetyStock * 2,
        },
        createdAt: new Date(),
      });
    }
  }

  // ─── 4.5 备件分析 ─────────────────────────────────────────────────────────

  async analytics(
    tenantId: string,
    query: AnalyticsQueryDto,
  ): Promise<SparePartAnalytics> {
    const { equipmentId, startDate, endDate, slowMovingDays = 90 } = query;

    // 消耗分析：OUT 类型流水按 partId 汇总
    const consumptionQb = this.txRepo
      .createQueryBuilder('t')
      .select('t.partId', 'partId')
      .addSelect('p.partCode', 'partCode')
      .addSelect('SUM(ABS(CAST(t.quantity AS DECIMAL(10,3))))', 'totalQty')
      .innerJoin(
        EamSparePart,
        'p',
        'p.id = t.partId AND p.tenantId = t.tenantId',
      )
      .where('t.tenantId = :tenantId', { tenantId })
      .andWhere('t.transactionType = :type', {
        type: SparePartTransactionType.OUT,
      })
      .andWhere("t.remark NOT LIKE '%[PENDING_APPROVAL]%' OR t.remark IS NULL");

    if (equipmentId) {
      consumptionQb.andWhere('t.relatedEquipmentId = :equipmentId', {
        equipmentId,
      });
    }
    if (startDate) {
      consumptionQb.andWhere('t.transactionDate >= :startDate', { startDate });
    }
    if (endDate) {
      consumptionQb.andWhere('t.transactionDate <= :endDate', { endDate });
    }

    const consumptionRows = await consumptionQb
      .groupBy('t.partId')
      .addGroupBy('p.partCode')
      .orderBy('totalQty', 'DESC')
      .getRawMany();

    const consumption = consumptionRows.map((r) => ({
      partId: r.partId as string,
      partCode: r.partCode as string,
      totalQty: parseFloat(r.totalQty ?? '0'),
    }));

    // 呆滞分析：超过 N 天没有 OUT 流水的备件
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - slowMovingDays);

    const activePartIds = await this.txRepo
      .createQueryBuilder('t')
      .select('DISTINCT t.partId', 'partId')
      .where('t.tenantId = :tenantId', { tenantId })
      .andWhere('t.transactionType = :type', {
        type: SparePartTransactionType.OUT,
      })
      .andWhere('t.transactionDate >= :cutoff', { cutoff: cutoffDate })
      .getRawMany();

    const activeIds = activePartIds.map((r) => r.partId as string);

    const slowMovingQb = this.partRepo
      .createQueryBuilder('p')
      .where('p.tenantId = :tenantId', { tenantId })
      .andWhere('p.isActive = 1');

    if (activeIds.length > 0) {
      slowMovingQb.andWhere('p.id NOT IN (:...activeIds)', { activeIds });
    }

    const slowMoving = await slowMovingQb
      .orderBy('p.partCode', 'ASC')
      .getMany();

    return { consumption, slowMoving };
  }

  // ─── 4.6 故障知识库 CRUD ──────────────────────────────────────────────────

  async createKnowledge(
    tenantId: string,
    dto: CreateKnowledgeDto,
  ): Promise<EamFaultKnowledge> {
    const knowledge = this.knowledgeRepo.create({
      tenantId,
      equipmentType: dto.equipmentType,
      faultType: dto.faultType,
      faultSymptoms: dto.faultSymptoms,
      possibleCauses: dto.possibleCauses,
      diagnosisSteps: dto.diagnosisSteps,
      repairSolution: dto.repairSolution,
      preventiveMeasures: dto.preventiveMeasures,
      keywords: dto.keywords,
      isVerified: 0,
      usageCount: 0,
      createdBy: dto.createdBy,
    });
    return this.knowledgeRepo.save(knowledge);
  }

  async findKnowledge(
    tenantId: string,
    query: KnowledgeQueryDto,
  ): Promise<{ data: EamFaultKnowledge[]; total: number }> {
    const { equipmentType, faultType, page = 1, pageSize = 20 } = query;

    const qb = this.knowledgeRepo
      .createQueryBuilder('k')
      .where('k.tenantId = :tenantId', { tenantId });

    if (equipmentType)
      qb.andWhere('k.equipmentType = :equipmentType', { equipmentType });
    if (faultType) qb.andWhere('k.faultType = :faultType', { faultType });

    const [data, total] = await qb
      .orderBy('k.usageCount', 'DESC')
      .addOrderBy('k.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { data, total };
  }

  // ─── 备件流水查询 ─────────────────────────────────────────────────────────

  async findTransactions(
    tenantId: string,
    query: { sparePartId?: string; page?: number; pageSize?: number } = {},
  ): Promise<{ list: EamSparePartTransaction[]; total: number }> {
    const { sparePartId, page = 1, pageSize = 20 } = query;
    const qb = this.txRepo
      .createQueryBuilder('t')
      .where('t.tenantId = :tenantId', { tenantId })
      .orderBy('t.transactionDate', 'DESC');
    if (sparePartId) qb.andWhere('t.partId = :sparePartId', { sparePartId });
    qb.skip((page - 1) * pageSize).take(pageSize);
    const [list, total] = await qb.getManyAndCount();
    return { list, total };
  }
}
