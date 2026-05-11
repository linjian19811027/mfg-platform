import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('hr_work_hour_record')
@Index('idx_hr_whr_emp_date', ['tenantId', 'empId', 'reportDate'])
@Index('idx_hr_whr_mes_report', ['tenantId', 'mesReportId'], { unique: true })
export class HrWorkHourRecord {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number;
  @Column({ name: 'tenant_id', length: 50 }) tenantId!: string;
  @Column({ name: 'emp_id', type: 'bigint' }) empId!: number;
  @Column({ name: 'report_date', type: 'date' }) reportDate!: string;
  @Column({ name: 'operation_code', length: 50 }) operationCode!: string;
  @Column({ name: 'work_center_id', type: 'bigint', nullable: true })
  workCenterId?: number;
  @Column({ name: 'actual_hours', type: 'decimal', precision: 8, scale: 2 })
  actualHours!: number;
  @Column({ name: 'mes_report_id', type: 'bigint' }) mesReportId!: number;
  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @Column({ name: 'updated_by', type: 'bigint', nullable: true })
  updatedBy?: string;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}
