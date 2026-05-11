import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TraceBatch } from '../entities/trace-batch.entity.js';
import { TraceLink } from '../entities/trace-link.entity.js';
import { TraceQueryLog } from '../entities/trace-query-log.entity.js';

export interface TraceNode {
  batchId: string;
  traceCode: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  batchNo: string;
  inspectionStatus: string;
  inventoryStatus: string;
  isFrozen: number;
  erpSoId: string | null;
  depth: number;
  missingData: boolean;
}

export interface TraceFilters {
  materialCode?: string;
  inventoryStatus?: string;
}

export interface ForwardTraceResult {
  nodes: TraceNode[];
  truncated: boolean;
  nodeCount: number;
}

const MAX_DEPTH = 10;
const MAX_NODES = 500;

@Injectable()
export class ForwardTraceService {
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
    filters?: TraceFilters,
    operatorId?: string,
  ): Promise<ForwardTraceResult> {
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

      // Apply filters
      if (
        filters?.materialCode &&
        node.materialCode &&
        !node.materialCode.includes(filters.materialCode)
      ) {
        // still traverse children but skip adding this node
      } else if (
        filters?.inventoryStatus &&
        node.inventoryStatus !== filters.inventoryStatus
      ) {
        // skip
      } else {
        nodes.push(node);
      }

      // Find downstream links (this batch is input → find outputs)
      const links = await this.linkRepo.find({
        where: { tenantId, inputBatchId: batchId },
      });
      for (const link of links) {
        if (!visited.has(link.outputBatchId)) {
          queue.push({ batchId: link.outputBatchId, depth: depth + 1 });
        }
      }
    }

    const durationMs = Date.now() - startTime;

    // Record query log
    await this.queryLogRepo.save(
      this.queryLogRepo.create({
        tenantId,
        queryType: 'FORWARD',
        startPoint: startBatchId,
        resultNodeCount: nodes.length,
        durationMs,
        operatorId: operatorId,
      }),
    );

    return { nodes, truncated, nodeCount: nodes.length };
  }
}
