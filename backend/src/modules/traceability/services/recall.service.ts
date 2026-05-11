import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { TraceRecallAssessment } from '../entities/trace-recall-assessment.entity.js';
import { TraceBatch } from '../entities/trace-batch.entity.js';
import { ForwardTraceService } from './forward-trace.service.js';
import { BackwardTraceService } from './backward-trace.service.js';
import {
  MESSAGE_SERVICE,
  MessageService,
} from '../../../shared/message/message.interface.js';
import { EventTypes } from '../../event/event-types.constant.js';

export interface RecallAssessmentQueryDto {
  page?: number;
  pageSize?: number;
  status?: string;
}

@Injectable()
export class RecallService {
  constructor(
    @InjectRepository(TraceRecallAssessment)
    private readonly assessmentRepo: Repository<TraceRecallAssessment>,
    @InjectRepository(TraceBatch)
    private readonly batchRepo: Repository<TraceBatch>,
    private readonly forwardTrace: ForwardTraceService,
    private readonly backwardTrace: BackwardTraceService,
    @Inject(MESSAGE_SERVICE)
    private readonly messageSvc: MessageService,
  ) {}

  async assess(
    tenantId: string,
    problemBatchId: string,
    operatorId: string,
  ): Promise<TraceRecallAssessment> {
    const problemBatch = await this.batchRepo.findOne({
      where: { id: problemBatchId, tenantId },
    });
    if (!problemBatch) throw new NotFoundException('TRACE_BATCH_NOT_FOUND');

    // Generate assessment number
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const prefix = `RA-${dateStr}-`;
    const count = await this.assessmentRepo.count({ where: { tenantId } });
    const assessmentNo = `${prefix}${String(count + 1).padStart(4, '0')}`;

    // Create assessment record
    const assessment = await this.assessmentRepo.save(
      this.assessmentRepo.create({
        tenantId,
        assessmentNo,
        problemBatchId,
        status: 'CALCULATING',
        operatorId,
      }),
    );

    // Run forward + backward trace
    try {
      const [forwardResult, backwardResult] = await Promise.all([
        this.forwardTrace.trace(
          tenantId,
          problemBatchId,
          undefined,
          operatorId,
        ),
        this.backwardTrace.trace(tenantId, problemBatchId, operatorId),
      ]);

      const allNodes = [...forwardResult.nodes, ...backwardResult.nodes];
      const uniqueNodes = Array.from(
        new Map(allNodes.map((n) => [n.batchId, n])).values(),
      );

      // Risk classification
      let highRiskCount = 0; // SHIPPED
      let mediumRiskCount = 0; // IN_STOCK
      let lowRiskCount = 0; // others (in production)
      let inStockQty = 0;
      const inStockBatchIds: string[] = [];
      const soIds = new Set<string>();
      const supplierBatchIds = new Set<string>();

      for (const node of uniqueNodes) {
        if (node.inventoryStatus === 'SHIPPED') {
          highRiskCount++;
        } else if (node.inventoryStatus === 'IN_STOCK') {
          mediumRiskCount++;
          inStockBatchIds.push(node.batchId);
          // Accumulate in-stock qty
          const batch = await this.batchRepo.findOne({
            where: { id: node.batchId, tenantId },
          });
          if (batch) inStockQty += Number(batch.actualQty);
        } else {
          lowRiskCount++;
        }

        if (node.erpSoId) soIds.add(node.erpSoId);
      }

      // Publish freeze request for in-stock batches
      if (inStockBatchIds.length > 0) {
        await this.messageSvc.publish({
          eventId: uuidv4(),
          eventType: EventTypes.RECALL_FREEZE_REQUEST,
          tenantId,
          sourceModule: 'TRACEABILITY',
          targetModule: 'WMS',
          payload: { assessmentNo, batchIds: inStockBatchIds },
          createdAt: new Date(),
        });
      }

      // Update assessment to COMPLETED
      await this.assessmentRepo.update(assessment.id, {
        status: 'COMPLETED',
        affectedOutputBatches: forwardResult.nodeCount,
        affectedInputBatches: backwardResult.nodeCount,
        affectedSoCount: soIds.size,
        inStockQty,
        highRiskCount,
        mediumRiskCount,
        lowRiskCount,
        completedAt: new Date(),
      });
    } catch (err) {
      await this.assessmentRepo.update(assessment.id, { status: 'FAILED' });
      throw err;
    }

    return this.assessmentRepo.findOne({
      where: { id: assessment.id },
    }) as Promise<TraceRecallAssessment>;
  }

  async getProgress(
    tenantId: string,
    assessmentId: string,
  ): Promise<TraceRecallAssessment> {
    const assessment = await this.assessmentRepo.findOne({
      where: { id: assessmentId, tenantId },
    });
    if (!assessment) throw new NotFoundException('RECALL_ASSESSMENT_NOT_FOUND');
    return assessment;
  }

  async findAll(tenantId: string, query: RecallAssessmentQueryDto) {
    const { page = 1, pageSize = 20, status } = query;
    const qb = this.assessmentRepo
      .createQueryBuilder('a')
      .where('a.tenant_id = :tenantId', { tenantId });
    if (status) qb.andWhere('a.status = :status', { status });

    const [items, total] = await qb
      .orderBy('a.created_at', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { items, total, page, pageSize };
  }

  async findOne(tenantId: string, id: string): Promise<TraceRecallAssessment> {
    const assessment = await this.assessmentRepo.findOne({
      where: { id, tenantId },
    });
    if (!assessment) throw new NotFoundException('RECALL_ASSESSMENT_NOT_FOUND');
    return assessment;
  }
}
