import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('qms_inspection_standard')
@Index('uk_qms_std', ['tenantId', 'code', 'version'], { unique: true })
@Index('idx_qms_std_material', ['tenantId', 'materialId'])
export class QmsInspectionStandard {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ name: 'tenant_id', length: 50 }) tenantId!: string;
  @Column({ length: 50 }) code!: string;
  @Column({ length: 100 }) name!: string;
  /** IQC | IPQC | FQC | OQC */
  @Column({ name: 'inspection_type', length: 20 }) inspectionType!: string;
  @Column({ name: 'material_id', type: 'bigint', nullable: true })
  materialId?: string;
  @Column({ default: 1 }) version!: number;
  @Column({ length: 20, default: 'ACTIVE' }) status!: string;
  @Column({ type: 'json' }) items!: Record<string, unknown>[];
  @Column({ name: 'sampling_plan', type: 'json', nullable: true })
  samplingPlan?: Record<string, unknown>;
  @Column({ name: 'effective_date', type: 'date', nullable: true })
  effectiveDate?: Date;
  @Column({ name: 'change_history', type: 'json', nullable: true })
  changeHistory?: Record<string, unknown>[];
  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @Column({ name: 'updated_by', type: 'bigint', nullable: true })
  updatedBy?: string;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}

@Entity('qms_inspection_item')
@Index('idx_qms_item_std', ['standardId'])
export class QmsInspectionItem {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ name: 'tenant_id', length: 50 }) tenantId!: string;
  @Column({ name: 'standard_id', type: 'bigint', nullable: true })
  standardId?: string;
  @Column({ length: 100 }) name!: string;
  /** NUMERIC | COUNT | QUALITATIVE | QUANTITATIVE */
  @Column({ length: 20 }) type!: string;
  @Column({ length: 50, nullable: true }) unit?: string;
  @Column({ name: 'std_value', length: 100, nullable: true }) stdValue?: string;
  @Column({
    name: 'min_value',
    type: 'decimal',
    precision: 18,
    scale: 6,
    nullable: true,
  })
  minValue?: number;
  @Column({
    name: 'max_value',
    type: 'decimal',
    precision: 18,
    scale: 6,
    nullable: true,
  })
  maxValue?: number;
  @Column({ length: 100, nullable: true }) method?: string;
  @Column({ length: 100, nullable: true }) instrument?: string;
  @Column({ name: 'is_required', type: 'tinyint', default: 1 })
  isRequired!: number;
  @Column({ name: 'sort_order', default: 0 }) sortOrder!: number;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}
