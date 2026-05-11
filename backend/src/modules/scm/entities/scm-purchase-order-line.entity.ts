import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum PoLineStatus {
  OPEN = 'OPEN',
  PARTIAL = 'PARTIAL',
  CLOSED = 'CLOSED',
}

@Entity('scm_purchase_order_line')
@Index('idx_scm_pol_po', ['poId'])
@Index('idx_scm_pol_material', ['materialId'])
export class ScmPurchaseOrderLine {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ name: 'tenant_id', length: 50 }) tenantId!: string;
  @Column({ name: 'po_id', type: 'bigint' }) poId!: string;
  @Column({ name: 'line_no', type: 'int' }) lineNo!: number;
  @Column({ name: 'material_id', type: 'bigint' }) materialId!: string;
  @Column({ type: 'decimal', precision: 18, scale: 6 }) quantity!: number;
  @Column({
    name: 'received_qty',
    type: 'decimal',
    precision: 18,
    scale: 6,
    default: 0,
  })
  receivedQty!: number;
  @Column({ name: 'uom_id', type: 'bigint' }) uomId!: string;
  @Column({ name: 'unit_price', type: 'decimal', precision: 18, scale: 4 })
  unitPrice!: number;
  @Column({ type: 'decimal', precision: 18, scale: 4 }) amount!: number;
  @Column({ name: 'expected_date', type: 'date', nullable: true })
  expectedDate?: Date;
  @Column({ length: 20, default: 'OPEN' }) status!: string;
  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @Column({ name: 'updated_by', type: 'bigint', nullable: true })
  updatedBy?: string;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}
