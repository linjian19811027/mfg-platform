import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager, DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import {
  ErpSalesOrder,
  SalesOrderStatus,
} from '../entities/erp-sales-order.entity.js';
import {
  ErpSalesOrderLine,
  SalesOrderLineStatus,
} from '../entities/erp-sales-order-line.entity.js';
import {
  ErpShipment,
  ShipmentStatus,
} from '../entities/erp-shipment.entity.js';
import {
  MessageService,
  MESSAGE_SERVICE,
} from '../../../shared/message/message.interface.js';

// ── DTOs ──────────────────────────────────────────────────────────────────────

export interface CreateSalesOrderLineDto {
  lineNo: number;
  materialId: string;
  quantity: number;
  uomId: string;
  unitPrice: number;
  amount: number;
  deliveryDate?: Date;
}

export interface CreateSalesOrderDto {
  customerId: string;
  quotationId?: string;
  orderDate: Date;
  deliveryDate?: Date;
  currency?: string;
  taxAmount?: number;
  createdBy?: string;
}

export interface SalesOrderQuery {
  status?: SalesOrderStatus;
  customerId?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
}

export interface ChangeOrderLineDto {
  lineId: string;
  quantity?: number;
  unitPrice?: number;
  deliveryDate?: Date;
}

export interface ChangeOrderDto {
  deliveryDate?: Date;
  lines: ChangeOrderLineDto[];
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class SalesOrderService {
  constructor(
    @InjectRepository(ErpSalesOrder)
    private readonly soRepo: Repository<ErpSalesOrder>,
    @InjectRepository(ErpSalesOrderLine)
    private readonly lineRepo: Repository<ErpSalesOrderLine>,
    @InjectRepository(ErpShipment)
    private readonly shipmentRepo: Repository<ErpShipment>,
    private readonly dataSource: DataSource,
    @Inject(MESSAGE_SERVICE)
    private readonly messageService: MessageService,
  ) {}

  // ── soNo 生成 ─────────────────────────────────────────────────────────────

  private async generateSoNo(
    tenantId: string,
    em: EntityManager,
  ): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
    const prefix = `SO-${dateStr}-`;

    const result = await em
      .createQueryBuilder(ErpSalesOrder, 'so')
      .select('so.soNo', 'soNo')
      .where('so.tenantId = :tenantId', { tenantId })
      .andWhere('so.soNo LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('so.soNo', 'DESC')
      .limit(1)
      .getRawOne<{ soNo: string }>();

    let seq = 1;
    if (result?.soNo) {
      const lastSeq = parseInt(result.soNo.slice(prefix.length), 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }

    return `${prefix}${String(seq).padStart(3, '0')}`;
  }

  // ── 1. create ─────────────────────────────────────────────────────────────

  async create(
    tenantId: string,
    data: CreateSalesOrderDto,
    lines: CreateSalesOrderLineDto[],
  ): Promise<ErpSalesOrder> {
    return this.dataSource.transaction(async (em) => {
      const soNo = await this.generateSoNo(tenantId, em);

      const totalAmount = lines.reduce((sum, l) => sum + Number(l.amount), 0);

      const so = em.create(ErpSalesOrder, {
        tenantId,
        soNo,
        customerId: data.customerId,
        quotationId: data.quotationId,
        orderDate: data.orderDate,
        deliveryDate: data.deliveryDate,
        status: SalesOrderStatus.DRAFT,
        totalAmount,
        taxAmount: data.taxAmount ?? 0,
        currency: data.currency ?? 'CNY',
        version: 1,
        changeLog: [],
        createdBy: data.createdBy,
      });

      const savedSo = await em.save(ErpSalesOrder, so);

      for (const l of lines) {
        const line = em.create(ErpSalesOrderLine, {
          tenantId,
          soId: savedSo.id,
          lineNo: l.lineNo,
          materialId: l.materialId,
          quantity: l.quantity,
          shippedQty: 0,
          uomId: l.uomId,
          unitPrice: l.unitPrice,
          amount: l.amount,
          deliveryDate: l.deliveryDate,
          status: SalesOrderLineStatus.OPEN,
        });
        await em.save(ErpSalesOrderLine, line);
      }

      return savedSo;
    });
  }

  // ── 2. findAll ────────────────────────────────────────────────────────────

  async findAll(
    tenantId: string,
    query: SalesOrderQuery = {},
  ): Promise<{
    items: (ErpSalesOrder & { customerName?: string })[];
    total: number;
  }> {
    const { status, customerId, keyword, page = 1, pageSize = 20 } = query;

    const qb = this.soRepo
      .createQueryBuilder('so')
      .where('so.tenantId = :tenantId', { tenantId });

    if (status) qb.andWhere('so.status = :status', { status });
    if (customerId) qb.andWhere('so.customerId = :customerId', { customerId });
    if (keyword) qb.andWhere('so.soNo LIKE :kw', { kw: `%${keyword}%` });

    qb.orderBy('so.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [sos, total] = await qb.getManyAndCount();

    // 批量查客户名称（使用 TypeORM 替代原生 SQL，避免跨模块硬编码表名）
    const customerIds = [
      ...new Set(sos.map((s) => s.customerId).filter(Boolean)),
    ];
    const custMap = new Map<string, string>();
    if (customerIds.length > 0) {
      const custs = await this.soRepo.manager
        .createQueryBuilder()
        .select(['c.id AS id', 'c.name AS name'])
        .from('erp_customer', 'c')
        .where('c.id IN (:...ids)', { ids: customerIds })
        .getRawMany<{ id: string; name: string }>();
      custs.forEach((c) => custMap.set(String(c.id), c.name));
    }

    const items = sos.map((s) => ({
      ...s,
      customerName: custMap.get(s.customerId),
    }));
    return { items, total };
  }

  // ── 3. findOne ────────────────────────────────────────────────────────────

  async findOne(
    tenantId: string,
    id: string,
  ): Promise<ErpSalesOrder & { lines: ErpSalesOrderLine[] }> {
    const so = await this.soRepo.findOne({ where: { id, tenantId } });
    if (!so) throw new NotFoundException(`销售订单 ${id} 不存在`);

    const lines = await this.lineRepo.find({
      where: { soId: id, tenantId },
      order: { lineNo: 'ASC' },
    });

    return Object.assign(so, { lines });
  }

  // ── 4. confirm ────────────────────────────────────────────────────────────

  async confirm(tenantId: string, id: string): Promise<ErpSalesOrder> {
    const so = await this.soRepo.findOne({ where: { id, tenantId } });
    if (!so) throw new NotFoundException(`销售订单 ${id} 不存在`);
    if (so.status !== SalesOrderStatus.DRAFT) {
      throw new BadRequestException(
        `仅 DRAFT 状态可确认，当前状态：${so.status}`,
      );
    }

    so.status = SalesOrderStatus.CONFIRMED;
    const saved = await this.soRepo.save(so);

    // 查询明细，构造事件 payload
    const lines = await this.lineRepo.find({
      where: { soId: id, tenantId },
      order: { lineNo: 'ASC' },
    });

    await this.messageService.publish({
      eventId: uuidv4(),
      eventType: 'SALES_ORDER_CONFIRMED',
      tenantId,
      sourceModule: 'ERP',
      targetModule: 'APS',
      payload: {
        soId: saved.id,
        soNo: saved.soNo,
        customerId: saved.customerId,
        totalAmount: saved.totalAmount,
        currency: saved.currency,
        deliveryDate: saved.deliveryDate,
        lines: lines.map((l) => ({
          materialId: l.materialId,
          quantity: l.quantity,
          uomId: l.uomId,
        })),
        tenantId,
      },
      createdAt: new Date(),
    });

    return saved;
  }

  // ── 5. startProduction ────────────────────────────────────────────────────

  async startProduction(tenantId: string, id: string): Promise<ErpSalesOrder> {
    const so = await this.soRepo.findOne({ where: { id, tenantId } });
    if (!so) throw new NotFoundException(`销售订单 ${id} 不存在`);
    if (so.status !== SalesOrderStatus.CONFIRMED) {
      throw new BadRequestException(
        `仅 CONFIRMED 状态可开始生产，当前状态：${so.status}`,
      );
    }

    so.status = SalesOrderStatus.IN_PRODUCTION;
    return this.soRepo.save(so);
  }

  // ── 6. changeOrder ────────────────────────────────────────────────────────

  async changeOrder(
    tenantId: string,
    id: string,
    changes: ChangeOrderDto,
    changedBy: string,
    reason: string,
  ): Promise<ErpSalesOrder> {
    return this.dataSource.transaction(async (em) => {
      const so = await em.findOne(ErpSalesOrder, { where: { id, tenantId } });
      if (!so) throw new NotFoundException(`销售订单 ${id} 不存在`);

      if (
        so.status !== SalesOrderStatus.CONFIRMED &&
        so.status !== SalesOrderStatus.IN_PRODUCTION
      ) {
        throw new BadRequestException(
          `仅 CONFIRMED/IN_PRODUCTION 状态可变更，当前状态：${so.status}`,
        );
      }

      const lines = await em.find(ErpSalesOrderLine, {
        where: { soId: id, tenantId },
      });

      // 快照变更前数据
      const snapshot = {
        deliveryDate: so.deliveryDate,
        lines: lines.map((l) => ({
          id: l.id,
          lineNo: l.lineNo,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          amount: l.amount,
          deliveryDate: l.deliveryDate,
        })),
      };

      const changeEntry = {
        version: so.version,
        changedBy,
        reason,
        snapshot,
        timestamp: new Date().toISOString(),
      };

      // 应用 SO 级变更
      if (changes.deliveryDate !== undefined) {
        so.deliveryDate = changes.deliveryDate;
      }

      // 应用明细变更
      for (const change of changes.lines) {
        const line = lines.find((l) => l.id === change.lineId);
        if (!line) continue;

        if (change.quantity !== undefined) {
          line.quantity = change.quantity;
          line.amount = Number(change.quantity) * Number(line.unitPrice);
        }
        if (change.unitPrice !== undefined) {
          line.unitPrice = change.unitPrice;
          line.amount = Number(line.quantity) * Number(change.unitPrice);
        }
        if (change.deliveryDate !== undefined) {
          line.deliveryDate = change.deliveryDate;
        }
        await em.save(ErpSalesOrderLine, line);
      }

      // 重新计算 totalAmount
      const updatedLines = await em.find(ErpSalesOrderLine, {
        where: { soId: id, tenantId },
      });
      so.totalAmount = updatedLines.reduce(
        (sum, l) => sum + Number(l.amount),
        0,
      );

      so.version = so.version + 1;
      so.changeLog = [...(so.changeLog ?? []), changeEntry];

      return em.save(ErpSalesOrder, so);
    });
  }

  // ── 6. updateStatus ──────────────────────────────────────────────────────

  async updateStatus(
    tenantId: string,
    id: string,
    status: SalesOrderStatus,
  ): Promise<ErpSalesOrder> {
    const so = await this.soRepo.findOne({ where: { id, tenantId } });
    if (!so) throw new NotFoundException(`销售订单 ${id} 不存在`);
    so.status = status;
    return this.soRepo.save(so);
  }

  // ── 7. ship ───────────────────────────────────────────────────────────────

  async ship(tenantId: string, id: string): Promise<ErpSalesOrder> {
    const so = await this.soRepo.findOne({ where: { id, tenantId } });
    if (!so) throw new NotFoundException(`销售订单 ${id} 不存在`);
    if (
      so.status !== SalesOrderStatus.CONFIRMED &&
      so.status !== SalesOrderStatus.IN_PRODUCTION
    ) {
      throw new BadRequestException(
        `仅 CONFIRMED/IN_PRODUCTION 状态可发货，当前状态：${so.status}`,
      );
    }
    so.status = SalesOrderStatus.SHIPPED;
    return this.soRepo.save(so);
  }

  // ── 8. close ──────────────────────────────────────────────────────────────

  async close(tenantId: string, id: string): Promise<ErpSalesOrder> {
    const so = await this.soRepo.findOne({ where: { id, tenantId } });
    if (!so) throw new NotFoundException(`销售订单 ${id} 不存在`);
    if (so.status !== SalesOrderStatus.SHIPPED) {
      throw new BadRequestException(
        `仅 SHIPPED 状态可关闭，当前状态：${so.status}`,
      );
    }
    so.status = SalesOrderStatus.CLOSED;
    return this.soRepo.save(so);
  }

  // ── 9. updateShippedQty ───────────────────────────────────────────────────

  async updateShippedQty(
    tenantId: string,
    soId: string,
    lineId: string,
    shippedQty: number,
  ): Promise<ErpSalesOrder> {
    return this.dataSource.transaction(async (em) => {
      const so = await em.findOne(ErpSalesOrder, {
        where: { id: soId, tenantId },
      });
      if (!so) throw new NotFoundException(`销售订单 ${soId} 不存在`);

      const line = await em.findOne(ErpSalesOrderLine, {
        where: { id: lineId, soId, tenantId },
      });
      if (!line) throw new NotFoundException(`销售订单明细 ${lineId} 不存在`);

      // 累加发货数量
      line.shippedQty = Number(line.shippedQty) + Number(shippedQty);

      // 更新明细状态
      if (Number(line.shippedQty) >= Number(line.quantity)) {
        line.status = SalesOrderLineStatus.CLOSED;
      } else {
        line.status = SalesOrderLineStatus.PARTIAL;
      }
      await em.save(ErpSalesOrderLine, line);

      // 重新查询所有明细，更新 SO 状态
      const allLines = await em.find(ErpSalesOrderLine, {
        where: { soId, tenantId },
      });

      const allClosed = allLines.every(
        (l) => l.status === SalesOrderLineStatus.CLOSED,
      );

      if (allClosed) {
        so.status = SalesOrderStatus.SHIPPED;
      }
      // 有 PARTIAL 时保持 IN_PRODUCTION（不变）

      return em.save(ErpSalesOrder, so);
    });
  }

  // ── 10. getProgress ───────────────────────────────────────────────────────

  async getProgress(
    tenantId: string,
    id: string,
  ): Promise<{
    so: ErpSalesOrder;
    lines: ErpSalesOrderLine[];
    shipments: ErpShipment[];
    trackingEvents: Array<{
      eventType: string;
      eventTime: Date;
      description: string;
      data?: any;
    }>;
    progress: {
      totalQty: number;
      shippedQty: number;
      pendingQty: number;
      shipRate: number;
      isOnTime: boolean | null;
    };
  }> {
    const so = await this.soRepo.findOne({ where: { id, tenantId } });
    if (!so) throw new NotFoundException(`销售订单 ${id} 不存在`);

    const lines = await this.lineRepo.find({
      where: { soId: id, tenantId },
      order: { lineNo: 'ASC' },
    });

    const shipments = await this.shipmentRepo.find({
      where: { soId: id, tenantId },
      order: { shipDate: 'ASC' },
    });

    // ── trackingEvents 生成 ───────────────────────────────────────────────

    const trackingEvents: Array<{
      eventType: string;
      eventTime: Date;
      description: string;
      data?: any;
    }> = [];

    // 1. ORDER_CREATED
    trackingEvents.push({
      eventType: 'ORDER_CREATED',
      eventTime: so.createdAt,
      description: '销售订单已创建',
      data: { soNo: so.soNo },
    });

    // 2. ORDER_CONFIRMED：非 DRAFT 状态时，用 updatedAt 推断
    if (so.status !== SalesOrderStatus.DRAFT) {
      trackingEvents.push({
        eventType: 'ORDER_CONFIRMED',
        eventTime: so.updatedAt,
        description: '销售订单已确认',
      });
    }

    // 3. IN_PRODUCTION：状态为 IN_PRODUCTION / SHIPPED / CLOSED 时
    const inProductionStatuses: SalesOrderStatus[] = [
      SalesOrderStatus.IN_PRODUCTION,
      SalesOrderStatus.SHIPPED,
      SalesOrderStatus.CLOSED,
    ];
    if (inProductionStatuses.includes(so.status)) {
      trackingEvents.push({
        eventType: 'IN_PRODUCTION',
        eventTime: so.updatedAt,
        description: '订单已进入生产阶段',
      });
    }

    // 4. SHIPPED：每条 ErpShipment 生成一个事件（按 shipDate）
    for (const s of shipments) {
      trackingEvents.push({
        eventType: 'SHIPPED',
        eventTime: new Date(s.shipDate),
        description: `已发货，发货单号：${s.shipmentNo}`,
        data: {
          shipmentId: s.id,
          shipmentNo: s.shipmentNo,
          carrier: s.carrier,
          trackingNo: s.trackingNo,
        },
      });
    }

    // 5. DELIVERED：status=DELIVERED 或 SIGNED 的发货记录
    const deliveredShipments = shipments.filter(
      (s) =>
        s.status === ShipmentStatus.DELIVERED ||
        s.status === ShipmentStatus.SIGNED,
    );
    for (const s of deliveredShipments) {
      trackingEvents.push({
        eventType: 'DELIVERED',
        eventTime: s.updatedAt,
        description: `货物已签收，发货单号：${s.shipmentNo}`,
        data: { shipmentId: s.id, shipmentNo: s.shipmentNo },
      });
    }

    // ── progress 计算 ─────────────────────────────────────────────────────

    const totalQty = lines.reduce((sum, l) => sum + Number(l.quantity), 0);
    const shippedQty = lines.reduce((sum, l) => sum + Number(l.shippedQty), 0);
    const pendingQty = totalQty - shippedQty;
    const shipRate = totalQty === 0 ? 0 : shippedQty / totalQty;

    // isOnTime：deliveryDate 存在且已发货时，比较最后发货日期 vs deliveryDate
    let isOnTime: boolean | null = null;
    if (so.deliveryDate && shipments.length > 0) {
      const lastShipDate = shipments.reduce((latest, s) =>
        new Date(s.shipDate) > new Date(latest.shipDate) ? s : latest,
      ).shipDate;
      isOnTime = new Date(lastShipDate) <= new Date(so.deliveryDate);
    }

    return {
      so,
      lines,
      shipments,
      trackingEvents,
      progress: { totalQty, shippedQty, pendingQty, shipRate, isOnTime },
    };
  }

  /**
   * 作废销售订单（仅 DRAFT 状态可操作）
   * 原数据库 FK CASCADE DELETE 已移除，此处在事务内手动级联删除明细行，
   * 确保订单头与明细行的数据完整性不依赖数据库外键。
   */
  async void(tenantId: string, id: string): Promise<void> {
    const so = await this.soRepo.findOne({ where: { id, tenantId } });
    if (!so) throw new NotFoundException(`销售订单 ${id} 不存在`);
    if (so.status !== SalesOrderStatus.DRAFT) {
      throw new BadRequestException(
        `只有 DRAFT 状态的销售订单可以作废，当前状态：${so.status}`,
      );
    }

    await this.dataSource.transaction(async (em) => {
      // 1. 先删除所有明细行（逻辑级联，替代数据库外键 CASCADE DELETE）
      await em.delete(ErpSalesOrderLine, { soId: id, tenantId });
      // 2. 再删除订单头
      await em.delete(ErpSalesOrder, { id, tenantId });
    });
  }
}
