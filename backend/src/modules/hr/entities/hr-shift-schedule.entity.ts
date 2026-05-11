import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('hr_shift_schedule')
@Index('idx_hr_schedule_emp_date', ['tenantId', 'empId', 'scheduleDate'], {
  unique: true,
})
@Index('idx_hr_schedule_date', ['tenantId', 'scheduleDate'])
export class HrShiftSchedule {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number;
  @Column({ name: 'tenant_id', length: 50 }) tenantId!: string;
  @Column({ name: 'emp_id', type: 'bigint' }) empId!: number;
  @Column({ name: 'schedule_date', type: 'date' }) scheduleDate!: string;
  @Column({ name: 'shift_id', type: 'bigint' }) shiftId!: number;
  @Column({ name: 'work_center_id', type: 'bigint', nullable: true })
  workCenterId?: number;
  @Column({ name: 'equipment_id', type: 'bigint', nullable: true })
  equipmentId?: number;
  @Column({ type: 'text', nullable: true }) remark?: string;
  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @Column({ name: 'updated_by', type: 'bigint', nullable: true })
  updatedBy?: string;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}
