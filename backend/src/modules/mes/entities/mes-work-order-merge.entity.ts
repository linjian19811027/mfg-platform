import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('mes_work_order_merge')
@Index('idx_mes_wom_target', ['targetWoId'])
export class MesWorkOrderMerge {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  /** 合并后的目标工单 */
  @Column({ name: 'target_wo_id', type: 'bigint' })
  targetWoId!: string;

  /** 被合并的源工单 ID 列表 */
  @Column({ name: 'source_wo_ids', type: 'json' })
  sourceWoIds!: string[];

  @Column({ name: 'merge_reason', length: 500, nullable: true })
  mergeReason?: string;

  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
