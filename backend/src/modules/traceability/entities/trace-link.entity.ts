import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('trace_link')
@Index('idx_link_input', ['tenantId', 'inputBatchId'])
@Index('idx_link_output', ['tenantId', 'outputBatchId'])
export class TraceLink {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ name: 'tenant_id', length: 50 }) tenantId!: string;
  @Column({ name: 'input_batch_id', type: 'bigint' }) inputBatchId!: string;
  @Column({ name: 'output_batch_id', type: 'bigint' }) outputBatchId!: string;
  /** PRODUCTION | SPLIT | MERGE | REWORK */
  @Column({ name: 'link_type', length: 20, default: 'PRODUCTION' })
  linkType!: string;
  @Column({
    name: 'input_qty',
    type: 'decimal',
    precision: 18,
    scale: 6,
    default: 0,
  })
  inputQty!: number;
  @Column({ name: 'mes_wo_id', type: 'bigint', nullable: true })
  mesWoId?: string;
  @Column({ name: 'linked_at', type: 'datetime' }) linkedAt!: Date;
  @Column({ name: 'is_manual', type: 'tinyint', default: 0 }) isManual!: number;
  @Column({ name: 'manual_reason', type: 'text', nullable: true })
  manualReason?: string;
  @Column({ name: 'operator_id', length: 50, nullable: true })
  operatorId?: string;
  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @Column({ name: 'updated_by', type: 'bigint', nullable: true })
  updatedBy?: string;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}
