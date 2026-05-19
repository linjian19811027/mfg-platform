import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { v4 as uuidv4 } from 'uuid';
import { MessageService, DomainEvent } from './message.interface.js';
import { EventStore } from './event-store.entity.js';

@Injectable()
export class DatabaseMessageService implements MessageService {
  private readonly logger = new Logger('DatabaseMessageService');
  private readonly handlers = new Map<
    string,
    Array<(event: DomainEvent) => Promise<void>>
  >();
  /** 已处理的 eventId 集合（进程内幂等，防止同一次启动重复处理） */
  private readonly processedIds = new Set<string>();

  constructor(
    @InjectRepository(EventStore)
    private readonly eventRepo: Repository<EventStore>,
  ) {}

  async publish(event: DomainEvent): Promise<void> {
    // 幂等检查：同一 eventId 不重复处理
    if (event.eventId && this.processedIds.has(event.eventId)) {
      this.logger.debug(`跳过重复事件 ${event.eventId} (${event.eventType})`);
      return;
    }

    // 所有事件都持久化到 event_store（审计 + 重试保障）
    const handlers = this.handlers.get(event.eventType) ?? [];
    let handlerError: string | undefined;

    if (handlers.length > 0) {
      for (const handler of handlers) {
        try {
          await handler(event);
        } catch (err) {
          handlerError = err instanceof Error ? err.message : String(err);
          this.logger.error(`事件处理失败 ${event.eventType}: ${handlerError}`);
        }
      }
    }

    // 持久化：成功标记 COMPLETED，失败标记 FAILED（供重试）
    await this.saveToStore(event, handlerError);

    // 标记为已处理（进程内幂等）
    if (event.eventId) {
      this.processedIds.add(event.eventId);
      if (this.processedIds.size > 10000) {
        const first = this.processedIds.values().next().value;
        if (first) this.processedIds.delete(first);
      }
    }
  }

  private async saveToStore(event: DomainEvent, error?: string): Promise<void> {
    try {
      const entity = this.eventRepo.create({
        eventId: event.eventId || uuidv4(),
        tenantId: event.tenantId,
        eventType: event.eventType,
        sourceModule: event.sourceModule,
        targetModule: event.targetModule,
        payload: event.payload,
        status: error ? 'FAILED' : 'COMPLETED',
        lastError: error,
        processedAt: error ? undefined : new Date(),
      });
      await this.eventRepo.save(entity);
    } catch (err) {
      this.logger.error(`Failed to save event to store: ${err}`);
    }
  }

  subscribe(
    eventType: string,
    handler: (event: DomainEvent) => Promise<void>,
  ): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);
  }

  // 每5秒轮询处理 PENDING/FAILED 事件
  @Cron('*/5 * * * * *')
  async processPendingEvents(): Promise<void> {
    const events = await this.eventRepo.find({
      where: [{ status: 'PENDING' }, { status: 'FAILED' }],
      order: { priority: 'ASC', createdAt: 'ASC' },
      take: 10,
    });

    // 过滤 retryCount < maxRetries
    const eligible = events.filter((e) => e.retryCount < e.maxRetries);

    for (const event of eligible) {
      await this.processEvent(event);
    }
  }

  private async processEvent(event: EventStore): Promise<void> {
    // 标记为处理中
    await this.eventRepo.update(event.id, { status: 'PROCESSING' });

    try {
      const handlers = this.handlers.get(event.eventType) ?? [];
      const domainEvent: DomainEvent = {
        eventId: event.eventId,
        eventType: event.eventType,
        tenantId: event.tenantId,
        sourceModule: event.sourceModule,
        targetModule: event.targetModule,
        payload: event.payload,
        createdAt: event.createdAt,
      };

      for (const handler of handlers) {
        await handler(domainEvent);
      }

      await this.eventRepo.update(event.id, {
        status: 'COMPLETED',
        processedAt: new Date(),
      });
    } catch (err) {
      const newRetryCount = event.retryCount + 1;
      const newStatus =
        newRetryCount >= event.maxRetries ? 'DEAD_LETTER' : 'FAILED';

      await this.eventRepo.update(event.id, {
        status: newStatus,
        retryCount: newRetryCount,
        lastError: err instanceof Error ? err.message : String(err),
      });

      if (newStatus === 'DEAD_LETTER') {
        this.logger.error(
          `Event ${event.eventId} (${event.eventType}) moved to DEAD_LETTER after ${newRetryCount} retries`,
        );
      }
    }
  }
}
