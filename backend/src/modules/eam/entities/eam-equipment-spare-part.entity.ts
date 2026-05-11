import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum CriticalLevel {
  CRITICAL = 'CRITICAL',
  IMPORTANT = 'IMPORTANT',
  GENERAL = 'GENERAL',
}

@Entity('eam_equipment_spare_part')
@Index('idx_eam_equip_part_equip', ['equipmentId'])
@Index('idx_eam_equip_part_part', ['partId'])
export class EamEquipmentSparePart {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'equipment_id', type: 'bigint' })
  equipmentId!: string;

  @Column({ name: 'part_id', type: 'bigint' })
  partId!: string;

  @Column({
    name: 'recommended_stock',
    type: 'decimal',
    precision: 10,
    scale: 3,
  })
  recommendedStock!: string;

  @Column({ name: 'critical_level', type: 'enum', enum: CriticalLevel })
  criticalLevel!: CriticalLevel;

  @Column({ type: 'text', nullable: true })
  remark?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
