import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QmsInspectionStandard } from '../entities/qms-inspection-standard.entity.js';
import { TenantContext } from '../../../shared/tenant/tenant.context.js';

@Injectable()
export class InspectionStandardService {
  constructor(
    @InjectRepository(QmsInspectionStandard)
    private readonly repo: Repository<QmsInspectionStandard>,
  ) {}

  async findAll(query: {
    materialId?: string;
    inspectionType?: string;
    status?: string;
  }) {
    const tenantId = TenantContext.requireCurrentTenant();
    const qb = this.repo
      .createQueryBuilder('s')
      .where('s.tenant_id = :tenantId', { tenantId });
    if (query.materialId)
      qb.andWhere('s.material_id = :mat', { mat: query.materialId });
    if (query.inspectionType)
      qb.andWhere('s.inspection_type = :type', { type: query.inspectionType });
    if (query.status)
      qb.andWhere('s.status = :status', { status: query.status });
    return qb
      .orderBy('s.code', 'ASC')
      .addOrderBy('s.version', 'DESC')
      .getMany();
  }

  async findOne(id: string): Promise<QmsInspectionStandard> {
    const tenantId = TenantContext.requireCurrentTenant();
    const std = await this.repo.findOne({ where: { id, tenantId } });
    if (!std) throw new NotFoundException('QMS_STANDARD_NOT_FOUND');
    return std;
  }

  async create(
    data: Partial<QmsInspectionStandard>,
  ): Promise<QmsInspectionStandard> {
    const tenantId = TenantContext.requireCurrentTenant();
    data.tenantId = tenantId;
    data.version = 1;
    data.status = 'ACTIVE';
    if (!data.items) data.items = [];
    return this.repo.save(this.repo.create(data));
  }

  /** 创建新版本（保留旧版本历史） */
  async createVersion(
    id: string,
    changes: Partial<QmsInspectionStandard>,
    changeReason?: string,
  ): Promise<QmsInspectionStandard> {
    const tenantId = TenantContext.requireCurrentTenant();
    const current = await this.repo.findOne({ where: { id, tenantId } });
    if (!current) throw new NotFoundException('QMS_STANDARD_NOT_FOUND');

    // 废止当前版本
    await this.repo.update(id, { status: 'OBSOLETE' });

    // 记录变更历史
    const history = [
      ...(current.changeHistory ?? []),
      {
        version: current.version,
        changedAt: new Date().toISOString(),
        reason: changeReason,
        snapshot: { items: current.items, samplingPlan: current.samplingPlan },
      },
    ];

    // 创建新版本
    return this.repo.save(
      this.repo.create({
        ...current,
        id: undefined as any,
        version: current.version + 1,
        status: 'ACTIVE',
        changeHistory: history,
        ...changes,
      }),
    );
  }

  async findEffective(
    materialId: string,
    inspectionType: string,
  ): Promise<QmsInspectionStandard | null> {
    const tenantId = TenantContext.requireCurrentTenant();
    const today = new Date().toISOString().split('T')[0];
    return this.repo
      .createQueryBuilder('s')
      .where(
        's.tenant_id = :tenantId AND s.material_id = :mat AND s.inspection_type = :type AND s.status = :status',
        { tenantId, mat: materialId, type: inspectionType, status: 'ACTIVE' },
      )
      .andWhere('(s.effective_date IS NULL OR s.effective_date <= :today)', {
        today,
      })
      .orderBy('s.version', 'DESC')
      .getOne();
  }
}
