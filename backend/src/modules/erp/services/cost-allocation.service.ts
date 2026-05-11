import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ErpCostAllocation,
  AllocationMethod,
} from '../entities/erp-cost-allocation.entity.js';
import { ErpCostRecord } from '../entities/erp-cost-record.entity.js';

export interface AllocateByProductsInput {
  sourceCostId: string;
  period: string;
  method: 'BY_QTY' | 'BY_WEIGHT' | 'BY_VALUE';
  products: Array<{
    targetId: string;
    qty?: number;
    weight?: number;
    value?: number;
  }>;
}

export interface AllocateWipInput {
  sourceCostId: string;
  period: string;
  completedQty: number;
  totalQty: number;
}

export interface WipAllocationResult {
  finished: ErpCostAllocation;
  wip: ErpCostAllocation;
}

@Injectable()
export class CostAllocationService {
  private readonly logger = new Logger(CostAllocationService.name);

  constructor(
    @InjectRepository(ErpCostAllocation)
    private readonly allocationRepo: Repository<ErpCostAllocation>,
    @InjectRepository(ErpCostRecord)
    private readonly costRecordRepo: Repository<ErpCostRecord>,
  ) {}

  /**
   * 联副产品成本分摊
   * 按 BY_QTY / BY_WEIGHT / BY_VALUE 计算各产品分摊比例
   */
  async allocateByProducts(
    tenantId: string,
    input: AllocateByProductsInput,
  ): Promise<ErpCostAllocation[]> {
    const { sourceCostId, period, method, products } = input;

    const costRecord = await this.costRecordRepo.findOne({
      where: { tenantId, id: sourceCostId },
    });
    if (!costRecord) {
      throw new NotFoundException(
        `成本记录不存在：id=${sourceCostId}，tenantId=${tenantId}`,
      );
    }

    const totalCost = Number(costRecord.amount);

    // 计算各产品的分摊基数
    const bases = products.map((p) => {
      switch (method) {
        case 'BY_QTY':
          return Number(p.qty ?? 0);
        case 'BY_WEIGHT':
          return Number(p.weight ?? 0);
        case 'BY_VALUE':
          return Number(p.value ?? 0);
      }
    });

    const totalBase = bases.reduce((sum, b) => sum + b, 0);

    const allocationMethod = AllocationMethod[method];

    const allocations = products.map((product, i) => {
      const ratio = totalBase > 0 ? bases[i] / totalBase : 0;
      return this.allocationRepo.create({
        tenantId,
        sourceId: sourceCostId,
        targetId: product.targetId,
        allocationMethod,
        allocationRatio: ratio,
        amount: totalCost * ratio,
        period,
      });
    });

    const saved = await this.allocationRepo.save(allocations);
    this.logger.log(
      `联副产品分摊完成：sourceCostId=${sourceCostId}，method=${method}，` +
        `产品数=${products.length}，总成本=${totalCost}`,
    );
    return saved;
  }

  /**
   * 在制品成本分摊（完工比例法）
   * 完工品 = totalCost * completionRate
   * 在制品 = totalCost * (1 - completionRate)
   */
  async allocateWip(
    tenantId: string,
    input: AllocateWipInput,
  ): Promise<WipAllocationResult> {
    const { sourceCostId, period, completedQty, totalQty } = input;

    const costRecord = await this.costRecordRepo.findOne({
      where: { tenantId, id: sourceCostId },
    });
    if (!costRecord) {
      throw new NotFoundException(
        `成本记录不存在：id=${sourceCostId}，tenantId=${tenantId}`,
      );
    }

    const totalCost = Number(costRecord.amount);
    const completionRate = totalQty > 0 ? completedQty / totalQty : 0;

    const finishedRecord = this.allocationRepo.create({
      tenantId,
      sourceId: sourceCostId,
      targetId: 'FINISHED',
      allocationMethod: AllocationMethod.BY_COMPLETION,
      allocationRatio: completionRate,
      amount: totalCost * completionRate,
      period,
    });

    const wipRecord = this.allocationRepo.create({
      tenantId,
      sourceId: sourceCostId,
      targetId: 'WIP',
      allocationMethod: AllocationMethod.BY_COMPLETION,
      allocationRatio: 1 - completionRate,
      amount: totalCost * (1 - completionRate),
      period,
    });

    const [finished, wip] = await this.allocationRepo.save([
      finishedRecord,
      wipRecord,
    ]);

    this.logger.log(
      `在制品分摊完成：sourceCostId=${sourceCostId}，` +
        `completionRate=${completionRate.toFixed(4)}，` +
        `完工=${finished.amount}，在制=${wip.amount}`,
    );

    return { finished, wip };
  }

  /**
   * 查询期间的所有分摊记录
   */
  async findByPeriod(
    tenantId: string,
    period: string,
  ): Promise<ErpCostAllocation[]> {
    return this.allocationRepo.find({
      where: { tenantId, period },
      order: { createdAt: 'ASC' },
    });
  }
}
