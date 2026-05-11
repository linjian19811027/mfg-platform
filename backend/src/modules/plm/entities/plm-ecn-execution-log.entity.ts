import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('plm_ecn_execution_log')
@Index('idx_plm_ecn_log_plan', ['planId'])
export class PlmEcnExecutionLog {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'plan_id', type: 'bigint' })
  planId!: string;

  /** STATUS_CHANGE | ITEM_EXECUTED | TRIGGERED | CANCELLED | DATE_UPDATED */
  @Column({ length: 50 })
  action!: string;

  @Column({ name: 'from_status', length: 30, nullable: true })
  fromStatus?: string;

  @Column({ name: 'to_status', length: 30, nullable: true })
  toStatus?: string;

  @Column({ name: 'operator_id', length: 50, nullable: true })
  operatorId?: string;

  @Column({
    name: 'trigger_type',
    type: 'enum',
    enum: ['SCHEDULED', 'MANUAL'],
    nullable: true,
  })
  triggerType?: string;

  @Column({ type: 'text', nullable: true })
  detail?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
