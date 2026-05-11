import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('qms_nonconformance')
@Index('uk_qms_nc', ['tenantId', 'ncNo'], { unique: true })
@Index('idx_qms_nc_material', ['materialId'])
@Index('idx_qms_nc_status', ['tenantId', 'status'])
export class QmsNonconformance {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ name: 'tenant_id', length: 50 }) tenantId!: string;
  @Column({ name: 'nc_no', length: 50 }) ncNo!: string;
  @Column({ name: 'ir_id', type: 'bigint', nullable: true }) irId?: string;
  @Column({ name: 'material_id', type: 'bigint' }) materialId!: string;
  @Column({ name: 'batch_id', type: 'bigint', nullable: true })
  batchId?: string;
  @Column({ name: 'wo_id', type: 'bigint', nullable: true }) woId?: string;
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true })
  quantity?: number;
  @Column({ name: 'defect_type', length: 50, nullable: true })
  defectType?: string;
  @Column({ name: 'defect_description', length: 500, nullable: true })
  defectDescription?: string;
  /** REWORK | REPAIR | SCRAP | CONCESSION | RETURN */
  @Column({ length: 20, nullable: true }) disposition?: string;
  /** OPEN | IN_REVIEW | CLOSED */
  @Column({ length: 20, default: 'OPEN' }) status!: string;
  @Column({ name: 'root_cause', length: 1000, nullable: true })
  rootCause?: string;
  @Column({ name: 'corrective_action', length: 1000, nullable: true })
  correctiveAction?: string;
  @Column({ name: 'rework_wo_id', type: 'bigint', nullable: true })
  reworkWoId?: string;
  @Column({
    name: 'rework_cost',
    type: 'decimal',
    precision: 18,
    scale: 4,
    nullable: true,
  })
  reworkCost?: number;
  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @Column({ name: 'updated_by', type: 'bigint', nullable: true })
  updatedBy?: string;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}
