import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum PoStatus {
  DRAFT = 'DRAFT',
  CONFIRMED = 'CONFIRMED',
  PARTIAL = 'PARTIAL',
  RECEIVED = 'RECEIVED',
  CLOSED = 'CLOSED',
}

@Entity('scm_purchase_order')
@Index('uk_scm_po', ['tenantId', 'poNo'], { unique: true })
@Index('idx_scm_po_supplier', ['supplierId'])
@Index('idx_scm_po_status', ['tenantId', 'status'])
export class ScmPurchaseOrder {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'po_no', length: 50 })
  poNo!: string;

  @Column({ name: 'supplier_id', type: 'bigint' })
  supplierId!: string;

  @Column({ name: 'pr_id', type: 'bigint', nullable: true })
  prId?: string;

  @Column({ name: 'order_date', type: 'date' })
  orderDate!: Date;

  @Column({ name: 'expected_date', type: 'date', nullable: true })
  expectedDate?: Date;

  @Column({ type: 'enum', enum: PoStatus, default: PoStatus.DRAFT })
  status!: PoStatus;

  @Column({
    name: 'total_amount',
    type: 'decimal',
    precision: 18,
    scale: 4,
    default: 0,
  })
  totalAmount!: number;

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
