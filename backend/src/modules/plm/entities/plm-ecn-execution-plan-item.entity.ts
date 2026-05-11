import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('plm_ecn_execution_plan_item')
@Index('idx_plm_ecn_plan_item_plan', ['planId'])
@Index('idx_plm_ecn_plan_item_status', ['tenantId', 'status'])
export class PlmEcnExecutionPlanItem {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'plan_id', type: 'bigint' })
  planId!: string;

  @Column({
    name: 'item_type',
    type: 'enum',
    enum: ['BOM', 'ROUTING'],
  })
  itemType!: string;

  @Column({ name: 'object_id', type: 'bigint' })
  objectId!: string;

  @Column({ name: 'object_code', length: 100 })
  objectCode!: string;

  @Column({ name: 'current_version', length: 20 })
  currentVersion!: string;

  @Column({ name: 'new_version', length: 20, nullable: true })
  newVersion?: string;

  @Column({
    type: 'enum',
    enum: ['PENDING', 'COMPLETED', 'FAILED'],
    default: 'PENDING',
  })
  status!: string;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ name: 'started_at', type: 'datetime', nullable: true })
  startedAt?: Date;

  @Column({ name: 'completed_at', type: 'datetime', nullable: true })
  completedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
