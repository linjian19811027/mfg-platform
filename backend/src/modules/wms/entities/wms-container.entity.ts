import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('wms_container')
@Index('uk_wms_container', ['tenantId', 'barcode'], { unique: true })
@Index('idx_wms_container_loc', ['locationId'])
export class WmsContainer {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ name: 'tenant_id', length: 50 }) tenantId!: string;
  @Column({ length: 50 }) barcode!: string;
  /** PALLET | BOX | TRAY | RACK */
  @Column({ name: 'container_type', length: 20 }) containerType!: string;
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
  @Column({ name: 'location_id', type: 'bigint', nullable: true })
  locationId?: string;
  /** EMPTY | IN_USE | DAMAGED | RETIRED */
  @Column({ length: 20, default: 'EMPTY' }) status!: string;
  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @Column({ name: 'updated_by', type: 'bigint', nullable: true })
  updatedBy?: string;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}
