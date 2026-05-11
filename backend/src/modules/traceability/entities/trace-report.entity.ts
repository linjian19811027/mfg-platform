import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('trace_report')
@Index('idx_trace_report_batch', ['tenantId', 'traceBatchId'])
export class TraceReport {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ name: 'tenant_id', length: 50 }) tenantId!: string;
  @Column({ name: 'trace_batch_id', type: 'bigint' }) traceBatchId!: string;
  /** PDF | EXCEL */
  @Column({ length: 10 }) format!: string;
  @Column({ name: 'file_path', length: 500 }) filePath!: string;
  @Column({ name: 'node_count', type: 'int', default: 0 }) nodeCount!: number;
  @Column({ name: 'has_missing_data', type: 'tinyint', default: 0 })
  hasMissingData!: number;
  @Column({ name: 'operator_id', length: 50 }) operatorId!: string;
  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @Column({ name: 'updated_by', type: 'bigint', nullable: true })
  updatedBy?: string;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}
