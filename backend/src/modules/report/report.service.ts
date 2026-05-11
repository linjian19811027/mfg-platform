import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { ReportTask } from './entities/report-task.entity.js';
import { WmsInventory } from '../wms/entities/wms-inventory.entity.js';
import { WmsStockTransaction } from '../wms/entities/wms-stock-transaction.entity.js';
import { MesWorkOrder } from '../mes/entities/mes-work-order.entity.js';

@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name);

  constructor(
    @InjectRepository(ReportTask)
    private readonly taskRepo: Repository<ReportTask>,
    @InjectRepository(WmsInventory)
    private readonly inventoryRepo: Repository<WmsInventory>,
    @InjectRepository(WmsStockTransaction)
    private readonly txRepo: Repository<WmsStockTransaction>,
    @InjectRepository(MesWorkOrder)
    private readonly workOrderRepo: Repository<MesWorkOrder>,
  ) {}

  async createTask(
    tenantId: string,
    reportType: string,
    params: object,
  ): Promise<{ taskId: string }> {
    const task = this.taskRepo.create({
      id: uuidv4(),
      tenantId,
      reportType,
      params,
      status: 'PENDING',
    });
    await this.taskRepo.save(task);

    setImmediate(() => {
      this.executeTask(task).catch((err) =>
        this.logger.error(`Report task ${task.id} failed: ${err.message}`),
      );
    });

    return { taskId: task.id };
  }

  async getTask(taskId: string): Promise<ReportTask> {
    const task = await this.taskRepo.findOne({ where: { id: taskId } });
    if (!task) throw new NotFoundException(`Report task ${taskId} not found`);
    return task;
  }

  private async executeTask(task: ReportTask): Promise<void> {
    await this.taskRepo.update(task.id, { status: 'RUNNING' });

    try {
      const result = await this.generateReport(task);
      await this.taskRepo.update(task.id, {
        status: 'COMPLETED',
        result,
        completedAt: new Date(),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Report task ${task.id} error: ${msg}`);
      await this.taskRepo.update(task.id, {
        status: 'FAILED',
        errorMsg: msg,
        completedAt: new Date(),
      });
    }
  }

  private async generateReport(task: ReportTask): Promise<object> {
    const { tenantId, reportType, params } = task;
    const p = (params ?? {}) as Record<string, unknown>;

    switch (reportType) {
      case 'INVENTORY_LEDGER': {
        const qb = this.inventoryRepo
          .createQueryBuilder('inv')
          .where('inv.tenantId = :tenantId', { tenantId });
        if (p['materialId'])
          qb.andWhere('inv.materialId = :mid', { mid: p['materialId'] });
        if (p['status'])
          qb.andWhere('inv.status = :status', { status: p['status'] });
        const rows = await qb.getMany();
        return { reportType, total: rows.length, rows };
      }

      case 'MOVEMENT_REPORT': {
        const qb = this.txRepo
          .createQueryBuilder('tx')
          .where('tx.tenantId = :tenantId', { tenantId })
          .orderBy('tx.txTime', 'DESC');
        if (p['txType'])
          qb.andWhere('tx.txType = :txType', { txType: p['txType'] });
        if (p['materialId'])
          qb.andWhere('tx.materialId = :mid', { mid: p['materialId'] });
        if (p['startDate'])
          qb.andWhere('tx.txTime >= :start', { start: p['startDate'] });
        if (p['endDate'])
          qb.andWhere('tx.txTime <= :end', { end: p['endDate'] });
        const rows = await qb.getMany();
        return { reportType, total: rows.length, rows };
      }

      case 'PRODUCTION_SUMMARY': {
        const qb = this.workOrderRepo
          .createQueryBuilder('wo')
          .where('wo.tenantId = :tenantId', { tenantId });
        if (p['status'])
          qb.andWhere('wo.status = :status', { status: p['status'] });
        if (p['startDate'])
          qb.andWhere('wo.plannedStart >= :start', { start: p['startDate'] });
        if (p['endDate'])
          qb.andWhere('wo.plannedEnd <= :end', { end: p['endDate'] });
        const rows = await qb.getMany();
        const totalPlanned = rows.reduce((s, r) => s + Number(r.plannedQty), 0);
        const totalCompleted = rows.reduce(
          (s, r) => s + Number(r.completedQty),
          0,
        );
        return {
          reportType,
          total: rows.length,
          totalPlanned,
          totalCompleted,
          rows,
        };
      }

      default:
        throw new Error(`Unsupported reportType: ${reportType}`);
    }
  }
}
