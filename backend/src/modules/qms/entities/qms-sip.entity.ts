import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('qms_sip')
@Index('uk_qms_sip', ['tenantId', 'code', 'version'], { unique: true })
export class QmsSip {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ name: 'tenant_id', length: 50 }) tenantId!: string;
  @Column({ length: 50 }) code!: string;
  @Column({ length: 200 }) title!: string;
  @Column({ name: 'standard_id', type: 'bigint', nullable: true })
  standardId?: string;
  @Column({ default: 1 }) version!: number;
  @Column({ type: 'text', nullable: true }) content?: string;
  @Column({ name: 'video_url', length: 500, nullable: true }) videoUrl?: string;
  @Column({ name: 'file_ids', type: 'json', nullable: true })
  fileIds?: string[];
  @Column({ length: 20, default: 'DRAFT' }) status!: string;
  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @Column({ name: 'updated_by', type: 'bigint', nullable: true })
  updatedBy?: string;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}

@Entity('qms_final_inspection')
@Index('idx_qms_fi_material', ['tenantId', 'materialId'])
export class QmsFinalInspection {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ name: 'tenant_id', length: 50 }) tenantId!: string;
  @Column({ name: 'ir_id', type: 'bigint' }) irId!: string;
  @Column({ name: 'material_id', type: 'bigint' }) materialId!: string;
  @Column({ name: 'batch_id', type: 'bigint', nullable: true })
  batchId?: string;
  /** INBOUND | OUTBOUND | TYPE_TEST */
  @Column({ name: 'fi_type', length: 20 }) fiType!: string;
  @Column({ length: 20 }) result!: string;
  @Column({ name: 'report_url', length: 500, nullable: true })
  reportUrl?: string;
  @Column({ name: 'certificate_no', length: 100, nullable: true })
  certificateNo?: string;
  @Column({ name: 'inspector_id', type: 'bigint', nullable: true })
  inspectorId?: string;
  @Column({ name: 'inspection_time', type: 'timestamp' }) inspectionTime!: Date;
  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @Column({ name: 'updated_by', type: 'bigint', nullable: true })
  updatedBy?: string;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}

@Entity('qms_supplier_quality_record')
@Index('idx_qms_sqr_supplier', ['tenantId', 'supplierId'])
export class QmsSupplierQualityRecord {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ name: 'tenant_id', length: 50 }) tenantId!: string;
  @Column({ name: 'supplier_id', type: 'bigint' }) supplierId!: string;
  @Column({ name: 'material_id', type: 'bigint', nullable: true })
  materialId?: string;
  @Column({ name: 'period_month', length: 7 }) periodMonth!: string;
  @Column({
    name: 'total_qty',
    type: 'decimal',
    precision: 18,
    scale: 6,
    default: 0,
  })
  totalQty!: number;
  @Column({
    name: 'qualified_qty',
    type: 'decimal',
    precision: 18,
    scale: 6,
    default: 0,
  })
  qualifiedQty!: number;
  @Column({
    name: 'pass_rate',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
  })
  passRate!: number;
  @Column({ name: 'defect_distribution', type: 'json', nullable: true })
  defectDistribution?: Record<string, unknown>;
  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @Column({ name: 'updated_by', type: 'bigint', nullable: true })
  updatedBy?: string;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}

@Entity('qms_customer_complaint')
@Index('idx_qms_cc_status', ['tenantId', 'status'])
export class QmsCustomerComplaint {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ name: 'tenant_id', length: 50 }) tenantId!: string;
  @Column({ name: 'complaint_no', length: 50 }) complaintNo!: string;
  @Column({ name: 'customer_id', type: 'bigint', nullable: true })
  customerId?: string;
  @Column({ name: 'material_id', type: 'bigint', nullable: true })
  materialId?: string;
  @Column({ name: 'batch_id', type: 'bigint', nullable: true })
  batchId?: string;
  @Column({ length: 200 }) title!: string;
  @Column({ length: 2000, nullable: true }) description?: string;
  @Column({ length: 20, default: 'OPEN' }) status!: string;
  @Column({ name: 'satisfaction_score', nullable: true })
  satisfactionScore?: number;
  @Column({ name: 'closed_at', type: 'timestamp', nullable: true })
  closedAt?: Date;
  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @Column({ name: 'updated_by', type: 'bigint', nullable: true })
  updatedBy?: string;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}

@Entity('qms_recall')
@Index('idx_qms_recall_status', ['tenantId', 'status'])
export class QmsRecall {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ name: 'tenant_id', length: 50 }) tenantId!: string;
  @Column({ name: 'recall_no', length: 50 }) recallNo!: string;
  @Column({ length: 200 }) title!: string;
  @Column({ name: 'material_id', type: 'bigint' }) materialId!: string;
  @Column({ name: 'affected_batches', type: 'json' })
  affectedBatches!: string[];
  @Column({ name: 'affected_customers', type: 'json', nullable: true })
  affectedCustomers?: string[];
  @Column({ length: 20, default: 'INITIATED' }) status!: string;
  @Column({ name: 'recall_reason', length: 1000, nullable: true })
  recallReason?: string;
  @Column({ name: 'execution_records', type: 'json', nullable: true })
  executionRecords?: Record<string, unknown>[];
  @Column({ name: 'report_url', length: 500, nullable: true })
  reportUrl?: string;
  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @Column({ name: 'updated_by', type: 'bigint', nullable: true })
  updatedBy?: string;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}
