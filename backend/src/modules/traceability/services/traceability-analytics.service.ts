import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TraceBatch } from '../entities/trace-batch.entity.js';
import { TraceQueryLog } from '../entities/trace-query-log.entity.js';
import { TraceRecallAssessment } from '../entities/trace-recall-assessment.entity.js';

export interface CoverageQueryDto {
  startDate?: Date;
  endDate?: Date;
  materialCategory?: string;
}

@Injectable()
export class TraceabilityAnalyticsService {
  constructor(
    @InjectRepository(TraceBatch)
    private readonly batchRepo: Repository<TraceBatch>,
    @InjectRepository(TraceQueryLog)
    private readonly queryLogRepo: Repository<TraceQueryLog>,
    @InjectRepository(TraceRecallAssessment)
    private readonly assessmentRepo: Repository<TraceRecallAssessment>,
  ) {}

  async getDashboard(tenantId: string) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [newBatchCount, queryCount, frozenCount, pendingRecallCount] =
      await Promise.all([
        this.batchRepo
          .createQueryBuilder('b')
          .where('b.tenant_id = :tenantId', { tenantId })
          .andWhere('b.created_at >= :monthStart', { monthStart })
          .getCount(),

        this.queryLogRepo
          .createQueryBuilder('q')
          .where('q.tenant_id = :tenantId', { tenantId })
          .andWhere('q.created_at >= :monthStart', { monthStart })
          .getCount(),

        this.batchRepo
          .createQueryBuilder('b')
          .where('b.tenant_id = :tenantId', { tenantId })
          .andWhere('b.is_frozen = 1')
          .getCount(),

        this.assessmentRepo
          .createQueryBuilder('a')
          .where('a.tenant_id = :tenantId', { tenantId })
          .andWhere('a.status = :status', { status: 'CALCULATING' })
          .getCount(),
      ]);

    return { newBatchCount, queryCount, frozenCount, pendingRecallCount };
  }

  async getCoverage(tenantId: string, query: CoverageQueryDto) {
    const { startDate, endDate } = query;
    const qb = this.batchRepo
      .createQueryBuilder('b')
      .select('COUNT(*)', 'total')
      .addSelect(
        'SUM(CASE WHEN b.inspection_status != :pending THEN 1 ELSE 0 END)',
        'inspected',
      )
      .where('b.tenant_id = :tenantId', { tenantId, pending: 'PENDING' });

    if (startDate) qb.andWhere('b.created_at >= :startDate', { startDate });
    if (endDate) qb.andWhere('b.created_at <= :endDate', { endDate });

    const result = await qb.getRawOne();
    const total = Number(result?.total ?? 0);
    const inspected = Number(result?.inspected ?? 0);
    const coverageRate =
      total > 0 ? Math.round((inspected / total) * 10000) / 100 : 0;

    return { total, inspected, coverageRate };
  }

  async consistencyCheck(tenantId: string) {
    const [totalBatches, frozenBatches, archivedBatches] = await Promise.all([
      this.batchRepo.count({ where: { tenantId } }),
      this.batchRepo.count({ where: { tenantId, isFrozen: 1 } }),
      this.batchRepo.count({ where: { tenantId, isArchived: 1 } }),
    ]);

    return {
      totalBatches,
      frozenBatches,
      archivedBatches,
      activeBatches: totalBatches - archivedBatches,
      checkedAt: new Date(),
    };
  }
}
