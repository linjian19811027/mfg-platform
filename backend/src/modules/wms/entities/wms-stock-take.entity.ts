import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('wms_stock_take')
@Index('uk_wms_st', ['tenantId', 'stNo'], { unique: true })
export class WmsStockTake {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ name: 'tenant_id', length: 50 }) tenantId!: string;
  @Column({ name: 'st_no', length: 50 }) stNo!: string;
  /** PERIODIC | DYNAMIC | FULL */
  @Column({ name: 'take_type', length: 20 }) takeType!: string;
  @Column({ name: 'warehouse_id', type: 'bigint', nullable: true })
  warehouseId?: string;
  @Column({ name: 'zone_id', type: 'bigint', nullable: true }) zoneId?: string;
  /** DRAFT | IN_PROGRESS | COUNTING | REVIEWING | APPROVED | CLOSED */
  @Column({ length: 20, default: 'DRAFT' }) status!: string;
  @Column({ name: 'planned_date', type: 'date', nullable: true })
  plannedDate?: Date;
  @Column({ name: 'started_at', type: 'timestamp', nullable: true })
  startedAt?: Date;
  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt?: Date;
  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @Column({ name: 'updated_by', type: 'bigint', nullable: true })
  updatedBy?: string;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}

@Entity('wms_stock_take_line')
@Index('idx_wms_stl_take', ['stockTakeId'])
@Index('idx_wms_stl_location', ['locationId'])
export class WmsStockTakeLine {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ name: 'tenant_id', length: 50 }) tenantId!: string;
  @Column({ name: 'stock_take_id', type: 'bigint' }) stockTakeId!: string;
  @Column({ name: 'location_id', type: 'bigint' }) locationId!: string;
  @Column({ name: 'material_id', type: 'bigint' }) materialId!: string;
  @Column({ name: 'batch_id', type: 'bigint', nullable: true })
  batchId?: string;
  @Column({ name: 'book_qty', type: 'decimal', precision: 18, scale: 6 })
  bookQty!: number;
  @Column({
    name: 'count_qty',
    type: 'decimal',
    precision: 18,
    scale: 6,
    nullable: true,
  })
  countQty?: number;
  @Column({
    name: 'diff_qty',
    type: 'decimal',
    precision: 18,
    scale: 6,
    nullable: true,
  })
  diffQty?: number;
  @Column({ name: 'uom_id', type: 'bigint' }) uomId!: string;
  /** PENDING | COUNTED | APPROVED | ADJUSTED */
  @Column({ length: 20, default: 'PENDING' }) status!: string;
  @Column({ name: 'diff_reason', length: 500, nullable: true })
  diffReason?: string;
  @Column({ name: 'counted_by', type: 'bigint', nullable: true })
  countedBy?: string;
  @Column({ name: 'counted_at', type: 'timestamp', nullable: true })
  countedAt?: Date;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}
