import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { MesWorkOrderOperation } from '../entities/mes-work-order-operation.entity.js';
import { MesWorkOrder } from '../entities/mes-work-order.entity.js';
import { MesWip } from '../entities/mes-wip.entity.js';
import { TenantContext } from '../../../shared/tenant/tenant.context.js';
import {
  MESSAGE_SERVICE,
  MessageService,
} from '../../../shared/message/message.interface.js';
import { EventTypes } from '../../event/event-types.constant.js';

export interface OperationQuery {
  woId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export interface StartCheckResult {
  passed: boolean;
  checks: {
    operator: boolean;
    equipment: boolean;
    material: boolean;
    routing: boolean;
  };
  failReasons: string[];
}

export interface CompleteRequest {
  completedQty: number;
  scrapQty?: number;
  actualHours?: number;
  outputBatchId?: string;
}

@Injectable()
export class OperationService {
  constructor(
    @InjectRepository(MesWorkOrderOperation)
    private readonly wooRepo: Repository<MesWorkOrderOperation>,
    @InjectRepository(MesWorkOrder)
    private readonly woRepo: Repository<MesWorkOrder>,
    @InjectRepository(MesWip)
    private readonly wipRepo: Repository<MesWip>,
    @Inject(MESSAGE_SERVICE)
    private readonly messageSvc: MessageService,
    private readonly dataSource: DataSource,
  ) {}

  // ── 工序列表查询 ──────────────────────────────────────────────────────────

  async findAll(query: OperationQuery): Promise<{
    items: (MesWorkOrderOperation & {
      woNo?: string;
      materialName?: string;
      materialCode?: string;
    })[];
    total: number;
  }> {
    const tenantId = TenantContext.requireCurrentTenant();
    const { woId, status, page = 1, pageSize = 20 } = query;

    const qb = this.wooRepo
      .createQueryBuilder('op')
      .where('op.tenant_id = :tenantId', { tenantId });

    if (woId) qb.andWhere('op.wo_id = :woId', { woId });
    if (status) qb.andWhere('op.status = :status', { status });

    const [ops, total] = await qb
      .orderBy('op.wo_id', 'ASC')
      .addOrderBy('op.sequence', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    // 批量查工单（QueryBuilder 替代原生 SQL）
    const woIds = [...new Set(ops.map((o) => o.woId))];
    const woMap = new Map<string, { woNo: string; materialId: string }>();
    if (woIds.length > 0) {
      const wos = await this.wooRepo.manager
        .createQueryBuilder()
        .select([
          'w.id AS id',
          'w.wo_no AS wo_no',
          'w.material_id AS material_id',
        ])
        .from('mes_work_order', 'w')
        .where('w.id IN (:...ids)', { ids: woIds })
        .getRawMany<{ id: string; wo_no: string; material_id: string }>();
      wos.forEach((w) =>
        woMap.set(String(w.id), {
          woNo: w.wo_no,
          materialId: String(w.material_id),
        }),
      );
    }

    // 批量查物料名称（QueryBuilder 替代原生 SQL）
    const matIds = [
      ...new Set([...woMap.values()].map((w) => w.materialId).filter(Boolean)),
    ];
    const matMap = new Map<string, { code: string; name: string }>();
    if (matIds.length > 0) {
      const mats = await this.wooRepo.manager
        .createQueryBuilder()
        .select(['m.id AS id', 'm.code AS code', 'm.name AS name'])
        .from('plm_material', 'm')
        .where('m.id IN (:...ids)', { ids: matIds })
        .getRawMany<{ id: string; code: string; name: string }>();
      mats.forEach((m) =>
        matMap.set(String(m.id), { code: m.code, name: m.name }),
      );
    }

    const items = ops.map((op) => {
      const wo = woMap.get(op.woId);
      const mat = wo ? matMap.get(wo.materialId) : undefined;
      return {
        ...op,
        woNo: wo?.woNo,
        materialCode: mat?.code,
        materialName: mat?.name,
      };
    });

    return { items, total };
  }

  // ── 2.11 开工确认（四项前置检查） ─────────────────────────────────────────

  async startCheck(
    wooId: string,
    params: {
      operatorId?: string;
      equipmentId?: string;
      materialConfirmed?: boolean;
      routingConfirmed?: boolean;
    },
  ): Promise<StartCheckResult> {
    const tenantId = TenantContext.requireCurrentTenant();
    const woo = await this.wooRepo.findOne({
      where: { id: wooId, tenantId } as any,
    });
    if (!woo) throw new NotFoundException('MES_WOO_NOT_FOUND');
    if (woo.status !== 'PENDING')
      throw new BadRequestException('MES_WOO_NOT_PENDING');

    const checks = {
      operator: !!params.operatorId,
      equipment: !!params.equipmentId || !woo.workCenterId, // 无工作中心要求则跳过
      material: params.materialConfirmed === true,
      routing: params.routingConfirmed === true,
    };

    const failReasons: string[] = [];
    if (!checks.operator) failReasons.push('MES_CHECK_OPERATOR_REQUIRED');
    if (!checks.equipment) failReasons.push('MES_CHECK_EQUIPMENT_REQUIRED');
    if (!checks.material) failReasons.push('MES_CHECK_MATERIAL_NOT_CONFIRMED');
    if (!checks.routing) failReasons.push('MES_CHECK_ROUTING_NOT_CONFIRMED');

    const passed = failReasons.length === 0;

    if (passed) {
      await this.wooRepo.update(wooId, {
        status: 'IN_PROGRESS',
        actualStart: new Date(),
        equipmentId: params.equipmentId,
      });

      // 创建/更新在制品记录
      const wo = await this.woRepo.findOne({
        where: { id: woo.woId, tenantId },
      });
      if (wo) {
        const existing = await this.wipRepo.findOne({
          where: { woId: wo.id, wooId, tenantId } as any,
        });
        if (!existing) {
          await this.wipRepo.save(
            this.wipRepo.create({
              tenantId,
              woId: wo.id,
              wooId,
              materialId: wo.materialId,
              uomId: wo.uomId,
              quantity: wo.plannedQty,
              status: 'IN_PROCESS',
            }),
          );
        }
      }
    }

    return { passed, checks, failReasons };
  }

  async start(
    wooId: string,
    params: {
      operatorId?: string;
      equipmentId?: string;
      materialConfirmed?: boolean;
      routingConfirmed?: boolean;
    },
  ): Promise<MesWorkOrderOperation> {
    const result = await this.startCheck(wooId, params);
    if (!result.passed) {
      throw new BadRequestException(
        `MES_START_CHECK_FAILED:${result.failReasons.join(',')}`,
      );
    }
    const tenantId = TenantContext.requireCurrentTenant();
    const woo = await this.wooRepo.findOne({
      where: { id: wooId, tenantId } as any,
    });
    return woo!;
  }

  // ── 2.12 完工扫码 ─────────────────────────────────────────────────────────

  async complete(
    wooId: string,
    req: CompleteRequest,
  ): Promise<MesWorkOrderOperation> {
    const tenantId = TenantContext.requireCurrentTenant();
    const woo = await this.wooRepo.findOne({
      where: { id: wooId, tenantId } as any,
    });
    if (!woo) throw new NotFoundException('MES_WOO_NOT_FOUND');
    if (woo.status !== 'IN_PROGRESS')
      throw new BadRequestException('MES_WOO_NOT_IN_PROGRESS');

    const newCompleted = Number(woo.completedQty) + req.completedQty;
    const newScrap = Number(woo.scrapQty) + (req.scrapQty ?? 0);
    const actualHours =
      req.actualHours ??
      (woo.actualStart
        ? (Date.now() - woo.actualStart.getTime()) / 3600000
        : 0);

    // ── 事务保障：工序状态、WIP数量、下道工序激活 全部原子执行 ──
    return this.dataSource.transaction(async (em) => {
      await em.update(
        MesWorkOrderOperation,
        { id: wooId },
        {
          completedQty: newCompleted,
          scrapQty: newScrap,
          actualHours,
          status: 'COMPLETED',
          actualEnd: new Date(),
        },
      );

      // 更新在制品数量（与工序状态在同一事务内）
      await em.update(MesWip, { woId: woo.woId, wooId, tenantId } as any, {
        quantity: Math.max(0, Number(woo.plannedQty ?? 0) - newCompleted),
      });

      // 自动流转下道工序（在同一事务内激活，不用担心部分未激活）
      await this.autoAdvance(woo.woId, woo.sequence, tenantId, em);

      return {
        ...woo,
        completedQty: newCompleted,
        scrapQty: newScrap,
        status: 'COMPLETED',
      };
    });
  }

  // ── 2.13 工序自动流转 ─────────────────────────────────────────────────────

  private async autoAdvance(
    woId: string,
    currentSeq: number,
    tenantId: string,
    em?: EntityManager,
  ): Promise<void> {
    const repo = em ? em.getRepository(MesWorkOrderOperation) : this.wooRepo;
    const wipRepo = em ? em.getRepository(MesWip) : this.wipRepo;

    // 找下一道工序（序号最小且大于当前）
    const nextOps = await repo
      .createQueryBuilder('op')
      .where(
        'op.wo_id = :woId AND op.tenant_id = :tenantId AND op.sequence > :seq AND op.status = :status',
        { woId, tenantId, seq: currentSeq, status: 'PENDING' },
      )
      .orderBy('op.sequence', 'ASC')
      .getMany();

    if (nextOps.length === 0) return;

    // 激活并行工序（isParallel=1 的同序号工序一起激活）
    const nextSeq = nextOps[0].sequence;
    const toActivate = nextOps.filter(
      (op: MesWorkOrderOperation) =>
        op.sequence === nextSeq || op.isParallel === 1,
    );

    for (const op of toActivate) {
      await repo.update(op.id, {
        status: 'IN_PROGRESS',
        actualStart: new Date(),
      });

      // 更新在制品位置
      await wipRepo.update({ woId, tenantId } as any, {
        wooId: op.id,
        status: 'IN_PROCESS',
      });
    }
  }

  // ── 2.16 异常报工 ─────────────────────────────────────────────────────────

  async reportException(
    wooId: string,
    params: {
      exceptionType: string;
      reason: string;
      equipmentId?: string;
    },
  ): Promise<void> {
    const tenantId = TenantContext.requireCurrentTenant();
    const woo = await this.wooRepo.findOne({
      where: { id: wooId, tenantId } as any,
    });
    if (!woo) throw new NotFoundException('MES_WOO_NOT_FOUND');

    if (params.exceptionType === 'MACHINE_DOWN') {
      await this.messageSvc.publish({
        eventId: uuidv4(),
        eventType: EventTypes.EQUIPMENT_FAILURE_REPORTED,
        tenantId,
        sourceModule: 'MES',
        payload: {
          wooId,
          woId: woo.woId,
          equipmentId: params.equipmentId ?? woo.equipmentId,
          reason: params.reason,
        },
        createdAt: new Date(),
      });
    }
  }

  // ── 2.15 工时采集 ─────────────────────────────────────────────────────────

  async calcDirectHours(wooId: string): Promise<number> {
    const tenantId = TenantContext.requireCurrentTenant();
    const woo = await this.wooRepo.findOne({
      where: { id: wooId, tenantId } as any,
    });
    if (!woo || !woo.actualStart || !woo.actualEnd) return 0;
    return (woo.actualEnd.getTime() - woo.actualStart.getTime()) / 3600000;
  }
}
