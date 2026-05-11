import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum CostType {
  MATERIAL = 'MATERIAL',
  LABOR = 'LABOR',
  OVERHEAD = 'OVERHEAD',
}

@Entity('erp_cost_record')
@Index('idx_erp_cost_ci', ['ciId'])
@Index('idx_erp_cost_period', ['tenantId', 'period'])
export class ErpCostRecord {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'ci_id', type: 'bigint' })
  ciId!: string;

  @Column({ name: 'material_id', type: 'bigint' })
  materialId!: string;

  @Column({ name: 'cost_center_id', type: 'bigint', nullable: true })
  costCenterId?: string;

  @Column({ name: 'cost_element_id', type: 'bigint', nullable: true })
  costElementId?: string;

  @Column({ name: 'cost_type', type: 'enum', enum: CostType })
  costType!: CostType;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  amount!: number;

  @Column({ length: 7 })
  period!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
