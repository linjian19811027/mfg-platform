import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager, DataSource } from 'typeorm';
import {
  ScmPurchaseOrder,
  PoStatus,
} from '../entities/scm-purchase-order.entity.js';
import {
  ScmPurchaseOrderLine,
  PoLineStatus,
} from '../entities/scm-purchase-order-line.entity.js';
import {
  ScmPriceAgreement,
  AgreementStatus,
  PriceType,
} from '../entities/scm-price-agreement.entity.js';
import { ScmReceipt, ReceiptStatus } from '../entities/scm-receipt.entity.js';
import { ScmAsn } from '../entities/scm-asn.entity.js';

// ── DTOs / Query types ────────────────────────────────────────────────────────

export interface CreatePoLineDto {
  lineNo: number;
  materialId: string;
  quantity: number;
  uomId: string;
  unitPrice: number;
  expectedDate?: Date;
}

export interface CreatePoDto {
  supplierId: string;
  prId?: string;
  orderDate: Date;
  expectedDate?: Date;
  currency?: string;
  createdBy?: string;
}

export interface PurchaseOrderQuery {
  status?: PoStatus;
  supplierId?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
}

export interface ChangeOrderLineDto {
  lineId: string;
  quantity?: number;
  expectedDate?: Date;
}

export interface TieredPrice {
  minQty: number;
  maxQty?: number;
  price: number;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class PurchaseOrderService {
  constructor(
    @InjectRepository(ScmPurchaseOrder)
    private readonly poRepo: Repository<ScmPurchaseOrder>,
    @InjectRepository(ScmPurchaseOrderLine)
    private readonly lineRepo: Repository<ScmPurchaseOrderLine>,
    @InjectRepository(ScmPriceAgreement)
    private readonly paRepo: Repository<ScmPriceAgreement>,
    @InjectRepository(ScmReceipt)
    private readonly receiptRepo: Repository<ScmReceipt>,
    @InjectRepository(ScmAsn)
    private readonly asnRepo: Repository<ScmAsn>,
    private readonly dataSource: DataSource,
  ) {}

  // ── poNo 生成 ───────────────────────────────────────────────────────────────

  private async generatePoNo(
    tenantId: string,
    em: EntityManager,
  ): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
    const prefix = `PO-${dateStr}-`;

    const result = await em
      .createQueryBuilder(ScmPurchaseOrder, 'po')
      .select('po.poNo', 'poNo')
      .where('po.tenantId = :tenantId', { tenantId })
      .andWhere('po.poNo LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('po.poNo', 'DESC')
      .limit(1)
      .getRawOne<{ poNo: string }>();

    let seq = 1;
    if (result?.poNo) {
      const lastSeq = parseInt(result.poNo.slice(prefix.length), 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }

    return `${prefix}${String(seq).padStart(3, '0')}`;
  }

  // ── 1. create ───────────────────────────────────────────────────────────────

  async create(
    tenantId: string,
    data: CreatePoDto,
    lines: CreatePoLineDto[],
  ): Promise<ScmPurchaseOrder> {
    return this.dataSource.transaction(async (em) => {
      const poNo = await this.generatePoNo(tenantId, em);

      // 计算 totalAmount
      const totalAmount = lines.reduce((sum, l) => {
        const amount = Number(l.quantity) * Number(l.unitPrice);
        return sum + amount;
      }, 0);

      const po = em.create(ScmPurchaseOrder, {
        tenantId,
        poNo,
        supplierId: data.supplierId,
        prId: data.prId,
        orderDate: data.orderDate,
        expectedDate: data.expectedDate,
        currency: data.currency ?? 'CNY',
        status: PoStatus.DRAFT,
        version: 1,
        totalAmount,
        createdBy: data.createdBy,
        changeLog: [],
      });

      const savedPo = await em.save(ScmPurchaseOrder, po);

      // 创建明细
      for (const l of lines) {
        const amount = Number(l.quantity) * Number(l.unitPrice);
        const line = em.create(ScmPurchaseOrderLine, {
          tenantId,
          poId: savedPo.id,
          lineNo: l.lineNo,
          materialId: l.materialId,
          quantity: l.quantity,
          receivedQty: 0,
          uomId: l.uomId,
          unitPrice: l.unitPrice,
          amount,
          expectedDate: l.expectedDate,
          status: PoLineStatus.OPEN,
        });
        await em.save(ScmPurchaseOrderLine, line);
      }

      return savedPo;
    });
  }

  // ── 2. findAll ──────────────────────────────────────────────────────────────

  async findAll(
    tenantId: string,
    query: PurchaseOrderQuery = {},
  ): Promise<{
    items: (ScmPurchaseOrder & { supplierName?: string })[];
    total: number;
  }> {
    const { status, supplierId, keyword, page = 1, pageSize = 20 } = query;

    const qb = this.poRepo
      .createQueryBuilder('po')
      .where('po.tenantId = :tenantId', { tenantId });

    if (status) qb.andWhere('po.status = :status', { status });
    if (supplierId) qb.andWhere('po.supplierId = :supplierId', { supplierId });
    if (keyword) qb.andWhere('po.poNo LIKE :kw', { kw: `%${keyword}%` });

    qb.orderBy('po.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [pos, total] = await qb.getManyAndCount();

    // 批量查供应商名称（QueryBuilder 替代原生 SQL）
    const supplierIds = [
      ...new Set(pos.map((p) => p.supplierId).filter(Boolean)),
    ];
    const supMap = new Map<string, string>();
    if (supplierIds.length > 0) {
      const sups = await this.poRepo.manager
        .createQueryBuilder()
        .select(['s.id AS id', 's.name AS name'])
        .from('scm_supplier', 's')
        .where('s.id IN (:...ids)', { ids: supplierIds })
        .getRawMany<{ id: string; name: string }>();
      sups.forEach((s) => supMap.set(String(s.id), s.name));
    }

    const items = pos.map((p) => ({
      ...p,
      supplierName: supMap.get(p.supplierId),
    }));
    return { items, total };
  }

  // ── 3. findOne ──────────────────────────────────────────────────────────────

  async findOne(
    tenantId: string,
    id: string,
  ): Promise<ScmPurchaseOrder & { lines: ScmPurchaseOrderLine[] }> {
    const po = await this.poRepo.findOne({ where: { id, tenantId } });
    if (!po) throw new NotFoundException(`采购订单 ${id} 不存在`);

    const lines = await this.lineRepo.find({
      where: { poId: id, tenantId },
      order: { lineNo: 'ASC' },
    });

    return Object.assign(po, { lines });
  }

  // ── 4. confirm ──────────────────────────────────────────────────────────────

  async confirm(tenantId: string, id: string): Promise<ScmPurchaseOrder> {
    const po = await this.poRepo.findOne({ where: { id, tenantId } });
    if (!po) throw new NotFoundException(`采购订单 ${id} 不存在`);
    if (po.status !== PoStatus.DRAFT) {
      throw new BadRequestException(
        `仅 DRAFT 状态可确认，当前状态：${po.status}`,
      );
    }
    po.status = PoStatus.CONFIRMED;
    return this.poRepo.save(po);
  }

  // ── 5. changeOrder ──────────────────────────────────────────────────────────

  async changeOrder(
    tenantId: string,
    id: string,
    changes: ChangeOrderLineDto[],
    changedBy: string,
    reason: string,
  ): Promise<ScmPurchaseOrder> {
    return this.dataSource.transaction(async (em) => {
      const po = await em.findOne(ScmPurchaseOrder, {
        where: { id, tenantId },
      });
      if (!po) throw new NotFoundException(`采购订单 ${id} 不存在`);

      if (po.status !== PoStatus.CONFIRMED && po.status !== PoStatus.PARTIAL) {
        throw new BadRequestException(
          `仅 CONFIRMED/PARTIAL 状态可变更，当前状态：${po.status}`,
        );
      }

      const lines = await em.find(ScmPurchaseOrderLine, {
        where: { poId: id, tenantId },
      });

      // 快照变更前数据
      const snapshot = {
        lines: lines.map((l) => ({
          id: l.id,
          lineNo: l.lineNo,
          quantity: l.quantity,
          expectedDate: l.expectedDate,
          amount: l.amount,
        })),
        expectedDate: po.expectedDate,
      };

      const changeEntry = {
        version: po.version,
        changedBy,
        reason,
        snapshot,
        timestamp: new Date().toISOString(),
      };

      // 应用变更
      for (const change of changes) {
        const line = lines.find((l) => l.id === change.lineId);
        if (!line) continue;

        if (change.quantity !== undefined) {
          line.quantity = change.quantity;
          line.amount = Number(change.quantity) * Number(line.unitPrice);
        }
        if (change.expectedDate !== undefined) {
          line.expectedDate = change.expectedDate;
        }
        await em.save(ScmPurchaseOrderLine, line);
      }

      // 重新计算 totalAmount
      const updatedLines = await em.find(ScmPurchaseOrderLine, {
        where: { poId: id, tenantId },
      });
      const totalAmount = updatedLines.reduce(
        (sum, l) => sum + Number(l.amount),
        0,
      );

      po.version = po.version + 1;
      po.totalAmount = totalAmount;
      po.changeLog = [...(po.changeLog ?? []), changeEntry];

      return em.save(ScmPurchaseOrder, po);
    });
  }

  // ── 6. matchPrice ───────────────────────────────────────────────────────────

  async matchPrice(
    tenantId: string,
    supplierId: string,
    materialId: string,
    quantity: number,
  ): Promise<number | null> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const agreement = await this.paRepo
      .createQueryBuilder('pa')
      .where('pa.tenantId = :tenantId', { tenantId })
      .andWhere('pa.supplierId = :supplierId', { supplierId })
      .andWhere('pa.materialId = :materialId', { materialId })
      .andWhere('pa.status = :status', { status: AgreementStatus.ACTIVE })
      .andWhere('pa.validFrom <= :today', { today })
      .andWhere('pa.validTo >= :today', { today })
      .orderBy('pa.id', 'DESC')
      .getOne();

    if (!agreement) return null;

    if (agreement.priceType === PriceType.FIXED) {
      return agreement.unitPrice ?? null;
    }

    // TIERED 阶梯价匹配
    if (agreement.priceType === PriceType.TIERED && agreement.tieredPrices) {
      const tiers = agreement.tieredPrices as TieredPrice[];
      // 按 minQty 降序，找到第一个 quantity >= minQty 的阶梯
      const sorted = [...tiers].sort((a, b) => b.minQty - a.minQty);
      for (const tier of sorted) {
        if (quantity >= tier.minQty) {
          if (tier.maxQty === undefined || quantity <= tier.maxQty) {
            return tier.price;
          }
        }
      }
      // 如果没有精确匹配，取最低阶梯
      const lowest = tiers.reduce((min, t) =>
        t.minQty < min.minQty ? t : min,
      );
      return lowest.price;
    }

    return null;
  }

  // ── 7. updateReceivedQty ────────────────────────────────────────────────────

  async updateReceivedQty(
    tenantId: string,
    poId: string,
    lineId: string,
    receivedQty: number,
  ): Promise<ScmPurchaseOrder> {
    return this.dataSource.transaction(async (em) => {
      const po = await em.findOne(ScmPurchaseOrder, {
        where: { id: poId, tenantId },
      });
      if (!po) throw new NotFoundException(`采购订单 ${poId} 不存在`);

      const line = await em.findOne(ScmPurchaseOrderLine, {
        where: { id: lineId, poId, tenantId },
      });
      if (!line) throw new NotFoundException(`采购订单明细 ${lineId} 不存在`);

      // 累加收货数量
      line.receivedQty = Number(line.receivedQty) + Number(receivedQty);

      // 更新明细状态
      if (Number(line.receivedQty) >= Number(line.quantity)) {
        line.status = PoLineStatus.CLOSED;
      } else {
        line.status = PoLineStatus.PARTIAL;
      }
      await em.save(ScmPurchaseOrderLine, line);

      // 重新查询所有明细，更新 PO 状态
      const allLines = await em.find(ScmPurchaseOrderLine, {
        where: { poId, tenantId },
      });

      const allClosed = allLines.every((l) => l.status === PoLineStatus.CLOSED);
      const anyPartial = allLines.some(
        (l) =>
          l.status === PoLineStatus.PARTIAL ||
          (l.status === PoLineStatus.CLOSED && Number(l.receivedQty) > 0),
      );

      if (allClosed) {
        po.status = PoStatus.RECEIVED;
      } else if (anyPartial) {
        po.status = PoStatus.PARTIAL;
      }

      return em.save(ScmPurchaseOrder, po);
    });
  }

  // ── 8. getTracking ──────────────────────────────────────────────────────────

  async getTracking(
    tenantId: string,
    id: string,
  ): Promise<{
    po: ScmPurchaseOrder;
    lines: ScmPurchaseOrderLine[];
    trackingEvents: Array<{
      eventType: string;
      eventTime: Date;
      description: string;
      data?: any;
    }>;
    asns: ScmAsn[];
    receipts: ScmReceipt[];
    summary: {
      totalQty: number;
      receivedQty: number;
      pendingQty: number;
      receiptRate: number;
    };
  }> {
    const po = await this.poRepo.findOne({ where: { id, tenantId } });
    if (!po) throw new NotFoundException(`采购订单 ${id} 不存在`);

    const lines = await this.lineRepo.find({
      where: { poId: id, tenantId },
      order: { lineNo: 'ASC' },
    });

    const asns = await this.asnRepo.find({
      where: { poId: id, tenantId },
      order: { createdAt: 'ASC' },
    });

    const receipts = await this.receiptRepo.find({
      where: { poId: id, tenantId },
      order: { receiptDate: 'ASC' },
    });

    // 构建跟踪事件
    const trackingEvents: Array<{
      eventType: string;
      eventTime: Date;
      description: string;
      data?: any;
    }> = [];

    // ORDER_CREATED
    trackingEvents.push({
      eventType: 'ORDER_CREATED',
      eventTime: po.createdAt,
      description: `采购订单 ${po.poNo} 已创建`,
      data: { poNo: po.poNo, supplierId: po.supplierId },
    });

    // ORDER_CONFIRMED：非 DRAFT 状态时推断确认时间
    if (po.status !== PoStatus.DRAFT) {
      // 尝试从 changeLog 中找最早的变更记录时间，否则用 updatedAt
      let confirmedAt: Date = po.updatedAt;
      if (po.changeLog && po.changeLog.length > 0) {
        const firstChange = po.changeLog[0];
        if (firstChange?.timestamp) {
          confirmedAt = new Date(firstChange.timestamp as string);
        }
      }
      trackingEvents.push({
        eventType: 'ORDER_CONFIRMED',
        eventTime: confirmedAt,
        description: `采购订单 ${po.poNo} 已确认`,
        data: { status: po.status },
      });
    }

    // ASN_RECEIVED：每条 ASN 记录生成一个事件
    for (const asn of asns) {
      trackingEvents.push({
        eventType: 'ASN_RECEIVED',
        eventTime: asn.createdAt,
        description: `收到到货通知 ${asn.asnNo}`,
        data: { asnId: asn.id, asnNo: asn.asnNo, status: asn.status },
      });
    }

    // GOODS_ARRIVED + INSPECTION_PASSED：每条收货记录
    for (const receipt of receipts) {
      trackingEvents.push({
        eventType: 'GOODS_ARRIVED',
        eventTime: receipt.receiptDate,
        description: `货物到达，收货单 ${receipt.receiptNo}`,
        data: { receiptId: receipt.id, receiptNo: receipt.receiptNo },
      });

      if (receipt.status === ReceiptStatus.ACCEPTED) {
        trackingEvents.push({
          eventType: 'INSPECTION_PASSED',
          eventTime: receipt.updatedAt,
          description: `收货单 ${receipt.receiptNo} 检验通过`,
          data: { receiptId: receipt.id, receiptNo: receipt.receiptNo },
        });
      }
    }

    // 按时间排序
    trackingEvents.sort(
      (a, b) => a.eventTime.getTime() - b.eventTime.getTime(),
    );

    // 计算 summary
    const totalQty = lines.reduce((sum, l) => sum + Number(l.quantity), 0);
    const receivedQty = lines.reduce(
      (sum, l) => sum + Number(l.receivedQty),
      0,
    );
    const pendingQty = totalQty - receivedQty;
    const receiptRate = totalQty === 0 ? 0 : receivedQty / totalQty;

    return {
      po,
      lines,
      trackingEvents,
      asns,
      receipts,
      summary: { totalQty, receivedQty, pendingQty, receiptRate },
    };
  }
}
