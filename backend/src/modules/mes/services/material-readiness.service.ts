import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { MesWorkOrder } from '../entities/mes-work-order.entity.js';
import type { ReadinessStatus } from '../entities/mes-work-order.entity.js';

export interface ReadinessItem {
  childWoId: string;
  materialId: string;
  requiredQty: number;
  completedQty: number;
  status: 'PENDING' | 'PARTIAL' | 'READY' | 'CANCELLED';
}

@Injectable()
export class MaterialReadinessService {
  private readonly logger = new Logger(MaterialReadinessService.name);

  constructor(
    @InjectRepository(MesWorkOrder)
    private readonly woRepo: Repository<MesWorkOrder>,
    private readonly dataSource: DataSource,
  ) {}

  // ── 3.3.1 子工单完工 → 更新父工单物料齐套状态 ────────────────────────────

  async onChildCompleted(
    tenantId: string,
    childWoId: string,
    receiptQty: number,
  ): Promise<void> {
    const child = await this.woRepo.findOne({
      where: { id: childWoId, tenantId },
    });
    if (!child?.parentWoId) return;

    const parent = await this.woRepo.findOne({
      where: { id: child.parentWoId, tenantId },
    });
    if (!parent) return;

    const items: ReadinessItem[] =
      (parent.materialReadiness as unknown as ReadinessItem[] | null) ?? [];

    // 找到或新建对应子工单的条目
    let item = items.find((i) => i.childWoId === childWoId);
    if (!item) {
      item = {
        childWoId,
        materialId: child.materialId,
        requiredQty: Number(child.plannedQty),
        completedQty: 0,
        status: 'PENDING',
      };
      items.push(item);
    }

    item.completedQty = receiptQty;

    if (receiptQty >= item.requiredQty) {
      item.status = 'READY';
    } else if (receiptQty > 0) {
      item.status = 'PARTIAL';
    } else {
      item.status = 'PENDING';
    }

    parent.materialReadiness = items as unknown as Record<string, unknown>[];
    parent.readinessStatus = this._calcOverallStatus(items);
    await this.woRepo.save(parent);

    this.logger.log(
      `[Readiness] Child ${childWoId} completed (qty=${receiptQty}), parent ${parent.id} status=${parent.readinessStatus}`,
    );

    if (parent.readinessStatus === 'ALL_READY') {
      await this.checkAllReady(tenantId, parent.id);
    }
  }

  // ── 3.3.2 子工单取消 → 标记父工单对应物料 CANCELLED ─────────────────────

  async onChildCancelled(tenantId: string, childWoId: string): Promise<void> {
    const child = await this.woRepo.findOne({
      where: { id: childWoId, tenantId },
    });
    if (!child?.parentWoId) return;

    const parent = await this.woRepo.findOne({
      where: { id: child.parentWoId, tenantId },
    });
    if (!parent) return;

    const items: ReadinessItem[] =
      (parent.materialReadiness as unknown as ReadinessItem[] | null) ?? [];

    let item = items.find((i) => i.childWoId === childWoId);
    if (!item) {
      item = {
        childWoId,
        materialId: child.materialId,
        requiredQty: Number(child.plannedQty),
        completedQty: 0,
        status: 'CANCELLED',
      };
      items.push(item);
    } else {
      item.status = 'CANCELLED';
    }

    parent.materialReadiness = items as unknown as Record<string, unknown>[];
    parent.readinessStatus = this._calcOverallStatus(items);
    await this.woRepo.save(parent);

    // 写取消预警通知
    await this._writeNotification(tenantId, parent.id, 'CANCELLED', childWoId);

    this.logger.log(
      `[Readiness] Child ${childWoId} cancelled, parent ${parent.id} status=${parent.readinessStatus}`,
    );
  }

  // ── 3.3.3 检查是否全部齐套，发送通知 ─────────────────────────────────────

  async checkAllReady(tenantId: string, parentWoId: string): Promise<boolean> {
    const parent = await this.woRepo.findOne({
      where: { id: parentWoId, tenantId },
    });
    if (!parent) return false;

    if (parent.readinessStatus === 'ALL_READY') {
      await this._writeNotification(tenantId, parentWoId, 'ALL_READY', null);
      return true;
    }
    return false;
  }

  // ── 私有：计算整体齐套状态 ────────────────────────────────────────────────

  private _calcOverallStatus(items: ReadinessItem[]): ReadinessStatus {
    if (items.length === 0) return 'PENDING';

    const hasCancelled = items.some((i) => i.status === 'CANCELLED');
    if (hasCancelled) return 'CANCELLED';

    const allReady = items.every((i) => i.status === 'READY');
    if (allReady) return 'ALL_READY';

    const anyPartialOrReady = items.some(
      (i) => i.status === 'PARTIAL' || i.status === 'READY',
    );
    if (anyPartialOrReady) return 'PARTIAL';

    return 'PENDING';
  }

  // ── 私有：写系统通知 ──────────────────────────────────────────────────────

  private async _writeNotification(
    tenantId: string,
    parentWoId: string,
    type: 'ALL_READY' | 'CANCELLED',
    triggerChildWoId: string | null,
  ): Promise<void> {
    try {
      const title = type === 'ALL_READY' ? '物料齐套通知' : '物料齐套预警';
      const content =
        type === 'ALL_READY'
          ? `工单 ${parentWoId} 所需物料已全部齐套，可以开始领料。`
          : `工单 ${parentWoId} 的子工单 ${triggerChildWoId} 已取消，请关注物料供应。`;

      await this.dataSource.query(
        `INSERT INTO sys_notification (tenant_id, title, content, type, ref_id, ref_type, is_read, created_at)
         VALUES (?, ?, ?, ?, ?, 'MES_WORK_ORDER', 0, NOW())`,
        [
          tenantId,
          title,
          content,
          type === 'ALL_READY' ? 'INFO' : 'WARNING',
          parentWoId,
        ],
      );
    } catch (err) {
      // 通知写入失败不影响主流程
      this.logger.warn(`[Readiness] Failed to write notification: ${err}`);
    }
  }
}
