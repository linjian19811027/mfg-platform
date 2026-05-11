import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum ReceiptStatus {
  PENDING = 'PENDING',
  INSPECTING = 'INSPECTING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
}

@Entity('scm_receipt')
@Index('uk_scm_receipt', ['tenantId', 'receiptNo'], { unique: true })
@Index('idx_scm_receipt_po', ['poId'])
@Index('idx_scm_receipt_supplier', ['supplierId'])
export class ScmReceipt {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'receipt_no', length: 50 })
  receiptNo!: string;

  @Column({ name: 'po_id', type: 'bigint' })
  poId!: string;

  @Column({ name: 'supplier_id', type: 'bigint' })
  supplierId!: string;

  @Column({ name: 'receipt_date', type: 'date' })
  receiptDate!: Date;

  @Column({ type: 'enum', enum: ReceiptStatus, default: ReceiptStatus.PENDING })
  status!: ReceiptStatus;

  @Column({ type: 'json' })
  items!: Record<string, any>[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
