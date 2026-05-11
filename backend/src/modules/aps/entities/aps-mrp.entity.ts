import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum ApsMrpStatus {
  DRAFT = 'DRAFT',
  CALCULATED = 'CALCULATED',
  RELEASED = 'RELEASED',
}

@Entity('aps_mrp')
@Index('uk_aps_mrp', ['tenantId', 'mrpNo'], { unique: true })
export class ApsMrp {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'mrp_no', length: 50 })
  mrpNo!: string;

  @Column({ name: 'so_id', type: 'bigint', nullable: true })
  soId?: string;

  @Column({ type: 'enum', enum: ApsMrpStatus, default: ApsMrpStatus.DRAFT })
  status!: ApsMrpStatus;

  @Column({ name: 'calculated_at', type: 'timestamp', nullable: true })
  calculatedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
