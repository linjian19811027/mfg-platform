import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type EventStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'DEAD_LETTER';

@Entity('sys_event_store')
@Index('idx_event_status_time', ['status', 'createdAt'])
@Index('idx_event_tenant_type', ['tenantId', 'eventType'])
export class EventStore {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'event_id', length: 36, unique: true })
  eventId!: string;

  @Column({ name: 'event_type', length: 100 })
  eventType!: string;

  @Column({ name: 'source_module', length: 20 })
  sourceModule!: string;

  @Column({ name: 'target_module', length: 20, nullable: true })
  targetModule?: string;

  @Column({ type: 'json' })
  payload!: Record<string, unknown>;

  @Column({ length: 20, default: 'PENDING' })
  status!: EventStatus;

  @Column({ name: 'retry_count', default: 0 })
  retryCount!: number;

  @Column({ name: 'max_retries', default: 3 })
  maxRetries!: number;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError?: string;

  @Column({ name: 'processed_at', type: 'timestamp', nullable: true })
  processedAt?: Date;

  @Column({ name: 'scheduled_at', type: 'timestamp', nullable: true })
  scheduledAt?: Date;

  @Column({ default: 5 })
  priority!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
