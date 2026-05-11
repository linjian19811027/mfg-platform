import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ErpStandardCost,
  StandardCostStatus,
} from '../entities/erp-standard-cost.entity.js';

const LABOR_RATE = 50; // 固定工资率：50 元/小时

export interface StandardCostQuery {
  materialId?: string;
  status?: StandardCostStatus;
  page?: number;
  pageSize?: number;
}

export interface BomLine {
  materialId: string;
  qty: number;
  unitCost: number;
}

export interface CreateStandardCostDto {
  materialId: string;
  version: string;
  materialCost: number;
  laborCost: number;
  overheadCost: number;
  effectiveFrom: string;
  effectiveTo?: string;
}

@Injectable()
export class StandardCostService {
  constructor(
    @InjectRepository(ErpStandardCost)
    private readonly repo: Repository<ErpStandardCost>,
  ) {}

  async create(
    tenantId: string,
    data: CreateStandardCostDto,
  ): Promise<ErpStandardCost> {
    const totalCost =
      Number(data.materialCost) +
      Number(data.laborCost) +
      Number(data.overheadCost);

    // 将同一物料的旧 ACTIVE 版本设为 INACTIVE
    await this.repo.update(
      {
        tenantId,
        materialId: data.materialId,
        status: StandardCostStatus.ACTIVE,
      },
      { status: StandardCostStatus.INACTIVE },
    );

    const entity = this.repo.create({
      ...data,
      tenantId,
      totalCost,
      status: StandardCostStatus.ACTIVE,
    });

    return this.repo.save(entity);
  }

  async findAll(
    tenantId: string,
    query: StandardCostQuery = {},
  ): Promise<{ items: ErpStandardCost[]; total: number }> {
    const { materialId, status, page = 1, pageSize = 20 } = query;

    const qb = this.repo
      .createQueryBuilder('sc')
      .where('sc.tenantId = :tenantId', { tenantId });

    if (materialId) qb.andWhere('sc.materialId = :materialId', { materialId });
    if (status) qb.andWhere('sc.status = :status', { status });

    qb.orderBy('sc.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async findOne(tenantId: string, id: string): Promise<ErpStandardCost> {
    const record = await this.repo.findOne({ where: { id, tenantId } });
    if (!record) {
      throw new NotFoundException(`标准成本 ${id} 不存在`);
    }
    return record;
  }

  async getActive(
    tenantId: string,
    materialId: string,
  ): Promise<ErpStandardCost | null> {
    return this.repo.findOne({
      where: { tenantId, materialId, status: StandardCostStatus.ACTIVE },
    });
  }

  async calculateFromBom(
    tenantId: string,
    materialId: string,
    bomLines: BomLine[],
    laborQuota: number,
    overheadRate: number,
  ): Promise<ErpStandardCost> {
    const materialCost = bomLines.reduce(
      (sum, line) => sum + line.qty * line.unitCost,
      0,
    );
    const laborCost = laborQuota * LABOR_RATE;
    const overheadCost = laborQuota * overheadRate;

    const version = `BOM-${new Date().toISOString().slice(0, 10)}`;

    return this.create(tenantId, {
      materialId,
      version,
      materialCost,
      laborCost,
      overheadCost,
      effectiveFrom: new Date().toISOString().slice(0, 10),
    });
  }

  async expire(tenantId: string, id: string): Promise<ErpStandardCost> {
    const record = await this.findOne(tenantId, id);
    if (record.status === StandardCostStatus.INACTIVE) {
      return record;
    }
    record.status = StandardCostStatus.INACTIVE;
    return this.repo.save(record);
  }
}
