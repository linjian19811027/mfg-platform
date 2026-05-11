import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ErpCostCenter,
  CostCenterType,
  CostCenterStatus,
} from '../entities/erp-cost-center.entity.js';

export interface CostCenterQuery {
  centerType?: CostCenterType;
  status?: CostCenterStatus;
  keyword?: string;
  page?: number;
  pageSize?: number;
}

export type CostCenterTreeNode = ErpCostCenter & {
  children: CostCenterTreeNode[];
};

@Injectable()
export class CostCenterService {
  constructor(
    @InjectRepository(ErpCostCenter)
    private readonly costCenterRepo: Repository<ErpCostCenter>,
  ) {}

  async create(
    tenantId: string,
    data: Partial<ErpCostCenter>,
  ): Promise<ErpCostCenter> {
    let level = 1;

    if (data.parentId) {
      const parent = await this.costCenterRepo.findOne({
        where: { id: data.parentId, tenantId },
      });
      if (!parent) {
        throw new NotFoundException(`父成本中心 ${data.parentId} 不存在`);
      }
      level = parent.level + 1;
    }

    const center = this.costCenterRepo.create({ ...data, tenantId, level });
    return this.costCenterRepo.save(center);
  }

  async findAll(
    tenantId: string,
    query: CostCenterQuery = {},
  ): Promise<{ items: ErpCostCenter[]; total: number }> {
    const { centerType, status, keyword, page = 1, pageSize = 20 } = query;

    const qb = this.costCenterRepo
      .createQueryBuilder('c')
      .where('c.tenantId = :tenantId', { tenantId });

    if (centerType) qb.andWhere('c.centerType = :centerType', { centerType });
    if (status) qb.andWhere('c.status = :status', { status });
    if (keyword) {
      qb.andWhere('(c.code LIKE :kw OR c.name LIKE :kw)', {
        kw: `%${keyword}%`,
      });
    }

    qb.orderBy('c.code', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async findOne(tenantId: string, id: string): Promise<ErpCostCenter> {
    const center = await this.costCenterRepo.findOne({
      where: { id, tenantId },
    });
    if (!center) {
      throw new NotFoundException(`成本中心 ${id} 不存在`);
    }
    return center;
  }

  async update(
    tenantId: string,
    id: string,
    data: Partial<ErpCostCenter>,
  ): Promise<ErpCostCenter> {
    const center = await this.findOne(tenantId, id);
    Object.assign(center, data);
    return this.costCenterRepo.save(center);
  }

  async buildTree(tenantId: string): Promise<CostCenterTreeNode[]> {
    const all = await this.costCenterRepo.find({
      where: { tenantId },
      order: { code: 'ASC' },
    });

    const map = new Map<string, CostCenterTreeNode>();
    for (const item of all) {
      map.set(item.id, { ...item, children: [] });
    }

    const roots: CostCenterTreeNode[] = [];
    for (const node of map.values()) {
      if (node.parentId) {
        const parent = map.get(node.parentId);
        if (parent) {
          parent.children.push(node);
        } else {
          roots.push(node);
        }
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  async getChildren(
    tenantId: string,
    parentId: string,
  ): Promise<ErpCostCenter[]> {
    return this.costCenterRepo.find({
      where: { tenantId, parentId },
      order: { code: 'ASC' },
    });
  }
}
