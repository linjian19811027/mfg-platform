import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type ConversionStatus =
  | 'PLANNED'
  | 'RELEASED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'CLOSED';

// 合法的状态流转
export const STATUS_TRANSITIONS: Record<ConversionStatus, ConversionStatus[]> =
  {
    PLANNED: ['RELEASED'],
    RELEASED: ['RUNNING', 'CLOSED'],
    RUNNING: ['COMPLETED', 'CLOSED'],
    COMPLETED: ['CLOSED'],
    CLOSED: [],
  };

@Entity('conversion_instance')
@Index('idx_ci_tenant_status', ['tenantId', 'status'])
@Index('idx_ci_definition', ['definitionId'])
@Index('idx_ci_trace_cover', [
  'tenantId',
  'businessType',
  'businessId',
  'status',
  'id',
])
export class ConversionInstance {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'definition_id', type: 'bigint' })
  definitionId!: string;

  @Column({ name: 'definition_version' })
  definitionVersion!: number;

  @Column({ name: 'business_type', length: 20 })
  businessType!: string;

  @Column({ name: 'business_id', length: 50 })
  businessId!: string;

  @Column({ name: 'business_no', length: 50, nullable: true })
  businessNo?: string;

  @Column({ name: 'organization_id', type: 'bigint', nullable: true })
  organizationId?: string;

  @Column({ length: 20, default: 'PLANNED' })
  status!: ConversionStatus;

  @Column({ name: 'planned_start', type: 'timestamp', nullable: true })
  plannedStart?: Date;

  @Column({ name: 'planned_end', type: 'timestamp', nullable: true })
  plannedEnd?: Date;

  @Column({ name: 'actual_start', type: 'timestamp', nullable: true })
  actualStart?: Date;

  @Column({ name: 'actual_end', type: 'timestamp', nullable: true })
  actualEnd?: Date;

  @Column({
    name: 'material_cost',
    type: 'decimal',
    precision: 18,
    scale: 4,
    default: 0,
  })
  materialCost!: number;

  @Column({
    name: 'labor_cost',
    type: 'decimal',
    precision: 18,
    scale: 4,
    default: 0,
  })
  laborCost!: number;

  @Column({
    name: 'overhead_cost',
    type: 'decimal',
    precision: 18,
    scale: 4,
    default: 0,
  })
  overheadCost!: number;

  @Column({
    name: 'total_cost',
    type: 'decimal',
    precision: 18,
    scale: 4,
    default: 0,
  })
  totalCost!: number;

  @Column({ name: 'quality_status', length: 20, nullable: true })
  qualityStatus?: string;

  @Column({ type: 'json', nullable: true })
  attributes?: Record<string, unknown>;

  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @Column({ name: 'updated_by', type: 'bigint', nullable: true })
  updatedBy?: string;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

@Entity('ci_input')
@Index('idx_cii_ci_id', ['ciId'])
@Index('idx_cii_batch', ['batchId'])
@Index('idx_ci_input_batch', ['tenantId', 'batchId', 'ciId'])
export class CiInput {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'ci_id', type: 'bigint' })
  ciId!: string;

  @Column({ name: 'material_id', type: 'bigint' })
  materialId!: string;

  @Column({ name: 'batch_id', type: 'bigint', nullable: true })
  batchId?: string;

  @Column({
    name: 'planned_qty',
    type: 'decimal',
    precision: 18,
    scale: 6,
    nullable: true,
  })
  plannedQty?: number;

  @Column({
    name: 'actual_qty',
    type: 'decimal',
    precision: 18,
    scale: 6,
    nullable: true,
  })
  actualQty?: number;

  @Column({ name: 'uom_id', type: 'bigint' })
  uomId!: string;

  @Column({ name: 'is_consumed', type: 'tinyint', default: 0 })
  isConsumed!: number;

  @Column({ name: 'consumed_at', type: 'timestamp', nullable: true })
  consumedAt?: Date;

  @Column({ type: 'json', nullable: true })
  attributes?: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}

@Entity('ci_output')
@Index('idx_cio_ci_id', ['ciId'])
@Index('idx_cio_batch', ['batchId'])
@Index('idx_ci_output_batch', ['tenantId', 'batchId', 'ciId'])
export class CiOutput {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'ci_id', type: 'bigint' })
  ciId!: string;

  @Column({ name: 'material_id', type: 'bigint' })
  materialId!: string;

  @Column({ name: 'batch_id', type: 'bigint', nullable: true })
  batchId?: string;

  @Column({
    name: 'planned_qty',
    type: 'decimal',
    precision: 18,
    scale: 6,
    nullable: true,
  })
  plannedQty?: number;

  @Column({
    name: 'actual_qty',
    type: 'decimal',
    precision: 18,
    scale: 6,
    nullable: true,
  })
  actualQty?: number;

  @Column({
    name: 'scrap_qty',
    type: 'decimal',
    precision: 18,
    scale: 6,
    default: 0,
  })
  scrapQty!: number;

  @Column({ name: 'uom_id', type: 'bigint' })
  uomId!: string;

  @Column({ name: 'quality_status', length: 20, nullable: true })
  qualityStatus?: string;

  @Column({ type: 'json', nullable: true })
  attributes?: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
