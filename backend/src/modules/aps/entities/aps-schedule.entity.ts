import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum ApsScheduleStatus {
  SCHEDULED = 'SCHEDULED',
  CONFIRMED = 'CONFIRMED',
  STARTED = 'STARTED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

@Entity('aps_schedule')
@Index('idx_aps_sch_resource', ['resourceId', 'scheduledStart'])
@Index('idx_aps_sch_wo', ['woId'])
@Index('idx_aps_sch_status', ['tenantId', 'status'])
export class ApsSchedule {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'wo_id', type: 'bigint' })
  woId!: string;

  @Column({ name: 'woo_id', type: 'bigint', nullable: true })
  wooId?: string;

  @Column({ name: 'resource_id', type: 'bigint' })
  resourceId!: string;

  @Column({ name: 'scheduled_start', type: 'timestamp' })
  scheduledStart!: Date;

  @Column({ name: 'scheduled_end', type: 'timestamp' })
  scheduledEnd!: Date;

  @Column({ type: 'int', default: 5 })
  priority!: number;

  @Column({
    type: 'enum',
    enum: ApsScheduleStatus,
    default: ApsScheduleStatus.SCHEDULED,
  })
  status!: ApsScheduleStatus;

  @Column({ name: 'is_simulation', type: 'tinyint', default: 0 })
  isSimulation!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
