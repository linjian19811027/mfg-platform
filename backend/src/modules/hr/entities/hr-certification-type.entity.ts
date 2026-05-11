import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('hr_certification_type')
export class HrCertificationType {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number;
  @Column({ name: 'tenant_id', length: 50 }) tenantId!: string;
  @Column({ length: 20, unique: true }) code!: string;
  @Column({ length: 100 }) name!: string;
  /** 是否强制要求 */
  @Column({ name: 'is_mandatory', type: 'tinyint', default: 0 })
  isMandatory!: number;
  @Column({ name: 'default_validity_months', type: 'int', default: 12 })
  defaultValidityMonths!: number;
  @Column({ type: 'tinyint', default: 1 }) enabled!: number;
  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @Column({ name: 'updated_by', type: 'bigint', nullable: true })
  updatedBy?: string;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}
