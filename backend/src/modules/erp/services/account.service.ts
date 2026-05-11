import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ErpAccount,
  AccountType,
  AccountStatus,
} from '../entities/erp-account.entity.js';

export interface AccountQuery {
  type?: AccountType;
  status?: AccountStatus;
  keyword?: string;
  page?: number;
  pageSize?: number;
}

export interface AuxiliaryDimensions {
  department?: boolean;
  project?: boolean;
  customer?: boolean;
  supplier?: boolean;
}

export type AccountTreeNode = ErpAccount & { children: AccountTreeNode[] };

@Injectable()
export class AccountService {
  constructor(
    @InjectRepository(ErpAccount)
    private readonly accountRepo: Repository<ErpAccount>,
  ) {}

  // ── CRUD ─────────────────────────────────────────────────────────────────

  async create(
    tenantId: string,
    data: Partial<ErpAccount>,
  ): Promise<ErpAccount> {
    let level = 1;

    if (data.parentId) {
      const parent = await this.accountRepo.findOne({
        where: { id: data.parentId, tenantId },
      });
      if (!parent) {
        throw new NotFoundException(`父科目 ${data.parentId} 不存在`);
      }
      level = parent.level + 1;
      // 父节点不再是叶子节点
      await this.accountRepo.update({ id: parent.id }, { isLeaf: 0 });
    }

    const account = this.accountRepo.create({
      ...data,
      tenantId,
      level,
      isLeaf: 1,
    });
    return this.accountRepo.save(account);
  }

  async findAll(
    tenantId: string,
    query: AccountQuery = {},
  ): Promise<{ items: ErpAccount[]; total: number }> {
    const { type, status, keyword, page = 1, pageSize = 20 } = query;

    const qb = this.accountRepo
      .createQueryBuilder('a')
      .where('a.tenantId = :tenantId', { tenantId });

    if (type) qb.andWhere('a.type = :type', { type });
    if (status) qb.andWhere('a.status = :status', { status });
    if (keyword) {
      qb.andWhere('(a.code LIKE :kw OR a.name LIKE :kw)', {
        kw: `%${keyword}%`,
      });
    }

    qb.orderBy('a.code', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async findOne(tenantId: string, id: string): Promise<ErpAccount> {
    const account = await this.accountRepo.findOne({ where: { id, tenantId } });
    if (!account) {
      throw new NotFoundException(`科目 ${id} 不存在`);
    }
    return account;
  }

  async update(
    tenantId: string,
    id: string,
    data: Partial<ErpAccount>,
  ): Promise<ErpAccount> {
    const account = await this.findOne(tenantId, id);
    Object.assign(account, data);
    return this.accountRepo.save(account);
  }

  // ── 科目树 ────────────────────────────────────────────────────────────────

  async buildTree(tenantId: string): Promise<AccountTreeNode[]> {
    const all = await this.accountRepo.find({
      where: { tenantId },
      order: { code: 'ASC' },
    });

    const map = new Map<string, AccountTreeNode>();
    for (const item of all) {
      map.set(item.id, { ...item, children: [] });
    }

    const roots: AccountTreeNode[] = [];
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

  // ── 按编码查询 ────────────────────────────────────────────────────────────

  async getByCode(tenantId: string, code: string): Promise<ErpAccount> {
    const account = await this.accountRepo.findOne({
      where: { code, tenantId },
    });
    if (!account) {
      throw new NotFoundException(`科目编码 ${code} 不存在`);
    }
    return account;
  }

  // ── 辅助核算维度 ──────────────────────────────────────────────────────────

  async updateAuxiliaryDimensions(
    tenantId: string,
    id: string,
    dimensions: AuxiliaryDimensions,
  ): Promise<ErpAccount> {
    const account = await this.findOne(tenantId, id);
    account.auxiliaryDimensions = {
      ...account.auxiliaryDimensions,
      ...dimensions,
    };
    return this.accountRepo.save(account);
  }
}
