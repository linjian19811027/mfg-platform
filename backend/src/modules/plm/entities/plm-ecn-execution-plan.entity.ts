import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('plm_ecn_execution_plan')
@Index('uk_plm_ecn_plan_no', ['tenantId', 'planNo'], { unique: true })
@Index('idx_plm_ecn_plan_ecn', ['ecnId'])
@Index('idx_plm_ecn_plan_status', ['tenantId', 'status'])
@Index('idx_plm_ecn_plan_effective', ['effectiveDate'])
export class PlmEcnExecutionPlan {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'plan_no', length: 50 })
  planNo!: string;

  @Column({ name: 'ecn_id', type: 'bigint' })
  ecnId!: string;

  @Column({ name: 'effective_date', type: 'datetime' })
  effectiveDate!: Date;

  @Column({
    type: 'enum',
    enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED'],
    default: 'PENDING',
  })
  status!: string;

  @Column({
    name: 'trigger_type',
    type: 'enum',
    enum: ['SCHEDULED', 'MANUAL'],
    nullable: true,
  })
  triggerType?: string;

  @Column({ name: 'triggered_at', type: 'datetime', nullable: true })
  triggeredAt?: Date;

  @Column({ name: 'completed_at', type: 'datetime', nullable: true })
  completedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
