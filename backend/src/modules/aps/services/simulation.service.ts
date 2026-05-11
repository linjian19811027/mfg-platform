import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApsSchedule } from '../entities/aps-schedule.entity';
import {
  SchedulerService,
  ScheduleInput,
  ScheduleForwardOptions,
  ScheduledResult,
} from './scheduler.service';

export interface SimulationScenario {
  scenarioName: string;
  inputs: ScheduleInput[];
  options: ScheduleForwardOptions;
}

export interface SimulationMetrics {
  totalOrders: number;
  onTimeCount: number;
  avgDelayHours: number;
  makespan: number;
}

export interface SimulationResult {
  scenarioName: string;
  schedules: ScheduledResult[];
  metrics: SimulationMetrics;
}

export interface RankedSimulationResult extends SimulationResult {
  rank: number;
  recommended: boolean;
}

@Injectable()
export class SimulationService {
  constructor(
    @InjectRepository(ApsSchedule)
    private readonly scheduleRepo: Repository<ApsSchedule>,
    private readonly schedulerService: SchedulerService,
  ) {}

  /**
   * What-if 排程模拟：对每个方案执行正向排程（isSimulation=true），
   * 收集结果后清理模拟数据，返回各方案的排程结果与指标。
   */
  async simulate(
    tenantId: string,
    scenarios: SimulationScenario[],
  ): Promise<SimulationResult[]> {
    const results: SimulationResult[] = [];

    try {
      for (const scenario of scenarios) {
        const schedules = await this.schedulerService.scheduleForward(
          tenantId,
          scenario.inputs,
          { ...scenario.options, isSimulation: true },
        );

        const metrics = this._calcMetrics(schedules, scenario.inputs);

        results.push({
          scenarioName: scenario.scenarioName,
          schedules,
          metrics,
        });
      }
    } finally {
      // 无论成功或失败，都清理本租户的模拟数据
      await this.scheduleRepo
        .createQueryBuilder()
        .delete()
        .from(ApsSchedule)
        .where('tenant_id = :tenantId', { tenantId })
        .andWhere('is_simulation = 1')
        .execute();
    }

    return results;
  }

  /**
   * 多方案对比：调用 simulate 后按 onTimeCount 降序、avgDelayHours 升序排列，
   * 标注排名与推荐方案（第一名）。
   */
  async compareScenarios(
    tenantId: string,
    scenarios: SimulationScenario[],
  ): Promise<RankedSimulationResult[]> {
    const results = await this.simulate(tenantId, scenarios);

    const sorted = [...results].sort((a, b) => {
      if (b.metrics.onTimeCount !== a.metrics.onTimeCount) {
        return b.metrics.onTimeCount - a.metrics.onTimeCount;
      }
      return a.metrics.avgDelayHours - b.metrics.avgDelayHours;
    });

    return sorted.map((result, index) => ({
      ...result,
      rank: index + 1,
      recommended: index === 0,
    }));
  }

  // ─── 私有：计算模拟指标 ────────────────────────────────────────────────────

  private _calcMetrics(
    schedules: ScheduledResult[],
    inputs: ScheduleInput[],
  ): SimulationMetrics {
    const totalOrders = schedules.length;

    // 建立 woId -> deliveryDate 映射
    const deliveryMap = new Map<string, Date>();
    for (const input of inputs) {
      if (input.deliveryDate) {
        deliveryMap.set(input.woId, input.deliveryDate);
      }
    }

    let onTimeCount = 0;
    let totalDelayHours = 0;

    for (const s of schedules) {
      const deliveryDate = deliveryMap.get(s.woId);
      if (!deliveryDate) continue;

      const delayMs = s.estimatedDelivery.getTime() - deliveryDate.getTime();
      const delayHours = delayMs / (60 * 60 * 1000);

      if (delayHours <= 0) {
        onTimeCount++;
      } else {
        totalDelayHours += delayHours;
      }
    }

    const avgDelayHours = totalOrders > 0 ? totalDelayHours / totalOrders : 0;

    // makespan = 最后一个 scheduledEnd - 第一个 scheduledStart（小时）
    let makespan = 0;
    if (schedules.length > 0) {
      const starts = schedules.map((s) => s.scheduledStart.getTime());
      const ends = schedules.map((s) => s.scheduledEnd.getTime());
      const minStart = Math.min(...starts);
      const maxEnd = Math.max(...ends);
      makespan = (maxEnd - minStart) / (60 * 60 * 1000);
    }

    return { totalOrders, onTimeCount, avgDelayHours, makespan };
  }
}
