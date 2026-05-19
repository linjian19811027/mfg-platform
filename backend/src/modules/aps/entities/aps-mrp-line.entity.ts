import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum ApsMrpLineSuggestedAction {
  PURCHASE = 'PURCHASE',
  PRODUCE = 'PRODUCE',
  TRANSFER = 'TRANSFER',
}

export enum ApsMrpLineStatus {
  OPEN = 'OPEN',
  PROCESSED = 'PROCESSED',
}

@Entity('aps_mrp_line')
@Index('idx_aps_mrpl_mrp', ['mrpId'])
@Index('idx_aps_mrpl_material', ['materialId'])
export class ApsMrpLine {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'mrp_id', type: 'bigint' })
  mrpId!: string;

  @Column({ name: 'material_id', type: 'bigint' })
  materialId!: string;

  /** 冗余字段：物料编码（跨模块，避免查询 plm_material） */
  @Column({ name: 'material_code', length: 50, nullable: true })
  materialCode?: string;

  /** 冗余字段：物料名称（跨模块，避免查询 plm_material） */
  @Column({ name: 'material_name', length: 200, nullable: true })
  materialName?: string;

  @Column({ name: 'required_qty', type: 'decimal', precision: 18, scale: 6 })
  requiredQty!: number;

  @Column({
    name: 'available_qty',
    type: 'decimal',
    precision: 18,
    scale: 6,
    default: 0,
  })
  availableQty!: number;

  @Column({
    name: 'shortage_qty',
    type: 'decimal',
    precision: 18,
    scale: 6,
    default: 0,
  })
  shortageQty!: number;

  @Column({ name: 'required_date', type: 'date' })
  requiredDate!: Date;

  @Column({
    name: 'suggested_action',
    type: 'enum',
    enum: ApsMrpLineSuggestedAction,
  })
  suggestedAction!: ApsMrpLineSuggestedAction;

  @Column({
    type: 'enum',
    enum: ApsMrpLineStatus,
    default: ApsMrpLineStatus.OPEN,
  })
  status!: ApsMrpLineStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
