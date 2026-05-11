import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('mes_wip')
@Index('idx_mes_wip_wo', ['woId'])
@Index('idx_mes_wip_location', ['tenantId', 'locationId'])
export class MesWip {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'wo_id', type: 'bigint' })
  woId!: string;

  @Column({ name: 'woo_id', type: 'bigint', nullable: true })
  wooId?: string; // 当前所在工序

  @Column({ name: 'material_id', type: 'bigint' })
  materialId!: string;

  @Column({ name: 'batch_id', type: 'bigint', nullable: true })
  batchId?: string;

  @Column({ type: 'decimal', precision: 18, scale: 6 })
  quantity!: number;

  @Column({ name: 'uom_id', type: 'bigint' })
  uomId!: string;

  /** 当前位置：工位/库位 */
  @Column({ name: 'location_id', type: 'bigint', nullable: true })
  locationId?: string;

  @Column({ name: 'location_code', length: 50, nullable: true })
  locationCode?: string;

  @Column({ length: 20, default: 'IN_PROCESS' })
  status!: string; // IN_PROCESS | WAITING | COMPLETED | SCRAPPED

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
