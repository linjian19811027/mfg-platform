import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('qms_corrective_action')
@Index('idx_qms_ca_nc', ['ncId'])
@Index('idx_qms_ca_status', ['tenantId', 'status'])
export class QmsCorrectiveAction {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ name: 'tenant_id', length: 50 }) tenantId!: string;
  @Column({ name: 'nc_id', type: 'bigint', nullable: true }) ncId?: string;
  @Column({ length: 200 }) title!: string;
  /** 5Why 根因分析 JSON：[{why, answer}] */
  @Column({ name: 'five_why', type: 'json', nullable: true }) fiveWhy?: Record<
    string,
    unknown
  >[];
  /** 鱼骨图要素 JSON：{man, machine, material, method, environment, measurement} */
  @Column({ name: 'fishbone', type: 'json', nullable: true }) fishbone?: Record<
    string,
    unknown
  >;
  @Column({ name: 'action_plan', length: 2000, nullable: true })
  actionPlan?: string;
  @Column({ name: 'responsible_id', type: 'bigint', nullable: true })
  responsibleId?: string;
  @Column({ name: 'due_date', type: 'date', nullable: true }) dueDate?: Date;
  /** OPEN | IN_PROGRESS | VERIFYING | CLOSED | INEFFECTIVE */
  @Column({ length: 20, default: 'OPEN' }) status!: string;
  @Column({ name: 'verification_result', length: 500, nullable: true })
  verificationResult?: string;
  @Column({ name: 'verified_by', type: 'bigint', nullable: true })
  verifiedBy?: string;
  @Column({ name: 'verified_at', type: 'timestamp', nullable: true })
  verifiedAt?: Date;
  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @Column({ name: 'updated_by', type: 'bigint', nullable: true })
  updatedBy?: string;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}
