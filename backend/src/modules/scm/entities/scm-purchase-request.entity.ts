import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum PrTriggerType {
  MANUAL = 'MANUAL',
  STOCK_ALERT = 'STOCK_ALERT',
  MRP = 'MRP',
}

export enum PrStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CLOSED = 'CLOSED',
}

@Entity('scm_purchase_request')
@Index('uk_scm_pr', ['tenantId', 'prNo'], { unique: true })
@Index('idx_scm_pr_status', ['tenantId', 'status'])
@Index('idx_scm_pr_requester', ['requesterId'])
export class ScmPurchaseRequest {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'pr_no', length: 50 })
  prNo!: string;

  @Column({ name: 'request_dept', length: 100, nullable: true })
  requestDept?: string;

  @Column({ name: 'requester_id', type: 'bigint', nullable: true })
  requesterId?: string;

  @Column({
    name: 'trigger_type',
    type: 'enum',
    enum: PrTriggerType,
    default: PrTriggerType.MANUAL,
  })
  triggerType!: PrTriggerType;

  @Column({ type: 'enum', enum: PrStatus, default: PrStatus.DRAFT })
  status!: PrStatus;

  /** 物料 ID */
  @Column({ name: 'material_id', type: 'bigint', nullable: true })
  materialId?: string;

  /** 冗余：物料编码 */
  @Column({ name: 'material_code', length: 50, nullable: true })
  materialCode?: string;

  /** 冗余：物料名称 */
  @Column({ name: 'material_name', length: 200, nullable: true })
  materialName?: string;

  /** 申请数量 */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true })
  qty?: number;

  /** 期望到货日期 */
  @Column({ name: 'expected_date', type: 'date', nullable: true })
  expectedDate?: Date;

  /** 申请原因 */
  @Column({ type: 'text', nullable: true })
  reason?: string;

  @Column({ type: 'json', nullable: true })
  items?: Record<string, any>[];

  @Column({
    name: 'budget_amount',
    type: 'decimal',
    precision: 18,
    scale: 4,
    nullable: true,
  })
  budgetAmount?: number;

  @Column({
    name: 'approved_amount',
    type: 'decimal',
    precision: 18,
    scale: 4,
    nullable: true,
  })
  approvedAmount?: number;

  @Column({ name: 'approval_records', type: 'json', nullable: true })
  approvalRecords?: Record<string, any>[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
