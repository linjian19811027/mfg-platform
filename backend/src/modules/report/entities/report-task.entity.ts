import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('sys_report_task')
export class ReportTask {
  @PrimaryColumn({ length: 36 })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'report_type', length: 50 })
  reportType!: string;

  @Column({ type: 'json', nullable: true })
  params!: object;

  /** PENDING | RUNNING | COMPLETED | FAILED */
  @Column({ length: 20, default: 'PENDING' })
  status!: string;

  @Column({ type: 'json', nullable: true })
  result!: object;

  @Column({ name: 'error_msg', type: 'text', nullable: true })
  errorMsg?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt?: Date;
}
