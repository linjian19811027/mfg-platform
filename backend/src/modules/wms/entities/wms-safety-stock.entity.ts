import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('wms_safety_stock')
@Index('uk_wms_ss', ['tenantId', 'materialId', 'warehouseId'], { unique: true })
export class WmsSafetyStock {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ name: 'tenant_id', length: 50 }) tenantId!: string;
  @Column({ name: 'material_id', type: 'bigint' }) materialId!: string;
  @Column({ name: 'warehouse_id', type: 'bigint', nullable: true })
  warehouseId?: string;
  @Column({ name: 'safety_qty', type: 'decimal', precision: 18, scale: 6 })
  safetyQty!: number;
  @Column({
    name: 'reorder_qty',
    type: 'decimal',
    precision: 18,
    scale: 6,
    nullable: true,
  })
  reorderQty?: number;
  @Column({ name: 'uom_id', type: 'bigint' }) uomId!: string;
  @Column({ name: 'alert_enabled', type: 'tinyint', default: 1 })
  alertEnabled!: number;
  @Column({ length: 20, default: 'ACTIVE' }) status!: string;
  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @Column({ name: 'updated_by', type: 'bigint', nullable: true })
  updatedBy?: string;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}
