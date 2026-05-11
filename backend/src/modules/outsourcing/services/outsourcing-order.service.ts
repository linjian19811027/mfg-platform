import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  OutsourcingOrder,
  OutsourcingOrderStatus,
} from '../entities/outsourcing-order.entity.js';
import { OutsourcingOperationLog } from '../entities/outsourcing-operation-log.entity.js';
import {
  OutsourcingIssue,
  OutsourcingIssueStatus,
} from '../entities/outsourcing-issue.entity.js';
import { TenantContext } from '../../../shared/tenant/tenant.context.js';

export interface CreateOutsourcingOrderDto {
  mesWoId?: string;
  supplierId: string;
  processName: string;
  materialId: string;
  plannedQty: number;
  unitPrice: number;
  taxRate?: number;
  currency?: string;
  issueWarehouseId: string;
  plannedDelivery: Date;
  remark?: string;
  createdBy: string;
}

export interface OutsourcingOrderQuery {
  status?: OutsourcingOrderStatus;
  supplierId?: string;
  processName?: string;
  deliveryFrom?: Date;
  deliveryTo?: Date;
  mesWoId?: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class OutsourcingOrderService {
  constructor(
    @InjectRepository(OutsourcingOrder)
    private readonly orderRepo: Repository<OutsourcingOrder>,
    @InjectRepository(OutsourcingOperationLog)
    private readonly logRepo: Repository<OutsourcingOperationLog>,
    @InjectRepository(OutsourcingIssue)
    private readonly issueRepo: Repository<OutsourcingIssue>,
    private readonly dataSource: DataSource,
  ) {}

  // ── 创建外协工单 ──────────────────────────────────────────────────────────

  async create(dto: CreateOutsourcingOrderDto): Promise<OutsourcingOrder> {
    const tenantId = TenantContext.requireCurrentTenant();

    // 校验供应商状态（只读跨模块查询）
    await this.validateSupplier(tenantId, dto.supplierId);

    // 校验关联 MES 工单
    if (dto.mesWoId) {
      await this.validateMesWorkOrder(tenantId, dto.mesWoId);
    }

    const order = await this.orderRepo.save(
      this.orderRepo.create({
        tenantId,
        mesWoId: dto.mesWoId,
        supplierId: dto.supplierId,
        processName: dto.processName,
        materialId: dto.materialId,
        plannedQty: dto.plannedQty,
        unitPrice: dto.unitPrice,
        taxRate: dto.taxRate ?? 0.13,
        currency: dto.currency ?? 'CNY',
        issueWarehouseId: dto.issueWarehouseId,
        plannedDelivery: dto.plannedDelivery,
        remark: dto.remark,
        createdBy: dto.createdBy,
        status: OutsourcingOrderStatus.DRAFT,
        issuedQty: 0,
        receivedQty: 0,
        inspectedQty: 0,
        settledQty: 0,
      }),
    );

    await this.writeLog(
      tenantId,
      order.id,
      'CREATE',
      undefined,
      OutsourcingOrderStatus.DRAFT,
      dto.createdBy,
    );
    return order;
  }

  // ── 确认工单（生成 OC 编号）────────────────────────────────────────────────

  async confirm(id: string, operatorId: string): Promise<OutsourcingOrder> {
    const tenantId = TenantContext.requireCurrentTenant();
    const order = await this.findOneOrFail(tenantId, id);

    if (order.status !== OutsourcingOrderStatus.DRAFT) {
      throw new BadRequestException(
        `仅 DRAFT 状态可确认，当前状态：${order.status}`,
      );
    }

    await this.validateSupplier(tenantId, order.supplierId);

    const ocNo = await this.generateOcNo(tenantId);
    const updated = await this.orderRepo.save({
      ...order,
      ocNo,
      status: OutsourcingOrderStatus.CONFIRMED,
    });

    await this.writeLog(
      tenantId,
      id,
      'CONFIRM',
      OutsourcingOrderStatus.DRAFT,
      OutsourcingOrderStatus.CONFIRMED,
      operatorId,
    );
    return updated;
  }

  // ── 取消工单 ──────────────────────────────────────────────────────────────

  async cancel(
    id: string,
    operatorId: string,
    remark?: string,
  ): Promise<OutsourcingOrder> {
    const tenantId = TenantContext.requireCurrentTenant();
    const order = await this.findOneOrFail(tenantId, id);

    const cancellableStatuses: OutsourcingOrderStatus[] = [
      OutsourcingOrderStatus.DRAFT,
      OutsourcingOrderStatus.CONFIRMED,
    ];
    if (!cancellableStatuses.includes(order.status)) {
      throw new BadRequestException(`当前状态 ${order.status} 不允许取消`);
    }

    // 校验无在途发料单
    const pendingIssues = await this.issueRepo.find({
      where: { tenantId, ocId: id, status: OutsourcingIssueStatus.PENDING },
    });
    if (pendingIssues.length > 0) {
      const ids = pendingIssues.map((i) => i.id).join(', ');
      throw new BadRequestException(`存在待确认发料单 [${ids}]，无法取消`);
    }

    const updated = await this.orderRepo.save({
      ...order,
      status: OutsourcingOrderStatus.CANCELLED,
    });

    await this.writeLog(
      tenantId,
      id,
      'CANCEL',
      order.status,
      OutsourcingOrderStatus.CANCELLED,
      operatorId,
      remark,
    );
    return updated;
  }

  // ── 分页查询 ──────────────────────────────────────────────────────────────

  async findAll(
    query: OutsourcingOrderQuery,
  ): Promise<{ items: any[]; total: number }> {
    const tenantId = TenantContext.requireCurrentTenant();
    const { page = 1, pageSize = 20 } = query;
    const limit = Math.min(pageSize, 100);

    const qb = this.orderRepo
      .createQueryBuilder('o')
      .where('o.tenant_id = :tenantId', { tenantId });

    if (query.status)
      qb.andWhere('o.status = :status', { status: query.status });
    if (query.supplierId)
      qb.andWhere('o.supplier_id = :sid', { sid: query.supplierId });
    if (query.processName)
      qb.andWhere('o.process_name LIKE :pn', { pn: `%${query.processName}%` });
    if (query.mesWoId)
      qb.andWhere('o.mes_wo_id = :woId', { woId: query.mesWoId });
    if (query.deliveryFrom)
      qb.andWhere('o.planned_delivery >= :from', { from: query.deliveryFrom });
    if (query.deliveryTo)
      qb.andWhere('o.planned_delivery <= :to', { to: query.deliveryTo });

    const [orders, total] = await qb
      .orderBy('o.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const now = new Date();
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
    const settledStatuses = [
      OutsourcingOrderStatus.SETTLED,
      OutsourcingOrderStatus.CLOSED,
      OutsourcingOrderStatus.CANCELLED,
    ];

    const items = orders.map((o) => {
      const delivery = new Date(o.plannedDelivery);
      const diffMs = delivery.getTime() - now.getTime();
      const isOverdue = !settledStatuses.includes(o.status) && diffMs < 0;
      const isDueSoon =
        !settledStatuses.includes(o.status) &&
        diffMs >= 0 &&
        diffMs <= threeDaysMs;
      const overdueDays = isOverdue
        ? Math.ceil(-diffMs / (24 * 60 * 60 * 1000))
        : 0;
      return { ...o, isOverdue, isDueSoon, overdueDays };
    });

    return { items, total };
  }

  // ── 详情 ──────────────────────────────────────────────────────────────────

  async findOne(id: string): Promise<OutsourcingOrder> {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.findOneOrFail(tenantId, id);
  }

  // ── 进度详情 ──────────────────────────────────────────────────────────────

  async getProgress(id: string): Promise<Record<string, unknown>> {
    const tenantId = TenantContext.requireCurrentTenant();
    const order = await this.findOneOrFail(tenantId, id);

    const planned = Number(order.plannedQty);
    const issued = Number(order.issuedQty);
    const received = Number(order.receivedQty);
    const inspected = Number(order.inspectedQty);
    const settled = Number(order.settledQty);

    const pct = (n: number, d: number) =>
      d > 0 ? Math.round((n / d) * 10000) / 100 : 0;

    return {
      ocId: id,
      ocNo: order.ocNo,
      status: order.status,
      plannedQty: planned,
      issuedQty: issued,
      receivedQty: received,
      inspectedQty: inspected,
      settledQty: settled,
      issuePct: pct(issued, planned),
      receivePct: pct(received, planned),
      inspectPct: pct(inspected, received),
      settlePct: pct(settled, inspected),
    };
  }

  // ── 内部：更新数量字段（供其他 service 调用）──────────────────────────────

  async incrementIssuedQty(
    tenantId: string,
    ocId: string,
    qty: number,
  ): Promise<void> {
    await this.orderRepo.increment({ id: ocId, tenantId }, 'issuedQty', qty);
    // 更新状态为 ISSUED
    const order = await this.orderRepo.findOne({
      where: { id: ocId, tenantId },
    });
    if (order && order.status === OutsourcingOrderStatus.CONFIRMED) {
      await this.orderRepo.update(
        { id: ocId, tenantId },
        { status: OutsourcingOrderStatus.ISSUED },
      );
    }
  }

  async incrementReceivedQty(
    tenantId: string,
    ocId: string,
    qty: number,
  ): Promise<void> {
    await this.orderRepo.increment({ id: ocId, tenantId }, 'receivedQty', qty);
    const order = await this.orderRepo.findOne({
      where: { id: ocId, tenantId },
    });
    if (!order) return;
    const newReceived = Number(order.receivedQty) + qty;
    const planned = Number(order.plannedQty);
    const newStatus =
      newReceived >= planned
        ? OutsourcingOrderStatus.RECEIVED
        : OutsourcingOrderStatus.PARTIAL_RECEIVED;
    await this.orderRepo.update({ id: ocId, tenantId }, { status: newStatus });
  }

  async incrementInspectedQty(
    tenantId: string,
    ocId: string,
    qty: number,
  ): Promise<void> {
    await this.orderRepo.increment({ id: ocId, tenantId }, 'inspectedQty', qty);
  }

  async incrementSettledQty(
    tenantId: string,
    ocId: string,
    qty: number,
  ): Promise<void> {
    await this.orderRepo.increment({ id: ocId, tenantId }, 'settledQty', qty);
    const order = await this.orderRepo.findOne({
      where: { id: ocId, tenantId },
    });
    if (!order) return;
    const newSettled = Number(order.settledQty) + qty;
    if (newSettled >= Number(order.inspectedQty)) {
      await this.orderRepo.update(
        { id: ocId, tenantId },
        { status: OutsourcingOrderStatus.SETTLED },
      );
    }
  }

  async setStatus(
    tenantId: string,
    ocId: string,
    status: OutsourcingOrderStatus,
  ): Promise<void> {
    await this.orderRepo.update({ id: ocId, tenantId }, { status });
  }

  async findOneByTenant(
    tenantId: string,
    id: string,
  ): Promise<OutsourcingOrder | null> {
    return this.orderRepo.findOne({ where: { id, tenantId } });
  }

  // ── 私有辅助 ──────────────────────────────────────────────────────────────

  private async findOneOrFail(
    tenantId: string,
    id: string,
  ): Promise<OutsourcingOrder> {
    const order = await this.orderRepo.findOne({ where: { id, tenantId } });
    if (!order) throw new NotFoundException(`外协工单 ${id} 不存在`);
    return order;
  }

  private async generateOcNo(tenantId: string): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `OC-${dateStr}-`;

    const result = await this.orderRepo
      .createQueryBuilder('o')
      .select('o.ocNo', 'ocNo')
      .where('o.tenantId = :tenantId', { tenantId })
      .andWhere('o.ocNo LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('o.ocNo', 'DESC')
      .limit(1)
      .getRawOne<{ ocNo: string }>();

    let seq = 1;
    if (result?.ocNo) {
      const lastSeq = parseInt(result.ocNo.slice(prefix.length), 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }
    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  private async validateSupplier(
    tenantId: string,
    supplierId: string,
  ): Promise<void> {
    const rows = await this.dataSource.query(
      `SELECT status FROM scm_supplier WHERE id = ? AND tenant_id = ? LIMIT 1`,
      [supplierId, tenantId],
    );
    if (!rows || rows.length === 0) {
      throw new BadRequestException(`供应商 ${supplierId} 不存在`);
    }
    if (rows[0].status !== 'ACTIVE') {
      throw new BadRequestException(
        `供应商状态异常（${rows[0].status}），无法创建外协工单`,
      );
    }
  }

  private async validateMesWorkOrder(
    tenantId: string,
    woId: string,
  ): Promise<void> {
    const rows = await this.dataSource.query(
      `SELECT status FROM mes_work_order WHERE id = ? AND tenant_id = ? LIMIT 1`,
      [woId, tenantId],
    );
    if (!rows || rows.length === 0) {
      throw new BadRequestException(`MES 工单 ${woId} 不存在`);
    }
    if (['CLOSED', 'CANCELLED'].includes(rows[0].status)) {
      throw new BadRequestException(
        `MES 工单状态为 ${rows[0].status}，无法关联`,
      );
    }
  }

  async writeLog(
    tenantId: string,
    ocId: string,
    action: string,
    fromStatus?: string,
    toStatus?: string,
    operatorId?: string,
    remark?: string,
    clientIp?: string,
  ): Promise<void> {
    await this.logRepo.save(
      this.logRepo.create({
        tenantId,
        ocId,
        action,
        fromStatus,
        toStatus,
        operatorId: operatorId ?? 'system',
        clientIp,
        remark,
      }),
    );
  }
}
