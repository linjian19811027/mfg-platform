import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('trace_recall_assessment')
@Index('idx_recall_batch', ['tenantId', 'problemBatchId'])
export class TraceRecallAssessment {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ name: 'tenant_id', length: 50 }) tenantId!: string;
  @Column({ name: 'assessment_no', length: 50, unique: true })
  assessmentNo!: string;
  @Column({ name: 'problem_batch_id', type: 'bigint' }) problemBatchId!: string;
  @Column({ type: 'int', default: 1 }) version!: number;
  /** CALCULATING | COMPLETED | FAILED */
  @Column({ length: 20, default: 'CALCULATING' }) status!: string;
  @Column({ name: 'affected_customers', type: 'int', default: 0 })
  affectedCustomers!: number;
  @Column({ name: 'affected_so_count', type: 'int', default: 0 })
  affectedSoCount!: number;
  @Column({ name: 'affected_output_batches', type: 'int', default: 0 })
  affectedOutputBatches!: number;
  @Column({ name: 'affected_input_batches', type: 'int', default: 0 })
  affectedInputBatches!: number;
  @Column({ name: 'affected_suppliers', type: 'int', default: 0 })
  affectedSuppliers!: number;
  @Column({
    name: 'in_stock_qty',
    type: 'decimal',
    precision: 18,
    scale: 6,
    default: 0,
  })
  inStockQty!: number;
  @Column({ name: 'high_risk_count', type: 'int', default: 0 })
  highRiskCount!: number;
  @Column({ name: 'medium_risk_count', type: 'int', default: 0 })
  mediumRiskCount!: number;
  @Column({ name: 'low_risk_count', type: 'int', default: 0 })
  lowRiskCount!: number;
  @Column({ name: 'operator_id', length: 50 }) operatorId!: string;
  @Column({ name: 'completed_at', type: 'datetime', nullable: true })
  completedAt?: Date;
  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @Column({ name: 'updated_by', type: 'bigint', nullable: true })
  updatedBy?: string;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}
