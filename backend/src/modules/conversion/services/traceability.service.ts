import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CiInput } from '../entities/conversion-instance.entity.js';
import { CiOutput } from '../entities/conversion-instance.entity.js';
import { MaterialBatch } from '../../base/entities/material-batch.entity.js';
import {
  CACHE_PROVIDER,
  CacheProvider,
} from '../../../shared/cache/cache.interface.js';

export interface TraceabilityNode {
  batchId: string;
  batchNo?: string;
  materialId?: string;
  sourceType?: string;
  quantity?: number;
  producedAt?: Date;
  qualityStatus?: string;
  error?: string;
  children?: TraceabilityNode[]; // 正向追溯
  usedIn?: TraceabilityNode[]; // 反向追溯
}

const MAX_DEPTH = 20;
const CACHE_TTL = 300;

@Injectable()
export class TraceabilityService {
  constructor(
    @InjectRepository(CiInput)
    private readonly ciInputRepo: Repository<CiInput>,
    @InjectRepository(CiOutput)
    private readonly ciOutputRepo: Repository<CiOutput>,
    @InjectRepository(MaterialBatch)
    private readonly batchRepo: Repository<MaterialBatch>,
    @Inject(CACHE_PROVIDER) private readonly cache: CacheProvider,
  ) {}

  // 正向追溯：产出批次 → 输入批次 → 更上游
  async traceForward(
    batchId: string,
    tenantId: string,
  ): Promise<TraceabilityNode> {
    const visited = new Set<string>();
    return this.traceForwardRecursive(batchId, tenantId, 0, visited);
  }

  private async traceForwardRecursive(
    batchId: string,
    tenantId: string,
    depth: number,
    visited: Set<string>,
  ): Promise<TraceabilityNode> {
    if (depth > MAX_DEPTH) {
      return { batchId, error: 'MAX_DEPTH_EXCEEDED' };
    }
    if (visited.has(batchId)) {
      return { batchId, error: 'CIRCULAR_REFERENCE' };
    }

    const cacheKey = `trace:fwd:${tenantId}:${batchId}`;
    const cached = await this.cache.get<TraceabilityNode>(cacheKey);
    if (cached) return cached;

    visited.add(batchId);

    const batch = await this.batchRepo.findOne({
      where: { id: batchId, tenantId },
    });
    const node: TraceabilityNode = {
      batchId,
      batchNo: batch?.batchNo,
      materialId: batch?.materialId,
      sourceType: batch?.sourceType,
      quantity: batch ? Number(batch.currentQty) : undefined,
      producedAt: batch?.producedAt,
      qualityStatus: batch?.qualityStatus,
      children: [],
    };

    // 采购批次是叶节点，追溯终止
    if (batch?.sourceType === 'PURCHASE') {
      await this.cache.set(cacheKey, node, CACHE_TTL);
      return node;
    }

    // 找到以此批次为输出的转换实例输入
    const ciOutput = await this.ciOutputRepo.findOne({
      where: { batchId, tenantId },
    });
    if (ciOutput) {
      const inputs = await this.ciInputRepo.find({
        where: { ciId: ciOutput.ciId, tenantId },
      });
      for (const input of inputs) {
        if (input.batchId) {
          const child = await this.traceForwardRecursive(
            input.batchId,
            tenantId,
            depth + 1,
            visited,
          );
          node.children!.push(child);
        }
      }
    }

    await this.cache.set(cacheKey, node, CACHE_TTL);
    return node;
  }

  // 反向追溯：输入批次 → 产出批次 → 下游
  async traceBackward(
    batchId: string,
    tenantId: string,
  ): Promise<TraceabilityNode> {
    const visited = new Set<string>();
    return this.traceBackwardRecursive(batchId, tenantId, 0, visited);
  }

  private async traceBackwardRecursive(
    batchId: string,
    tenantId: string,
    depth: number,
    visited: Set<string>,
  ): Promise<TraceabilityNode> {
    if (depth > MAX_DEPTH) return { batchId, error: 'MAX_DEPTH_EXCEEDED' };
    if (visited.has(batchId)) return { batchId, error: 'CIRCULAR_REFERENCE' };

    visited.add(batchId);

    const batch = await this.batchRepo.findOne({
      where: { id: batchId, tenantId },
    });
    const node: TraceabilityNode = {
      batchId,
      batchNo: batch?.batchNo,
      materialId: batch?.materialId,
      sourceType: batch?.sourceType,
      usedIn: [],
    };

    const ciInputs = await this.ciInputRepo.find({
      where: { batchId, tenantId },
    });
    for (const ciInput of ciInputs) {
      const outputs = await this.ciOutputRepo.find({
        where: { ciId: ciInput.ciId, tenantId },
      });
      for (const output of outputs) {
        if (output.batchId) {
          const child = await this.traceBackwardRecursive(
            output.batchId,
            tenantId,
            depth + 1,
            visited,
          );
          node.usedIn!.push(child);
        }
      }
    }

    return node;
  }
}
