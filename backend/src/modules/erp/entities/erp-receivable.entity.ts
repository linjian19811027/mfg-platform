import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum ReceivableStatus {
  PENDING = 'PENDING',
  PARTIAL = 'PARTIAL',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
}

@Entity('erp_receivable')
@Index('uk_erp_receivable', ['tenantId', 'receivableNo'], { unique: true })
@Index('idx_erp_receivable_status', ['tenantId', 'status'])
@Index('idx_erp_receivable_customer', ['customerId'])
export class ErpReceivable {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'receivable_no', length: 50 })
  receivableNo!: string;

  @Column({ name: 'customer_id', type: 'bigint' })
  customerId!: string;

  @Column({ name: 'so_id', type: 'bigint' })
  soId!: string;

  @Column({ name: 'shipment_id', type: 'bigint', nullable: true })
  shipmentId?: string;

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

  @Column({
    type: 'enum',
    enum: ReceivableStatus,
    default: ReceivableStatus.PENDING,
  })
  status!: ReceivableStatus;

  @Column({ length: 10, default: 'CNY' })
  currency!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
