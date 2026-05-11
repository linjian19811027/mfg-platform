import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ErpCostRecord, CostType } from '../entities/erp-cost-record.entity.js';
import {
  MESSAGE_SERVICE,
  MessageService,
} from '../../../shared/message/message.interface.js';

export interface CostSummary {
  materialTotal: number;
  laborTotal: number;
  overheadTotal: number;
  grandTotal: number;
}

@Injectable()
export class CostService implements OnModuleInit {
  private readonly logger = new Logger(CostService.name);

  constructor(
    @InjectRepository(ErpCostRecord)
    private readonly repo: Repository<ErpCostRecord>,
    @Inject(MESSAGE_SERVICE)
    private readonly messageService: MessageService,
  ) {}

  onModuleInit() {
    this.messageService.subscribe('PRODUCTION_COMPLETED', (event) =>
      this.handleProductionCompleted(event),
    );
    this.logger.log('CostService 已订阅事件：PRODUCTION_COMPLETED');
  }

  // ── 事件处理 ──────────────────────────────────────────────────────────────

  private async handleProductionCompleted(event: {
    payload: Record<string, unknown>;
    tenantId: string;
  }): Promise<void> {
    const { tenantId, payload } = event;
    const {
      ciId,
      materialId,
      costCenterId,
      materialCost = 0,
      laborCost = 0,
      overheadCost = 0,
    } = payload as {
      ciId: string;
      businessNo?: string;
      materialId: string;
      costCenterId?: string;
      materialCost?: number;
      laborCost?: number;
      overheadCost?: number;
    };

    const period = this.currentPeriod();

    try {
      const records = [
        this.repo.create({
          tenantId,
          ciId: String(ciId),
          materialId: String(materialId),
          costCenterId: costCenterId ? String(costCenterId) : undefined,
          costType: CostType.MATERIAL,
          amount: Number(materialCost),
          period,
        }),
        this.repo.create({
          tenantId,
          ciId: String(ciId),
          materialId: String(materialId),
          costCenterId: costCenterId ? String(costCenterId) : undefined,
          costType: CostType.LABOR,
          amount: Number(laborCost),
          period,
        }),
        this.repo.create({
          tenantId,
          ciId: String(ciId),
          materialId: String(materialId),
          costCenterId: costCenterId ? String(costCenterId) : undefined,
          costType: CostType.OVERHEAD,
          amount: Number(overheadCost),
          period,
        }),
      ];

      await this.repo.save(records);
      this.logger.log(
        `成本记录已归集：ciId=${ciId}，period=${period}，` +
          `material=${materialCost}，labor=${laborCost}，overhead=${overheadCost}`,
      );
    } catch (err) {
      this.logger.error(
        `成本归集失败（ciId=${ciId}）：${(err as Error).message}`,
      );
    }
  }

  // ── 查询方法 ──────────────────────────────────────────────────────────────

  /** 查询某转换实例的所有成本记录 */
  async findByCi(tenantId: string, ciId: string): Promise<ErpCostRecord[]> {
    return this.repo.find({
      where: { tenantId, ciId },
      order: { createdAt: 'ASC' },
    });
  }

  /** 查询某期间的所有成本记录 */
  async findByPeriod(
    tenantId: string,
    period: string,
  ): Promise<ErpCostRecord[]> {
    return this.repo.find({
      where: { tenantId, period },
      order: { createdAt: 'ASC' },
    });
  }

  /** 期间成本汇总：按 costType 分组统计 */
  async getCostSummary(tenantId: string, period: string): Promise<CostSummary> {
    const rows = await this.repo
      .createQueryBuilder('cr')
      .where('cr.tenantId = :tenantId', { tenantId })
      .andWhere('cr.period = :period', { period })
      .select('cr.costType', 'costType')
      .addSelect('SUM(cr.amount)', 'total')
      .groupBy('cr.costType')
      .getRawMany<{ costType: CostType; total: string }>();

    const map = new Map(rows.map((r) => [r.costType, Number(r.total) || 0]));

    const materialTotal = map.get(CostType.MATERIAL) ?? 0;
    const laborTotal = map.get(CostType.LABOR) ?? 0;
    const overheadTotal = map.get(CostType.OVERHEAD) ?? 0;

    return {
      materialTotal,
      laborTotal,
      overheadTotal,
      grandTotal: materialTotal + laborTotal + overheadTotal,
    };
  }

  // ── 辅助 ──────────────────────────────────────────────────────────────────

  private currentPeriod(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }
}
