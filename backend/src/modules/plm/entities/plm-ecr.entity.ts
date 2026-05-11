import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('plm_ecr')
@Index('uk_plm_ecr', ['tenantId', 'ecrNo'], { unique: true })
@Index('idx_plm_ecr_status', ['tenantId', 'status'])
export class PlmEcr {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'ecr_no', length: 50 })
  ecrNo!: string;

  @Column({ length: 200 })
  title!: string;

  @Column({ name: 'change_reason', length: 1000 })
  changeReason!: string;

  @Column({ name: 'change_type', length: 20 })
  changeType!: string; // MATERIAL | BOM | ROUTING | DOCUMENT

  @Column({ name: 'affected_items', type: 'json' })
  affectedItems!: Record<string, unknown>[];

  @Column({ name: 'impact_analysis', length: 2000, nullable: true })
  impactAnalysis?: string;

  @Column({ length: 20, default: 'NORMAL' })
  priority!: string; // URGENT | HIGH | NORMAL | LOW

  @Column({ length: 20, default: 'DRAFT' })
  status!: string; // DRAFT | SUBMITTED | APPROVED | REJECTED | CLOSED

  @Column({ name: 'submitted_by', type: 'bigint', nullable: true })
  submittedBy?: string;

  @Column({ name: 'submitted_at', type: 'timestamp', nullable: true })
  submittedAt?: Date;

  @Column({ name: 'approved_by', type: 'bigint', nullable: true })
  approvedBy?: string;

  @Column({ name: 'approved_at', type: 'timestamp', nullable: true })
  approvedAt?: Date;

  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
