import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum OnboardingStage {
  QUALIFICATION_REVIEW = 'QUALIFICATION_REVIEW',
  SITE_AUDIT = 'SITE_AUDIT',
  SAMPLE_TEST = 'SAMPLE_TEST',
  PILOT_RUN = 'PILOT_RUN',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

@Entity('scm_supplier_onboarding')
@Index('idx_scm_onboarding_supplier', ['tenantId', 'supplierId'])
@Index('idx_scm_onboarding_stage', ['tenantId', 'stage'])
export class ScmSupplierOnboarding {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'supplier_id', type: 'bigint' })
  supplierId!: string;

  @Column({
    type: 'enum',
    enum: OnboardingStage,
    default: OnboardingStage.QUALIFICATION_REVIEW,
  })
  stage!: OnboardingStage;

  @Column({ name: 'stage_data', type: 'json', nullable: true })
  stageData?: Record<string, any>;

  @Column({ name: 'current_approver_id', type: 'bigint', nullable: true })
  currentApproverId?: string;

  @Column({ name: 'approved_by', type: 'bigint', nullable: true })
  approvedBy?: string;

  @Column({ name: 'approved_at', type: 'timestamp', nullable: true })
  approvedAt?: Date;

  @Column({ length: 500, nullable: true })
  remarks?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
