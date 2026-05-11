import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('plm_wip_assessment')
@Index('idx_plm_wip_assessment_plan', ['planId'])
export class PlmWipAssessment {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'plan_id', type: 'bigint' })
  planId!: string;

  @Column({
    type: 'enum',
    enum: ['PENDING', 'CONFIRMED'],
    default: 'PENDING',
  })
  status!: string;

  @Column({ name: 'total_wip_count', type: 'int', default: 0 })
  totalWipCount!: number;

  @Column({ name: 'continue_old_count', type: 'int', default: 0 })
  continueOldCount!: number;

  @Column({ name: 'switch_new_count', type: 'int', default: 0 })
  switchNewCount!: number;

  @Column({ name: 'suspend_review_count', type: 'int', default: 0 })
  suspendReviewCount!: number;

  @Column({
    name: 'estimated_impact_value',
    type: 'decimal',
    precision: 18,
    scale: 2,
    default: 0,
  })
  estimatedImpactValue!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
