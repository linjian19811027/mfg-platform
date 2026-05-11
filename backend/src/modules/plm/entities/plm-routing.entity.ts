import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('plm_routing')
@Index('uk_plm_routing', ['tenantId', 'materialId', 'version'], {
  unique: true,
})
@Index('idx_plm_routing_material', ['materialId'])
export class PlmRouting {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'material_id', type: 'bigint' })
  materialId!: string;

  @Column({ length: 100, nullable: true })
  code?: string;

  @Column({ default: 1 })
  version!: number;

  @Column({ length: 100, nullable: true })
  name?: string;

  @Column({ length: 20, default: 'DRAFT' })
  status!: string; // ACTIVE | OBSOLETE | DRAFT

  @Column({ name: 'bom_version', nullable: true })
  bomVersion?: number;

  @Column({ name: 'ecn_id', type: 'bigint', nullable: true })
  ecnId?: string;

  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
