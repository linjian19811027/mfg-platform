import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { MesWorkOrder } from '../entities/mes-work-order.entity.js';

export interface CancelPreview {
  parentWoId: string;
  pendingChildren: Array<{
    id: string;
    woNo: string;
    bomLevel: number;
    status: string;
  }>;
  skippedChildren: Array<{ id: string; woNo: string; status: string }>;
  totalPending: number;
}

export interface CancelResult {
  cancelled: string[];
  skipped: string[];
  success: boolean;
}

const CANCELLABLE_STATUSES = ['RELEASED', 'PENDING'];

@Injectable()
export class CascadeCancelService {
  private readonly logger = new Logger(CascadeCancelService.name);

  constructor(
    @InjectRepository(MesWorkOrder)
    private readonly woRepo: Repository<MesWorkOrder>,
    private readonly dataSource: DataSource,
  ) {}

  // ── 3.4.1 预览：返回可取消的子工单列表 ───────────────────────────────────

  async previewCascadeCancel(
    tenantId: string,
    parentWoId: string,
  ): Promise<CancelPreview> {
    const allDescendants = await this._getAllDescendants(tenantId, parentWoId);

    const pending = allDescendants.filter((w) =>
      CANCELLABLE_STATUSES.includes(w.status),
    );
    const skipped = allDescendants.filter(
      (w) => !CANCELLABLE_STATUSES.includes(w.status),
    );

    return {
      parentWoId,
      pendingChildren: pending.map((w) => ({
        id: w.id,
        woNo: w.woNo,
        bomLevel: w.bomLevel,
        status: w.status,
      })),
      skippedChildren: skipped.map((w) => ({
        id: w.id,
        woNo: w.woNo,
        status: w.status,
      })),
      totalPending: pending.length,
    };
  }

  // ── 3.4.2 执行：事务内批量取消，失败全部回滚 ─────────────────────────────

  async executeCascadeCancel(
    tenantId: string,
    parentWoId: string,
    reason: string,
    operatorId: string,
  ): Promise<CancelResult> {
    const preview = await this.previewCascadeCancel(tenantId, parentWoId);
    const toCancel = preview.pendingChildren.map((c) => c.id);

    if (toCancel.length === 0) {
      return {
        cancelled: [],
        skipped: preview.skippedChildren.map((c) => c.id),
        success: true,
      };
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const woId of toCancel) {
        const wo = await queryRunner.manager.findOne(MesWorkOrder, {
          where: { id: woId, tenantId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!wo) throw new BadRequestException(`工单 ${woId} 不存在`);
        if (!CANCELLABLE_STATUSES.includes(wo.status)) {
          throw new BadRequestException(
            `工单 ${wo.woNo} 状态为 ${wo.status}，无法取消`,
          );
        }

        wo.status = 'CANCELLED';
        await queryRunner.manager.save(wo);

        // 写操作日志
        await queryRunner.manager
          .query(
            `INSERT INTO mes_work_order_log (tenant_id, wo_id, action, reason, operator_id, created_at)
           VALUES (?, ?, 'CANCEL', ?, ?, NOW())
           ON DUPLICATE KEY UPDATE updated_at = NOW()`,
            [
              tenantId,
              woId,
              `级联取消：${reason}（父工单 ${parentWoId}）`,
              operatorId,
            ],
          )
          .catch(() => {
            // 日志表可能不存在，忽略错误不影响主流程
          });
      }

      await queryRunner.commitTransaction();

      this.logger.log(
        `[CascadeCancel] Cancelled ${toCancel.length} WOs under parent ${parentWoId} by ${operatorId}`,
      );

      return {
        cancelled: toCancel,
        skipped: preview.skippedChildren.map((c) => c.id),
        success: true,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`[CascadeCancel] Transaction rolled back: ${err}`);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // ── 私有：递归获取所有子孙工单 ────────────────────────────────────────────

  private async _getAllDescendants(
    tenantId: string,
    parentWoId: string,
  ): Promise<MesWorkOrder[]> {
    const sql = `
      WITH RECURSIVE descendants AS (
        SELECT id, tenant_id, wo_no, status, parent_wo_id, bom_level
        FROM mes_work_order
        WHERE parent_wo_id = ? AND tenant_id = ?

        UNION ALL

        SELECT c.id, c.tenant_id, c.wo_no, c.status, c.parent_wo_id, c.bom_level
        FROM mes_work_order c
        INNER JOIN descendants d ON c.parent_wo_id = d.id AND c.tenant_id = d.tenant_id
      )
      SELECT * FROM descendants
    `;

    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      sql,
      [parentWoId, tenantId],
    );

    return rows.map((r) => {
      const wo = new MesWorkOrder();
      wo.id = String(r['id']);
      wo.tenantId = String(r['tenant_id']);
      wo.woNo = String(r['wo_no']);
      wo.status = String(r['status']);
      wo.parentWoId = r['parent_wo_id'] ? String(r['parent_wo_id']) : undefined;
      wo.bomLevel = Number(r['bom_level']);
      return wo;
    });
  }
}
