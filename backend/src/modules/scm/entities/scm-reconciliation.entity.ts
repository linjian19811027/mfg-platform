import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum ReconciliationStatus {
  DRAFT = 'DRAFT',
  CONFIRMED = 'CONFIRMED',
  DISCREPANCY = 'DISCREPANCY',
}

@Entity('scm_reconciliation')
@Index('uk_scm_recon', ['tenantId', 'reconNo'], { unique: true })
@Index('idx_scm_recon_supplier', ['supplierId'])
@Index('idx_scm_recon_period', ['tenantId', 'periodStart', 'periodEnd'])
export class ScmReconciliation {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'recon_no', length: 50 })
  reconNo!: string;

  @Column({ name: 'supplier_id', type: 'bigint' })
  supplierId!: string;

  @Column({ name: 'period_start', type: 'date' })
  periodStart!: Date;

  @Column({ name: 'period_end', type: 'date' })
  periodEnd!: Date;

  @Column({
    name: 'receipt_amount',
    type: 'decimal',
    precision: 18,
    scale: 4,
    default: 0,
  })
  receiptAmount!: number;

  @Column({
    name: 'invoice_amount',
    type: 'decimal',
    precision: 18,
    scale: 4,
    default: 0,
  })
  invoiceAmount!: number;

  @Column({
    name: 'diff_amount',
    type: 'decimal',
    precision: 18,
    scale: 4,
    default: 0,
  })
  diffAmount!: number;

  @Column({
    type: 'enum',
    enum: ReconciliationStatus,
    default: ReconciliationStatus.DRAFT,
  })
  status!: ReconciliationStatus;

  @Column({ type: 'json', nullable: true })
  items?: Record<string, any>[];

  @Column({ name: 'payable_created', type: 'tinyint', default: 0 })
  payableCreated!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
