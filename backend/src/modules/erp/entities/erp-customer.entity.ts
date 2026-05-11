import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum CustomerType {
  STRATEGIC = 'STRATEGIC',
  KEY = 'KEY',
  GENERAL = 'GENERAL',
  POTENTIAL = 'POTENTIAL',
}

export enum SettlementType {
  MONTHLY = 'MONTHLY',
  INVOICE = 'INVOICE',
  ADVANCE = 'ADVANCE',
}

export enum CustomerStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

@Entity('erp_customer')
@Index('uk_erp_customer', ['tenantId', 'code'], { unique: true })
export class ErpCustomer {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ length: 50 })
  code!: string;

  @Column({ length: 200 })
  name!: string;

  @Column({ type: 'enum', enum: CustomerType, default: CustomerType.GENERAL })
  type!: CustomerType;

  @Column({
    name: 'credit_limit',
    type: 'decimal',
    precision: 18,
    scale: 4,
    nullable: true,
  })
  creditLimit?: number;

  @Column({ name: 'payment_terms', type: 'int', default: 30 })
  paymentTerms!: number;

  @Column({
    name: 'settlement_type',
    type: 'enum',
    enum: SettlementType,
    nullable: true,
  })
  settlementType?: SettlementType;

  @Column({ name: 'contact_name', length: 100, nullable: true })
  contactName?: string;

  @Column({ name: 'contact_phone', length: 50, nullable: true })
  contactPhone?: string;

  @Column({ name: 'contact_email', length: 200, nullable: true })
  contactEmail?: string;

  @Column({ name: 'bank_account', type: 'json', nullable: true })
  bankAccount?: Record<string, any>;

  @Column({
    type: 'enum',
    enum: CustomerStatus,
    default: CustomerStatus.ACTIVE,
  })
  status!: CustomerStatus;

  @Column({ type: 'json', nullable: true })
  attributes?: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
