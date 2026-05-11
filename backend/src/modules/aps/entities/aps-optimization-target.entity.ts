import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ApsOptimizationTargetType {
  MIN_DELIVERY = 'MIN_DELIVERY',
  MIN_CHANGEOVER = 'MIN_CHANGEOVER',
  BALANCE_LOAD = 'BALANCE_LOAD',
  MIN_COST = 'MIN_COST',
}

@Entity('aps_optimization_target')
export class ApsOptimizationTarget {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ length: 100 })
  name!: string;

  @Column({
    name: 'target_type',
    type: 'enum',
    enum: ApsOptimizationTargetType,
  })
  targetType!: ApsOptimizationTargetType;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 1 })
  weight!: number;

  @Column({ name: 'is_active', type: 'tinyint', default: 1 })
  isActive!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
