import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum StandardCostStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

@Entity('erp_standard_cost')
@Index('idx_erp_std_cost_material', ['tenantId', 'materialId'])
export class ErpStandardCost {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'material_id', type: 'bigint' })
  materialId!: string;

  @Column({ length: 20 })
  version!: string;

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

  @Column({ length: 10, default: 'CNY' })
  currency!: string;

  @Column({ name: 'effective_from', type: 'date' })
  effectiveFrom!: string;

  @Column({ name: 'effective_to', type: 'date', nullable: true })
  effectiveTo?: string;

  @Column({
    type: 'enum',
    enum: StandardCostStatus,
    default: StandardCostStatus.ACTIVE,
  })
  status!: StandardCostStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
