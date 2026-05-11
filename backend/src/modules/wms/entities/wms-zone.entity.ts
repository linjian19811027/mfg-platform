import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('wms_zone')
@Index('uk_wms_zone', ['tenantId', 'warehouseId', 'code'], { unique: true })
@Index('idx_wms_zone_wh', ['warehouseId'])
export class WmsZone {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ name: 'tenant_id', length: 50 }) tenantId!: string;
  @Column({ name: 'warehouse_id', type: 'bigint' }) warehouseId!: string;
  @Column({ length: 50 }) code!: string;
  @Column({ length: 100 }) name!: string;
  /** RAW_MATERIAL | SEMI_FINISHED | FINISHED | NONCONFORMING | SLOW_MOVING | QUARANTINE */
  @Column({ name: 'zone_type', length: 30, default: 'RAW_MATERIAL' })
  zoneType!: string;
  @Column({ length: 20, default: 'ACTIVE' }) status!: string;
  @Column({ name: 'sort_order', default: 0 }) sortOrder!: number;
  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @Column({ name: 'updated_by', type: 'bigint', nullable: true })
  updatedBy?: string;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}
