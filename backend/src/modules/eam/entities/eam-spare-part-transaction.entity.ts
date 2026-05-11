import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum SparePartTransactionType {
  IN = 'IN',
  OUT = 'OUT',
  ADJUST = 'ADJUST',
  RETURN = 'RETURN',
}

@Entity('eam_spare_part_transaction')
@Index('idx_eam_part_tx_part', ['partId', 'transactionDate'])
@Index('idx_eam_part_tx_task', ['relatedTaskId'])
export class EamSparePartTransaction {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'part_id', type: 'bigint' })
  partId!: string;

  @Column({
    name: 'transaction_type',
    type: 'enum',
    enum: SparePartTransactionType,
  })
  transactionType!: SparePartTransactionType;

  @Column({ type: 'decimal', precision: 10, scale: 3 })
  quantity!: string;

  @Column({ name: 'stock_before', type: 'decimal', precision: 10, scale: 3 })
  stockBefore!: string;

  @Column({ name: 'stock_after', type: 'decimal', precision: 10, scale: 3 })
  stockAfter!: string;

  @Column({
    name: 'unit_cost',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  unitCost?: string;

  @Column({
    name: 'total_cost',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  totalCost?: string;

  @Column({ name: 'related_task_id', type: 'bigint', nullable: true })
  relatedTaskId?: string;

  @Column({ name: 'related_equipment_id', type: 'bigint', nullable: true })
  relatedEquipmentId?: string;

  @Column({ name: 'operator_id', type: 'bigint', nullable: true })
  operatorId?: string;

  @Column({ type: 'text', nullable: true })
  remark?: string;

  @Column({ name: 'transaction_date', type: 'datetime' })
  transactionDate!: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
