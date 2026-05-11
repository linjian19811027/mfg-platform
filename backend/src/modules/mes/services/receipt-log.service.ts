import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { v4 as uuidv4 } from 'uuid';
import { MesReceiptLog } from '../entities/mes-receipt-log.entity.js';
import { TenantContext } from '../../../shared/tenant/tenant.context.js';
import {
  MESSAGE_SERVICE,
  MessageService,
} from '../../../shared/message/message.interface.js';
import { EventTypes } from '../../event/event-types.constant.js';

@Injectable()
export class ReceiptLogService {
  private readonly logger = new Logger('ReceiptLogService');

  constructor(
    @InjectRepository(MesReceiptLog)
    private readonly logRepo: Repository<MesReceiptLog>,
    @Inject(MESSAGE_SERVICE)
    private readonly messageSvc: MessageService,
  ) {}

  // ── 查询 ──────────────────────────────────────────────────────────────────

  async findAll(query: {
    woId?: string;
    status?: string;
    triggerType?: string;
    page?: number;
    pageSize?: number;
  }) {
    const tenantId = TenantContext.requireCurrentTenant();
    const { page = 1, pageSize = 20 } = query;
    const qb = this.logRepo
      .createQueryBuilder('l')
      .where('l.tenant_id = :tenantId', { tenantId });
    if (query.woId) qb.andWhere('l.wo_id = :woId', { woId: query.woId });
    if (query.status)
      qb.andWhere('l.status = :status', { status: query.status });
    if (query.triggerType)
      qb.andWhere('l.trigger_type = :tt', { tt: query.triggerType });
    const [items, total] = await qb
      .orderBy('l.created_at', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return { items, total };
  }

  // ── 手动重试 ──────────────────────────────────────────────────────────────

  async retry(id: string): Promise<MesReceiptLog> {
    const tenantId = TenantContext.requireCurrentTenant();
    const log = await this.logRepo.findOne({ where: { id, tenantId } });
    if (!log) throw new NotFoundException('RECEIPT_LOG_NOT_FOUND');
    if (log.status !== 'FAILED') {
      throw new BadRequestException(
        `RECEIPT_LOG_NOT_FAILED: current status=${log.status}`,
      );
    }

    await this.logRepo.update(id, {
      status: 'RETRYING',
      retryCount: log.retryCount + 1,
    });
    await this.republishEvent(log, tenantId);

    return this.logRepo.findOneOrFail({ where: { id, tenantId } });
  }

  // ── 自动重试调度（1min / 5min / 30min 三档）────────────────────────────────

  @Cron(CronExpression.EVERY_MINUTE)
  async autoRetryScheduler(): Promise<void> {
    const now = new Date();
    const logs = await this.logRepo
      .createQueryBuilder('l')
      .where('l.status IN (:...statuses)', { statuses: ['FAILED', 'RETRYING'] })
      .andWhere('l.retry_count < 3')
      .getMany();

    for (const log of logs) {
      const minutesSinceCreated =
        (now.getTime() - log.updatedAt.getTime()) / 60000;
      const shouldRetry = this.shouldAutoRetry(
        log.retryCount,
        minutesSinceCreated,
      );
      if (!shouldRetry) continue;

      try {
        await this.logRepo.update(log.id, {
          status: 'RETRYING',
          retryCount: log.retryCount + 1,
        });
        await this.republishEvent(log, log.tenantId);
        this.logger.log(
          `[ReceiptLog] Auto-retry #${log.retryCount + 1} for log ${log.id}`,
        );
      } catch (err) {
        this.logger.error(
          `[ReceiptLog] Auto-retry failed for log ${log.id}: ${err}`,
        );
        if (log.retryCount + 1 >= 3) {
          await this.logRepo.update(log.id, {
            status: 'FAILED',
            errorMessage: `Auto-retry exhausted (3 attempts): ${err}`,
          });
        }
      }
    }
  }

  // ── 内部方法（供 Orchestrator 调用）──────────────────────────────────────

  async markSuccess(id: string, wmsTxId?: string): Promise<void> {
    await this.logRepo.update(id, { status: 'SUCCESS', wmsTxId });
  }

  async markFailed(id: string, errorMessage: string): Promise<void> {
    const log = await this.logRepo.findOne({ where: { id } });
    if (!log) return;
    const newCount = log.retryCount;
    const newStatus = newCount >= 3 ? 'FAILED' : 'FAILED';
    await this.logRepo.update(id, { status: newStatus as any, errorMessage });
  }

  async updateFqcIrId(id: string, fqcIrId: string): Promise<void> {
    await this.logRepo.update(id, { fqcIrId });
  }

  // ── 私有方法 ──────────────────────────────────────────────────────────────

  /**
   * 重试间隔策略：
   * retryCount=0 → 首次失败，1 分钟后重试
   * retryCount=1 → 5 分钟后重试
   * retryCount=2 → 30 分钟后重试
   */
  private shouldAutoRetry(
    retryCount: number,
    minutesSinceUpdate: number,
  ): boolean {
    if (retryCount === 0) return minutesSinceUpdate >= 1;
    if (retryCount === 1) return minutesSinceUpdate >= 5;
    if (retryCount === 2) return minutesSinceUpdate >= 30;
    return false;
  }

  private async republishEvent(
    log: MesReceiptLog,
    tenantId: string,
  ): Promise<void> {
    const basePayload = {
      receiptLogId: log.id,
      woId: log.woId,
      materialId: log.materialId,
      quantity: log.quantity,
      uomId: log.uomId,
      targetWarehouseId: log.targetWarehouseId,
      targetLocationId: log.targetLocationId,
    };

    if (log.requireFqc) {
      await this.messageSvc.publish({
        eventId: uuidv4(),
        eventType: EventTypes.FQC_INSPECTION_REQUEST,
        tenantId,
        sourceModule: 'MES',
        targetModule: 'QMS',
        payload: basePayload,
        createdAt: new Date(),
      });
    } else {
      await this.messageSvc.publish({
        eventId: uuidv4(),
        eventType: EventTypes.PRODUCTION_RECEIPT_REQUEST,
        tenantId,
        sourceModule: 'MES',
        targetModule: 'WMS',
        payload: basePayload,
        createdAt: new Date(),
      });
    }
  }
}
