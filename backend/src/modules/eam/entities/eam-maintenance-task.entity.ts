import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum MaintenanceTaskType {
  PREVENTIVE = 'PREVENTIVE',
  CORRECTIVE = 'CORRECTIVE',
  EMERGENCY = 'EMERGENCY',
}

export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum MaintenanceTaskStatus {
  PENDING = 'PENDING',
  ASSIGNED = 'ASSIGNED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

@Entity('eam_maintenance_task')
@Index('idx_eam_task_equip', ['equipmentId', 'scheduledDate'])
@Index('idx_eam_task_status', ['tenantId', 'status'])
@Index('idx_eam_task_plan', ['planId'])
export class EamMaintenanceTask {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'task_code', length: 100 })
  taskCode!: string;

  @Column({ name: 'plan_id', type: 'bigint', nullable: true })
  planId?: string;

  @Column({ name: 'equipment_id', type: 'bigint' })
  equipmentId!: string;

  @Column({ name: 'task_type', type: 'enum', enum: MaintenanceTaskType })
  taskType!: MaintenanceTaskType;

  @Column({ type: 'enum', enum: TaskPriority, default: TaskPriority.MEDIUM })
  priority!: TaskPriority;

  @Column({
    type: 'enum',
    enum: MaintenanceTaskStatus,
    default: MaintenanceTaskStatus.PENDING,
  })
  status!: MaintenanceTaskStatus;

  @Column({ name: 'scheduled_date', type: 'date' })
  scheduledDate!: Date;

  @Column({ name: 'assigned_to', type: 'bigint', nullable: true })
  assignedTo?: string;

  @Column({ name: 'start_time', type: 'datetime', nullable: true })
  startTime?: Date;

  @Column({ name: 'end_time', type: 'datetime', nullable: true })
  endTime?: Date;

  @Column({
    name: 'labor_hours',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  laborHours?: string;

  @Column({
    name: 'labor_cost',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  laborCost?: string;

  @Column({
    name: 'material_cost',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  materialCost?: string;

  @Column({
    name: 'total_cost',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  totalCost?: string;

  @Column({ name: 'work_description', type: 'text', nullable: true })
  workDescription?: string;

  @Column({ type: 'text', nullable: true })
  result?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
