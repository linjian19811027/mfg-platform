import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlmStandardOperation } from '../entities/plm-standard-operation.entity.js';
import { TenantContext } from '../../../shared/tenant/tenant.context.js';
import { sanitizeUpdateData } from '../../../shared/utils/sanitize.js';

@Injectable()
export class StandardOperationService {
  constructor(
    @InjectRepository(PlmStandardOperation)
    private readonly repo: Repository<PlmStandardOperation>,
  ) {}

  async findAll(query: { keyword?: string; status?: string; page?: number; pageSize?: number }) {
    const tenantId = TenantContext.requireCurrentTenant();
    const { keyword, status, page = 1, pageSize = 20 } = query;

    const qb = this.repo.createQueryBuilder('o')
      .where('o.tenantId = :tenantId', { tenantId });

    if (status) {
      qb.andWhere('o.status = :status', { status });
    }
    if (keyword) {
      qb.andWhere('(o.code LIKE :kw OR o.name LIKE :kw)', { kw: `%${keyword}%` });
    }

    qb.orderBy('o.code', 'ASC');

    const [items, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { items, total };
  }

  async findOne(id: string) {
    const tenantId = TenantContext.requireCurrentTenant();
    const op = await this.repo.findOne({ where: { id, tenantId } });
    if (!op) throw new NotFoundException('PLM_STANDARD_OPERATION_NOT_FOUND');
    return op;
  }

  async create(data: Partial<PlmStandardOperation>) {
    const tenantId = TenantContext.requireCurrentTenant();
    
    // 检查编码唯一性
    const existing = await this.repo.findOne({ where: { tenantId, code: data.code } });
    if (existing) throw new ConflictException('PLM_STANDARD_OPERATION_CODE_EXISTS');

    const op = this.repo.create({ ...data, tenantId });
    return this.repo.save(op);
  }

  async update(id: string, data: Partial<PlmStandardOperation>) {
    const tenantId = TenantContext.requireCurrentTenant();
    const op = await this.findOne(id);
    
    if (data.code && data.code !== op.code) {
      const existing = await this.repo.findOne({ where: { tenantId, code: data.code } });
      if (existing) throw new ConflictException('PLM_STANDARD_OPERATION_CODE_EXISTS');
    }

    await this.repo.update(id, sanitizeUpdateData(data) as any);
    return { ...op, ...data };
  }

  async remove(id: string) {
    const tenantId = TenantContext.requireCurrentTenant();
    const op = await this.findOne(id);
    // TODO: 检查是否被工艺路线引用，如果被引用可以考虑禁止删除或软删除
    await this.repo.delete(id);
  }
}
