import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum ExceptionType {
  SHORT_DELIVERY = 'SHORT_DELIVERY',
  DAMAGE = 'DAMAGE',
  WRONG_ITEM = 'WRONG_ITEM',
}

export enum HandlingType {
  RETURN = 'RETURN',
  SUPPLEMENT = 'SUPPLEMENT',
  CLAIM = 'CLAIM',
}

export enum HandlingStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  CLOSED = 'CLOSED',
}

@Entity('scm_receipt_exception')
@Index('idx_scm_re_receipt', ['tenantId', 'receiptId'])
@Index('idx_scm_re_handling_status', ['handlingStatus'])
export class ScmReceiptException {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'receipt_id', type: 'bigint' })
  receiptId!: string;

  @Column({ name: 'exception_type', type: 'enum', enum: ExceptionType })
  exceptionType!: ExceptionType;

  @Column({ length: 500, nullable: true })
  description?: string;

  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true })
  quantity?: number;

  @Column({
    name: 'handling_type',
    type: 'enum',
    enum: HandlingType,
    nullable: true,
  })
  handlingType?: HandlingType;

  @Column({
    name: 'handling_status',
    type: 'enum',
    enum: HandlingStatus,
    default: HandlingStatus.PENDING,
  })
  handlingStatus!: HandlingStatus;

  @Column({ name: 'handling_notes', length: 500, nullable: true })
  handlingNotes?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
