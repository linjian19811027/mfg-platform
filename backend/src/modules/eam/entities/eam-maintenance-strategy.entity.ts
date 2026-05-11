import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum StrategyType {
  PERIODIC = 'PERIODIC',
  CONDITION_BASED = 'CONDITION_BASED',
  PREDICTIVE = 'PREDICTIVE',
}

export enum TriggerType {
  CALENDAR = 'CALENDAR',
  RUNTIME_HOURS = 'RUNTIME_HOURS',
  CONDITION = 'CONDITION',
}

@Entity('eam_maintenance_strategy')
@Index('idx_eam_strategy_tenant', ['tenantId', 'strategyCode'])
@Index('idx_eam_strategy_equip', ['equipmentId'])
export class EamMaintenanceStrategy {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'strategy_code', length: 100 })
  strategyCode!: string;

  @Column({ name: 'strategy_name', length: 200 })
  strategyName!: string;

  @Column({ name: 'strategy_type', type: 'enum', enum: StrategyType })
  strategyType!: StrategyType;

  @Column({ name: 'equipment_id', type: 'bigint', nullable: true })
  equipmentId?: string;

  @Column({ name: 'equipment_type', length: 50, nullable: true })
  equipmentType?: string;

  @Column({ name: 'trigger_type', type: 'enum', enum: TriggerType })
  triggerType!: TriggerType;

  @Column({ name: 'interval_days', type: 'int', nullable: true })
  intervalDays?: number;

  @Column({
    name: 'interval_hours',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  intervalHours?: string;

  @Column({ name: 'condition_threshold', length: 500, nullable: true })
  conditionThreshold?: string;

  @Column({ name: 'advance_notice_days', type: 'int', default: 3 })
  advanceNoticeDays!: number;

  @Column({ name: 'is_active', type: 'tinyint', default: 1 })
  isActive!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
