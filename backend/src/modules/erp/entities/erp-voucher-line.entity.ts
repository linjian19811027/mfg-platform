import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('erp_voucher_line')
@Index('idx_erp_vl_voucher', ['voucherId'])
export class ErpVoucherLine {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'voucher_id', type: 'bigint' })
  voucherId!: string;

  @Column({ name: 'line_no', type: 'int' })
  lineNo!: number;

  @Column({ name: 'account_id', type: 'bigint' })
  accountId!: string;

  @Column({
    name: 'debit_amount',
    type: 'decimal',
    precision: 18,
    scale: 4,
    default: 0,
  })
  debitAmount!: number;

  @Column({
    name: 'credit_amount',
    type: 'decimal',
    precision: 18,
    scale: 4,
    default: 0,
  })
  creditAmount!: number;

  @Column({ length: 200, nullable: true })
  summary?: string;

  // 不使用数据库外键约束；级联删除由 VoucherService.void() 逻辑层保证
}
