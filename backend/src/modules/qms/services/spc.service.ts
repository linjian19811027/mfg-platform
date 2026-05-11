import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QmsSpcDataPoint } from '../entities/qms-spc-data-point.entity.js';
import { TenantContext } from '../../../shared/tenant/tenant.context.js';

export interface SpcStats {
  mean: number;
  range: number;
  stdDev: number;
  ucl: number; // 上控制限
  lcl: number; // 下控制限
  cpk: number;
  isOutOfControl: boolean;
}

@Injectable()
export class SpcService {
  constructor(
    @InjectRepository(QmsSpcDataPoint)
    private readonly repo: Repository<QmsSpcDataPoint>,
  ) {}

  async addDataPoint(params: {
    itemId: string;
    woId?: string;
    wooId?: string;
    actualValue: number;
    subgroupId?: number;
    operatorId?: string;
    chartType?: string;
  }): Promise<QmsSpcDataPoint> {
    const tenantId = TenantContext.requireCurrentTenant();

    // 计算控制状态
    const recentPoints = await this.repo.find({
      where: { tenantId, itemId: params.itemId } as any,
      order: { measuredAt: 'DESC' },
      take: 25,
    });

    const controlStatus = this.calcControlStatus(
      params.actualValue,
      recentPoints.map((p) => Number(p.actualValue)),
    );

    return this.repo.save(
      this.repo.create({
        tenantId,
        itemId: params.itemId,
        woId: params.woId,
        wooId: params.wooId,
        actualValue: params.actualValue,
        subgroupId: params.subgroupId,
        measuredAt: new Date(),
        operatorId: params.operatorId,
        chartType: params.chartType ?? 'X-R',
        controlStatus,
      }),
    );
  }

  async getChartData(
    itemId: string,
    limit = 50,
  ): Promise<{ points: QmsSpcDataPoint[]; stats: SpcStats }> {
    const tenantId = TenantContext.requireCurrentTenant();
    const points = await this.repo.find({
      where: { tenantId, itemId } as any,
      order: { measuredAt: 'DESC' },
      take: limit,
    });

    const values = points.map((p) => Number(p.actualValue));
    const stats = this.calcStats(values);

    return { points: points.reverse(), stats };
  }

  /** 计算 Cpk */
  calcCpk(values: number[], usl: number, lsl: number): number {
    if (values.length < 2) return 0;
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const stdDev = Math.sqrt(
      values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) /
        (values.length - 1),
    );
    if (stdDev === 0) return 999;
    const cpu = (usl - mean) / (3 * stdDev);
    const cpl = (mean - lsl) / (3 * stdDev);
    return Math.round(Math.min(cpu, cpl) * 100) / 100;
  }

  private calcStats(values: number[]): SpcStats {
    if (values.length === 0)
      return {
        mean: 0,
        range: 0,
        stdDev: 0,
        ucl: 0,
        lcl: 0,
        cpk: 0,
        isOutOfControl: false,
      };

    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const stdDev =
      values.length > 1
        ? Math.sqrt(
            values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) /
              (values.length - 1),
          )
        : 0;
    const range = Math.max(...values) - Math.min(...values);
    const ucl = mean + 3 * stdDev;
    const lcl = mean - 3 * stdDev;
    const isOutOfControl = values.some((v) => v > ucl || v < lcl);

    return {
      mean: Math.round(mean * 10000) / 10000,
      range,
      stdDev: Math.round(stdDev * 10000) / 10000,
      ucl,
      lcl,
      cpk: 0,
      isOutOfControl,
    };
  }

  private calcControlStatus(value: number, history: number[]): string {
    if (history.length < 5) return 'NORMAL';
    const stats = this.calcStats(history);
    if (value > stats.ucl || value < stats.lcl) return 'OUT_OF_CONTROL';
    // 连续 7 点同侧 → 趋势预警
    const last7 = history.slice(0, 7);
    if (
      last7.every((v) => v > stats.mean) ||
      last7.every((v) => v < stats.mean)
    )
      return 'WARNING';
    return 'NORMAL';
  }
}
