import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum VoucherType {
  RECEIPT = 'RECEIPT',
  PAYMENT = 'PAYMENT',
  TRANSFER = 'TRANSFER',
  MEMO = 'MEMO',
}

export enum VoucherStatus {
  DRAFT = 'DRAFT',
  APPROVED = 'APPROVED',
  POSTED = 'POSTED',
  REVERSED = 'REVERSED',
}

@Entity('erp_voucher')
@Index('uk_erp_voucher', ['tenantId', 'voucherNo'], { unique: true })
@Index('idx_erp_voucher_date', ['tenantId', 'voucherDate'])
@Index('idx_erp_voucher_source', ['sourceType', 'sourceId'])
export class ErpVoucher {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'voucher_no', length: 50 })
  voucherNo!: string;

  @Column({ name: 'voucher_date', type: 'date' })
  voucherDate!: string;

  @Column({ name: 'voucher_type', type: 'enum', enum: VoucherType })
  voucherType!: VoucherType;

  @Column({ name: 'source_type', length: 50, nullable: true })
  sourceType?: string;

  @Column({ name: 'source_id', length: 50, nullable: true })
  sourceId?: string;

  @Column({ name: 'total_debit', type: 'decimal', precision: 18, scale: 4 })
  totalDebit!: number;

  @Column({ name: 'total_credit', type: 'decimal', precision: 18, scale: 4 })
  totalCredit!: number;

  @Column({ type: 'enum', enum: VoucherStatus, default: VoucherStatus.DRAFT })
  status!: VoucherStatus;

  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
