import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { QmsInspectionRecord } from '../entities/qms-inspection-record.entity.js';
import { QmsInspectionStandard } from '../entities/qms-inspection-standard.entity.js';
import { QmsNonconformance } from '../entities/qms-nonconformance.entity.js';
import { TenantContext } from '../../../shared/tenant/tenant.context.js';
import {
  MESSAGE_SERVICE,
  MessageService,
} from '../../../shared/message/message.interface.js';
import { EventTypes } from '../../event/event-types.constant.js';

// AQL 抽样表（简化版，Level II 正常检验）
const AQL_TABLE: Record<
  string,
  { sampleSize: number; acceptQty: number; rejectQty: number }
> = {
  '2-8': { sampleSize: 2, acceptQty: 0, rejectQty: 1 },
  '9-15': { sampleSize: 3, acceptQty: 0, rejectQty: 1 },
  '16-25': { sampleSize: 5, acceptQty: 0, rejectQty: 1 },
  '26-50': { sampleSize: 8, acceptQty: 0, rejectQty: 1 },
  '51-90': { sampleSize: 13, acceptQty: 1, rejectQty: 2 },
  '91-150': { sampleSize: 20, acceptQty: 1, rejectQty: 2 },
  '151-280': { sampleSize: 32, acceptQty: 2, rejectQty: 3 },
  '281-500': { sampleSize: 50, acceptQty: 3, rejectQty: 4 },
  '501+': { sampleSize: 80, acceptQty: 5, rejectQty: 6 },
};

export interface ItemResult {
  itemId: string;
  actualValue: number | string;
  result?: 'PASS' | 'FAIL';
}

export interface InspectionSubmit {
  irId: string;
  itemsData: ItemResult[];
  inspectorId?: string;
  remarks?: string;
}

@Injectable()
export class InspectionService {
  constructor(
    @InjectRepository(QmsInspectionRecord)
    private readonly irRepo: Repository<QmsInspectionRecord>,
    @InjectRepository(QmsInspectionStandard)
    private readonly stdRepo: Repository<QmsInspectionStandard>,
    @InjectRepository(QmsNonconformance)
    private readonly ncRepo: Repository<QmsNonconformance>,
    @Inject(MESSAGE_SERVICE)
    private readonly messageSvc: MessageService,
    private readonly dataSource: DataSource,
  ) {}

  // ── 创建检验任务 ──────────────────────────────────────────────────────────

  async create(params: {
    inspectionType: string;
    materialId: string;
    batchId?: string;
    woId?: string;
    wooId?: string;
    standardId?: string;
    inspectorId?: string;
    lotQty?: number;
  }): Promise<QmsInspectionRecord> {
    const tenantId = TenantContext.requireCurrentTenant();

    // 查找检验标准
    let standard: QmsInspectionStandard | null = null;
    if (params.standardId) {
      standard = await this.stdRepo.findOne({
        where: { id: params.standardId, tenantId },
      });
    } else {
      standard = await this.stdRepo.findOne({
        where: {
          tenantId,
          materialId: params.materialId,
          inspectionType: params.inspectionType,
          status: 'ACTIVE',
        } as any,
        order: { version: 'DESC' },
      });
    }

    // 计算抽样数量
    const sampleQty = this.calcSampleQty(standard, params.lotQty);

    const count = await this.irRepo.count({ where: { tenantId } });
    const irNo = `IR-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;

    const now = new Date();
    const saved = await this.irRepo.save(
      this.irRepo.create({
        tenantId,
        irNo,
        inspectionType: params.inspectionType,
        standardId: standard?.id,
        materialId: params.materialId,
        batchId: params.batchId,
        woId: params.woId,
        wooId: params.wooId,
        sampleQty,
        result: 'PENDING' as any,
        inspectorId: params.inspectorId,
        inspectionTime: now,
      }),
    );
    // TypeORM save() 不回填 @CreateDateColumn，手动补上
    if (!saved.createdAt) saved.createdAt = now;
    if (!saved.updatedAt) saved.updatedAt = now;
    return saved;
  }

  // ── 录入实测值 + 自动判定 ─────────────────────────────────────────────────

  async submit(req: InspectionSubmit): Promise<QmsInspectionRecord> {
    const tenantId = TenantContext.requireCurrentTenant();
    const ir = await this.irRepo.findOne({ where: { id: req.irId, tenantId } });
    if (!ir) throw new NotFoundException('QMS_IR_NOT_FOUND');

    // 查检验标准项
    let standardItems: Record<string, unknown>[] = [];
    if (ir.standardId) {
      const std = await this.stdRepo.findOne({
        where: { id: ir.standardId, tenantId },
      });
      standardItems = std?.items ?? [];
    }

    // 自动判定每个检验项
    const itemsData = (req.itemsData ?? []).map((item) => {
      const stdItem = standardItems.find(
        (s: any) => s.itemId === item.itemId || s.id === item.itemId,
      ) as any;
      let itemResult: 'PASS' | 'FAIL' = 'PASS';

      if (stdItem && typeof item.actualValue === 'number') {
        const val = Number(item.actualValue);
        if (stdItem.minValue !== undefined && val < Number(stdItem.minValue))
          itemResult = 'FAIL';
        if (stdItem.maxValue !== undefined && val > Number(stdItem.maxValue))
          itemResult = 'FAIL';
      } else if (stdItem?.stdValue && typeof item.actualValue === 'string') {
        itemResult = item.actualValue === stdItem.stdValue ? 'PASS' : 'FAIL';
      }

      return { ...item, result: item.result ?? itemResult };
    });

    // 整体判定：任一项 FAIL → 整体 FAILED
    const overallResult = itemsData.some((i) => i.result === 'FAIL')
      ? 'FAILED'
      : 'PASSED';

    // ── 事务保障：检验结果更新 + NC单创建 原子执行 ──
    await this.dataSource.transaction(async (em) => {
      await em.update(QmsInspectionRecord, req.irId, {
        itemsData,
        result: overallResult,
        inspectorId: req.inspectorId ?? ir.inspectorId,
        remarks: req.remarks,
        inspectionTime: new Date(),
      });

      // 检验不合格 → 在同一事务内创建不合格品记录，防止检验结果写了但NC单没创建
      if (overallResult === 'FAILED') {
        await this.createNc(ir, tenantId, em);
      }
    });

    const updated = { ...ir, itemsData, result: overallResult };

    // 检验通过 → 发布事件（在事务外执行，消息总线失败不应影响检验结果回滚）
    if (overallResult === 'PASSED') {
      await this.messageSvc.publish({
        eventId: uuidv4(),
        eventType: EventTypes.INSPECTION_COMPLETED,
        tenantId,
        sourceModule: 'QMS',
        targetModule: 'WMS',
        payload: {
          irId: req.irId,
          inspectionType: ir.inspectionType,
          materialId: ir.materialId,
          batchId: ir.batchId,
          woId: ir.woId,
          result: 'PASSED',
        },
        createdAt: new Date(),
      });
    }

    return updated as QmsInspectionRecord;
  }

  // ── 查询 ──────────────────────────────────────────────────────────────────

  async findAll(query: {
    materialId?: string;
    inspectionType?: string;
    result?: string;
    page?: number;
    pageSize?: number;
  }) {
    const tenantId = TenantContext.requireCurrentTenant();
    const { page = 1, pageSize = 20 } = query;
    const qb = this.irRepo
      .createQueryBuilder('ir')
      .where('ir.tenant_id = :tenantId', { tenantId });
    if (query.materialId)
      qb.andWhere('ir.material_id = :mat', { mat: query.materialId });
    if (query.inspectionType)
      qb.andWhere('ir.inspection_type = :type', { type: query.inspectionType });
    if (query.result)
      qb.andWhere('ir.result = :result', { result: query.result });
    const [items, total] = await qb
      .orderBy('ir.inspection_time', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return { items, total };
  }

  // ── AQL 抽样计算 ──────────────────────────────────────────────────────────

  calcSampleQty(
    standard: QmsInspectionStandard | null,
    lotQty?: number,
  ): number {
    if (!standard || !lotQty) return 0;
    const plan = standard.samplingPlan as any;
    if (!plan) return lotQty; // 无抽样方案 → 全检

    if (plan.planType === 'FULL') return lotQty;
    if (plan.planType === 'FIXED') return Number(plan.sampleQty ?? 5);

    // AQL 抽样
    const entry = this.getAqlEntry(lotQty);
    return entry?.sampleSize ?? Math.ceil(lotQty * 0.1);
  }

  private getAqlEntry(lotQty: number) {
    if (lotQty <= 1) return null;
    if (lotQty <= 8) return AQL_TABLE['2-8'];
    if (lotQty <= 15) return AQL_TABLE['9-15'];
    if (lotQty <= 25) return AQL_TABLE['16-25'];
    if (lotQty <= 50) return AQL_TABLE['26-50'];
    if (lotQty <= 90) return AQL_TABLE['51-90'];
    if (lotQty <= 150) return AQL_TABLE['91-150'];
    if (lotQty <= 280) return AQL_TABLE['151-280'];
    if (lotQty <= 500) return AQL_TABLE['281-500'];
    return AQL_TABLE['501+'];
  }

  private async createNc(
    ir: QmsInspectionRecord,
    tenantId: string,
    em?: any,
  ): Promise<void> {
    const repo = em ? em.getRepository(QmsNonconformance) : this.ncRepo;
    const count = await repo.count({ where: { tenantId } });
    const ncNo = `NC-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;
    await repo.save(
      repo.create({
        tenantId,
        ncNo,
        irId: ir.id,
        materialId: ir.materialId,
        batchId: ir.batchId,
        woId: ir.woId,
        status: 'OPEN',
      }),
    );
  }
}
