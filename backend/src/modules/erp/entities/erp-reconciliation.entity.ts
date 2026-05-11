import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum ErpReconciliationStatus {
  DRAFT = 'DRAFT',
  CONFIRMED = 'CONFIRMED',
  DISCREPANCY = 'DISCREPANCY',
}

@Entity('erp_reconciliation')
@Index('uk_erp_recon', ['tenantId', 'reconNo'], { unique: true })
@Index('idx_erp_recon_customer', ['customerId'])
export class ErpReconciliation {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'recon_no', length: 50 })
  reconNo!: string;

  @Column({ name: 'customer_id', type: 'bigint' })
  customerId!: string;

  @Column({ name: 'period_start', type: 'date' })
  periodStart!: Date;

  @Column({ name: 'period_end', type: 'date' })
  periodEnd!: Date;

  @Column({
    name: 'shipment_amount',
    type: 'decimal',
    precision: 18,
    scale: 4,
    default: 0,
  })
  shipmentAmount!: number;

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
    enum: ErpReconciliationStatus,
    default: ErpReconciliationStatus.DRAFT,
  })
  status!: ErpReconciliationStatus;

  @Column({ type: 'json', nullable: true })
  items?: Record<string, any>[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
