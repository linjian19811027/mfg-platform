import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('plm_bom_line')
@Index('idx_plm_bom_line_bom', ['bomId'])
@Index('idx_plm_bom_line_material', ['materialId'])
export class PlmBomLine {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'bom_id', type: 'bigint' })
  bomId!: string;

  @Column()
  sequence!: number;

  @Column({ name: 'material_id', type: 'bigint', nullable: true })
  materialId?: string;

  @Column({ type: 'decimal', precision: 18, scale: 6 })
  quantity!: number;

  @Column({ name: 'uom_id', type: 'bigint', nullable: true })
  uomId?: string;

  @Column({
    name: 'loss_rate',
    type: 'decimal',
    precision: 5,
    scale: 4,
    default: 0,
  })
  lossRate!: number;

  /** 父行 ID（多级 BOM，null 表示顶层） */
  @Column({ name: 'parent_line_id', type: 'bigint', nullable: true })
  parentLineId?: string;

  @Column({ name: 'is_substitute', type: 'tinyint', default: 0 })
  isSubstitute!: number;

  @Column({ name: 'substitute_group', length: 20, nullable: true })
  substituteGroup?: string;

  @Column({ name: 'substitute_priority', default: 1 })
  substitutePriority!: number;

  @Column({ name: 'effective_date', type: 'date', nullable: true })
  effectiveDate?: Date;

  @Column({ name: 'expiry_date', type: 'date', nullable: true })
  expiryDate?: Date;

  @Column({ name: 'reference_designator', length: 100, nullable: true })
  referenceDesignator?: string;

  @Column({ length: 500, nullable: true })
  remark?: string;
}
