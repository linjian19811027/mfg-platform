import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { MesWorkOrder } from '../entities/mes-work-order.entity.js';

export interface WorkOrderTreeNode {
  id: string;
  tenantId: string;
  woNo: string;
  materialId: string;
  plannedQty: number;
  completedQty: number;
  status: string;
  plannedStart?: Date;
  plannedEnd?: Date;
  parentWoId?: string;
  rootWoId?: string;
  bomLevel: number;
  isCritical: number;
  es?: Date;
  ef?: Date;
  ls?: Date;
  lf?: Date;
  totalFloat?: number;
  /** 计划工时（来自工序汇总，用于加权计算） */
  plannedHours?: number;
  completionPct?: number;
  children?: WorkOrderTreeNode[];
  truncated?: boolean;
}

const MAX_LEVELS = 10;
const MAX_NODES = 200;

@Injectable()
export class WorkOrderTreeService {
  private readonly logger = new Logger(WorkOrderTreeService.name);

  constructor(
    @InjectRepository(MesWorkOrder)
    private readonly woRepo: Repository<MesWorkOrder>,
    private readonly dataSource: DataSource,
  ) {}

  // ── 3.1.1 递归 CTE 查询工单树 ─────────────────────────────────────────────

  async getTree(
    tenantId: string,
    rootWoId: string,
  ): Promise<WorkOrderTreeNode[]> {
    const sql = `
      WITH RECURSIVE wo_tree AS (
        -- 锚点：根工单
        SELECT
          w.id, w.tenant_id, w.wo_no, w.material_id,
          w.planned_qty, w.completed_qty, w.status,
          w.planned_start, w.planned_end,
          w.parent_wo_id, w.root_wo_id, w.bom_level,
          w.is_critical, w.es, w.ef, w.ls, w.lf, w.total_float,
          COALESCE(ph.total_hours, 0) AS planned_hours,
          0 AS depth
        FROM mes_work_order w
        LEFT JOIN (
          SELECT wo_id, SUM(planned_hours) AS total_hours
          FROM mes_work_order_operation
          GROUP BY wo_id
        ) ph ON ph.wo_id = w.id
        WHERE w.id = ? AND w.tenant_id = ?

        UNION ALL

        -- 递归：子工单
        SELECT
          c.id, c.tenant_id, c.wo_no, c.material_id,
          c.planned_qty, c.completed_qty, c.status,
          c.planned_start, c.planned_end,
          c.parent_wo_id, c.root_wo_id, c.bom_level,
          c.is_critical, c.es, c.ef, c.ls, c.lf, c.total_float,
          COALESCE(ph2.total_hours, 0) AS planned_hours,
          t.depth + 1
        FROM mes_work_order c
        LEFT JOIN (
          SELECT wo_id, SUM(planned_hours) AS total_hours
          FROM mes_work_order_operation
          GROUP BY wo_id
        ) ph2 ON ph2.wo_id = c.id
        INNER JOIN wo_tree t ON c.parent_wo_id = t.id AND c.tenant_id = t.tenant_id
        WHERE t.depth < ${MAX_LEVELS - 1}
      )
      SELECT * FROM wo_tree
      LIMIT ${MAX_NODES + 1}
    `;

    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      sql,
      [rootWoId, tenantId],
    );

    const truncated = rows.length > MAX_NODES;
    const limited = rows.slice(0, MAX_NODES);

    const nodes: WorkOrderTreeNode[] = limited.map((r) => ({
      id: String(r['id']),
      tenantId: String(r['tenant_id']),
      woNo: String(r['wo_no']),
      materialId: String(r['material_id']),
      plannedQty: Number(r['planned_qty']),
      completedQty: Number(r['completed_qty']),
      status: String(r['status']),
      plannedStart: r['planned_start']
        ? new Date(r['planned_start'] as string)
        : undefined,
      plannedEnd: r['planned_end']
        ? new Date(r['planned_end'] as string)
        : undefined,
      parentWoId: r['parent_wo_id'] ? String(r['parent_wo_id']) : undefined,
      rootWoId: r['root_wo_id'] ? String(r['root_wo_id']) : undefined,
      bomLevel: Number(r['bom_level']),
      isCritical: Number(r['is_critical']),
      es: r['es'] ? new Date(r['es'] as string) : undefined,
      ef: r['ef'] ? new Date(r['ef'] as string) : undefined,
      ls: r['ls'] ? new Date(r['ls'] as string) : undefined,
      lf: r['lf'] ? new Date(r['lf'] as string) : undefined,
      totalFloat:
        r['total_float'] != null ? Number(r['total_float']) : undefined,
      plannedHours: Number(r['planned_hours']),
    }));

    if (truncated) {
      // 在根节点上标记截断
      if (nodes.length > 0) nodes[0].truncated = true;
    }

    return nodes;
  }

  // ── 3.1.2 按计划工时加权计算完成百分比 ────────────────────────────────────

  calcCompletionPct(nodes: WorkOrderTreeNode[]): number {
    if (nodes.length === 0) return 0;

    let totalWeight = 0;
    let weightedComplete = 0;

    for (const n of nodes) {
      const hours = n.plannedHours ?? 0;
      const pct =
        n.plannedQty > 0 ? Math.min(n.completedQty / n.plannedQty, 1) : 0;
      totalWeight += hours;
      weightedComplete += hours * pct;
    }

    if (totalWeight === 0) {
      // 无工时信息时退化为简单平均
      const sum = nodes.reduce((acc, n) => {
        return (
          acc +
          (n.plannedQty > 0 ? Math.min(n.completedQty / n.plannedQty, 1) : 0)
        );
      }, 0);
      return Math.round((sum / nodes.length) * 10000) / 100;
    }

    return Math.round((weightedComplete / totalWeight) * 10000) / 100;
  }

  // ── 3.1.3 循环引用检测 ────────────────────────────────────────────────────

  async detectCycle(
    tenantId: string,
    woId: string,
    newParentId: string,
  ): Promise<boolean> {
    if (woId === newParentId) return true;

    // 从 newParentId 向上遍历祖先链，若遇到 woId 则存在循环
    let currentId: string | undefined = newParentId;
    const visited = new Set<string>();

    while (currentId) {
      if (visited.has(currentId)) return true; // 已有循环
      if (currentId === woId) return true; // 找到目标节点 → 循环
      visited.add(currentId);

      const parent = await this.woRepo.findOne({
        where: { id: currentId, tenantId },
        select: ['id', 'parentWoId'],
      });
      currentId = parent?.parentWoId;
    }

    return false;
  }

  // ── 3.1.4 修改父工单关联，自动重算 rootWoId / bomLevel ───────────────────

  async updateParent(
    tenantId: string,
    woId: string,
    newParentId: string | null,
    operatorId?: string,
  ): Promise<MesWorkOrder> {
    const wo = await this.woRepo.findOne({ where: { id: woId, tenantId } });
    if (!wo) throw new BadRequestException(`工单 ${woId} 不存在`);

    if (newParentId) {
      const hasCycle = await this.detectCycle(tenantId, woId, newParentId);
      if (hasCycle) throw new BadRequestException(`修改父工单会产生循环引用`);

      const parent = await this.woRepo.findOne({
        where: { id: newParentId, tenantId },
      });
      if (!parent)
        throw new BadRequestException(`父工单 ${newParentId} 不存在`);

      wo.parentWoId = newParentId;
      wo.bomLevel = parent.bomLevel + 1;
      wo.rootWoId = parent.rootWoId ?? parent.id;
    } else {
      wo.parentWoId = undefined;
      wo.bomLevel = 0;
      wo.rootWoId = wo.id; // 自身成为根
    }

    const saved = await this.woRepo.save(wo);

    // 递归更新所有子孙节点的 rootWoId / bomLevel
    await this._propagateRootAndLevel(
      tenantId,
      saved.id,
      saved.rootWoId!,
      saved.bomLevel,
    );

    this.logger.log(
      `[WorkOrderTree] WO ${woId} parent updated to ${newParentId ?? 'null'} by ${operatorId ?? 'system'}`,
    );
    return saved;
  }

  // ── 私有：递归传播 rootWoId / bomLevel ────────────────────────────────────

  private async _propagateRootAndLevel(
    tenantId: string,
    parentId: string,
    rootWoId: string,
    parentLevel: number,
  ): Promise<void> {
    const children = await this.woRepo.find({
      where: { tenantId, parentWoId: parentId },
    });
    for (const child of children) {
      child.rootWoId = rootWoId;
      child.bomLevel = parentLevel + 1;
      await this.woRepo.save(child);
      await this._propagateRootAndLevel(
        tenantId,
        child.id,
        rootWoId,
        child.bomLevel,
      );
    }
  }

  // ── 将平铺节点列表构建为树形结构 ─────────────────────────────────────────

  buildTree(nodes: WorkOrderTreeNode[]): WorkOrderTreeNode[] {
    const map = new Map<string, WorkOrderTreeNode>();
    for (const n of nodes) {
      map.set(n.id, { ...n, children: [] });
    }

    const roots: WorkOrderTreeNode[] = [];
    for (const n of map.values()) {
      if (n.parentWoId && map.has(n.parentWoId)) {
        map.get(n.parentWoId)!.children!.push(n);
      } else {
        roots.push(n);
      }
    }
    return roots;
  }
}
