import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum CertType {
  BUSINESS_LICENSE = '营业执照',
  CERTIFICATION = '认证证书',
  OTHER = '其他',
}

@Entity('scm_supplier_qualification')
@Index('idx_scm_sq_supplier', ['tenantId', 'supplierId'])
@Index('idx_scm_sq_expire', ['expireDate'])
export class ScmSupplierQualification {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ name: 'tenant_id', length: 50 }) tenantId!: string;
  @Column({ name: 'supplier_id', type: 'bigint' }) supplierId!: string;
  @Column({ name: 'cert_type', type: 'enum', enum: CertType })
  certType!: CertType;
  @Column({ name: 'cert_no', length: 100, nullable: true }) certNo?: string;
  @Column({ name: 'cert_name', length: 200 }) certName!: string;
  @Column({ name: 'issue_date', type: 'date', nullable: true })
  issueDate?: Date;
  @Column({ name: 'expire_date', type: 'date', nullable: true })
  expireDate?: Date;
  @Column({ name: 'file_url', length: 500, nullable: true }) fileUrl?: string;
  @Column({ length: 20, default: 'ACTIVE' }) status!: string;
  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @Column({ name: 'updated_by', type: 'bigint', nullable: true })
  updatedBy?: string;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}
