import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

export enum SalesOrderLineStatus {
  OPEN = 'OPEN',
  PARTIAL = 'PARTIAL',
  CLOSED = 'CLOSED',
}

@Entity('erp_sales_order_line')
@Index('idx_erp_sol_so', ['soId'])
export class ErpSalesOrderLine {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'so_id', type: 'bigint' })
  soId!: string;

  @Column({ name: 'line_no', type: 'int' })
  lineNo!: number;

  @Column({ name: 'material_id', type: 'bigint' })
  materialId!: string;

  @Column({ type: 'decimal', precision: 18, scale: 6 })
  quantity!: number;

  @Column({
    name: 'shipped_qty',
    type: 'decimal',
    precision: 18,
    scale: 6,
    default: 0,
  })
  shippedQty!: number;

  @Column({ name: 'uom_id', type: 'bigint' })
  uomId!: string;

  @Column({ name: 'unit_price', type: 'decimal', precision: 18, scale: 4 })
  unitPrice!: number;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  amount!: number;

  @Column({ name: 'delivery_date', type: 'date', nullable: true })
  deliveryDate?: Date;

  @Column({
    type: 'enum',
    enum: SalesOrderLineStatus,
    default: SalesOrderLineStatus.OPEN,
  })
  status!: SalesOrderLineStatus;

  // 不使用数据库外键约束；级联删除由 SalesOrderService.void() 逻辑层保证
}
