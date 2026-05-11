import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('qms_inspection_record')
@Index('uk_qms_ir', ['tenantId', 'irNo'], { unique: true })
@Index('idx_qms_ir_material', ['tenantId', 'materialId'])
@Index('idx_qms_ir_batch', ['batchId'])
@Index('idx_qms_ir_wo', ['woId'])
export class QmsInspectionRecord {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ name: 'tenant_id', length: 50 }) tenantId!: string;
  @Column({ name: 'ir_no', length: 50 }) irNo!: string;
  /** IQC | IPQC | FQC | OQC | FIRST | PATROL | FINAL */
  @Column({ name: 'inspection_type', length: 20 }) inspectionType!: string;
  @Column({ name: 'standard_id', type: 'bigint', nullable: true })
  standardId?: string;
  @Column({ name: 'material_id', type: 'bigint' }) materialId!: string;
  @Column({ name: 'batch_id', type: 'bigint', nullable: true })
  batchId?: string;
  @Column({ name: 'wo_id', type: 'bigint', nullable: true }) woId?: string;
  @Column({ name: 'woo_id', type: 'bigint', nullable: true }) wooId?: string;
  @Column({ name: 'sample_qty', nullable: true }) sampleQty?: number;
  /** PASSED | FAILED | CONCESSION */
  @Column({ length: 20 }) result!: string;
  /** RELEASE | REWORK | SCRAP | CONCESSION | RETURN */
  @Column({ length: 20, nullable: true }) disposition?: string;
  @Column({ name: 'inspector_id', type: 'bigint', nullable: true })
  inspectorId?: string;
  @Column({ name: 'inspection_time', type: 'timestamp' }) inspectionTime!: Date;
  @Column({ name: 'items_data', type: 'json', nullable: true })
  itemsData?: Record<string, unknown>[];
  @Column({ length: 1000, nullable: true }) remarks?: string;
  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @Column({ name: 'updated_by', type: 'bigint', nullable: true })
  updatedBy?: string;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}
