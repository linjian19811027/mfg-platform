import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('aps_calendar')
@Index('idx_aps_cal_resource', ['resourceId', 'workDate'])
export class ApsCalendar {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'resource_id', type: 'bigint', nullable: true })
  resourceId?: string;

  @Column({ name: 'work_date', type: 'date' })
  workDate!: Date;

  @Column({ name: 'shift_code', length: 20, nullable: true })
  shiftCode?: string;

  @Column({ name: 'start_time', type: 'time' })
  startTime!: string;

  @Column({ name: 'end_time', type: 'time' })
  endTime!: string;

  @Column({
    name: 'available_hours',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  availableHours?: number;

  @Column({ name: 'is_holiday', type: 'tinyint', default: 0 })
  isHoliday!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
