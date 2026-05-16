import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('plm_bom')
@Index('uk_plm_bom', ['tenantId', 'materialId', 'version'], { unique: true })
@Index('idx_plm_bom_material', ['materialId'])
@Index('idx_plm_bom_effective', ['effectiveDate', 'expiryDate'])
export class PlmBom {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'material_id', type: 'bigint' })
  materialId!: string;

  @Column({ default: 1 })
  version!: number;

  @Column({ length: 20, default: 'DRAFT' })
  status!: string; // DRAFT | ACTIVE | INACTIVE | OBSOLETE

  @Column({ name: 'effective_date', type: 'date', nullable: true })
  effectiveDate?: Date;

  @Column({ name: 'expiry_date', type: 'date', nullable: true })
  expiryDate?: Date;

  @Column({ name: 'is_default', type: 'tinyint', default: 0 })
  isDefault!: number;

  @Column({
    name: 'material_cost',
    type: 'decimal',
    precision: 18,
    scale: 4,
    nullable: true,
  })
  materialCost?: number;

  @Column({ name: 'ecn_id', type: 'bigint', nullable: true })
  ecnId?: string;

  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @Column({ name: 'updated_by', type: 'bigint', nullable: true })
  updatedBy?: string;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
