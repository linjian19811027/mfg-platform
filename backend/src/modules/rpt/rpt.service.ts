import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RptReportDefinition } from './entities/rpt-report-definition.entity.js';
import { TenantContext } from '../../shared/tenant/tenant.context.js';

@Injectable()
export class RptService {
  constructor(
    @InjectRepository(RptReportDefinition)
    private readonly repo: Repository<RptReportDefinition>,
  ) {}

  async findAll(query: { type?: string; isTemplate?: number; page?: number; pageSize?: number }) {
    const tenantId = TenantContext.requireCurrentTenant();
    const { type, isTemplate, page = 1, pageSize = 20 } = query;

    const qb = this.repo.createQueryBuilder('r')
      .where('r.tenant_id = :tenantId', { tenantId });

    if (type) qb.andWhere('r.type = :type', { type });
    if (isTemplate !== undefined) qb.andWhere('r.is_template = :isTemplate', { isTemplate });

    qb.orderBy('r.updated_at', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const { entities, raw } = await qb.getRawAndEntities();
    const total = await qb.getCount();
    return { items: entities, total };
  }

  async findOne(id: string) {
    const tenantId = TenantContext.requireCurrentTenant();
    const report = await this.repo.findOne({ where: { id, tenantId } });
    if (!report) throw new NotFoundException('REPORT_NOT_FOUND');
    return report;
  }

  async create(data: Record<string, unknown>) {
    const tenantId = TenantContext.requireCurrentTenant();
    const report = this.repo.create({
      ...data,
      tenantId,
      status: 'ACTIVE',
    } as any);
    return this.repo.save(report);
  }

  async update(id: string, data: Record<string, unknown>) {
    const tenantId = TenantContext.requireCurrentTenant();
    const report = await this.repo.findOne({ where: { id, tenantId } });
    if (!report) throw new NotFoundException('REPORT_NOT_FOUND');
    await this.repo.update(id, data as any);
    return this.repo.findOne({ where: { id } });
  }

  async delete(id: string) {
    const tenantId = TenantContext.requireCurrentTenant();
    await this.repo.softDelete({ id, tenantId });
  }

  async getTemplates() {
    return this.repo.find({
      where: { isTemplate: 1 as any, status: 'ACTIVE' },
      order: { name: 'ASC' },
    });
  }
}
