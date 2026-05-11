import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum MaintenancePlanType {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  YEARLY = 'YEARLY',
}

export enum MaintenancePlanStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
}

@Entity('eam_maintenance_plan')
@Index('idx_eam_plan_equip', ['equipmentId', 'plannedDate'])
@Index('idx_eam_plan_status', ['tenantId', 'status'])
export class EamMaintenancePlan {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'plan_code', length: 100 })
  planCode!: string;

  @Column({ name: 'plan_name', length: 200 })
  planName!: string;

  @Column({ name: 'equipment_id', type: 'bigint' })
  equipmentId!: string;

  @Column({ name: 'strategy_id', type: 'bigint', nullable: true })
  strategyId?: string;

  @Column({ name: 'plan_type', type: 'enum', enum: MaintenancePlanType })
  planType!: MaintenancePlanType;

  @Column({ name: 'planned_date', type: 'date' })
  plannedDate!: Date;

  @Column({
    name: 'planned_duration',
    type: 'decimal',
    precision: 10,
    scale: 2,
  })
  plannedDuration!: string;

  @Column({ name: 'maintenance_content', type: 'text' })
  maintenanceContent!: string;

  @Column({ name: 'required_skills', length: 500, nullable: true })
  requiredSkills?: string;

  @Column({
    type: 'enum',
    enum: MaintenancePlanStatus,
    default: MaintenancePlanStatus.PENDING,
  })
  status!: MaintenancePlanStatus;

  @Column({ name: 'assigned_to', type: 'bigint', nullable: true })
  assignedTo?: string;

  @Column({ name: 'actual_start_time', type: 'datetime', nullable: true })
  actualStartTime?: Date;

  @Column({ name: 'actual_end_time', type: 'datetime', nullable: true })
  actualEndTime?: Date;

  @Column({
    name: 'actual_cost',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  actualCost?: string;

  @Column({ name: 'completion_note', type: 'text', nullable: true })
  completionNote?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
