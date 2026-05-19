import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('wms_inventory')
@Index('uk_wms_inv', ['tenantId', 'materialId', 'batchId', 'locationId'], {
  unique: true,
})
@Index('idx_wms_inv_material', ['tenantId', 'materialId', 'status'])
@Index('idx_wms_inv_location', ['locationId'])
@Index('idx_wms_inv_query', [
  'tenantId',
  'materialId',
  'status',
  'availableQty',
])
export class WmsInventory {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ name: 'tenant_id', length: 50 }) tenantId!: string;
  @Column({ name: 'material_id', type: 'bigint' }) materialId!: string;
  /** 冗余字段：物料编码（避免跨模块查询 plm_material） */
  @Column({ name: 'material_code', length: 50, nullable: true }) materialCode?: string;
  /** 冗余字段：物料名称（避免跨模块查询 plm_material） */
  @Column({ name: 'material_name', length: 200, nullable: true }) materialName?: string;
  @Column({ name: 'batch_id', type: 'bigint', nullable: true })
  batchId?: string;
  @Column({ name: 'location_id', type: 'bigint' }) locationId!: string;
  @Column({ type: 'decimal', precision: 18, scale: 6, default: 0 })
  quantity!: number;
  @Column({
    name: 'available_qty',
    type: 'decimal',
    precision: 18,
    scale: 6,
    default: 0,
  })
  availableQty!: number;
  @Column({
    name: 'locked_qty',
    type: 'decimal',
    precision: 18,
    scale: 6,
    default: 0,
  })
  lockedQty!: number;
  @Column({ name: 'uom_id', type: 'bigint' }) uomId!: string;
  /** AVAILABLE | QUARANTINE | LOCKED | EXPIRED */
  @Column({ length: 20, default: 'AVAILABLE' }) status!: string;
  /** UNINSPECTED | QUALIFIED | UNQUALIFIED | CONCESSION */
  @Column({ name: 'quality_status', length: 20, default: 'UNINSPECTED' })
  qualityStatus!: string;
  @Column({ name: 'freeze_reason', length: 30, nullable: true })
  freezeReason?: string;
  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @Column({ name: 'updated_by', type: 'bigint', nullable: true })
  updatedBy?: string;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}
