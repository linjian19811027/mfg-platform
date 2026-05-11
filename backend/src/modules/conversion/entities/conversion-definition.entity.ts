import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('conversion_definition')
@Index('idx_cd_tenant_status', ['tenantId', 'status'])
export class ConversionDefinition {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ length: 50 })
  code!: string;

  @Column({ length: 100 })
  name!: string;

  @Column({ default: 1 })
  version!: number;

  @Column({ length: 20 })
  type!: string; // PRODUCTION | PROCUREMENT | SALES | TRANSFER

  @Column({ length: 20, default: 'ACTIVE' })
  status!: string;

  @Column({ name: 'organization_id', type: 'bigint', nullable: true })
  organizationId?: string;

  @Column({ name: 'time_params', type: 'json', nullable: true })
  timeParams?: Record<string, unknown>;

  @Column({ name: 'cost_params', type: 'json', nullable: true })
  costParams?: Record<string, unknown>;

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

@Entity('cd_input')
@Index('idx_cdi_cd_id', ['cdId'])
export class CdInput {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'cd_id', type: 'bigint' })
  cdId!: string;

  @Column({ name: 'material_id', type: 'bigint' })
  materialId!: string;

  @Column({ type: 'decimal', precision: 18, scale: 6 })
  quantity!: number;

  @Column({ name: 'uom_id', type: 'bigint' })
  uomId!: string;

  @Column({ name: 'is_key_input', type: 'tinyint', default: 1 })
  isKeyInput!: number;

  @Column({
    name: 'loss_rate',
    type: 'decimal',
    precision: 5,
    scale: 4,
    default: 0,
  })
  lossRate!: number;

  @Column({ default: 0 })
  sequence!: number;

  @Column({ type: 'json', nullable: true })
  attributes?: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}

@Entity('cd_output')
@Index('idx_cdo_cd_id', ['cdId'])
export class CdOutput {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'cd_id', type: 'bigint' })
  cdId!: string;

  @Column({ name: 'material_id', type: 'bigint' })
  materialId!: string;

  @Column({ type: 'decimal', precision: 18, scale: 6 })
  quantity!: number;

  @Column({ name: 'uom_id', type: 'bigint' })
  uomId!: string;

  @Column({ name: 'is_main_output', type: 'tinyint', default: 1 })
  isMainOutput!: number;

  @Column({
    name: 'yield_rate',
    type: 'decimal',
    precision: 5,
    scale: 4,
    default: 1,
  })
  yieldRate!: number;

  @Column({ default: 0 })
  sequence!: number;

  @Column({ type: 'json', nullable: true })
  attributes?: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
