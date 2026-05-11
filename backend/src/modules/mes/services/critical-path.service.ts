import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MesWorkOrder } from '../entities/mes-work-order.entity.js';
import {
  WorkOrderTreeNode,
  WorkOrderTreeService,
} from './work-order-tree.service.js';

export interface CriticalPathResult {
  criticalPath: WorkOrderTreeNode[];
  earliestFinishTime: Date | null;
  allNodes: WorkOrderTreeNode[];
}

@Injectable()
export class CriticalPathService {
  private readonly logger = new Logger(CriticalPathService.name);

  constructor(
    @InjectRepository(MesWorkOrder)
    private readonly woRepo: Repository<MesWorkOrder>,
    private readonly treeSvc: WorkOrderTreeService,
  ) {}

  // ── 3.2.1 正向计算 ES / EF ────────────────────────────────────────────────

  forwardPass(nodes: WorkOrderTreeNode[]): void {
    const map = new Map<string, WorkOrderTreeNode>();
    for (const n of nodes) map.set(n.id, n);

    // 拓扑排序（按 bomLevel 升序，父先于子）
    const sorted = [...nodes].sort((a, b) => a.bomLevel - b.bomLevel);

    for (const node of sorted) {
      const durationMs = this._durationMs(node);

      if (!node.parentWoId || !map.has(node.parentWoId)) {
        // 根节点：ES = plannedStart 或 now
        node.es = node.plannedStart ?? new Date();
      } else {
        const parent = map.get(node.parentWoId)!;
        // 子节点的 ES = 父节点的 EF（父完工后子才能开始）
        node.es = parent.ef ?? parent.plannedStart ?? new Date();
      }

      node.ef = new Date(node.es.getTime() + durationMs);
    }
  }

  // ── 3.2.2 反向计算 LS / LF ────────────────────────────────────────────────

  backwardPass(nodes: WorkOrderTreeNode[], projectEnd: Date): void {
    const map = new Map<string, WorkOrderTreeNode>();
    for (const n of nodes) map.set(n.id, n);

    // 反向：按 bomLevel 降序（叶先于根）
    const sorted = [...nodes].sort((a, b) => b.bomLevel - a.bomLevel);

    for (const node of sorted) {
      const durationMs = this._durationMs(node);

      // 找所有直接子节点
      const children = nodes.filter((n) => n.parentWoId === node.id);

      if (children.length === 0) {
        // 叶节点：LF = projectEnd
        node.lf = projectEnd;
      } else {
        // LF = 所有子节点 LS 的最小值
        const minChildLs = children.reduce((min, c) => {
          const ls = c.ls ?? projectEnd;
          return ls < min ? ls : min;
        }, projectEnd);
        node.lf = minChildLs;
      }

      node.ls = new Date(node.lf.getTime() - durationMs);
    }
  }

  // ── 3.2.3 标记关键工单（TF = 0） ─────────────────────────────────────────

  markCritical(nodes: WorkOrderTreeNode[]): WorkOrderTreeNode[] {
    for (const node of nodes) {
      if (node.es != null && node.ls != null) {
        const tfMs = node.ls.getTime() - node.es.getTime();
        node.totalFloat = Math.round((tfMs / (1000 * 3600)) * 100) / 100; // 小时，保留2位
        node.isCritical = tfMs <= 0 ? 1 : 0;
      } else {
        node.totalFloat = undefined;
        node.isCritical = 0;
      }
    }
    return nodes;
  }

  // ── 3.2.4 持久化 CPM 结果到数据库 ────────────────────────────────────────

  async persistCpmResult(
    tenantId: string,
    nodes: WorkOrderTreeNode[],
  ): Promise<void> {
    for (const node of nodes) {
      await this.woRepo.update(
        { id: node.id, tenantId },
        {
          es: node.es,
          ef: node.ef,
          ls: node.ls,
          lf: node.lf,
          totalFloat: node.totalFloat,
          isCritical: node.isCritical,
        },
      );
    }
    this.logger.log(
      `[CPM] Persisted CPM results for ${nodes.length} nodes (tenant=${tenantId})`,
    );
  }

  // ── 3.2.5 返回关键路径工单列表 + EarliestFinishTime ───────────────────────

  async getCriticalPath(
    tenantId: string,
    rootWoId: string,
  ): Promise<CriticalPathResult> {
    const nodes = await this.treeSvc.getTree(tenantId, rootWoId);
    if (nodes.length === 0)
      return { criticalPath: [], earliestFinishTime: null, allNodes: [] };

    const criticalPath = nodes
      .filter((n) => n.isCritical === 1)
      .sort((a, b) => (a.es?.getTime() ?? 0) - (b.es?.getTime() ?? 0));

    // EarliestFinishTime = 根节点的 EF
    const root = nodes.find((n) => !n.parentWoId || n.id === rootWoId);
    const earliestFinishTime = root?.ef ?? null;

    return { criticalPath, earliestFinishTime, allNodes: nodes };
  }

  // ── 完整重算（getTree → forward → backward → markCritical → persist） ────

  async recalculate(tenantId: string, rootWoId: string): Promise<void> {
    const nodes = await this.treeSvc.getTree(tenantId, rootWoId);
    if (nodes.length === 0) return;

    this.forwardPass(nodes);

    // projectEnd = 所有叶节点 EF 的最大值
    const projectEnd = nodes.reduce((max, n) => {
      const ef = n.ef ?? new Date(0);
      return ef > max ? ef : max;
    }, new Date(0));

    this.backwardPass(nodes, projectEnd);
    this.markCritical(nodes);
    await this.persistCpmResult(tenantId, nodes);

    this.logger.log(
      `[CPM] Recalculated for rootWoId=${rootWoId}, projectEnd=${projectEnd.toISOString()}`,
    );
  }

  // ── 私有：计算工单持续时间（毫秒） ───────────────────────────────────────

  private _durationMs(node: WorkOrderTreeNode): number {
    if (node.plannedStart && node.plannedEnd) {
      return Math.max(
        node.plannedEnd.getTime() - node.plannedStart.getTime(),
        0,
      );
    }
    // 退化：按计划工时（小时）
    const hours = node.plannedHours ?? 8;
    return hours * 3600 * 1000;
  }
}
