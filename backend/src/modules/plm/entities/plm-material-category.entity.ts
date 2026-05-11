import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('plm_material_category')
@Index('idx_plm_cat_parent', ['parentId'])
@Index('uk_plm_cat', ['tenantId', 'code'], { unique: true })
export class PlmMaterialCategory {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ length: 50 })
  code!: string;

  @Column({ length: 100 })
  name!: string;

  @Column({ name: 'parent_id', type: 'bigint', nullable: true })
  parentId?: string;

  @Column({ default: 1 })
  level!: number;

  @Column({ length: 500, nullable: true })
  path?: string; // 全路径 "1/3/7"，根节点为自身 id

  @Column({ name: 'sort_order', default: 0 })
  sortOrder!: number;

  @Column({ length: 20, default: 'ACTIVE' })
  status!: string;

  @Column({ type: 'json', nullable: true })
  attributes?: Record<string, unknown>;

  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
