import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('material_batch')
@Index('idx_batch_material', ['tenantId', 'materialId'])
@Index('idx_batch_source', ['sourceType', 'sourceId'])
@Index('idx_batch_quality', ['tenantId', 'qualityStatus'])
export class MaterialBatch {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'batch_no', length: 100 })
  batchNo!: string;

  @Column({ name: 'material_id', type: 'bigint' })
  materialId!: string;

  @Column({ name: 'source_type', length: 20 })
  sourceType!: string; // PURCHASE | PRODUCTION | RETURN | ADJUST

  @Column({ name: 'source_id', length: 50, nullable: true })
  sourceId?: string;

  @Column({ name: 'supplier_id', type: 'bigint', nullable: true })
  supplierId?: string;

  @Column({ name: 'initial_qty', type: 'decimal', precision: 18, scale: 6 })
  initialQty!: number;

  @Column({ name: 'current_qty', type: 'decimal', precision: 18, scale: 6 })
  currentQty!: number;

  @Column({ name: 'uom_id', type: 'bigint' })
  uomId!: string;

  @Column({ name: 'quality_status', length: 20, default: 'UNINSPECTED' })
  qualityStatus!: string;

  @Column({ name: 'produced_at', type: 'timestamp', nullable: true })
  producedAt?: Date;

  @Column({ name: 'expire_at', type: 'timestamp', nullable: true })
  expireAt?: Date;

  @Column({ name: 'supplier_batch_no', length: 100, nullable: true })
  supplierBatchNo?: string;

  @Column({ name: 'certificate_no', length: 100, nullable: true })
  certificateNo?: string;

  @Column({ type: 'json', nullable: true })
  attributes?: Record<string, unknown>;

  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
