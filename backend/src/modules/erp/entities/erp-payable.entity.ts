import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum PayableStatus {
  PENDING = 'PENDING',
  PARTIAL = 'PARTIAL',
  PAID = 'PAID',
}

@Entity('erp_payable')
@Index('uk_erp_payable', ['tenantId', 'payableNo'], { unique: true })
@Index('idx_erp_payable_status', ['tenantId', 'status'])
export class ErpPayable {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'payable_no', length: 50 })
  payableNo!: string;

  @Column({ name: 'supplier_id', type: 'bigint' })
  supplierId!: string;

  @Column({ name: 'recon_id', type: 'bigint', nullable: true })
  reconId?: string;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  amount!: number;

  @Column({
    name: 'paid_amount',
    type: 'decimal',
    precision: 18,
    scale: 4,
    default: 0,
  })
  paidAmount!: number;

  @Column({ name: 'due_date', type: 'date' })
  dueDate!: Date;

  @Column({ type: 'enum', enum: PayableStatus, default: PayableStatus.PENDING })
  status!: PayableStatus;

  @Column({ name: 'payment_plan', type: 'json', nullable: true })
  paymentPlan?: Record<string, any>[];

  @Column({ length: 10, default: 'CNY' })
  currency!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
