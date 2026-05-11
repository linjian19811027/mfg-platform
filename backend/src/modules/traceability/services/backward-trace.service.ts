import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TraceBatch } from '../entities/trace-batch.entity.js';
import { TraceLink } from '../entities/trace-link.entity.js';
import { TraceQueryLog } from '../entities/trace-query-log.entity.js';
import { TraceNode } from './forward-trace.service.js';

export interface BackwardTraceResult {
  nodes: TraceNode[];
  truncated: boolean;
  nodeCount: number;
}

const MAX_DEPTH = 10;
const MAX_NODES = 500;

@Injectable()
export class BackwardTraceService {
  constructor(
    @InjectRepository(TraceBatch)
    private readonly batchRepo: Repository<TraceBatch>,
    @InjectRepository(TraceLink)
    private readonly linkRepo: Repository<TraceLink>,
    @InjectRepository(TraceQueryLog)
    private readonly queryLogRepo: Repository<TraceQueryLog>,
  ) {}

  async trace(
    tenantId: string,
    startBatchId: string,
    operatorId?: string,
  ): Promise<BackwardTraceResult> {
    const startTime = Date.now();
    const visited = new Set<string>();
    const queue: Array<{ batchId: string; depth: number }> = [
      { batchId: startBatchId, depth: 0 },
    ];
    const nodes: TraceNode[] = [];
    let truncated = false;

    while (queue.length > 0) {
      if (nodes.length >= MAX_NODES) {
        truncated = true;
        break;
      }

      const { batchId, depth } = queue.shift()!;

      if (visited.has(batchId) || depth > MAX_DEPTH) continue;
      visited.add(batchId);

      const batch = await this.batchRepo.findOne({
        where: { id: batchId, tenantId },
      });
      const node: TraceNode = batch
        ? {
            batchId: batch.id,
            traceCode: batch.traceCode,
            materialId: batch.materialId,
            materialCode: batch.materialCode,
            materialName: batch.materialName,
            batchNo: batch.batchNo,
            inspectionStatus: batch.inspectionStatus,
            inventoryStatus: batch.inventoryStatus,
            isFrozen: batch.isFrozen,
            erpSoId: batch.erpSoId ?? null,
            depth,
            missingData: false,
          }
        : {
            batchId,
            traceCode: '',
            materialId: '',
            materialCode: '',
            materialName: '',
            batchNo: '',
            inspectionStatus: 'PENDING',
            inventoryStatus: 'IN_STOCK',
            isFrozen: 0,
            erpSoId: null,
            depth,
            missingData: true,
          };

      nodes.push(node);

      // Find upstream links (this batch is output → find inputs)
      const links = await this.linkRepo.find({
        where: { tenantId, outputBatchId: batchId },
      });
      for (const link of links) {
        if (!visited.has(link.inputBatchId)) {
          queue.push({ batchId: link.inputBatchId, depth: depth + 1 });
        }
      }
    }

    const durationMs = Date.now() - startTime;

    await this.queryLogRepo.save(
      this.queryLogRepo.create({
        tenantId,
        queryType: 'BACKWARD',
        startPoint: startBatchId,
        resultNodeCount: nodes.length,
        durationMs,
        operatorId: operatorId,
      }),
    );

    return { nodes, truncated, nodeCount: nodes.length };
  }
}
