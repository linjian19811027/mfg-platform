import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum SupplierType {
  STRATEGIC = 'STRATEGIC',
  PREFERRED = 'PREFERRED',
  QUALIFIED = 'QUALIFIED',
  ELIMINATED = 'ELIMINATED',
  BLACKLIST = 'BLACKLIST',
}

@Entity('scm_supplier')
@Index('uk_scm_supplier', ['tenantId', 'code'], { unique: true })
@Index('idx_scm_supplier_status', ['tenantId', 'status'])
export class ScmSupplier {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ length: 50 })
  code!: string;

  @Column({ length: 200 })
  name!: string;

  @Column({ type: 'enum', enum: SupplierType, default: SupplierType.QUALIFIED })
  type!: SupplierType;

  @Column({ name: 'contact_name', length: 100, nullable: true })
  contactName?: string;

  @Column({ name: 'contact_phone', length: 50, nullable: true })
  contactPhone?: string;

  @Column({ name: 'contact_email', length: 200, nullable: true })
  contactEmail?: string;

  @Column({ name: 'bank_account', type: 'json', nullable: true })
  bankAccount?: Record<string, any>;

  @Column({
    name: 'performance_score',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  performanceScore?: number;

  @Column({ type: 'json', nullable: true })
  attributes?: Record<string, any>;

  @Column({ length: 20, default: 'ACTIVE' })
  status!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
