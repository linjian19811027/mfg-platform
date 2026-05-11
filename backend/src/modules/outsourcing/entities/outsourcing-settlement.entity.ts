import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum OutsourcingSettlementStatus {
  DRAFT = 'DRAFT',
  APPROVED = 'APPROVED',
  CANCELLED = 'CANCELLED',
}

@Entity('outsourcing_settlement')
@Index('idx_os_oc', ['tenantId', 'ocId'])
@Index('idx_os_status', ['tenantId', 'status'])
export class OutsourcingSettlement {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'oc_id', type: 'bigint' })
  ocId!: string;

  @Column({ name: 'settle_qty', type: 'decimal', precision: 18, scale: 6 })
  settleQty!: number;

  @Column({ name: 'tax_amount', type: 'decimal', precision: 18, scale: 4 })
  taxAmount!: number;

  @Column({ name: 'amount_with_tax', type: 'decimal', precision: 18, scale: 4 })
  amountWithTax!: number;

  @Column({
    name: 'amount_without_tax',
    type: 'decimal',
    precision: 18,
    scale: 4,
  })
  amountWithoutTax!: number;

  @Column({ name: 'tax_rate', type: 'decimal', precision: 5, scale: 4 })
  taxRate!: number;

  @Column({ length: 10, default: 'CNY' })
  currency!: string;

  @Column({ name: 'settle_date', type: 'date' })
  settleDate!: Date;

  @Column({
    type: 'enum',
    enum: OutsourcingSettlementStatus,
    default: OutsourcingSettlementStatus.DRAFT,
  })
  status!: OutsourcingSettlementStatus;

  @Column({ name: 'scm_payable_id', type: 'bigint', nullable: true })
  scmPayableId?: string;

  @Column({ name: 'approved_by', length: 50, nullable: true })
  approvedBy?: string;

  @Column({ name: 'approved_at', type: 'timestamp', nullable: true })
  approvedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
