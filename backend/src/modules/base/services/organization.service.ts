import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SysOrganization } from '../entities/sys-organization.entity.js';
import { TenantContext } from '../../../shared/tenant/tenant.context.js';
import { sanitizeUpdateData } from '../../../shared/utils/sanitize.js';

export interface OrgTreeNode extends SysOrganization {
  children: OrgTreeNode[];
}

@Injectable()
export class OrganizationService {
  constructor(
    @InjectRepository(SysOrganization)
    private readonly repo: Repository<SysOrganization>,
  ) {}

  async getTree(type?: string): Promise<OrgTreeNode[]> {
    const tenantId = TenantContext.requireCurrentTenant();
    const where: Partial<SysOrganization> = { tenantId, status: 'ACTIVE' };
    if (type) where.type = type;

    const all = await this.repo.find({
      where,
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
    return this.buildTree(all);
  }

  private buildTree(
    nodes: SysOrganization[],
    parentId?: string,
  ): OrgTreeNode[] {
    return nodes
      .filter((n) => (parentId ? n.parentId === parentId : !n.parentId))
      .map((n) => ({ ...n, children: this.buildTree(nodes, n.id) }));
  }

  async create(data: Partial<SysOrganization>): Promise<SysOrganization> {
    const tenantId = TenantContext.requireCurrentTenant();
    data.tenantId = tenantId;

    if (data.parentId) {
      const parent = await this.repo.findOne({
        where: { id: data.parentId, tenantId },
      });
      if (!parent) throw new NotFoundException('BASE_ORG_PARENT_NOT_FOUND');
      data.level = parent.level + 1;
      // path 在保存后更新（需要先获取 id）
    } else {
      data.level = 1;
    }

    const saved = await this.repo.save(this.repo.create(data));

    // 更新 path
    const path = data.parentId
      ? `${(await this.repo.findOne({ where: { id: data.parentId } }))?.path ?? data.parentId}/${saved.id}`
      : saved.id;
    await this.repo.update(saved.id, { path });
    saved.path = path;

    return saved;
  }

  async update(
    id: string,
    data: Partial<SysOrganization>,
  ): Promise<SysOrganization> {
    const tenantId = TenantContext.requireCurrentTenant();
    const org = await this.repo.findOne({ where: { id, tenantId } });
    if (!org) throw new NotFoundException('BASE_ORG_NOT_FOUND');
    await this.repo.update(id, sanitizeUpdateData(data) as any);
    return { ...org, ...data };
  }

  async delete(id: string): Promise<void> {
    const tenantId = TenantContext.requireCurrentTenant();
    const children = await this.repo.count({
      where: { parentId: id, tenantId },
    });
    if (children > 0) throw new BadRequestException('BASE_ORG_HAS_CHILDREN');
    await this.repo.softDelete({ id, tenantId });
  }
}
