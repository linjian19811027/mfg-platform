import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('plm_ecn')
@Index('uk_plm_ecn', ['tenantId', 'ecnNo'], { unique: true })
@Index('idx_plm_ecn_ecr', ['ecrId'])
@Index('idx_plm_ecn_effective', ['effectiveDate'])
export class PlmEcn {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'ecn_no', length: 50 })
  ecnNo!: string;

  @Column({ name: 'ecr_id', type: 'bigint' })
  ecrId!: string;

  @Column({ length: 200 })
  title!: string;

  @Column({ name: 'effective_date', type: 'date' })
  effectiveDate!: Date;

  @Column({ name: 'change_items', type: 'json' })
  changeItems!: Record<string, unknown>[];

  @Column({ name: 'notify_modules', type: 'json', nullable: true })
  notifyModules?: string[];

  @Column({ length: 20, default: 'ISSUED' })
  status!: string; // ISSUED | EXECUTING | COMPLETED

  @Column({ name: 'issued_by', type: 'bigint', nullable: true })
  issuedBy?: string;

  @CreateDateColumn({ name: 'issued_at' })
  issuedAt!: Date;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt?: Date;
}
