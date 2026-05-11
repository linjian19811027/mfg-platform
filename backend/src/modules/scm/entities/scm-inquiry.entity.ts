import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum InquiryStatus {
  DRAFT = 'DRAFT',
  SENT = 'SENT',
  COMPARING = 'COMPARING',
  CLOSED = 'CLOSED',
}

@Entity('scm_inquiry')
@Index('uk_scm_inquiry', ['tenantId', 'inquiryNo'], { unique: true })
@Index('idx_scm_inquiry_material', ['materialId'])
@Index('idx_scm_inquiry_status', ['tenantId', 'status'])
export class ScmInquiry {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'inquiry_no', length: 50 })
  inquiryNo!: string;

  @Column({ name: 'material_id', type: 'bigint' })
  materialId!: string;

  @Column({ type: 'decimal', precision: 18, scale: 6 })
  quantity!: number;

  @Column({ name: 'uom_id', type: 'bigint' })
  uomId!: string;

  @Column({ name: 'required_date', type: 'date', nullable: true })
  requiredDate?: Date;

  @Column({ type: 'enum', enum: InquiryStatus, default: InquiryStatus.DRAFT })
  status!: InquiryStatus;

  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
