import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum EmployeeEventType {
  ONBOARD = 'ONBOARD',           // 入职
  TRANSFER = 'TRANSFER',         // 岗位/工种调动
  PROMOTION = 'PROMOTION',       // 晋升
  STATUS_CHANGE = 'STATUS_CHANGE', // 状态变更
  RESIGN = 'RESIGN',             // 离职
  INFO_UPDATE = 'INFO_UPDATE',   // 基本信息修改
}

@Entity('hr_employee_history')
@Index('idx_hr_history_emp', ['employeeId', 'createdAt'])
export class HrEmployeeHistory {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'employee_id', type: 'bigint' })
  employeeId!: string;

  @Column({ name: 'event_type', type: 'enum', enum: EmployeeEventType })
  eventType!: EmployeeEventType;

  @Column({ type: 'text' })
  description!: string;

  @Column({ name: 'operator_id', type: 'bigint', nullable: true })
  operatorId?: string;

  // ── 调动相关 ──
  @Column({ name: 'from_job_type', length: 50, nullable: true })
  fromJobType?: string;

  @Column({ name: 'to_job_type', length: 50, nullable: true })
  toJobType?: string;

  @Column({ name: 'from_work_center_id', type: 'bigint', nullable: true })
  fromWorkCenterId?: number;

  @Column({ name: 'to_work_center_id', type: 'bigint', nullable: true })
  toWorkCenterId?: number;

  // ── 状态变更相关 ──
  @Column({ name: 'from_status', length: 20, nullable: true })
  fromStatus?: string;

  @Column({ name: 'to_status', length: 20, nullable: true })
  toStatus?: string;

  // ── 备注 ──
  @Column({ type: 'text', nullable: true })
  remark?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
