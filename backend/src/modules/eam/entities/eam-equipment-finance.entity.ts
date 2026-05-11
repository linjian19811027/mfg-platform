import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum DepreciationMethod {
  STRAIGHT_LINE = 'STRAIGHT_LINE',
  DOUBLE_DECLINING = 'DOUBLE_DECLINING',
  SUM_OF_YEARS = 'SUM_OF_YEARS',
}

@Entity('eam_equipment_finance')
@Index('idx_eam_finance_equip', ['equipmentId'], { unique: true })
export class EamEquipmentFinance {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'equipment_id', type: 'bigint' })
  equipmentId!: string;

  @Column({ name: 'original_value', type: 'decimal', precision: 15, scale: 2 })
  originalValue!: string;

  @Column({
    name: 'depreciation_method',
    type: 'enum',
    enum: DepreciationMethod,
  })
  depreciationMethod!: DepreciationMethod;

  @Column({ name: 'useful_life', type: 'int' })
  usefulLife!: number;

  @Column({ name: 'salvage_value', type: 'decimal', precision: 15, scale: 2 })
  salvageValue!: string;

  @Column({
    name: 'current_net_value',
    type: 'decimal',
    precision: 15,
    scale: 2,
  })
  currentNetValue!: string;

  @Column({
    name: 'accumulated_depreciation',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
  })
  accumulatedDepreciation!: string;

  @Column({
    name: 'monthly_depreciation',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  monthlyDepreciation?: string;

  @Column({ name: 'last_depreciation_date', type: 'date', nullable: true })
  lastDepreciationDate?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
