import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('mes_work_order_split')
@Index('idx_mes_wos_parent', ['parentWoId'])
export class MesWorkOrderSplit {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'parent_wo_id', type: 'bigint' })
  parentWoId!: string;

  @Column({ name: 'child_wo_id', type: 'bigint' })
  childWoId!: string;

  @Column({ name: 'split_qty', type: 'decimal', precision: 18, scale: 6 })
  splitQty!: number;

  @Column({ name: 'split_reason', length: 500, nullable: true })
  splitReason?: string;

  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
