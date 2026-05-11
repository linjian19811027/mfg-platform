import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('hr_employee_certification')
@Index('idx_hr_cert_emp', ['tenantId', 'empId'])
@Index('idx_hr_cert_type', ['tenantId', 'certTypeId'])
export class HrEmployeeCertification {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number;
  @Column({ name: 'tenant_id', length: 50 }) tenantId!: string;
  @Column({ name: 'emp_id', type: 'bigint' }) empId!: number;
  @Column({ name: 'cert_type_id', type: 'bigint' }) certTypeId!: number;
  @Column({ name: 'cert_no', length: 100 }) certNo!: string;
  @Column({ name: 'issue_date', type: 'date' }) issueDate!: string;
  @Column({ name: 'expire_date', type: 'date' }) expireDate!: string;
  @Column({ length: 100, nullable: true }) issuer?: string;
  @Column({ name: 'attachment_path', length: 500, nullable: true })
  attachmentPath?: string;
  @Column({ name: 'is_expired', type: 'tinyint', default: 0 })
  isExpired!: number;
  @Column({ name: 'is_expiring_soon', type: 'tinyint', default: 0 })
  isExpiringSoon!: number;
  @Column({ type: 'text', nullable: true }) remark?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}
