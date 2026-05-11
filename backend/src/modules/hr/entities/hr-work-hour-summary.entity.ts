import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum SummaryDimension {
  DAY = 'DAY',
  WEEK = 'WEEK',
  MONTH = 'MONTH',
}

@Entity('hr_work_hour_summary')
@Index(
  'idx_hr_whs_emp_date_dim',
  ['tenantId', 'empId', 'summaryDate', 'dimension'],
  { unique: true },
)
export class HrWorkHourSummary {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number;
  @Column({ name: 'tenant_id', length: 50 }) tenantId!: string;
  @Column({ name: 'emp_id', type: 'bigint' }) empId!: number;
  @Column({ name: 'summary_date', type: 'date' }) summaryDate!: string;
  @Column({ length: 10 }) dimension!: string;
  @Column({
    name: 'total_hours',
    type: 'decimal',
    precision: 8,
    scale: 2,
    default: 0,
  })
  totalHours!: number;
  @Column({
    name: 'normal_hours',
    type: 'decimal',
    precision: 8,
    scale: 2,
    default: 0,
  })
  normalHours!: number;
  @Column({
    name: 'overtime_hours',
    type: 'decimal',
    precision: 8,
    scale: 2,
    default: 0,
  })
  overtimeHours!: number;
  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @Column({ name: 'updated_by', type: 'bigint', nullable: true })
  updatedBy?: string;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}
