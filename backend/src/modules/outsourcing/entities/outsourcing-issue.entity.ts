import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum OutsourcingIssueStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
}

@Entity('outsourcing_issue')
@Index('idx_oi_oc', ['tenantId', 'ocId'])
@Index('idx_oi_status', ['tenantId', 'status'])
export class OutsourcingIssue {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'oc_id', type: 'bigint' })
  ocId!: string;

  @Column({ name: 'batch_id', type: 'bigint', nullable: true })
  batchId?: string;

  @Column({ name: 'issue_qty', type: 'decimal', precision: 18, scale: 6 })
  issueQty!: number;

  @Column({ name: 'warehouse_id', type: 'bigint' })
  warehouseId!: string;

  @Column({ name: 'location_id', type: 'bigint' })
  locationId!: string;

  @Column({ name: 'wms_tx_id', type: 'bigint', nullable: true })
  wmsTxId?: string;

  @Column({
    type: 'enum',
    enum: OutsourcingIssueStatus,
    default: OutsourcingIssueStatus.PENDING,
  })
  status!: OutsourcingIssueStatus;

  @Column({ name: 'operator_id', length: 50 })
  operatorId!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
