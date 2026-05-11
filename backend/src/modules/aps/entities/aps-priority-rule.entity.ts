import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ApsPriorityRuleType {
  DELIVERY_DATE = 'DELIVERY_DATE',
  PROFIT = 'PROFIT',
  CUSTOMER_PRIORITY = 'CUSTOMER_PRIORITY',
  FIFO = 'FIFO',
}

@Entity('aps_priority_rule')
export class ApsPriorityRule {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ length: 100 })
  name!: string;

  @Column({ name: 'rule_type', type: 'enum', enum: ApsPriorityRuleType })
  ruleType!: ApsPriorityRuleType;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 1 })
  weight!: number;

  @Column({ name: 'is_active', type: 'tinyint', default: 1 })
  isActive!: number;

  @Column({ type: 'json', nullable: true })
  config?: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
