import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('qms_spc_data_point')
@Index('idx_qms_spc_item', ['tenantId', 'itemId'])
@Index('idx_qms_spc_time', ['measuredAt'])
export class QmsSpcDataPoint {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ name: 'tenant_id', length: 50 }) tenantId!: string;
  @Column({ name: 'item_id', type: 'bigint' }) itemId!: string;
  @Column({ name: 'wo_id', type: 'bigint', nullable: true }) woId?: string;
  @Column({ name: 'woo_id', type: 'bigint', nullable: true }) wooId?: string;
  @Column({ name: 'actual_value', type: 'decimal', precision: 18, scale: 6 })
  actualValue!: number;
  @Column({ name: 'subgroup_id', nullable: true }) subgroupId?: number;
  @Column({ name: 'measured_at', type: 'timestamp' }) measuredAt!: Date;
  @Column({ name: 'operator_id', type: 'bigint', nullable: true })
  operatorId?: string;
  /** X-R | X-S | P | NP | C | U */
  @Column({ name: 'chart_type', length: 10, default: 'X-R' })
  chartType!: string;
  /** NORMAL | WARNING | OUT_OF_CONTROL */
  @Column({ name: 'control_status', length: 20, default: 'NORMAL' })
  controlStatus!: string;
  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @Column({ name: 'updated_by', type: 'bigint', nullable: true })
  updatedBy?: string;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}
