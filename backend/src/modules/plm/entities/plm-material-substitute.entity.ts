import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('plm_material_substitute')
@Index('uk_plm_sub', ['tenantId', 'materialId', 'substituteId'], {
  unique: true,
})
@Index('idx_plm_sub_material', ['materialId'])
export class PlmMaterialSubstitute {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'material_id', type: 'bigint' })
  materialId!: string;

  @Column({ name: 'substitute_id', type: 'bigint' })
  substituteId!: string;

  @Column({ type: 'decimal', precision: 10, scale: 6, default: 1 })
  ratio!: number;

  @Column({ default: 1 })
  priority!: number;

  @Column({ name: 'effective_date', type: 'date', nullable: true })
  effectiveDate?: Date;

  @Column({ name: 'expiry_date', type: 'date', nullable: true })
  expiryDate?: Date;

  @Column({ length: 20, default: 'ACTIVE' })
  status!: string;

  @Column({ length: 500, nullable: true })
  remark?: string;

  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
