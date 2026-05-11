import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('plm_material')
@Index('uk_plm_material', ['tenantId', 'code'], { unique: true })
@Index('idx_plm_material_type', ['tenantId', 'type', 'status'])
@Index('idx_plm_material_category', ['categoryId'])
export class PlmMaterial {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ length: 50 })
  code!: string;

  @Column({ length: 200 })
  name!: string;

  @Column({ length: 500, nullable: true })
  specification?: string;

  @Column({ length: 20 })
  type!: string; // RAW | SEMI | FINISHED

  @Column({ name: 'category_id', type: 'bigint', nullable: true })
  categoryId?: string;

  @Column({ name: 'uom_id', type: 'bigint' })
  uomId!: string;

  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true })
  weight?: number;

  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true })
  volume?: number;

  @Column({ length: 20, default: 'DESIGN' })
  status!: string; // DESIGN | TRIAL | ACTIVE | INACTIVE | OBSOLETE

  @Column({ name: 'coding_rule', length: 50, nullable: true })
  codingRule?: string;

  @Column({
    name: 'std_cost',
    type: 'decimal',
    precision: 18,
    scale: 4,
    nullable: true,
  })
  stdCost?: number;

  @Column({ type: 'json', nullable: true })
  attributes?: Record<string, unknown>;

  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
