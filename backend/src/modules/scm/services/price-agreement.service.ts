import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ScmPriceAgreement,
  AgreementStatus,
  PriceType,
} from '../entities/scm-price-agreement.entity.js';
import { ScmPriceRecord } from '../entities/scm-price-record.entity.js';

// ── DTOs ──────────────────────────────────────────────────────────────────────

export interface CreatePriceAgreementDto {
  supplierId: string;
  materialId: string;
  priceType: PriceType;
  unitPrice?: number;
  tieredPrices?: Record<string, any>[];
  validFrom: Date;
  validTo: Date;
}

export interface PriceAgreementQuery {
  status?: AgreementStatus;
  supplierId?: string;
  materialId?: string;
  page?: number;
  pageSize?: number;
}

export interface RecordPriceDto {
  supplierId: string;
  materialId: string;
  unitPrice: number;
  quantity?: number;
  poNo?: string;
  recordDate: Date;
}

export interface PriceApprovalResult {
  needsApproval: boolean;
  reason?: string;
  historicalAvg?: number;
  agreementPrice?: number;
}

export interface PriceHistoryQuery {
  supplierId?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  pageSize?: number;
}

export interface PriceCurvePoint {
  month: string;
  avgPrice: number;
  maxPrice: number;
  minPrice: number;
  recordCount: number;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class PriceAgreementService {
  constructor(
    @InjectRepository(ScmPriceAgreement)
    private readonly paRepo: Repository<ScmPriceAgreement>,
    @InjectRepository(ScmPriceRecord)
    private readonly priceRecordRepo: Repository<ScmPriceRecord>,
  ) {}

  // ── agreementNo 生成 ────────────────────────────────────────────────────────

  private async generateAgreementNo(tenantId: string): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
    const prefix = `PA-${dateStr}-`;

    const result = await this.paRepo
      .createQueryBuilder('pa')
      .select('pa.agreementNo', 'agreementNo')
      .where('pa.tenantId = :tenantId', { tenantId })
      .andWhere('pa.agreementNo LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('pa.agreementNo', 'DESC')
      .limit(1)
      .getRawOne<{ agreementNo: string }>();

    let seq = 1;
    if (result?.agreementNo) {
      const lastSeq = parseInt(result.agreementNo.slice(prefix.length), 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }

    return `${prefix}${String(seq).padStart(3, '0')}`;
  }

  // ── 1. create ───────────────────────────────────────────────────────────────

  async create(
    tenantId: string,
    data: CreatePriceAgreementDto,
  ): Promise<ScmPriceAgreement> {
    const agreementNo = await this.generateAgreementNo(tenantId);

    const agreement = this.paRepo.create({
      tenantId,
      agreementNo,
      supplierId: data.supplierId,
      materialId: data.materialId,
      priceType: data.priceType,
      unitPrice: data.unitPrice,
      tieredPrices: data.tieredPrices,
      validFrom: data.validFrom,
      validTo: data.validTo,
      status: AgreementStatus.ACTIVE,
    });

    return this.paRepo.save(agreement);
  }

  // ── 2. findAll ──────────────────────────────────────────────────────────────

  async findAll(
    tenantId: string,
    query: PriceAgreementQuery = {},
  ): Promise<{ items: ScmPriceAgreement[]; total: number }> {
    const { status, supplierId, materialId, page = 1, pageSize = 20 } = query;

    const qb = this.paRepo
      .createQueryBuilder('pa')
      .where('pa.tenantId = :tenantId', { tenantId });

    if (status) qb.andWhere('pa.status = :status', { status });
    if (supplierId) qb.andWhere('pa.supplierId = :supplierId', { supplierId });
    if (materialId) qb.andWhere('pa.materialId = :materialId', { materialId });

    qb.orderBy('pa.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  // ── 3. findOne ──────────────────────────────────────────────────────────────

  async findOne(tenantId: string, id: string): Promise<ScmPriceAgreement> {
    const agreement = await this.paRepo.findOne({ where: { id, tenantId } });
    if (!agreement) throw new NotFoundException(`价格协议 ${id} 不存在`);
    return agreement;
  }

  // ── 4. expire ───────────────────────────────────────────────────────────────

  async expire(tenantId: string, id: string): Promise<ScmPriceAgreement> {
    const agreement = await this.findOne(tenantId, id);
    if (agreement.status !== AgreementStatus.ACTIVE) {
      throw new BadRequestException(
        `仅 ACTIVE 状态可手动过期，当前状态：${agreement.status}`,
      );
    }
    agreement.status = AgreementStatus.EXPIRED;
    return this.paRepo.save(agreement);
  }

  // ── 5. cancel ───────────────────────────────────────────────────────────────

  async cancel(tenantId: string, id: string): Promise<ScmPriceAgreement> {
    const agreement = await this.findOne(tenantId, id);
    if (agreement.status !== AgreementStatus.ACTIVE) {
      throw new BadRequestException(
        `仅 ACTIVE 状态可取消，当前状态：${agreement.status}`,
      );
    }
    agreement.status = AgreementStatus.CANCELLED;
    return this.paRepo.save(agreement);
  }

  // ── 6. checkPriceApproval ───────────────────────────────────────────────────

  async checkPriceApproval(
    tenantId: string,
    supplierId: string,
    materialId: string,
    quantity: number,
    proposedPrice: number,
  ): Promise<PriceApprovalResult> {
    // 查询历史均价
    const histResult = await this.priceRecordRepo
      .createQueryBuilder('pr')
      .select('AVG(pr.unitPrice)', 'avg')
      .where('pr.tenantId = :tenantId', { tenantId })
      .andWhere('pr.supplierId = :supplierId', { supplierId })
      .andWhere('pr.materialId = :materialId', { materialId })
      .getRawOne<{ avg: string | null }>();

    const historicalAvg = histResult?.avg ? parseFloat(histResult.avg) : null;

    if (historicalAvg !== null && proposedPrice > historicalAvg * 1.1) {
      return {
        needsApproval: true,
        reason: `报价 ${proposedPrice} 超出历史均价 ${historicalAvg.toFixed(4)} 的 10%`,
        historicalAvg,
      };
    }

    // 查询有效价格协议
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

    if (agreement) {
      // 取协议价（FIXED 直接用 unitPrice，TIERED 取最低阶梯价作为基准）
      let agreementPrice: number | null = null;

      if (
        agreement.priceType === PriceType.FIXED &&
        agreement.unitPrice != null
      ) {
        agreementPrice = Number(agreement.unitPrice);
      } else if (
        agreement.priceType === PriceType.TIERED &&
        agreement.tieredPrices?.length
      ) {
        // 按数量匹配阶梯价
        const tiers = agreement.tieredPrices as Array<{
          minQty: number;
          maxQty?: number;
          price: number;
        }>;
        const sorted = [...tiers].sort((a, b) => b.minQty - a.minQty);
        for (const tier of sorted) {
          if (quantity >= tier.minQty) {
            agreementPrice = tier.price;
            break;
          }
        }
        if (agreementPrice === null) {
          const lowest = tiers.reduce((min, t) =>
            t.minQty < min.minQty ? t : min,
          );
          agreementPrice = lowest.price;
        }
      }

      if (agreementPrice !== null && proposedPrice > agreementPrice * 1.05) {
        return {
          needsApproval: true,
          reason: `报价 ${proposedPrice} 超出协议价 ${agreementPrice} 的 5%`,
          agreementPrice,
        };
      }
    }

    return { needsApproval: false };
  }

  // ── 7. autoExpireAgreements ─────────────────────────────────────────────────

  async autoExpireAgreements(tenantId: string): Promise<{ expired: number }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = await this.paRepo
      .createQueryBuilder()
      .update(ScmPriceAgreement)
      .set({ status: AgreementStatus.EXPIRED })
      .where('tenantId = :tenantId', { tenantId })
      .andWhere('status = :status', { status: AgreementStatus.ACTIVE })
      .andWhere('validTo < :today', { today })
      .execute();

    return { expired: result.affected ?? 0 };
  }

  // ── 8. recordPrice ──────────────────────────────────────────────────────────

  async recordPrice(
    tenantId: string,
    data: RecordPriceDto,
  ): Promise<ScmPriceRecord> {
    const record = this.priceRecordRepo.create({
      tenantId,
      supplierId: data.supplierId,
      materialId: data.materialId,
      unitPrice: data.unitPrice,
      quantity: data.quantity,
      poNo: data.poNo,
      recordDate: data.recordDate,
    });
    return this.priceRecordRepo.save(record);
  }

  // ── 9. getPriceHistory ────────────────────────────────────────────────────

  async getPriceHistory(
    tenantId: string,
    materialId: string,
    query: PriceHistoryQuery = {},
  ): Promise<{ items: ScmPriceRecord[]; total: number }> {
    const { supplierId, startDate, endDate, page = 1, pageSize = 20 } = query;

    const qb = this.priceRecordRepo
      .createQueryBuilder('pr')
      .where('pr.tenantId = :tenantId', { tenantId })
      .andWhere('pr.materialId = :materialId', { materialId });

    if (supplierId) {
      qb.andWhere('pr.supplierId = :supplierId', { supplierId });
    }
    if (startDate) {
      qb.andWhere('pr.recordDate >= :startDate', { startDate });
    }
    if (endDate) {
      qb.andWhere('pr.recordDate <= :endDate', { endDate });
    }

    qb.orderBy('pr.recordDate', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  // ── 10. getPriceCurve ─────────────────────────────────────────────────────

  async getPriceCurve(
    tenantId: string,
    materialId: string,
    supplierId?: string,
    months = 6,
  ): Promise<PriceCurvePoint[]> {
    const since = new Date();
    since.setMonth(since.getMonth() - months);
    since.setDate(1);
    since.setHours(0, 0, 0, 0);

    const qb = this.priceRecordRepo
      .createQueryBuilder('pr')
      .select("DATE_FORMAT(pr.recordDate, '%Y-%m')", 'month')
      .addSelect('AVG(pr.unitPrice)', 'avgPrice')
      .addSelect('MAX(pr.unitPrice)', 'maxPrice')
      .addSelect('MIN(pr.unitPrice)', 'minPrice')
      .addSelect('COUNT(*)', 'recordCount')
      .where('pr.tenantId = :tenantId', { tenantId })
      .andWhere('pr.materialId = :materialId', { materialId })
      .andWhere('pr.recordDate >= :since', { since });

    if (supplierId) {
      qb.andWhere('pr.supplierId = :supplierId', { supplierId });
    }

    qb.groupBy("DATE_FORMAT(pr.recordDate, '%Y-%m')").orderBy('month', 'ASC');

    const rows = await qb.getRawMany<{
      month: string;
      avgPrice: string;
      maxPrice: string;
      minPrice: string;
      recordCount: string;
    }>();

    return rows.map((r) => ({
      month: r.month,
      avgPrice: parseFloat(r.avgPrice),
      maxPrice: parseFloat(r.maxPrice),
      minPrice: parseFloat(r.minPrice),
      recordCount: parseInt(r.recordCount, 10),
    }));
  }
}
