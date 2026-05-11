import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum SalesReturnStatus {
  PENDING = 'PENDING',
  INSPECTING = 'INSPECTING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  STOCKED = 'STOCKED',
}

@Entity('erp_sales_return')
@Index('uk_erp_return', ['tenantId', 'returnNo'], { unique: true })
@Index('idx_erp_return_so', ['soId'])
@Index('idx_erp_return_customer', ['customerId'])
export class ErpSalesReturn {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'return_no', length: 50 })
  returnNo!: string;

  @Column({ name: 'so_id', type: 'bigint' })
  soId!: string;

  @Column({ name: 'customer_id', type: 'bigint' })
  customerId!: string;

  @Column({ name: 'return_date', type: 'date' })
  returnDate!: Date;

  @Column({ length: 500, nullable: true })
  reason?: string;

  @Column({
    type: 'enum',
    enum: SalesReturnStatus,
    default: SalesReturnStatus.PENDING,
  })
  status!: SalesReturnStatus;

  @Column({ type: 'json', nullable: true })
  items?: Record<string, any>[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
