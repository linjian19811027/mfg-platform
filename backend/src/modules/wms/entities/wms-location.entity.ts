import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('wms_location')
@Index('uk_wms_loc', ['tenantId', 'warehouseId', 'code'], { unique: true })
@Index('idx_wms_loc_zone', ['zoneId'])
export class WmsLocation {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ name: 'tenant_id', length: 50 }) tenantId!: string;
  @Column({ name: 'warehouse_id', type: 'bigint' }) warehouseId!: string;
  @Column({ name: 'zone_id', type: 'bigint', nullable: true }) zoneId?: string;
  @Column({ length: 50 }) code!: string;
  @Column({ length: 100, nullable: true }) name?: string;
  @Column({ length: 20, default: 'STORAGE' }) type!: string;
  @Column({
    name: 'max_weight',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  maxWeight?: number;
  @Column({
    name: 'max_volume',
    type: 'decimal',
    precision: 10,
    scale: 4,
    nullable: true,
  })
  maxVolume?: number;
  @Column({
    name: 'min_temp',
    type: 'decimal',
    precision: 5,
    scale: 1,
    nullable: true,
  })
  minTemp?: number;
  @Column({
    name: 'max_temp',
    type: 'decimal',
    precision: 5,
    scale: 1,
    nullable: true,
  })
  maxTemp?: number;
  @Column({
    name: 'min_humidity',
    type: 'decimal',
    precision: 5,
    scale: 1,
    nullable: true,
  })
  minHumidity?: number;
  @Column({
    name: 'max_humidity',
    type: 'decimal',
    precision: 5,
    scale: 1,
    nullable: true,
  })
  maxHumidity?: number;
  @Column({ name: 'special_requirements', type: 'json', nullable: true })
  specialRequirements?: string[];
  @Column({ name: 'abc_class', length: 1, nullable: true }) abcClass?: string;
  @Column({ length: 20, default: 'ACTIVE' }) status!: string;
  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @Column({ name: 'updated_by', type: 'bigint', nullable: true })
  updatedBy?: string;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}
