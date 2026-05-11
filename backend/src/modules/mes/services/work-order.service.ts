import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, DataSource } from 'typeorm';
import { MesWorkOrder } from '../entities/mes-work-order.entity.js';
import { MesWorkOrderOperation } from '../entities/mes-work-order-operation.entity.js';
import { MesWorkOrderSplit } from '../entities/mes-work-order-split.entity.js';
import { MesWorkOrderMerge } from '../entities/mes-work-order-merge.entity.js';
import { TenantContext } from '../../../shared/tenant/tenant.context.js';
import { sanitizeUpdateData } from '../../../shared/utils/sanitize.js';

// 状态流转规则
const WO_TRANSITIONS: Record<string, string[]> = {
  RELEASED: ['IN_PROGRESS', 'CLOSED'],
  IN_PROGRESS: ['COMPLETED', 'CLOSED'],
  COMPLETED: ['CLOSED'],
  CLOSED: [],
};

export interface WorkOrderQuery {
  status?: string;
  materialId?: string;
  workCenterId?: string;
  plannedStartFrom?: string;
  plannedStartTo?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class WorkOrderService {
  constructor(
    @InjectRepository(MesWorkOrder)
    private readonly woRepo: Repository<MesWorkOrder>,
    @InjectRepository(MesWorkOrderOperation)
    private readonly wooRepo: Repository<MesWorkOrderOperation>,
    @InjectRepository(MesWorkOrderSplit)
    private readonly splitRepo: Repository<MesWorkOrderSplit>,
    @InjectRepository(MesWorkOrderMerge)
    private readonly mergeRepo: Repository<MesWorkOrderMerge>,
    private readonly dataSource: DataSource,
  ) {}

  // ── CRUD ─────────────────────────────────────────────────────────────────

  async findAll(query: WorkOrderQuery): Promise<{
    items: (MesWorkOrder & { materialName?: string; materialCode?: string })[];
    total: number;
  }> {
    const tenantId = TenantContext.requireCurrentTenant();
    const {
      status,
      materialId,
      workCenterId,
      plannedStartFrom,
      plannedStartTo,
      keyword,
      page = 1,
      pageSize = 20,
    } = query;

    const qb = this.woRepo
      .createQueryBuilder('wo')
      .where('wo.tenant_id = :tenantId', { tenantId });

    if (status) qb.andWhere('wo.status = :status', { status });
    if (materialId) qb.andWhere('wo.material_id = :materialId', { materialId });
    if (workCenterId)
      qb.andWhere('wo.work_center_id = :workCenterId', { workCenterId });
    if (plannedStartFrom)
      qb.andWhere('wo.planned_start >= :from', { from: plannedStartFrom });
    if (plannedStartTo)
      qb.andWhere('wo.planned_start <= :to', { to: plannedStartTo });
    if (keyword) qb.andWhere('wo.wo_no LIKE :kw', { kw: `%${keyword}%` });

    const [wos, total] = await qb
      .orderBy('wo.priority', 'ASC')
      .addOrderBy('wo.planned_start', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    // 批量查物料名称（QueryBuilder 替代原生 SQL，不硬编码表名）
    const matIds = [...new Set(wos.map((w) => w.materialId).filter(Boolean))];
    const matMap = new Map<string, { code: string; name: string }>();
    if (matIds.length > 0) {
      const mats = await this.woRepo.manager
        .createQueryBuilder()
        .select(['m.id AS id', 'm.code AS code', 'm.name AS name'])
        .from('plm_material', 'm')
        .where('m.id IN (:...ids)', { ids: matIds })
        .getRawMany<{ id: string; code: string; name: string }>();
      mats.forEach((m) =>
        matMap.set(String(m.id), { code: m.code, name: m.name }),
      );
    }

    const items = wos.map((w) => ({
      ...w,
      materialCode: matMap.get(w.materialId)?.code,
      materialName: matMap.get(w.materialId)?.name,
    })) as (MesWorkOrder & { materialName?: string; materialCode?: string })[];

    return { items, total };
  }

  async findOne(
    id: string,
  ): Promise<MesWorkOrder & { operations: MesWorkOrderOperation[] }> {
    const tenantId = TenantContext.requireCurrentTenant();
    const wo = await this.woRepo.findOne({ where: { id, tenantId } });
    if (!wo) throw new NotFoundException('MES_WO_NOT_FOUND');

    const operations = await this.wooRepo.find({
      where: { woId: id, tenantId } as any,
      order: { sequence: 'ASC' },
    });
    return { ...wo, operations } as MesWorkOrder & {
      operations: MesWorkOrderOperation[];
    };
  }

  async create(data: Partial<MesWorkOrder>): Promise<MesWorkOrder> {
    const tenantId = TenantContext.requireCurrentTenant();
    data.tenantId = tenantId;
    data.status = 'RELEASED';

    if (!data.woNo) {
      const count = await this.woRepo.count({ where: { tenantId } });
      const now = new Date();
      data.woNo = `WO-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${String(count + 1).padStart(5, '0')}`;
    }

    return this.woRepo.save(this.woRepo.create(data));
  }

  async update(id: string, data: Partial<MesWorkOrder>): Promise<MesWorkOrder> {
    const tenantId = TenantContext.requireCurrentTenant();
    const wo = await this.woRepo.findOne({ where: { id, tenantId } });
    if (!wo) throw new NotFoundException('MES_WO_NOT_FOUND');
    if (wo.status === 'CLOSED')
      throw new BadRequestException('MES_WO_CLOSED_READONLY');

    delete (data as any).status;
    await this.woRepo.update(id, sanitizeUpdateData(data) as any);
    return { ...wo, ...data } as MesWorkOrder;
  }

  // ── 状态机 ────────────────────────────────────────────────────────────────

  async transition(id: string, newStatus: string): Promise<MesWorkOrder> {
    const tenantId = TenantContext.requireCurrentTenant();
    const wo = await this.woRepo.findOne({ where: { id, tenantId } });
    if (!wo) throw new NotFoundException('MES_WO_NOT_FOUND');

    const allowed = WO_TRANSITIONS[wo.status] ?? [];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `MES_WO_INVALID_TRANSITION:${wo.status}->${newStatus}`,
      );
    }

    const update: Partial<MesWorkOrder> = { status: newStatus };
    if (newStatus === 'IN_PROGRESS' && !wo.actualStart)
      update.actualStart = new Date();
    if (newStatus === 'COMPLETED' || newStatus === 'CLOSED')
      update.actualEnd = new Date();

    await this.woRepo.update(id, update as any);
    return { ...wo, ...update } as MesWorkOrder;
  }

  // ── 优先级调整 ────────────────────────────────────────────────────────────

  async adjustPriority(id: string, priority: number): Promise<MesWorkOrder> {
    const tenantId = TenantContext.requireCurrentTenant();
    if (priority < 1 || priority > 10)
      throw new BadRequestException('MES_WO_PRIORITY_RANGE');

    const wo = await this.woRepo.findOne({ where: { id, tenantId } });
    if (!wo) throw new NotFoundException('MES_WO_NOT_FOUND');

    await this.woRepo.update(id, { priority });
    return { ...wo, priority } as MesWorkOrder;
  }

  // ── 工单拆分 ──────────────────────────────────────────────────────────────

  /**
   * 将一个工单拆分为多个小批次工单
   * splitQtys: 每个子工单的数量，总和必须等于父工单计划数量
   */
  async split(
    parentId: string,
    splitQtys: number[],
    reason?: string,
    createdBy?: string,
  ): Promise<MesWorkOrder[]> {
    const tenantId = TenantContext.requireCurrentTenant();
    const parent = await this.woRepo.findOne({
      where: { id: parentId, tenantId },
    });
    if (!parent) throw new NotFoundException('MES_WO_NOT_FOUND');
    if (!['RELEASED'].includes(parent.status)) {
      throw new BadRequestException('MES_WO_SPLIT_ONLY_RELEASED');
    }

    const totalSplit = splitQtys.reduce((s, q) => s + q, 0);
    if (Math.abs(totalSplit - Number(parent.plannedQty)) > 0.0001) {
      throw new BadRequestException('MES_WO_SPLIT_QTY_MISMATCH');
    }

    // ── 事务保障：子工单创建 + 父工单关闭 原子执行，防止中途失败造成数量虚增 ──
    return this.dataSource.transaction(async (em) => {
      const children: MesWorkOrder[] = [];
      for (let i = 0; i < splitQtys.length; i++) {
        const child = await em.save(
          em.create(MesWorkOrder, {
            tenantId,
            woNo: `${parent.woNo}-${String(i + 1).padStart(2, '00')}`,
            woType: parent.woType,
            materialId: parent.materialId,
            bomId: parent.bomId,
            routingId: parent.routingId,
            plannedQty: splitQtys[i],
            uomId: parent.uomId,
            plannedStart: parent.plannedStart,
            plannedEnd: parent.plannedEnd,
            status: 'RELEASED',
            priority: parent.priority,
            workCenterId: parent.workCenterId,
            parentWoId: parent.id,
            createdBy,
          }),
        );
        children.push(child);

        await em.save(
          em.create(MesWorkOrderSplit, {
            tenantId,
            parentWoId: parent.id,
            childWoId: child.id,
            splitQty: splitQtys[i],
            splitReason: reason,
            createdBy,
          }),
        );
      }

      // 关闭父工单（与子工单创建在同一事务内，失败则全部回滚）
      await em.update(
        MesWorkOrder,
        { id: parentId, tenantId },
        { status: 'CLOSED' },
      );
      return children;
    });
  }

  // ── 工单合并 ──────────────────────────────────────────────────────────────

  /**
   * 将多个工单合并为一个
   * 所有源工单必须是同一物料、同一 BOM/工艺、RELEASED 状态
   */
  async merge(
    sourceIds: string[],
    reason?: string,
    createdBy?: string,
  ): Promise<MesWorkOrder> {
    const tenantId = TenantContext.requireCurrentTenant();
    if (sourceIds.length < 2)
      throw new BadRequestException('MES_WO_MERGE_MIN_2');

    // 前置校验（事务外提前检查，减少锁占用时间）
    const sources = await Promise.all(
      sourceIds.map((id) => this.woRepo.findOne({ where: { id, tenantId } })),
    );
    for (const wo of sources) {
      if (!wo) throw new NotFoundException('MES_WO_NOT_FOUND');
      if (wo.status !== 'RELEASED')
        throw new BadRequestException('MES_WO_MERGE_ONLY_RELEASED');
    }
    const first = sources[0]!;
    const allSameMaterial = sources.every(
      (w) => w!.materialId === first.materialId,
    );
    if (!allSameMaterial)
      throw new BadRequestException('MES_WO_MERGE_DIFFERENT_MATERIAL');

    const totalQty = sources.reduce((s, w) => s + Number(w!.plannedQty), 0);

    // ── 事务保障：合并工单创建 + 源工单批量关闭 原子执行 ──────────────────────
    return this.dataSource.transaction(async (em) => {
      const count = await em.count(MesWorkOrder, { where: { tenantId } });
      const merged = await em.save(
        em.create(MesWorkOrder, {
          tenantId,
          woNo: `WO-MERGE-${Date.now()}-${String(count + 1).padStart(4, '0')}`,
          woType: first.woType,
          materialId: first.materialId,
          bomId: first.bomId,
          routingId: first.routingId,
          plannedQty: totalQty,
          uomId: first.uomId,
          plannedStart: first.plannedStart,
          plannedEnd: first.plannedEnd,
          status: 'RELEASED',
          priority: Math.min(...sources.map((w) => w!.priority)),
          workCenterId: first.workCenterId,
          createdBy,
        }),
      );

      await em.save(
        em.create(MesWorkOrderMerge, {
          tenantId,
          targetWoId: merged.id,
          sourceWoIds: sourceIds,
          mergeReason: reason,
          createdBy,
        }),
      );

      // 批量关闭源工单（与合并工单创建在同一事务内，失败则全部回滚）
      await em
        .createQueryBuilder()
        .update(MesWorkOrder)
        .set({ status: 'CLOSED' })
        .where('id IN (:...ids) AND tenant_id = :tenantId', {
          ids: sourceIds,
          tenantId,
        })
        .execute();

      return merged;
    });
  }

  // ── 工序管理 ──────────────────────────────────────────────────────────────

  async createOperations(
    woId: string,
    ops: Partial<MesWorkOrderOperation>[],
  ): Promise<MesWorkOrderOperation[]> {
    const tenantId = TenantContext.requireCurrentTenant();
    const entities = ops.map((op) =>
      this.wooRepo.create({ ...op, woId, tenantId }),
    );
    return this.wooRepo.save(entities);
  }
}
