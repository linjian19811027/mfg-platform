import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { ScmSupplier, SupplierType } from '../entities/scm-supplier.entity.js';
import { ScmSupplierQualification } from '../entities/scm-supplier-qualification.entity.js';
import {
  ScmPurchaseOrder,
  PoStatus,
} from '../entities/scm-purchase-order.entity.js';
import { ScmReceipt, ReceiptStatus } from '../entities/scm-receipt.entity.js';
import { ScmPriceRecord } from '../entities/scm-price-record.entity.js';

export interface SupplierQuery {
  type?: SupplierType;
  status?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
  // 扩展筛选字段
  region?: string;
  hasExpiredQualification?: boolean;
  minScore?: number;
  maxScore?: number;
  sortBy?: 'performanceScore' | 'createdAt' | 'name';
  sortOrder?: 'ASC' | 'DESC';
}

@Injectable()
export class SupplierService {
  constructor(
    @InjectRepository(ScmSupplier)
    private readonly supplierRepo: Repository<ScmSupplier>,
    @InjectRepository(ScmSupplierQualification)
    private readonly qualificationRepo: Repository<ScmSupplierQualification>,
    @InjectRepository(ScmPurchaseOrder)
    private readonly poRepo: Repository<ScmPurchaseOrder>,
    @InjectRepository(ScmReceipt)
    private readonly receiptRepo: Repository<ScmReceipt>,
    @InjectRepository(ScmPriceRecord)
    private readonly priceRecordRepo: Repository<ScmPriceRecord>,
  ) {}

  // ── CRUD ─────────────────────────────────────────────────────────────────

  async create(
    tenantId: string,
    data: Partial<ScmSupplier>,
  ): Promise<ScmSupplier> {
    const supplier = this.supplierRepo.create({ ...data, tenantId });
    return this.supplierRepo.save(supplier);
  }

  async findAll(
    tenantId: string,
    query: SupplierQuery = {},
  ): Promise<{ items: ScmSupplier[]; total: number }> {
    const {
      type,
      status,
      keyword,
      page = 1,
      pageSize = 20,
      region,
      hasExpiredQualification,
      minScore,
      maxScore,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = query;

    const qb = this.supplierRepo
      .createQueryBuilder('s')
      .where('s.tenantId = :tenantId', { tenantId });

    if (type) qb.andWhere('s.type = :type', { type });
    if (status) qb.andWhere('s.status = :status', { status });
    if (keyword) {
      qb.andWhere('(s.code LIKE :kw OR s.name LIKE :kw)', {
        kw: `%${keyword}%`,
      });
    }

    // 地区模糊匹配（JSON_EXTRACT）
    if (region) {
      qb.andWhere("JSON_EXTRACT(s.attributes, '$.region') LIKE :region", {
        region: `%${region}%`,
      });
    }

    // 绩效评分区间
    if (minScore !== undefined && maxScore !== undefined) {
      qb.andWhere('s.performanceScore BETWEEN :minScore AND :maxScore', {
        minScore,
        maxScore,
      });
    } else if (minScore !== undefined) {
      qb.andWhere('s.performanceScore >= :minScore', { minScore });
    } else if (maxScore !== undefined) {
      qb.andWhere('s.performanceScore <= :maxScore', { maxScore });
    }

    // 是否有过期资质（子查询）
    if (hasExpiredQualification === true) {
      qb.andWhere(
        `EXISTS (
          SELECT 1 FROM scm_supplier_qualification q
          WHERE q.supplier_id = s.id
            AND q.tenant_id = :tenantId
            AND q.expire_date < NOW()
        )`,
        { tenantId },
      );
    } else if (hasExpiredQualification === false) {
      qb.andWhere(
        `NOT EXISTS (
          SELECT 1 FROM scm_supplier_qualification q
          WHERE q.supplier_id = s.id
            AND q.tenant_id = :tenantId
            AND q.expire_date < NOW()
        )`,
        { tenantId },
      );
    }

    // 动态排序
    const sortColumn =
      sortBy === 'name'
        ? 's.name'
        : sortBy === 'performanceScore'
          ? 's.performanceScore'
          : 's.createdAt';
    qb.orderBy(sortColumn, sortOrder)
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  // ── 绩效排名 ──────────────────────────────────────────────────────────────

  /**
   * 返回绩效评分最高的前 N 个供应商，含排名序号
   */
  async getPerformanceRanking(
    tenantId: string,
    limit = 20,
  ): Promise<Array<{ rank: number; supplier: ScmSupplier }>> {
    const suppliers = await this.supplierRepo
      .createQueryBuilder('s')
      .where('s.tenantId = :tenantId', { tenantId })
      .andWhere('s.performanceScore IS NOT NULL')
      .orderBy('s.performanceScore', 'DESC')
      .take(limit)
      .getMany();

    return suppliers.map((supplier, index) => ({
      rank: index + 1,
      supplier,
    }));
  }

  async findOne(tenantId: string, id: string): Promise<ScmSupplier> {
    const supplier = await this.supplierRepo.findOne({
      where: { id, tenantId },
    });
    if (!supplier) {
      throw new NotFoundException(`供应商 ${id} 不存在`);
    }
    return supplier;
  }

  async update(
    tenantId: string,
    id: string,
    data: Partial<ScmSupplier>,
  ): Promise<ScmSupplier> {
    const supplier = await this.findOne(tenantId, id);
    Object.assign(supplier, data);
    return this.supplierRepo.save(supplier);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const supplier = await this.findOne(tenantId, id);
    await this.supplierRepo.remove(supplier);
  }

  // ── 供应商分类管理 ────────────────────────────────────────────────────────

  async updateType(
    tenantId: string,
    id: string,
    type: SupplierType,
  ): Promise<ScmSupplier> {
    return this.update(tenantId, id, { type });
  }

  // ── 资质证书效期预警 ──────────────────────────────────────────────────────

  /**
   * 查询 expire_date 在未来 daysAhead 天内的证书
   */
  async getExpiringQualifications(
    tenantId: string,
    daysAhead = 30,
  ): Promise<ScmSupplierQualification[]> {
    const now = new Date();
    const future = new Date();
    future.setDate(future.getDate() + daysAhead);

    return this.qualificationRepo.find({
      where: {
        tenantId,
        status: 'ACTIVE',
        expireDate: Between(now, future),
      },
      order: { expireDate: 'ASC' },
    });
  }

  // ── 绩效评分计算 ──────────────────────────────────────────────────────────

  /**
   * 计算供应商综合绩效评分（0-100）
   *
   * 维度权重：
   *   交期达成率  40%
   *   质量合格率  30%
   *   价格竞争力  20%
   *   服务响应    10%（固定 0.8）
   */
  async calculatePerformanceScore(supplierId: string): Promise<number> {
    const [deliveryScore, qualityScore, priceScore] = await Promise.all([
      this._calcDeliveryScore(supplierId),
      this._calcQualityScore(supplierId),
      this._calcPriceScore(supplierId),
    ]);

    const serviceScore = 0.8; // 固定值，后续可扩展

    const composite =
      deliveryScore * 0.4 +
      qualityScore * 0.3 +
      priceScore * 0.2 +
      serviceScore * 0.1;

    // 转换为 0-100 分
    return Math.round(composite * 100 * 100) / 100;
  }

  /**
   * 重新计算并保存绩效评分到 scm_supplier.performance_score
   */
  async updatePerformanceScore(
    tenantId: string,
    supplierId: string,
  ): Promise<ScmSupplier> {
    const supplier = await this.findOne(tenantId, supplierId);
    const score = await this.calculatePerformanceScore(supplierId);
    supplier.performanceScore = score;
    return this.supplierRepo.save(supplier);
  }

  // ── 私有计算方法 ──────────────────────────────────────────────────────────

  /**
   * 交期达成率：已按时到货的采购订单 / 总采购订单
   * 按时到货 = 状态为 RECEIVED/CLOSED 且 receipt_date <= expected_date
   */
  private async _calcDeliveryScore(supplierId: string): Promise<number> {
    const totalPos = await this.poRepo.count({
      where: {
        supplierId,
        status: PoStatus.RECEIVED,
      },
    });

    if (totalPos === 0) return 1; // 无历史订单，默认满分

    // 查询所有已收货的 PO，关联 receipt 判断是否按时
    const receipts = await this.receiptRepo
      .createQueryBuilder('r')
      .innerJoin(
        ScmPurchaseOrder,
        'po',
        'po.id = r.poId AND po.supplierId = :supplierId',
        { supplierId },
      )
      .where('r.status = :status', { status: ReceiptStatus.ACCEPTED })
      .andWhere('r.receiptDate <= po.expectedDate')
      .getCount();

    return totalPos > 0 ? receipts / totalPos : 1;
  }

  /**
   * 质量合格率：IQC 合格数量 / 总到货数量（从 scm_receipt 查询）
   * ACCEPTED 状态的 receipt 视为合格
   */
  private async _calcQualityScore(supplierId: string): Promise<number> {
    const total = await this.receiptRepo.count({ where: { supplierId } });
    if (total === 0) return 1;

    const accepted = await this.receiptRepo.count({
      where: { supplierId, status: ReceiptStatus.ACCEPTED },
    });

    return accepted / total;
  }

  /**
   * 价格竞争力：该供应商均价 vs 所有供应商均价
   * 分数 = 1 - (供应商均价 - 全局均价) / 全局均价，限制在 [0, 1]
   */
  private async _calcPriceScore(supplierId: string): Promise<number> {
    // 该供应商的历史均价
    const supplierAvg = await this.priceRecordRepo
      .createQueryBuilder('pr')
      .select('AVG(pr.unitPrice)', 'avg')
      .where('pr.supplierId = :supplierId', { supplierId })
      .getRawOne<{ avg: string | null }>();

    const supplierPrice = supplierAvg?.avg ? parseFloat(supplierAvg.avg) : null;
    if (supplierPrice === null) return 1; // 无价格记录，默认满分

    // 所有供应商的全局均价
    const globalAvg = await this.priceRecordRepo
      .createQueryBuilder('pr')
      .select('AVG(pr.unitPrice)', 'avg')
      .getRawOne<{ avg: string | null }>();

    const globalPrice = globalAvg?.avg ? parseFloat(globalAvg.avg) : null;
    if (!globalPrice || globalPrice === 0) return 1;

    // 供应商价格越低，分数越高
    const score = 1 - (supplierPrice - globalPrice) / globalPrice;
    return Math.max(0, Math.min(1, score));
  }

  // ── 供应商等级调整 ────────────────────────────────────────────────────────

  /**
   * 调整供应商等级（人工或自动），并记录调整历史到 attributes.gradeHistory
   */
  async adjustGrade(
    tenantId: string,
    supplierId: string,
    newType: SupplierType,
    adjustedBy: string,
    reason: string,
    isAuto = false,
  ): Promise<ScmSupplier> {
    const supplier = await this.findOne(tenantId, supplierId);

    // 等级未变化，直接返回
    if (supplier.type === newType) {
      return supplier;
    }

    // 安全读取 gradeHistory 数组
    const attrs = supplier.attributes ?? {};
    const gradeHistory: Array<Record<string, any>> = Array.isArray(
      attrs.gradeHistory,
    )
      ? attrs.gradeHistory
      : [];

    // 追加历史记录
    gradeHistory.push({
      fromType: supplier.type,
      toType: newType,
      adjustedBy,
      reason,
      isAuto,
      timestamp: new Date().toISOString(),
    });

    supplier.type = newType;
    supplier.attributes = { ...attrs, gradeHistory };

    return this.supplierRepo.save(supplier);
  }

  /**
   * 基于绩效评分自动调整供应商等级
   *   >= 90 → STRATEGIC
   *   >= 75 → PREFERRED
   *   >= 60 → QUALIFIED
   *   >= 40 → ELIMINATED
   *   <  40 → BLACKLIST
   */
  async autoAdjustGrade(
    tenantId: string,
    supplierId: string,
  ): Promise<ScmSupplier> {
    const supplier = await this.findOne(tenantId, supplierId);
    const score = supplier.performanceScore ?? 0;

    let newType: SupplierType;
    if (score >= 90) {
      newType = SupplierType.STRATEGIC;
    } else if (score >= 75) {
      newType = SupplierType.PREFERRED;
    } else if (score >= 60) {
      newType = SupplierType.QUALIFIED;
    } else if (score >= 40) {
      newType = SupplierType.ELIMINATED;
    } else {
      newType = SupplierType.BLACKLIST;
    }

    return this.adjustGrade(
      tenantId,
      supplierId,
      newType,
      'SYSTEM',
      `绩效评分 ${score}，自动调整等级`,
      true,
    );
  }

  /**
   * 批量自动调整所有 ACTIVE 供应商等级（用于定时任务）
   */
  async batchAutoAdjust(
    tenantId: string,
  ): Promise<{ adjusted: number; skipped: number }> {
    const { items } = await this.findAll(tenantId, {
      status: 'ACTIVE',
      pageSize: 1000,
    });

    let adjusted = 0;
    let skipped = 0;

    for (const supplier of items) {
      const before = supplier.type;
      await this.autoAdjustGrade(tenantId, supplier.id);
      // 重新查询判断是否实际发生了变更
      const after = await this.findOne(tenantId, supplier.id);
      if (after.type !== before) {
        adjusted++;
      } else {
        skipped++;
      }
    }

    return { adjusted, skipped };
  }

  // ── 资质 CRUD ─────────────────────────────────────────────────────────────

  async createQualification(
    tenantId: string,
    data: Partial<ScmSupplierQualification>,
  ): Promise<ScmSupplierQualification> {
    const entity = this.qualificationRepo.create({ ...data, tenantId });
    return this.qualificationRepo.save(entity);
  }

  async updateQualification(
    tenantId: string,
    id: string,
    data: Partial<ScmSupplierQualification>,
  ): Promise<ScmSupplierQualification> {
    await this.qualificationRepo.update({ id, tenantId }, data);
    const updated = await this.qualificationRepo.findOne({
      where: { id, tenantId },
    });
    if (!updated) throw new Error(`资质记录 ${id} 不存在`);
    return updated;
  }
}
