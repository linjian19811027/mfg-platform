import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum SalesOrderStatus {
  DRAFT = 'DRAFT',
  CONFIRMED = 'CONFIRMED',
  IN_PRODUCTION = 'IN_PRODUCTION',
  SHIPPED = 'SHIPPED',
  CLOSED = 'CLOSED',
}

@Entity('erp_sales_order')
@Index('uk_erp_so', ['tenantId', 'soNo'], { unique: true })
@Index('idx_erp_so_status', ['tenantId', 'status'])
@Index('idx_erp_so_customer', ['customerId'])
export class ErpSalesOrder {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'so_no', length: 50 })
  soNo!: string;

  @Column({ name: 'customer_id', type: 'bigint' })
  customerId!: string;

  @Column({ name: 'quotation_id', type: 'bigint', nullable: true })
  quotationId?: string;

  @Column({ name: 'order_date', type: 'date' })
  orderDate!: Date;

  @Column({ name: 'delivery_date', type: 'date', nullable: true })
  deliveryDate?: Date;

  @Column({
    type: 'enum',
    enum: SalesOrderStatus,
    default: SalesOrderStatus.DRAFT,
  })
  status!: SalesOrderStatus;

  @Column({
    name: 'total_amount',
    type: 'decimal',
    precision: 18,
    scale: 4,
    default: 0,
  })
  totalAmount!: number;

  @Column({
    name: 'tax_amount',
    type: 'decimal',
    precision: 18,
    scale: 4,
    default: 0,
  })
  taxAmount!: number;

  @Column({ length: 10, default: 'CNY' })
  currency!: string;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @Column({ name: 'change_log', type: 'json', nullable: true })
  changeLog?: Record<string, any>[];

  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
