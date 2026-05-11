import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('mes_receipt_log')
@Index('idx_mrl_wo', ['woId'])
@Index('idx_mrl_status', ['tenantId', 'status'])
export class MesReceiptLog {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ name: 'tenant_id', length: 50 }) tenantId!: string;
  @Column({ name: 'wo_id', type: 'bigint' }) woId!: string;
  /** FULL = 全部完工触发, PARTIAL = 部分完工触发 */
  @Column({ name: 'trigger_type', length: 10 }) triggerType!: string;
  @Column({ name: 'material_id', type: 'bigint' }) materialId!: string;
  @Column({ type: 'decimal', precision: 18, scale: 6 }) quantity!: number;
  @Column({ name: 'uom_id', type: 'bigint', nullable: true }) uomId?: string;
  @Column({ name: 'target_warehouse_id', type: 'bigint', nullable: true })
  targetWarehouseId?: string;
  @Column({ name: 'target_location_id', type: 'bigint', nullable: true })
  targetLocationId?: string;
  @Column({ name: 'require_fqc', type: 'tinyint', default: 0 })
  requireFqc!: number;
  /** PENDING | SUCCESS | FAILED | RETRYING */
  @Column({ length: 10, default: 'PENDING' }) status!: string;
  @Column({ name: 'retry_count', default: 0 }) retryCount!: number;
  @Column({ name: 'fqc_ir_id', type: 'bigint', nullable: true })
  fqcIrId?: string;
  @Column({ name: 'wms_tx_id', type: 'bigint', nullable: true })
  wmsTxId?: string;
  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}
