import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('trace_batch')
@Index('idx_trace_material', ['tenantId', 'materialId', 'batchNo'])
@Index('idx_trace_wo', ['tenantId', 'mesWoId'])
export class TraceBatch {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ name: 'tenant_id', length: 50 }) tenantId!: string;
  @Column({ name: 'trace_code', length: 100, unique: true }) traceCode!: string;
  @Column({ name: 'material_id', type: 'bigint' }) materialId!: string;
  @Column({ name: 'material_code', length: 100 }) materialCode!: string;
  @Column({ name: 'material_name', length: 200 }) materialName!: string;
  @Column({ name: 'batch_no', length: 100 }) batchNo!: string;
  @Column({ name: 'mes_wo_id', type: 'bigint', nullable: true })
  mesWoId?: string;
  @Column({ name: 'mes_batch_id', type: 'bigint', nullable: true })
  mesBatchId?: string;
  @Column({ name: 'wms_batch_id', type: 'bigint', nullable: true })
  wmsBatchId?: string;
  @Column({ name: 'scm_po_id', type: 'bigint', nullable: true })
  scmPoId?: string;
  @Column({ name: 'erp_so_id', type: 'bigint', nullable: true })
  erpSoId?: string;
  @Column({
    name: 'planned_qty',
    type: 'decimal',
    precision: 18,
    scale: 6,
    default: 0,
  })
  plannedQty!: number;
  @Column({
    name: 'actual_qty',
    type: 'decimal',
    precision: 18,
    scale: 6,
    default: 0,
  })
  actualQty!: number;
  @Column({ name: 'uom_id', type: 'bigint', nullable: true }) uomId?: string;
  /** PENDING | PASSED | FAILED | CONCESSION */
  @Column({ name: 'inspection_status', length: 20, default: 'PENDING' })
  inspectionStatus!: string;
  /** IN_STOCK | SHIPPED | CONSUMED | FROZEN */
  @Column({ name: 'inventory_status', length: 20, default: 'IN_STOCK' })
  inventoryStatus!: string;
  @Column({ name: 'is_frozen', type: 'tinyint', default: 0 }) isFrozen!: number;
  @Column({ name: 'freeze_reason', length: 200, nullable: true })
  freezeReason?: string;
  @Column({ name: 'is_archived', type: 'tinyint', default: 0 })
  isArchived!: number;
  @Column({ name: 'production_start', type: 'datetime', nullable: true })
  productionStart?: Date;
  @Column({ name: 'production_end', type: 'datetime', nullable: true })
  productionEnd?: Date;
  @Column({ name: 'operator_id', length: 50, nullable: true })
  operatorId?: string;
  @Column({ name: 'barcode_path', length: 500, nullable: true })
  barcodePath?: string;
  @Column({ name: 'qrcode_path', length: 500, nullable: true })
  qrcodePath?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}
