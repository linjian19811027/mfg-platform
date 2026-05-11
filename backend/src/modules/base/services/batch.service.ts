import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions } from 'typeorm';
import { MaterialBatch } from '../entities/material-batch.entity.js';
import { TenantContext } from '../../../shared/tenant/tenant.context.js';
import { sanitizeUpdateData } from '../../../shared/utils/sanitize.js';

export interface BatchQuery {
  materialId?: string;
  sourceType?: string;
  qualityStatus?: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class BatchService {
  constructor(
    @InjectRepository(MaterialBatch)
    private readonly repo: Repository<MaterialBatch>,
  ) {}

  async findAll(query: BatchQuery) {
    const tenantId = TenantContext.requireCurrentTenant();
    const where: Partial<MaterialBatch> = { tenantId };
    if (query.materialId) where.materialId = query.materialId;
    if (query.sourceType) where.sourceType = query.sourceType;
    if (query.qualityStatus) where.qualityStatus = query.qualityStatus;

    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 100);

    const [list, total] = await this.repo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return {
      list,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async findOne(id: string): Promise<MaterialBatch> {
    const tenantId = TenantContext.requireCurrentTenant();
    const batch = await this.repo.findOne({ where: { id, tenantId } });
    if (!batch) throw new NotFoundException('BASE_BATCH_NOT_FOUND');
    return batch;
  }

  async create(data: Partial<MaterialBatch>): Promise<MaterialBatch> {
    const tenantId = TenantContext.requireCurrentTenant();
    data.tenantId = tenantId;
    data.currentQty = data.currentQty ?? data.initialQty;
    return this.repo.save(this.repo.create(data));
  }

  async update(
    id: string,
    data: Partial<MaterialBatch>,
  ): Promise<MaterialBatch> {
    const tenantId = TenantContext.requireCurrentTenant();
    const batch = await this.repo.findOne({ where: { id, tenantId } });
    if (!batch) throw new NotFoundException('BASE_BATCH_NOT_FOUND');
    await this.repo.update(id, sanitizeUpdateData(data) as any);
    return { ...batch, ...data };
  }
}
