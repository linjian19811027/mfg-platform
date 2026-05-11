import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export enum AllocationMethod {
  BY_QTY = 'BY_QTY',
  BY_WEIGHT = 'BY_WEIGHT',
  BY_VALUE = 'BY_VALUE',
  BY_COMPLETION = 'BY_COMPLETION',
}

@Entity('erp_cost_allocation')
export class ErpCostAllocation {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'source_id', type: 'bigint' })
  sourceId!: string;

  @Column({ name: 'target_id', type: 'bigint' })
  targetId!: string;

  @Column({ name: 'allocation_method', type: 'enum', enum: AllocationMethod })
  allocationMethod!: AllocationMethod;

  @Column({ name: 'allocation_ratio', type: 'decimal', precision: 8, scale: 6 })
  allocationRatio!: number;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  amount!: number;

  @Column({ length: 7 })
  period!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
