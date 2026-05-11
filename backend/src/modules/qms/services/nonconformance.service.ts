import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { QmsNonconformance } from '../entities/qms-nonconformance.entity.js';
import { QmsCorrectiveAction } from '../entities/qms-corrective-action.entity.js';
import { TenantContext } from '../../../shared/tenant/tenant.context.js';
import {
  MESSAGE_SERVICE,
  MessageService,
} from '../../../shared/message/message.interface.js';
import { sanitizeUpdateData } from '../../../shared/utils/sanitize.js';

const NC_TRANSITIONS: Record<string, string[]> = {
  OPEN: ['IN_REVIEW', 'CLOSED'],
  IN_REVIEW: ['CLOSED'],
  CLOSED: [],
};

@Injectable()
export class NonconformanceService {
  constructor(
    @InjectRepository(QmsNonconformance)
    private readonly ncRepo: Repository<QmsNonconformance>,
    @InjectRepository(QmsCorrectiveAction)
    private readonly caRepo: Repository<QmsCorrectiveAction>,
    @Inject(MESSAGE_SERVICE)
    private readonly messageSvc: MessageService,
  ) {}

  async findAll(query: {
    materialId?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }) {
    const tenantId = TenantContext.requireCurrentTenant();
    const { page = 1, pageSize = 20 } = query;
    const qb = this.ncRepo
      .createQueryBuilder('nc')
      .where('nc.tenant_id = :tenantId', { tenantId });
    if (query.materialId)
      qb.andWhere('nc.material_id = :mat', { mat: query.materialId });
    if (query.status)
      qb.andWhere('nc.status = :status', { status: query.status });
    const [items, total] = await qb
      .orderBy('nc.created_at', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return { items, total };
  }

  async findOne(id: string): Promise<QmsNonconformance> {
    const tenantId = TenantContext.requireCurrentTenant();
    const nc = await this.ncRepo.findOne({ where: { id, tenantId } });
    if (!nc) throw new NotFoundException('QMS_NC_NOT_FOUND');
    return nc;
  }

  async create(data: Partial<QmsNonconformance>): Promise<QmsNonconformance> {
    const tenantId = TenantContext.requireCurrentTenant();
    data.tenantId = tenantId;
    data.status = 'OPEN';
    const count = await this.ncRepo.count({ where: { tenantId } });
    data.ncNo =
      data.ncNo ??
      `NC-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;

    const nc = await this.ncRepo.save(this.ncRepo.create(data));

    // 自动冻结 WMS 库存（通过事件）
    if (nc.batchId) {
      await this.messageSvc.publish({
        eventId: uuidv4(),
        eventType: 'NC_CREATED',
        tenantId,
        sourceModule: 'QMS',
        payload: {
          ncId: nc.id,
          materialId: nc.materialId,
          batchId: nc.batchId,
          quantity: nc.quantity,
        },
        createdAt: new Date(),
      });
    }

    return nc;
  }

  /** MRB 状态流转 */
  async transition(
    id: string,
    newStatus: string,
    disposition?: string,
  ): Promise<QmsNonconformance> {
    const tenantId = TenantContext.requireCurrentTenant();
    const nc = await this.ncRepo.findOne({ where: { id, tenantId } });
    if (!nc) throw new NotFoundException('QMS_NC_NOT_FOUND');

    const allowed = NC_TRANSITIONS[nc.status] ?? [];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `QMS_NC_INVALID_TRANSITION:${nc.status}->${newStatus}`,
      );
    }

    const update: Partial<QmsNonconformance> = { status: newStatus };
    if (disposition) update.disposition = disposition;

    await this.ncRepo.update(id, update as any);
    return { ...nc, ...update };
  }

  /** 返工跟踪 */
  async rework(
    id: string,
    reworkWoId: string,
    reworkCost?: number,
  ): Promise<QmsNonconformance> {
    const tenantId = TenantContext.requireCurrentTenant();
    const nc = await this.ncRepo.findOne({ where: { id, tenantId } });
    if (!nc) throw new NotFoundException('QMS_NC_NOT_FOUND');

    await this.ncRepo.update(id, {
      reworkWoId,
      reworkCost,
      disposition: 'REWORK',
    });
    return { ...nc, reworkWoId, reworkCost, disposition: 'REWORK' };
  }

  // ── 纠正措施 ──────────────────────────────────────────────────────────────

  async createCa(
    data: Partial<QmsCorrectiveAction>,
  ): Promise<QmsCorrectiveAction> {
    const tenantId = TenantContext.requireCurrentTenant();
    data.tenantId = tenantId;
    data.status = 'OPEN';
    return this.caRepo.save(this.caRepo.create(data));
  }

  async updateCa(
    id: string,
    data: Partial<QmsCorrectiveAction>,
  ): Promise<QmsCorrectiveAction> {
    const tenantId = TenantContext.requireCurrentTenant();
    const ca = await this.caRepo.findOne({ where: { id, tenantId } });
    if (!ca) throw new NotFoundException('QMS_CA_NOT_FOUND');
    await this.caRepo.update(id, sanitizeUpdateData(data) as any);
    return { ...ca, ...data };
  }

  async verifyCa(
    id: string,
    result: string,
    verifiedBy: string,
  ): Promise<QmsCorrectiveAction> {
    const tenantId = TenantContext.requireCurrentTenant();
    const ca = await this.caRepo.findOne({ where: { id, tenantId } });
    if (!ca) throw new NotFoundException('QMS_CA_NOT_FOUND');

    const newStatus = result.includes('PASS') ? 'CLOSED' : 'INEFFECTIVE';
    await this.caRepo.update(id, {
      status: newStatus,
      verificationResult: result,
      verifiedBy,
      verifiedAt: new Date(),
    });
    return { ...ca, status: newStatus };
  }

  async findAllCa(
    query: {
      tenantId?: string;
      status?: string;
      page?: number;
      pageSize?: number;
    } = {},
  ): Promise<{ list: QmsCorrectiveAction[]; total: number }> {
    const tenantId =
      TenantContext.getCurrentTenant() ?? query.tenantId ?? 'DEFAULT';
    const { status, page = 1, pageSize = 20 } = query;
    const qb = this.caRepo
      .createQueryBuilder('c')
      .where('c.tenantId = :tenantId', { tenantId });
    if (status) qb.andWhere('c.status = :status', { status });
    qb.skip((page - 1) * pageSize)
      .take(pageSize)
      .orderBy('c.createdAt', 'DESC');
    const [list, total] = await qb.getManyAndCount();
    return { list, total };
  }
}
