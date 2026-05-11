import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum OutsourcingReceiptQualityStatus {
  NORMAL = 'NORMAL',
  SUSPECT = 'SUSPECT',
}

export enum OutsourcingReceiptStatus {
  PENDING = 'PENDING',
  INSPECTING = 'INSPECTING',
  PASSED = 'PASSED',
  FAILED = 'FAILED',
  CONCESSION = 'CONCESSION',
}

@Entity('outsourcing_receipt')
@Index('idx_or_oc', ['tenantId', 'ocId'])
@Index('idx_or_issue', ['tenantId', 'issueId'])
@Index('idx_or_status', ['tenantId', 'status'])
export class OutsourcingReceipt {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'oc_id', type: 'bigint' })
  ocId!: string;

  @Column({ name: 'issue_id', type: 'bigint' })
  issueId!: string;

  @Column({ name: 'receipt_qty', type: 'decimal', precision: 18, scale: 6 })
  receiptQty!: number;

  @Column({
    name: 'quality_status',
    type: 'enum',
    enum: OutsourcingReceiptQualityStatus,
    default: OutsourcingReceiptQualityStatus.NORMAL,
  })
  qualityStatus!: OutsourcingReceiptQualityStatus;

  @Column({ name: 'is_over_receipt', type: 'tinyint', default: 0 })
  isOverReceipt!: number;

  @Column({ name: 'staging_location_id', type: 'bigint', nullable: true })
  stagingLocationId?: string;

  @Column({ name: 'qms_ir_id', type: 'bigint', nullable: true })
  qmsIrId?: string;

  @Column({
    type: 'enum',
    enum: OutsourcingReceiptStatus,
    default: OutsourcingReceiptStatus.PENDING,
  })
  status!: OutsourcingReceiptStatus;

  @Column({ name: 'operator_id', length: 50 })
  operatorId!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
