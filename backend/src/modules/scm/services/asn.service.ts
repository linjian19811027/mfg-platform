import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScmAsn, AsnStatus } from '../entities/scm-asn.entity.js';
import { ScmAsnLine } from '../entities/scm-asn-line.entity.js';
import { ScmPurchaseOrder } from '../entities/scm-purchase-order.entity.js';

// ── DTOs ──────────────────────────────────────────────────────────────────────

export interface AsnItemDto {
  materialId: string;
  quantity: number;
  uomId: string;
}

export interface CreateAsnDto {
  poId: string;
  supplierId: string;
  expectedDate: Date;
  items?: AsnItemDto[];
}

export interface AsnQuery {
  status?: AsnStatus;
  poId?: string;
  supplierId?: string;
  page?: number;
  pageSize?: number;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class AsnService {
  constructor(
    @InjectRepository(ScmAsn)
    private readonly asnRepo: Repository<ScmAsn>,
    @InjectRepository(ScmAsnLine)
    private readonly lineRepo: Repository<ScmAsnLine>,
    @InjectRepository(ScmPurchaseOrder)
    private readonly poRepo: Repository<ScmPurchaseOrder>,
  ) {}

  // ── asnNo 生成 ──────────────────────────────────────────────────────────────

  private async generateAsnNo(tenantId: string): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
    const prefix = `ASN-${dateStr}-`;

    const result = await this.asnRepo
      .createQueryBuilder('asn')
      .select('asn.asnNo', 'asnNo')
      .where('asn.tenantId = :tenantId', { tenantId })
      .andWhere('asn.asnNo LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('asn.asnNo', 'DESC')
      .limit(1)
      .getRawOne<{ asnNo: string }>();

    let seq = 1;
    if (result?.asnNo) {
      const lastSeq = parseInt(result.asnNo.slice(prefix.length), 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }

    return `${prefix}${String(seq).padStart(3, '0')}`;
  }

  // ── 1. create ───────────────────────────────────────────────────────────────

  async create(tenantId: string, data: CreateAsnDto): Promise<ScmAsn> {
    // 校验关联 PO 存在且属于同一租户
    const po = await this.poRepo.findOne({
      where: { id: data.poId, tenantId },
    });
    if (!po) {
      throw new NotFoundException(`采购订单 ${data.poId} 不存在`);
    }

    const asnNo = await this.generateAsnNo(tenantId);

    // 查找供应商名称（同模块）
    let supplierName: string | undefined;
    if (data.supplierId) {
      const sup = await this.asnRepo.manager
        .createQueryBuilder()
        .select('name')
        .from('scm_supplier', 's')
        .where('id = :id AND tenant_id = :tid', { id: data.supplierId, tid: tenantId })
        .getRawOne<{ name: string }>();
      supplierName = sup?.name;
    }

    const asn = this.asnRepo.create({
      tenantId,
      asnNo,
      poId: data.poId,
      supplierId: data.supplierId,
      supplierName,
      expectedDate: data.expectedDate,
      status: AsnStatus.PENDING,
      items: data.items ?? [],
    });
    const savedAsn = await this.asnRepo.save(asn);

    // 保存明细行
    if (data.items && data.items.length > 0) {
      const lines = data.items.map((item, idx) =>
        this.lineRepo.create({
          tenantId,
          asnId: savedAsn.id,
          lineNo: idx + 1,
          materialId: item.materialId,
          materialCode: (item as any).materialCode,
          materialName: (item as any).materialName,
          quantity: item.quantity,
          uomId: item.uomId,
        }),
      );
      await this.lineRepo.save(lines);
    }

    return savedAsn;
  }

  // ── 2. findAll ──────────────────────────────────────────────────────────────

  async findAll(
    tenantId: string,
    query: AsnQuery = {},
  ): Promise<{ items: ScmAsn[]; total: number }> {
    const { status, poId, supplierId, page = 1, pageSize = 20 } = query;

    const qb = this.asnRepo
      .createQueryBuilder('asn')
      .leftJoin('scm_supplier', 'sup', 'sup.id = asn.supplier_id AND sup.tenant_id = asn.tenant_id')
      .addSelect('sup.name', 'supplierName')
      .where('asn.tenantId = :tenantId', { tenantId });

    if (status) qb.andWhere('asn.status = :status', { status });
    if (poId) qb.andWhere('asn.poId = :poId', { poId });
    if (supplierId) qb.andWhere('asn.supplierId = :supplierId', { supplierId });

    qb.orderBy('asn.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const { entities, raw } = await qb.getRawAndEntities();
    const total = await qb.getCount();
    const items = entities.map((e, i) => ({ ...e, supplierName: raw[i]?.supplierName }));
    return { items, total };
  }

  // ── 3. findOne ──────────────────────────────────────────────────────────────

  async findOne(tenantId: string, id: string): Promise<ScmAsn> {
    const asn = await this.asnRepo.findOne({ where: { id, tenantId } });
    if (!asn) throw new NotFoundException(`到货通知 ${id} 不存在`);
    return asn;
  }

  // ── 4. receive ──────────────────────────────────────────────────────────────

  async receive(tenantId: string, id: string): Promise<ScmAsn> {
    const asn = await this.findOne(tenantId, id);
    if (asn.status !== AsnStatus.PENDING) {
      throw new BadRequestException(
        `仅 PENDING 状态可标记接收，当前状态：${asn.status}`,
      );
    }
    asn.status = AsnStatus.RECEIVED;
    return this.asnRepo.save(asn);
  }

  // ── 5. cancel ───────────────────────────────────────────────────────────────

  async cancel(tenantId: string, id: string): Promise<ScmAsn> {
    const asn = await this.findOne(tenantId, id);
    if (asn.status !== AsnStatus.PENDING) {
      throw new BadRequestException(
        `仅 PENDING 状态可取消，当前状态：${asn.status}`,
      );
    }
    asn.status = AsnStatus.CANCELLED;
    return this.asnRepo.save(asn);
  }

  // ── 6. findLines ────────────────────────────────────────────────────────────

  async findLines(tenantId: string, asnId: string): Promise<ScmAsnLine[]> {
    return this.lineRepo.find({
      where: { tenantId, asnId },
      order: { lineNo: 'ASC' },
    });
  }

  // ── 7. findByPo ─────────────────────────────────────────────────────────────

  async findByPo(tenantId: string, poId: string): Promise<ScmAsn[]> {
    return this.asnRepo.find({
      where: { poId, tenantId },
      order: { createdAt: 'ASC' },
    });
  }
}
