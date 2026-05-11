import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum ApsScheduleOperationStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}

@Entity('aps_schedule_operation')
@Index('idx_aps_sop_schedule', ['scheduleId'])
@Index('idx_aps_sop_wo', ['woId'])
export class ApsScheduleOperation {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'schedule_id', type: 'bigint' })
  scheduleId!: string;

  @Column({ name: 'wo_id', type: 'bigint' })
  woId!: string;

  @Column({ name: 'operation_no', type: 'int' })
  operationNo!: number;

  @Column({ name: 'operation_name', length: 100 })
  operationName!: string;

  @Column({ name: 'resource_id', type: 'bigint' })
  resourceId!: string;

  @Column({ name: 'planned_start', type: 'timestamp' })
  plannedStart!: Date;

  @Column({ name: 'planned_end', type: 'timestamp' })
  plannedEnd!: Date;

  @Column({ name: 'actual_start', type: 'timestamp', nullable: true })
  actualStart?: Date;

  @Column({ name: 'actual_end', type: 'timestamp', nullable: true })
  actualEnd?: Date;

  @Column({
    type: 'enum',
    enum: ApsScheduleOperationStatus,
    default: ApsScheduleOperationStatus.PENDING,
  })
  status!: ApsScheduleOperationStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
