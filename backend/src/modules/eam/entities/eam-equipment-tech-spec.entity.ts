import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum ParamType {
  NUMBER = 'NUMBER',
  TEXT = 'TEXT',
  BOOLEAN = 'BOOLEAN',
}

@Entity('eam_equipment_tech_spec')
@Index('idx_eam_tech_spec_equip', ['equipmentId'])
export class EamEquipmentTechSpec {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'equipment_id', type: 'bigint' })
  equipmentId!: string;

  @Column({ name: 'param_name', length: 200 })
  paramName!: string;

  @Column({ name: 'param_code', length: 100 })
  paramCode!: string;

  @Column({ name: 'param_value', length: 500 })
  paramValue!: string;

  @Column({ name: 'param_unit', length: 50, nullable: true })
  paramUnit?: string;

  @Column({
    name: 'param_type',
    type: 'enum',
    enum: ParamType,
    default: ParamType.TEXT,
  })
  paramType!: ParamType;

  @Column({ name: 'is_custom', type: 'tinyint', default: 0 })
  isCustom!: number;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
