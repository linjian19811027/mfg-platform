import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import {
  ErpShipment,
  ShipmentStatus,
} from '../entities/erp-shipment.entity.js';
import {
  ErpReceivable,
  ReceivableStatus,
} from '../entities/erp-receivable.entity.js';
import { ErpSalesOrder } from '../entities/erp-sales-order.entity.js';
import { ErpCustomer } from '../entities/erp-customer.entity.js';
import {
  MessageService,
  MESSAGE_SERVICE,
} from '../../../shared/message/message.interface.js';
import { SalesOrderService } from './sales-order.service.js';

// ── DTOs ──────────────────────────────────────────────────────────────────────

export interface ShipmentItemDto {
  soLineId: string;
  materialId: string;
  quantity: number;
  uomId: string;
}

export interface CreateShipmentDto {
  soId: string;
  customerId: string;
  shipDate: Date;
  carrier?: string;
  trackingNo?: string;
  items: ShipmentItemDto[];
}

export interface LogisticsEvent {
  time: string;
  location: string;
  description: string;
}

export interface UpdateLogisticsDto {
  carrier?: string;
  trackingNo?: string;
  events?: LogisticsEvent[];
}

export interface ShipmentQuery {
  status?: ShipmentStatus;
  soId?: string;
  customerId?: string;
  page?: number;
  pageSize?: number;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class ShipmentService {
  constructor(
    @InjectRepository(ErpShipment)
    private readonly shipmentRepo: Repository<ErpShipment>,
    @InjectRepository(ErpReceivable)
    private readonly receivableRepo: Repository<ErpReceivable>,
    @InjectRepository(ErpSalesOrder)
    private readonly soRepo: Repository<ErpSalesOrder>,
    @InjectRepository(ErpCustomer)
    private readonly customerRepo: Repository<ErpCustomer>,
    private readonly dataSource: DataSource,
    @Inject(MESSAGE_SERVICE)
    private readonly messageService: MessageService,
    private readonly salesOrderService: SalesOrderService,
  ) {}

  // ── shipmentNo 生成 ───────────────────────────────────────────────────────

  private async generateShipmentNo(
    tenantId: string,
    em: EntityManager,
  ): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `SHP-${dateStr}-`;

    const result = await em
      .createQueryBuilder(ErpShipment, 's')
      .select('s.shipmentNo', 'shipmentNo')
      .where('s.tenantId = :tenantId', { tenantId })
      .andWhere('s.shipmentNo LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('s.shipmentNo', 'DESC')
      .limit(1)
      .getRawOne<{ shipmentNo: string }>();

    let seq = 1;
    if (result?.shipmentNo) {
      const lastSeq = parseInt(result.shipmentNo.slice(prefix.length), 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }

    return `${prefix}${String(seq).padStart(3, '0')}`;
  }

  // ── receivableNo 生成 ─────────────────────────────────────────────────────

  private async generateReceivableNo(
    tenantId: string,
    em: EntityManager,
  ): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `AR-${dateStr}-`;

    const result = await em
      .createQueryBuilder(ErpReceivable, 'r')
      .select('r.receivableNo', 'receivableNo')
      .where('r.tenantId = :tenantId', { tenantId })
      .andWhere('r.receivableNo LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('r.receivableNo', 'DESC')
      .limit(1)
      .getRawOne<{ receivableNo: string }>();

    let seq = 1;
    if (result?.receivableNo) {
      const lastSeq = parseInt(result.receivableNo.slice(prefix.length), 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }

    return `${prefix}${String(seq).padStart(3, '0')}`;
  }

  // ── 1. create ─────────────────────────────────────────────────────────────

  async create(
    tenantId: string,
    data: CreateShipmentDto,
  ): Promise<ErpShipment> {
    return this.dataSource.transaction(async (em) => {
      const shipmentNo = await this.generateShipmentNo(tenantId, em);

      const shipment = em.create(ErpShipment, {
        tenantId,
        shipmentNo,
        soId: data.soId,
        customerId: data.customerId,
        shipDate: data.shipDate,
        carrier: data.carrier,
        trackingNo: data.trackingNo,
        status: ShipmentStatus.PENDING,
        items: data.items,
      });

      return em.save(ErpShipment, shipment);
    });
  }

  // ── 2. ship ───────────────────────────────────────────────────────────────

  async ship(tenantId: string, id: string): Promise<ErpShipment> {
    return this.dataSource.transaction(async (em) => {
      const shipment = await em.findOne(ErpShipment, {
        where: { id, tenantId },
      });
      if (!shipment) throw new NotFoundException(`发货单 ${id} 不存在`);
      if (shipment.status !== ShipmentStatus.PENDING) {
        throw new BadRequestException(
          `仅 PENDING 状态可确认发货，当前状态：${shipment.status}`,
        );
      }

      // 更新每个 item 的发货数量
      const items = shipment.items ?? [];
      for (const item of items) {
        await this.salesOrderService.updateShippedQty(
          tenantId,
          shipment.soId,
          item.soLineId as string,
          item.quantity as number,
        );
      }

      // 更新状态
      shipment.status = ShipmentStatus.SHIPPED;
      const saved = await em.save(ErpShipment, shipment);

      // 发布 SALES_ORDER_SHIPPED 事件
      await this.messageService.publish({
        eventId: uuidv4(),
        eventType: 'SALES_ORDER_SHIPPED',
        tenantId,
        sourceModule: 'ERP',
        targetModule: 'WMS',
        payload: {
          shipmentId: saved.id,
          shipmentNo: saved.shipmentNo,
          soId: saved.soId,
          customerId: saved.customerId,
          items,
          tenantId,
        },
        createdAt: new Date(),
      });

      // 自动生成应收账款
      const so = await em.findOne(ErpSalesOrder, {
        where: { id: shipment.soId, tenantId },
      });

      const customer = so
        ? await em.findOne(ErpCustomer, {
            where: { id: so.customerId, tenantId },
          })
        : null;

      const paymentTerms = customer?.paymentTerms ?? 30;
      const dueDate = new Date(shipment.shipDate);
      dueDate.setDate(dueDate.getDate() + paymentTerms);

      const receivableNo = await this.generateReceivableNo(tenantId, em);

      const receivable = em.create(ErpReceivable, {
        tenantId,
        receivableNo,
        customerId: shipment.customerId,
        soId: shipment.soId,
        shipmentId: saved.id,
        amount: so?.totalAmount ?? 0,
        paidAmount: 0,
        dueDate,
        status: ReceivableStatus.PENDING,
        currency: so?.currency ?? 'CNY',
      });

      await em.save(ErpReceivable, receivable);

      return saved;
    });
  }

  // ── 3. updateLogistics ────────────────────────────────────────────────────

  async updateLogistics(
    tenantId: string,
    id: string,
    logisticsInfo: UpdateLogisticsDto,
  ): Promise<ErpShipment> {
    const shipment = await this.shipmentRepo.findOne({
      where: { id, tenantId },
    });
    if (!shipment) throw new NotFoundException(`发货单 ${id} 不存在`);

    // 合并物流信息
    const existing = shipment.logisticsInfo ?? {};
    const mergedEvents = [
      ...((existing['events'] as LogisticsEvent[]) ?? []),
      ...(logisticsInfo.events ?? []),
    ];

    shipment.logisticsInfo = {
      ...existing,
      ...(logisticsInfo.events !== undefined ? { events: mergedEvents } : {}),
    };

    if (logisticsInfo.carrier !== undefined) {
      shipment.carrier = logisticsInfo.carrier;
      shipment.logisticsInfo['carrier'] = logisticsInfo.carrier;
    }
    if (logisticsInfo.trackingNo !== undefined) {
      shipment.trackingNo = logisticsInfo.trackingNo;
      shipment.logisticsInfo['trackingNo'] = logisticsInfo.trackingNo;
    }

    return this.shipmentRepo.save(shipment);
  }

  // ── 4. confirmDelivery ────────────────────────────────────────────────────

  async confirmDelivery(tenantId: string, id: string): Promise<ErpShipment> {
    const shipment = await this.shipmentRepo.findOne({
      where: { id, tenantId },
    });
    if (!shipment) throw new NotFoundException(`发货单 ${id} 不存在`);

    if (
      shipment.status !== ShipmentStatus.SHIPPED &&
      shipment.status !== ShipmentStatus.DELIVERED
    ) {
      throw new BadRequestException(
        `仅 SHIPPED/DELIVERED 状态可签收，当前状态：${shipment.status}`,
      );
    }

    shipment.status = ShipmentStatus.SIGNED;
    return this.shipmentRepo.save(shipment);
  }

  // ── 5. findAll ────────────────────────────────────────────────────────────

  async findAll(
    tenantId: string,
    query: ShipmentQuery = {},
  ): Promise<{ items: ErpShipment[]; total: number }> {
    const { status, soId, customerId, page = 1, pageSize = 20 } = query;

    const qb = this.shipmentRepo
      .createQueryBuilder('s')
      .where('s.tenantId = :tenantId', { tenantId });

    if (status) qb.andWhere('s.status = :status', { status });
    if (soId) qb.andWhere('s.soId = :soId', { soId });
    if (customerId) qb.andWhere('s.customerId = :customerId', { customerId });

    qb.orderBy('s.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  // ── 6. findOne ────────────────────────────────────────────────────────────

  async findOne(tenantId: string, id: string): Promise<ErpShipment> {
    const shipment = await this.shipmentRepo.findOne({
      where: { id, tenantId },
    });
    if (!shipment) throw new NotFoundException(`发货单 ${id} 不存在`);
    return shipment;
  }
}
