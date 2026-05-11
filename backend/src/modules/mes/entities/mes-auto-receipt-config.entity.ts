import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('mes_auto_receipt_config')
@Index('idx_marc_tenant_match', ['tenantId', 'matchType', 'matchValue'])
export class MesAutoReceiptConfig {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ name: 'tenant_id', length: 50 }) tenantId!: string;
  /** MATERIAL = 精确匹配物料ID, CATEGORY = 分类前缀匹配 */
  @Column({ name: 'match_type', length: 20 }) matchType!: string;
  @Column({ name: 'match_value', length: 100 }) matchValue!: string;
  @Column({ name: 'require_fqc', type: 'tinyint', default: 0 })
  requireFqc!: number;
  @Column({ name: 'target_warehouse_id', type: 'bigint', nullable: true })
  targetWarehouseId?: string;
  @Column({ name: 'target_location_id', type: 'bigint', nullable: true })
  targetLocationId?: string;
  @Column({ type: 'tinyint', default: 1 }) enabled!: number;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}
