import {
  EventSubscriber,
  EntitySubscriberInterface,
  InsertEvent,
  UpdateEvent,
} from 'typeorm';
import { UserContext } from './user.context.js';

/**
 * 全局 TypeORM 订阅器：
 * 1. 自动填充 createdBy / updatedBy
 * 2. afterInsert 回填 createdAt/updatedAt（TypeORM save() 不自动回填）
 */
@EventSubscriber()
export class AuditFieldsSubscriber implements EntitySubscriberInterface {
  beforeInsert(event: InsertEvent<Record<string, unknown>>): void {
    const userId = UserContext.getCurrentUserId();
    const entity = event.entity;
    if (!entity || typeof entity !== 'object') return;
    if (userId) {
      if ('createdBy' in entity && entity.createdBy == null)
        entity.createdBy = userId;
      if ('updatedBy' in entity && entity.updatedBy == null)
        entity.updatedBy = userId;
    }
  }

  afterInsert(event: InsertEvent<Record<string, unknown>>): void {
    const entity = event.entity;
    if (!entity || typeof entity !== 'object') return;
    const now = new Date();
    // 回填 TypeORM 不自动返回的时间戳字段
    if ('createdAt' in entity && !entity.createdAt) entity.createdAt = now;
    if ('updatedAt' in entity && !entity.updatedAt) entity.updatedAt = now;
  }

  beforeUpdate(event: UpdateEvent<Record<string, unknown>>): void {
    const userId = UserContext.getCurrentUserId();
    const entity = event.entity;
    if (!entity || typeof entity !== 'object') return;
    if (userId && 'updatedBy' in entity) entity.updatedBy = userId;
  }
}
