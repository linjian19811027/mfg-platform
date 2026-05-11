import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum SparePartCategory {
  CRITICAL = 'CRITICAL',
  GENERAL = 'GENERAL',
  CONSUMABLE = 'CONSUMABLE',
}

@Entity('eam_spare_part')
@Index('idx_eam_part_tenant_code', ['tenantId', 'partCode'], { unique: true })
@Index('idx_eam_part_category', ['tenantId', 'category'])
export class EamSparePart {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'part_code', length: 100 })
  partCode!: string;

  @Column({ name: 'part_name', length: 200 })
  partName!: string;

  @Column({ length: 200, nullable: true })
  specification?: string;

  @Column({ type: 'enum', enum: SparePartCategory })
  category!: SparePartCategory;

  @Column({ length: 50 })
  unit!: string;

  @Column({
    name: 'current_stock',
    type: 'decimal',
    precision: 10,
    scale: 3,
    default: 0,
  })
  currentStock!: string;

  @Column({
    name: 'safety_stock',
    type: 'decimal',
    precision: 10,
    scale: 3,
    default: 0,
  })
  safetyStock!: string;

  @Column({
    name: 'max_stock',
    type: 'decimal',
    precision: 10,
    scale: 3,
    nullable: true,
  })
  maxStock?: string;

  @Column({ length: 200, nullable: true })
  location?: string;

  @Column({
    name: 'unit_cost',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  unitCost?: string;

  @Column({ length: 200, nullable: true })
  supplier?: string;

  @Column({ name: 'lead_time_days', type: 'int', nullable: true })
  leadTimeDays?: number;

  @Column({ name: 'is_active', type: 'tinyint', default: 1 })
  isActive!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
