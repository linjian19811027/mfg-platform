import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import {
  ErpSalesReturn,
  SalesReturnStatus,
} from '../entities/erp-sales-return.entity.js';
import {
  MessageService,
  MESSAGE_SERVICE,
} from '../../../shared/message/message.interface.js';

// ── DTOs ──────────────────────────────────────────────────────────────────────

export interface SalesReturnItemDto {
  materialId: string;
  quantity: number;
  uomId: string;
  soLineId: string;
}

export interface CreateSalesReturnDto {
  soId: string;
  customerId: string;
  returnDate: Date;
  reason?: string;
  items: SalesReturnItemDto[];
}

export interface SalesReturnQuery {
  status?: SalesReturnStatus;
  soId?: string;
  customerId?: string;
  page?: number;
  pageSize?: number;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class SalesReturnService {
  constructor(
    @InjectRepository(ErpSalesReturn)
    private readonly returnRepo: Repository<ErpSalesReturn>,
    @Inject(MESSAGE_SERVICE)
    private readonly messageService: MessageService,
  ) {}

  // ── returnNo 生成 ─────────────────────────────────────────────────────────

  private async generateReturnNo(tenantId: string): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `RET-${dateStr}-`;

    const result = await this.returnRepo
      .createQueryBuilder('r')
      .select('r.returnNo', 'returnNo')
      .where('r.tenantId = :tenantId', { tenantId })
      .andWhere('r.returnNo LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('r.returnNo', 'DESC')
      .limit(1)
      .getRawOne<{ returnNo: string }>();

    let seq = 1;
    if (result?.returnNo) {
      const lastSeq = parseInt(result.returnNo.slice(prefix.length), 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }

    return `${prefix}${String(seq).padStart(3, '0')}`;
  }

  // ── 1. create ─────────────────────────────────────────────────────────────

  async create(
    tenantId: string,
    data: CreateSalesReturnDto,
  ): Promise<ErpSalesReturn> {
    const returnNo = await this.generateReturnNo(tenantId);

    const entity = this.returnRepo.create({
      tenantId,
      returnNo,
      soId: data.soId,
      customerId: data.customerId,
      returnDate: data.returnDate,
      reason: data.reason,
      status: SalesReturnStatus.PENDING,
      items: data.items,
    });

    return this.returnRepo.save(entity);
  }

  // ── 2. findAll ────────────────────────────────────────────────────────────

  async findAll(
    tenantId: string,
    query: SalesReturnQuery = {},
  ): Promise<{ items: ErpSalesReturn[]; total: number }> {
    const { status, soId, customerId, page = 1, pageSize = 20 } = query;

    const qb = this.returnRepo
      .createQueryBuilder('r')
      .where('r.tenantId = :tenantId', { tenantId });

    if (status) qb.andWhere('r.status = :status', { status });
    if (soId) qb.andWhere('r.soId = :soId', { soId });
    if (customerId) qb.andWhere('r.customerId = :customerId', { customerId });

    qb.orderBy('r.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  // ── 3. findOne ────────────────────────────────────────────────────────────

  async findOne(tenantId: string, id: string): Promise<ErpSalesReturn> {
    const entity = await this.returnRepo.findOne({ where: { id, tenantId } });
    if (!entity) throw new NotFoundException(`退货单 ${id} 不存在`);
    return entity;
  }

  // ── 4. startInspection ───────────────────────────────────────────────────

  async startInspection(tenantId: string, id: string): Promise<ErpSalesReturn> {
    const entity = await this.findOne(tenantId, id);

    if (entity.status !== SalesReturnStatus.PENDING) {
      throw new BadRequestException(
        `仅 PENDING 状态可开始质检，当前状态：${entity.status}`,
      );
    }

    entity.status = SalesReturnStatus.INSPECTING;
    const saved = await this.returnRepo.save(entity);

    await this.messageService.publish({
      eventId: uuidv4(),
      eventType: 'SALES_RETURN_INSPECTION',
      tenantId,
      sourceModule: 'ERP',
      targetModule: 'QMS',
      payload: {
        returnId: saved.id,
        returnNo: saved.returnNo,
        soId: saved.soId,
        customerId: saved.customerId,
        items: saved.items,
        tenantId,
      },
      createdAt: new Date(),
    });

    return saved;
  }

  // ── 5. accept ─────────────────────────────────────────────────────────────

  async accept(tenantId: string, id: string): Promise<ErpSalesReturn> {
    const entity = await this.findOne(tenantId, id);

    if (entity.status !== SalesReturnStatus.INSPECTING) {
      throw new BadRequestException(
        `仅 INSPECTING 状态可质检通过，当前状态：${entity.status}`,
      );
    }

    entity.status = SalesReturnStatus.ACCEPTED;
    const saved = await this.returnRepo.save(entity);

    await this.messageService.publish({
      eventId: uuidv4(),
      eventType: 'SALES_RETURN_ACCEPTED',
      tenantId,
      sourceModule: 'ERP',
      targetModule: 'WMS',
      payload: {
        returnId: saved.id,
        returnNo: saved.returnNo,
        soId: saved.soId,
        customerId: saved.customerId,
        items: saved.items,
        tenantId,
      },
      createdAt: new Date(),
    });

    return saved;
  }

  // ── 6. reject ─────────────────────────────────────────────────────────────

  async reject(
    tenantId: string,
    id: string,
    reason: string,
  ): Promise<ErpSalesReturn> {
    const entity = await this.findOne(tenantId, id);

    if (entity.status !== SalesReturnStatus.INSPECTING) {
      throw new BadRequestException(
        `仅 INSPECTING 状态可质检拒绝，当前状态：${entity.status}`,
      );
    }

    entity.status = SalesReturnStatus.REJECTED;
    entity.reason = reason;
    return this.returnRepo.save(entity);
  }

  // ── 7. markStocked ────────────────────────────────────────────────────────

  async markStocked(tenantId: string, id: string): Promise<ErpSalesReturn> {
    const entity = await this.findOne(tenantId, id);

    if (entity.status !== SalesReturnStatus.ACCEPTED) {
      throw new BadRequestException(
        `仅 ACCEPTED 状态可标记入库，当前状态：${entity.status}`,
      );
    }

    entity.status = SalesReturnStatus.STOCKED;
    return this.returnRepo.save(entity);
  }
}
