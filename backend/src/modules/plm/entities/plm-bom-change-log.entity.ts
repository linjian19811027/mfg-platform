import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('plm_bom_change_log')
@Index('idx_plm_bcl_bom', ['bomId'])
@Index('idx_plm_bcl_time', ['changedAt'])
export class PlmBomChangeLog {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'bom_id', type: 'bigint' })
  bomId!: string;

  @Column({ name: 'change_type', length: 20 })
  changeType!: string; // CREATE | UPDATE | LINE_ADD | LINE_DEL | LINE_MOD

  @Column({ name: 'before_data', type: 'json', nullable: true })
  beforeData?: Record<string, unknown>;

  @Column({ name: 'after_data', type: 'json', nullable: true })
  afterData?: Record<string, unknown>;

  @Column({ name: 'ecn_id', type: 'bigint', nullable: true })
  ecnId?: string;

  @Column({ name: 'changed_by', type: 'bigint', nullable: true })
  changedBy?: string;

  @CreateDateColumn({ name: 'changed_at' })
  changedAt!: Date;

  @Column({ length: 500, nullable: true })
  remark?: string;
}
