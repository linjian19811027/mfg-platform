import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum EmployeeStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
}

@Entity('hr_employee')
@Index('idx_hr_emp_tenant_status', ['tenantId', 'status'])
@Index('idx_hr_emp_no', ['empNo'])
export class HrEmployee {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number;
  @Column({ name: 'tenant_id', length: 50 }) tenantId!: string;
  @Column({ name: 'emp_no', length: 20, unique: true }) empNo!: string;
  @Column({ length: 50 }) name!: string;
  @Column({ name: 'job_type', length: 50 }) jobType!: string;
  @Column({ name: 'work_center_id', type: 'bigint', nullable: true })
  workCenterId?: number;
  @Column({ name: 'hire_date', type: 'date' }) hireDate!: string;
  @Column({ name: 'leave_date', type: 'date', nullable: true })
  leaveDate?: string;
  /** ACTIVE | INACTIVE | SUSPENDED */
  @Column({ length: 20, default: 'ACTIVE' }) status!: string;
  @Column({ length: 20, nullable: true }) phone?: string;
  @Column({ name: 'id_card', length: 20, nullable: true }) idCard?: string;
  @Column({ name: 'emergency_contact', length: 50, nullable: true })
  emergencyContact?: string;
  @Column({ name: 'emergency_phone', length: 20, nullable: true })
  emergencyPhone?: string;
  @Column({ type: 'text', nullable: true }) remark?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}
