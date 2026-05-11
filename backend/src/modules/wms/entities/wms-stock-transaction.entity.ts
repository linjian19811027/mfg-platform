import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('wms_stock_transaction')
@Index('uk_wms_tx', ['tenantId', 'txNo'], { unique: true })
@Index('idx_wms_tx_material', ['materialId'])
@Index('idx_wms_tx_time', ['txTime'])
@Index('idx_wms_tx_source', ['sourceType', 'sourceId'])
export class WmsStockTransaction {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ name: 'tenant_id', length: 50 }) tenantId!: string;
  @Column({ name: 'tx_no', length: 50 }) txNo!: string;
  /** RECEIPT | ISSUE | TRANSFER | ADJUST | LOCK | UNLOCK */
  @Column({ name: 'tx_type', length: 20 }) txType!: string;
  @Column({ name: 'material_id', type: 'bigint' }) materialId!: string;
  @Column({ name: 'batch_id', type: 'bigint', nullable: true })
  batchId?: string;
  @Column({ name: 'from_location_id', type: 'bigint', nullable: true })
  fromLocationId?: string;
  @Column({ name: 'to_location_id', type: 'bigint', nullable: true })
  toLocationId?: string;
  @Column({ type: 'decimal', precision: 18, scale: 6 }) quantity!: number;
  @Column({ name: 'uom_id', type: 'bigint' }) uomId!: string;
  @Column({ name: 'source_type', length: 20, nullable: true })
  sourceType?: string;
  @Column({ name: 'source_id', length: 50, nullable: true }) sourceId?: string;
  @Column({ name: 'operator_id', type: 'bigint', nullable: true })
  operatorId?: string;
  @Column({ name: 'tx_time', type: 'timestamp' }) txTime!: Date;
  @Column({ length: 500, nullable: true }) remark?: string;
  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
}
