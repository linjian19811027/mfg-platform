import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * 日志类型：
 *   LOGIN        登录/登出
 *   OPERATION    功能操作（增删改）
 *   SYSTEM_ERROR 系统级错误（未捕获异常、500）
 *   BIZ_ERROR    业务操作错误（4xx）
 */
export type AuditLogType = 'LOGIN' | 'OPERATION' | 'SYSTEM_ERROR' | 'BIZ_ERROR';

@Entity('sys_audit_log')
@Index('idx_audit_tenant_time', ['tenantId', 'createdAt'])
@Index('idx_audit_user', ['userId'])
@Index('idx_audit_type', ['logType', 'createdAt'])
@Index('idx_audit_resource', ['resourceType', 'resourceId'])
export class SysAuditLog {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ name: 'tenant_id', length: 50, nullable: true }) tenantId?: string;
  @Column({ name: 'log_type', length: 20, default: 'OPERATION' })
  logType!: AuditLogType;
  @Column({ name: 'user_id', type: 'bigint', nullable: true }) userId?: string;
  @Column({ length: 50, nullable: true }) username?: string;
  @Column({ length: 20, nullable: true }) module?: string;
  @Column({ length: 50, nullable: true }) action?: string;
  @Column({ name: 'resource_type', length: 50, nullable: true })
  resourceType?: string;
  @Column({ name: 'resource_id', length: 50, nullable: true })
  resourceId?: string;
  @Column({ name: 'request_method', length: 10, nullable: true })
  requestMethod?: string;
  @Column({ name: 'request_url', length: 500, nullable: true })
  requestUrl?: string;
  @Column({ name: 'request_body', type: 'text', nullable: true })
  requestBody?: string;
  @Column({ name: 'response_code', nullable: true }) responseCode?: number;
  /** 错误信息（SYSTEM_ERROR / BIZ_ERROR 时填写） */
  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string;
  /** 错误堆栈（SYSTEM_ERROR 时填写） */
  @Column({ name: 'error_stack', type: 'text', nullable: true })
  errorStack?: string;
  @Column({ name: 'ip_address', length: 50, nullable: true })
  ipAddress?: string;
  @Column({ name: 'user_agent', length: 500, nullable: true })
  userAgent?: string;
  @Column({ name: 'duration_ms', nullable: true }) durationMs?: number;
  /** 请求开始时间 */
  @Column({ name: 'request_time', type: 'timestamp', nullable: true })
  requestTime?: Date;
  /** 登录结果：SUCCESS / FAILED / LOCKED */
  @Column({ name: 'login_result', length: 20, nullable: true })
  loginResult?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
}
