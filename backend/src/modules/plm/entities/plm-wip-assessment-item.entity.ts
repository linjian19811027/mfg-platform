import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('plm_wip_assessment_item')
@Index('idx_plm_wip_item_assessment', ['assessmentId'])
@Index('idx_plm_wip_item_wo', ['mesWoId'])
export class PlmWipAssessmentItem {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'assessment_id', type: 'bigint' })
  assessmentId!: string;

  /** MES 工单 ID（只存 ID，不做外键约束） */
  @Column({ name: 'mes_wo_id', type: 'bigint' })
  mesWoId!: string;

  @Column({ name: 'wo_no', length: 50 })
  woNo!: string;

  @Column({
    name: 'completion_pct',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
  })
  completionPct!: number;

  @Column({
    type: 'enum',
    enum: ['CONTINUE_OLD', 'SWITCH_NEW', 'SUSPEND_REVIEW'],
  })
  suggestion!: string;

  @Column({
    name: 'override_suggestion',
    type: 'enum',
    enum: ['CONTINUE_OLD', 'SWITCH_NEW'],
    nullable: true,
  })
  overrideSuggestion?: string;

  @Column({ name: 'override_by', length: 50, nullable: true })
  overrideBy?: string;

  @Column({ name: 'override_reason', type: 'text', nullable: true })
  overrideReason?: string;

  @Column({ name: 'confirmed_at', type: 'datetime', nullable: true })
  confirmedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
