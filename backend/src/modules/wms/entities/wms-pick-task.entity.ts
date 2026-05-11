import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('wms_pick_task')
@Index('uk_wms_pt', ['tenantId', 'taskNo'], { unique: true })
@Index('idx_wms_pt_picker', ['tenantId', 'pickerId'])
export class WmsPickTask {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ name: 'tenant_id', length: 50 }) tenantId!: string;
  @Column({ name: 'task_no', length: 50 }) taskNo!: string;
  /** SINGLE | WAVE */
  @Column({ name: 'task_type', length: 20, default: 'SINGLE' })
  taskType!: string;
  @Column({ name: 'source_type', length: 20, nullable: true })
  sourceType?: string;
  @Column({ name: 'source_id', length: 50, nullable: true }) sourceId?: string;
  @Column({ name: 'picker_id', type: 'bigint', nullable: true })
  pickerId?: string;
  /** PENDING | IN_PROGRESS | COMPLETED | CANCELLED */
  @Column({ length: 20, default: 'PENDING' }) status!: string;
  @Column({ name: 'pick_path', type: 'json', nullable: true })
  pickPath?: string[];
  @Column({ name: 'assigned_at', type: 'timestamp', nullable: true })
  assignedAt?: Date;
  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt?: Date;
  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @Column({ name: 'updated_by', type: 'bigint', nullable: true })
  updatedBy?: string;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}

@Entity('wms_pick_task_line')
@Index('idx_wms_ptl_task', ['pickTaskId'])
export class WmsPickTaskLine {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ name: 'tenant_id', length: 50 }) tenantId!: string;
  @Column({ name: 'pick_task_id', type: 'bigint' }) pickTaskId!: string;
  @Column({ name: 'material_id', type: 'bigint' }) materialId!: string;
  @Column({ name: 'batch_id', type: 'bigint', nullable: true })
  batchId?: string;
  @Column({ name: 'from_location_id', type: 'bigint' }) fromLocationId!: string;
  @Column({ name: 'required_qty', type: 'decimal', precision: 18, scale: 6 })
  requiredQty!: number;
  @Column({
    name: 'picked_qty',
    type: 'decimal',
    precision: 18,
    scale: 6,
    default: 0,
  })
  pickedQty!: number;
  @Column({ name: 'uom_id', type: 'bigint' }) uomId!: string;
  @Column({ length: 20, default: 'PENDING' }) status!: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}
