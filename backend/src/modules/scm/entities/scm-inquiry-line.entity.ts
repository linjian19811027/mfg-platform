import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('scm_inquiry_line')
@Index('idx_scm_il_inquiry', ['inquiryId'])
@Index('idx_scm_il_supplier', ['supplierId'])
export class ScmInquiryLine {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ name: 'tenant_id', length: 50 }) tenantId!: string;
  @Column({ name: 'inquiry_id', type: 'bigint' }) inquiryId!: string;
  @Column({ name: 'supplier_id', type: 'bigint' }) supplierId!: string;
  @Column({
    name: 'quoted_price',
    type: 'decimal',
    precision: 18,
    scale: 4,
    nullable: true,
  })
  quotedPrice?: number;
  @Column({ name: 'quoted_lead_days', type: 'int', nullable: true })
  quotedLeadDays?: number;
  @Column({
    name: 'quality_score',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  qualityScore?: number;
  @Column({
    name: 'delivery_score',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  deliveryScore?: number;
  @Column({
    name: 'total_score',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  totalScore?: number;
  @Column({ name: 'is_selected', type: 'tinyint', default: 0 })
  isSelected!: number;
  @Column({ length: 500, nullable: true }) remarks?: string;
  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @Column({ name: 'updated_by', type: 'bigint', nullable: true })
  updatedBy?: string;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}
