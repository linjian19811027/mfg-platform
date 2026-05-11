import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum OutsourcingOrderStatus {
  DRAFT = 'DRAFT',
  CONFIRMED = 'CONFIRMED',
  ISSUED = 'ISSUED',
  PARTIAL_RECEIVED = 'PARTIAL_RECEIVED',
  RECEIVED = 'RECEIVED',
  INSPECTING = 'INSPECTING',
  SETTLED = 'SETTLED',
  CLOSED = 'CLOSED',
  CANCELLED = 'CANCELLED',
}

@Entity('outsourcing_order')
@Index('uk_oc_no', ['tenantId', 'ocNo'], { unique: true })
@Index('idx_oc_status', ['tenantId', 'status'])
@Index('idx_oc_supplier', ['tenantId', 'supplierId'])
@Index('idx_oc_delivery', ['tenantId', 'plannedDelivery'])
export class OutsourcingOrder {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'oc_no', length: 30, nullable: true })
  ocNo?: string;

  @Column({ name: 'mes_wo_id', type: 'bigint', nullable: true })
  mesWoId?: string;

  @Column({ name: 'supplier_id', type: 'bigint' })
  supplierId!: string;

  @Column({ name: 'process_name', length: 100 })
  processName!: string;

  @Column({ name: 'material_id', type: 'bigint' })
  materialId!: string;

  @Column({ name: 'planned_qty', type: 'decimal', precision: 18, scale: 6 })
  plannedQty!: number;

  @Column({
    name: 'issued_qty',
    type: 'decimal',
    precision: 18,
    scale: 6,
    default: 0,
  })
  issuedQty!: number;

  @Column({
    name: 'received_qty',
    type: 'decimal',
    precision: 18,
    scale: 6,
    default: 0,
  })
  receivedQty!: number;

  @Column({
    name: 'inspected_qty',
    type: 'decimal',
    precision: 18,
    scale: 6,
    default: 0,
  })
  inspectedQty!: number;

  @Column({
    name: 'settled_qty',
    type: 'decimal',
    precision: 18,
    scale: 6,
    default: 0,
  })
  settledQty!: number;

  @Column({ name: 'unit_price', type: 'decimal', precision: 18, scale: 4 })
  unitPrice!: number;

  @Column({
    name: 'tax_rate',
    type: 'decimal',
    precision: 5,
    scale: 4,
    default: 0.13,
  })
  taxRate!: number;

  @Column({ length: 10, default: 'CNY' })
  currency!: string;

  @Column({ name: 'issue_warehouse_id', type: 'bigint' })
  issueWarehouseId!: string;

  @Column({ name: 'planned_delivery', type: 'date' })
  plannedDelivery!: Date;

  @Column({
    type: 'enum',
    enum: OutsourcingOrderStatus,
    default: OutsourcingOrderStatus.DRAFT,
  })
  status!: OutsourcingOrderStatus;

  @Column({ name: 'created_by', length: 50 })
  createdBy!: string;

  @Column({ type: 'text', nullable: true })
  remark?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
