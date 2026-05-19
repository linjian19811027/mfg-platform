import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ScmPurchaseRequest,
  PrStatus,
  PrTriggerType,
} from '../entities/scm-purchase-request.entity.js';

export interface PurchaseRequestQuery {
  status?: PrStatus;
  triggerType?: PrTriggerType;
  requestDept?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class PurchaseRequestService {
  constructor(
    @InjectRepository(ScmPurchaseRequest)
    private readonly prRepo: Repository<ScmPurchaseRequest>,
  ) {}

  // ── prNo 生成 ─────────────────────────────────────────────────────────────

  private async generatePrNo(tenantId: string): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD

    // 查询当天最大序号
    const prefix = `PR-${dateStr}-`;
    const result = await this.prRepo
      .createQueryBuilder('pr')
      .select('pr.prNo', 'prNo')
      .where('pr.tenantId = :tenantId', { tenantId })
      .andWhere('pr.prNo LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('pr.prNo', 'DESC')
      .limit(1)
      .getRawOne<{ prNo: string }>();

    let seq = 1;
    if (result?.prNo) {
      const lastSeq = parseInt(result.prNo.slice(prefix.length), 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }

    return `${prefix}${String(seq).padStart(3, '0')}`;
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async create(
    tenantId: string,
    data: Partial<ScmPurchaseRequest>,
  ): Promise<ScmPurchaseRequest> {
    const prNo = await this.generatePrNo(tenantId);

    // 自动查找物料编码和名称（跨模块，降级处理）
    let materialCode = data.materialCode;
    let materialName = data.materialName;
    if (data.materialId && (!materialCode || !materialName)) {
      try {
        const mat = await this.prRepo.manager
          .createQueryBuilder()
          .select(['code', 'name'])
          .from('plm_material', 'm')
          .where('m.id = :id', { id: data.materialId })
          .getRawOne<{ code: string; name: string }>();
        if (mat) {
          materialCode = materialCode ?? mat.code;
          materialName = materialName ?? mat.name;
        }
      } catch { /* PLM 未启用 */ }
    }

    const entity = this.prRepo.create({
      ...data,
      materialCode,
      materialName,
      tenantId,
      prNo,
      status: PrStatus.DRAFT,
    });
    return this.prRepo.save(entity);
  }

  async findAll(
    tenantId: string,
    query: PurchaseRequestQuery = {},
  ): Promise<{ items: ScmPurchaseRequest[]; total: number }> {
    const {
      status,
      triggerType,
      requestDept,
      keyword,
      page = 1,
      pageSize = 20,
    } = query;

    const qb = this.prRepo
      .createQueryBuilder('pr')
      .where('pr.tenantId = :tenantId', { tenantId });

    if (status) qb.andWhere('pr.status = :status', { status });
    if (triggerType)
      qb.andWhere('pr.triggerType = :triggerType', { triggerType });
    if (requestDept)
      qb.andWhere('pr.requestDept = :requestDept', { requestDept });
    if (keyword) {
      qb.andWhere('(pr.prNo LIKE :kw OR pr.requestDept LIKE :kw)', {
        kw: `%${keyword}%`,
      });
    }

    qb.orderBy('pr.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async findOne(tenantId: string, id: string): Promise<ScmPurchaseRequest> {
    const pr = await this.prRepo.findOne({ where: { id, tenantId } });
    if (!pr) throw new NotFoundException(`采购申请 ${id} 不存在`);
    return pr;
  }

  async update(
    tenantId: string,
    id: string,
    data: Partial<ScmPurchaseRequest>,
  ): Promise<ScmPurchaseRequest> {
    const pr = await this.findOne(tenantId, id);
    if (pr.status !== PrStatus.DRAFT) {
      throw new BadRequestException(
        `仅 DRAFT 状态的采购申请可修改，当前状态：${pr.status}`,
      );
    }
    Object.assign(pr, data);
    return this.prRepo.save(pr);
  }

  // ── 状态流转 ──────────────────────────────────────────────────────────────

  async submit(tenantId: string, id: string): Promise<ScmPurchaseRequest> {
    const pr = await this.findOne(tenantId, id);
    if (pr.status !== PrStatus.DRAFT) {
      throw new BadRequestException(
        `仅 DRAFT 状态可提交，当前状态：${pr.status}`,
      );
    }
    pr.status = PrStatus.PENDING;
    return this.prRepo.save(pr);
  }

  async approve(
    tenantId: string,
    id: string,
    approverId: string,
    approvedAmount: number,
    remarks?: string,
  ): Promise<ScmPurchaseRequest> {
    const pr = await this.findOne(tenantId, id);
    if (pr.status !== PrStatus.PENDING) {
      throw new BadRequestException(
        `仅 PENDING 状态可审批，当前状态：${pr.status}`,
      );
    }
    if (pr.budgetAmount !== undefined && pr.budgetAmount !== null) {
      if (approvedAmount > Number(pr.budgetAmount)) {
        throw new BadRequestException(
          `审批金额 ${approvedAmount} 超出预算 ${pr.budgetAmount}，已自动拦截`,
        );
      }
    }

    const record = {
      action: 'APPROVE',
      approverId,
      approvedAmount,
      remarks: remarks ?? '',
      timestamp: new Date().toISOString(),
    };

    pr.status = PrStatus.APPROVED;
    pr.approvedAmount = approvedAmount;
    pr.approvalRecords = [...(pr.approvalRecords ?? []), record];
    return this.prRepo.save(pr);
  }

  async reject(
    tenantId: string,
    id: string,
    approverId: string,
    remarks?: string,
  ): Promise<ScmPurchaseRequest> {
    const pr = await this.findOne(tenantId, id);
    if (pr.status !== PrStatus.PENDING) {
      throw new BadRequestException(
        `仅 PENDING 状态可拒绝，当前状态：${pr.status}`,
      );
    }

    const record = {
      action: 'REJECT',
      approverId,
      remarks: remarks ?? '',
      timestamp: new Date().toISOString(),
    };

    pr.status = PrStatus.REJECTED;
    pr.approvalRecords = [...(pr.approvalRecords ?? []), record];
    return this.prRepo.save(pr);
  }

  async close(tenantId: string, id: string): Promise<ScmPurchaseRequest> {
    const pr = await this.findOne(tenantId, id);
    if (pr.status !== PrStatus.APPROVED) {
      throw new BadRequestException(
        `仅 APPROVED 状态可关闭，当前状态：${pr.status}`,
      );
    }
    pr.status = PrStatus.CLOSED;
    return this.prRepo.save(pr);
  }
}
