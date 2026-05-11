import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { PlmRouting } from '../entities/plm-routing.entity.js';
import { PlmRoutingOperation } from '../entities/plm-routing-operation.entity.js';
import { PlmMaterial } from '../entities/plm-material.entity.js';
import { TenantContext } from '../../../shared/tenant/tenant.context.js';
import {
  MESSAGE_SERVICE,
  MessageService,
} from '../../../shared/message/message.interface.js';
import { EventTypes } from '../../event/event-types.constant.js';
import { sanitizeUpdateData } from '../../../shared/utils/sanitize.js';

export interface EcnRoutingChange {
  action: 'ADD' | 'REMOVE' | 'MODIFY';
  operationCode?: string;
  sequence?: number;
  operationName?: string;
  workCenterId?: string;
  stdHours?: number;
  setupTime?: number;
  parameters?: Record<string, unknown>[];
}

export interface RoutingQuery {
  materialId?: string;
  operationCode?: string;
  workCenterId?: string;
  status?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class RoutingService {
  constructor(
    @InjectRepository(PlmRouting)
    private readonly routingRepo: Repository<PlmRouting>,
    @InjectRepository(PlmRoutingOperation)
    private readonly opRepo: Repository<PlmRoutingOperation>,
    @Inject(MESSAGE_SERVICE)
    private readonly messageSvc: MessageService,
  ) {}

  // ── 工艺路线 CRUD ─────────────────────────────────────────────────────────

  async findAll(query: RoutingQuery): Promise<{
    list: (PlmRouting & { materialCode?: string; materialName?: string })[];
    total: number;
  }> {
    const tenantId = TenantContext.requireCurrentTenant();
    const {
      materialId,
      operationCode,
      workCenterId,
      status,
      keyword,
      page = 1,
      pageSize = 20,
    } = query;

    const qb = this.routingRepo
      .createQueryBuilder('r')
      .where('r.tenant_id = :tenantId', { tenantId });

    if (materialId) qb.andWhere('r.material_id = :materialId', { materialId });
    if (status) qb.andWhere('r.status = :status', { status });
    if (keyword)
      qb.andWhere('(r.code LIKE :kw OR r.name LIKE :kw)', {
        kw: `%${keyword}%`,
      });

    if (operationCode || workCenterId) {
      qb.innerJoin('plm_routing_operation', 'op', 'op.routing_id = r.id');
      if (operationCode)
        qb.andWhere('op.operation_code = :opCode', { opCode: operationCode });
      if (workCenterId)
        qb.andWhere('op.work_center_id = :wcId', { wcId: workCenterId });
    }

    qb.orderBy('r.material_id', 'ASC').addOrderBy('r.version', 'DESC');

    const total = await qb.getCount();
    const routings = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();

    // 批量查物料名称
    const matIds = [
      ...new Set(
        routings.map((r) => r.materialId).filter((id): id is string => !!id),
      ),
    ];
    const matMap = new Map<string, { code: string; name: string }>();
    if (matIds.length > 0) {
      const mats = await this.routingRepo.manager
        .getRepository(PlmMaterial)
        .findBy({ id: In(matIds) });
      mats.forEach((m) => matMap.set(m.id, { code: m.code, name: m.name }));
    }

    const list = routings.map((r) => ({
      ...r,
      materialCode: matMap.get(r.materialId)?.code,
      materialName: matMap.get(r.materialId)?.name,
    }));
    return { list, total };
  }

  async findOne(
    id: string,
  ): Promise<PlmRouting & { operations: PlmRoutingOperation[] }> {
    const tenantId = TenantContext.requireCurrentTenant();
    const routing = await this.routingRepo.findOne({ where: { id, tenantId } });
    if (!routing) throw new NotFoundException('PLM_ROUTING_NOT_FOUND');

    const operations = await this.opRepo.find({
      where: { routingId: id, tenantId } as any,
      order: { sequence: 'ASC' },
    });
    return { ...routing, operations };
  }

  async create(
    data: Partial<PlmRouting>,
    operations: Partial<PlmRoutingOperation>[] = [],
  ): Promise<PlmRouting> {
    const tenantId = TenantContext.requireCurrentTenant();
    data.tenantId = tenantId;
    data.status = data.status ?? 'DRAFT';

    // 自动递增版本
    const latest = await this.routingRepo.findOne({
      where: { tenantId, materialId: data.materialId! },
      order: { version: 'DESC' },
    });
    data.version = (latest?.version ?? 0) + 1;

    const routing = await this.routingRepo.save(this.routingRepo.create(data));

    if (operations.length > 0) {
      const ops = operations.map((op) =>
        this.opRepo.create({ ...op, routingId: routing.id, tenantId }),
      );
      await this.opRepo.save(ops);
    }

    return routing;
  }

  async delete(id: string): Promise<void> {
    const tenantId = TenantContext.requireCurrentTenant();
    const routing = await this.routingRepo.findOne({ where: { id, tenantId } });
    if (!routing) throw new NotFoundException('PLM_ROUTING_NOT_FOUND');
    await this.opRepo.delete({ routingId: id } as any);
    await this.routingRepo.delete(id);
  }

  async update(id: string, data: Partial<PlmRouting>): Promise<PlmRouting> {
    const tenantId = TenantContext.requireCurrentTenant();
    const routing = await this.routingRepo.findOne({ where: { id, tenantId } });
    if (!routing) throw new NotFoundException('PLM_ROUTING_NOT_FOUND');
    if (routing.status === 'OBSOLETE')
      throw new BadRequestException('PLM_ROUTING_OBSOLETE_READONLY');

    await this.routingRepo.update(id, sanitizeUpdateData(data) as any);
    return { ...routing, ...data };
  }

  // ── 工序管理 ──────────────────────────────────────────────────────────────

  async addOperation(
    routingId: string,
    op: Partial<PlmRoutingOperation>,
  ): Promise<PlmRoutingOperation> {
    const tenantId = TenantContext.requireCurrentTenant();
    const routing = await this.routingRepo.findOne({
      where: { id: routingId, tenantId },
    });
    if (!routing) throw new NotFoundException('PLM_ROUTING_NOT_FOUND');

    return this.opRepo.save(this.opRepo.create({ ...op, routingId, tenantId }));
  }

  async updateOperation(
    opId: string,
    data: Partial<PlmRoutingOperation>,
  ): Promise<PlmRoutingOperation> {
    const tenantId = TenantContext.requireCurrentTenant();
    const op = await this.opRepo.findOne({
      where: { id: opId, tenantId } as any,
    });
    if (!op) throw new NotFoundException('PLM_OPERATION_NOT_FOUND');

    await this.opRepo.update(opId, sanitizeUpdateData(data) as any);
    return { ...op, ...data };
  }

  async removeOperation(opId: string): Promise<void> {
    const tenantId = TenantContext.requireCurrentTenant();
    const op = await this.opRepo.findOne({
      where: { id: opId, tenantId } as any,
    });
    if (!op) throw new NotFoundException('PLM_OPERATION_NOT_FOUND');
    await this.opRepo.delete(opId);
  }

  // ── 路线复制 ──────────────────────────────────────────────────────────────

  async copyRouting(
    sourceId: string,
    targetMaterialId?: string,
  ): Promise<PlmRouting> {
    const tenantId = TenantContext.requireCurrentTenant();
    const source = await this.routingRepo.findOne({
      where: { id: sourceId, tenantId },
    });
    if (!source) throw new NotFoundException('PLM_ROUTING_NOT_FOUND');

    const ops = await this.opRepo.find({
      where: { routingId: sourceId, tenantId } as any,
      order: { sequence: 'ASC' },
    });

    const newRouting = await this.create(
      {
        materialId: targetMaterialId ?? source.materialId,
        name: source.name ? `${source.name}（复制）` : undefined,
        status: 'DRAFT',
        bomVersion: source.bomVersion,
      },
      ops.map(({ id: _id, routingId: _rid, ...rest }) => rest),
    );

    return newRouting;
  }

  // ── 变更影响分析 ──────────────────────────────────────────────────────────

  /** 查找使用该工艺路线的在制工单（状态为 RELEASED 或 IN_PROGRESS） */
  async findAffectedWorkOrders(
    routingId: string,
  ): Promise<{ id: string; woNo: string; status: string }[]> {
    const tenantId = TenantContext.requireCurrentTenant();
    const rows = await this.routingRepo.manager.query(
      `SELECT id, wo_no, status
       FROM mes_work_order
       WHERE tenant_id = ? AND routing_id = ? AND status IN ('RELEASED','IN_PROGRESS')`,
      [tenantId, routingId],
    );
    return rows as { id: string; woNo: string; status: string }[];
  }

  // ── 版本管理 + 事件发布 ───────────────────────────────────────────────────

  /** 关联 BOM 版本并发布 ROUTING_REVISED 事件 */
  async linkBomVersion(
    routingId: string,
    bomVersion: number,
    ecnId?: string,
  ): Promise<PlmRouting> {
    const tenantId = TenantContext.requireCurrentTenant();
    const routing = await this.routingRepo.findOne({
      where: { id: routingId, tenantId },
    });
    if (!routing) throw new NotFoundException('PLM_ROUTING_NOT_FOUND');

    await this.routingRepo.update(routingId, { bomVersion, ecnId });
    const updated = { ...routing, bomVersion, ecnId };

    await this.messageSvc.publish({
      eventId: uuidv4(),
      eventType: EventTypes.ROUTING_REVISED,
      tenantId,
      sourceModule: 'PLM',
      targetModule: 'MES',
      payload: {
        routingId,
        materialId: routing.materialId,
        version: routing.version,
        bomVersion,
        ecnId,
      },
      createdAt: new Date(),
    });

    return updated;
  }

  /** 废止工艺路线：ACTIVE → OBSOLETE，有在制工单则拒绝 */
  async retire(routingId: string): Promise<PlmRouting> {
    const tenantId = TenantContext.requireCurrentTenant();
    const routing = await this.routingRepo.findOne({
      where: { id: routingId, tenantId },
    });
    if (!routing) throw new NotFoundException('PLM_ROUTING_NOT_FOUND');
    if (routing.status !== 'ACTIVE')
      throw new BadRequestException('PLM_ROUTING_INVALID_STATUS');

    const workOrders = await this.findAffectedWorkOrders(routingId);
    if (workOrders.length > 0) {
      throw new BadRequestException({
        message: 'PLM_ROUTING_HAS_ACTIVE_WORK_ORDERS',
        workOrders,
      });
    }

    await this.routingRepo.update(routingId, { status: 'OBSOLETE' });
    return { ...routing, status: 'OBSOLETE' };
  }

  /** 废止旧版本，激活新版本 */
  async activate(routingId: string): Promise<PlmRouting> {
    const tenantId = TenantContext.requireCurrentTenant();
    const routing = await this.routingRepo.findOne({
      where: { id: routingId, tenantId },
    });
    if (!routing) throw new NotFoundException('PLM_ROUTING_NOT_FOUND');

    await this.routingRepo
      .createQueryBuilder()
      .update(PlmRouting)
      .set({ status: 'OBSOLETE' })
      .where(
        'tenant_id = :tenantId AND material_id = :materialId AND status = :status AND id != :id',
        {
          tenantId,
          materialId: routing.materialId,
          status: 'ACTIVE',
          id: routingId,
        },
      )
      .execute();

    await this.routingRepo.update(routingId, { status: 'ACTIVE' });
    return { ...routing, status: 'ACTIVE' };
  }

  // ── ECN 变更应用 ──────────────────────────────────────────────────────────

  /**
   * 克隆当前 ACTIVE 工艺路线版本并应用 ECN 变更，事务内执行。
   * 成功：新版本 ACTIVE，旧版本 OBSOLETE。
   * 失败：回滚，原版本不变。
   */
  async cloneAndApply(
    tenantId: string,
    routingId: string,
    ecnChanges: EcnRoutingChange[],
    ecnNo?: string,
  ): Promise<PlmRouting> {
    return this.routingRepo.manager.transaction(async (em) => {
      const routingRepo = em.getRepository(PlmRouting);
      const opRepo = em.getRepository(PlmRoutingOperation);

      const source = await routingRepo.findOne({
        where: { id: routingId, tenantId },
      });
      if (!source) throw new NotFoundException('PLM_ROUTING_NOT_FOUND');
      if (source.status !== 'ACTIVE')
        throw new BadRequestException('PLM_ROUTING_NOT_ACTIVE');

      const newVersion = source.version + 1;
      const newRouting = routingRepo.create({
        tenantId,
        materialId: source.materialId,
        code: source.code,
        name: source.name,
        version: newVersion,
        status: 'DRAFT',
        bomVersion: source.bomVersion,
        ecnId: source.ecnId,
      });
      const savedRouting = await routingRepo.save(newRouting);

      // 克隆工序
      const sourceOps = await opRepo.find({
        where: { routingId, tenantId } as any,
        order: { sequence: 'ASC' },
      });
      let ops = sourceOps.map(({ id: _id, routingId: _rid, ...rest }) => ({
        ...rest,
        routingId: savedRouting.id,
        tenantId,
      }));

      // 应用变更
      for (const change of ecnChanges) {
        if (change.action === 'ADD') {
          ops.push({
            tenantId,
            routingId: savedRouting.id,
            sequence: change.sequence ?? (ops.length + 1) * 10,
            operationCode: change.operationCode ?? `OP-${Date.now()}`,
            operationName: change.operationName ?? '',
            workCenterId: change.workCenterId,
            stdHours: change.stdHours,
            setupTime: change.setupTime,
            parameters: change.parameters,
            remark: ecnNo ? `ECN: ${ecnNo}` : undefined,
          } as any);
        } else if (change.action === 'REMOVE') {
          ops = ops.filter((o) => o.operationCode !== change.operationCode);
        } else if (change.action === 'MODIFY') {
          ops = ops.map((o) => {
            if (o.operationCode !== change.operationCode) return o;
            return {
              ...o,
              operationName: change.operationName ?? o.operationName,
              workCenterId: change.workCenterId ?? o.workCenterId,
              stdHours: change.stdHours ?? o.stdHours,
              setupTime: change.setupTime ?? o.setupTime,
              parameters: change.parameters ?? o.parameters,
              remark: ecnNo ? `ECN: ${ecnNo}` : o.remark,
            };
          });
        }
      }

      if (ops.length > 0) {
        await opRepo.save(ops.map((o) => opRepo.create(o)));
      }

      // 新版本 ACTIVE，旧版本 OBSOLETE
      await routingRepo.update(savedRouting.id, { status: 'ACTIVE' } as any);
      await routingRepo.update(routingId, { status: 'OBSOLETE' } as any);

      return { ...savedRouting, status: 'ACTIVE', version: newVersion };
    });
  }
}
