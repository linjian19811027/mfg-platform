import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('sys_user')
@Index('idx_user_status', ['tenantId', 'status'])
export class SysUser {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ length: 50 })
  username!: string;

  @Column({ length: 200 })
  password!: string;

  @Column({ name: 'real_name', length: 50, nullable: true })
  realName?: string;

  @Column({ length: 20, nullable: true })
  phone?: string;

  @Column({ length: 100, nullable: true })
  email?: string;

  @Column({ name: 'employee_no', length: 50, nullable: true })
  employeeNo?: string;

  @Column({ name: 'organization_id', type: 'bigint', nullable: true })
  organizationId?: string;

  @Column({ length: 20, default: 'ACTIVE' })
  status!: string;

  @Column({ name: 'password_changed_at', type: 'timestamp', nullable: true })
  passwordChangedAt?: Date;

  @Column({ name: 'login_fail_count', default: 0 })
  loginFailCount!: number;

  @Column({ name: 'token_version', default: 0 })
  tokenVersion!: number;

  @Column({ name: 'locked_until', type: 'timestamp', nullable: true })
  lockedUntil?: Date;

  @Column({ name: 'last_login_at', type: 'timestamp', nullable: true })
  lastLoginAt?: Date;

  @Column({ name: 'last_login_ip', length: 50, nullable: true })
  lastLoginIp?: string;

  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
