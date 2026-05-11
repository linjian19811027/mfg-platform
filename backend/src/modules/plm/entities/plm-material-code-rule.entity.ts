import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export interface CodeSegment {
  type: 'PREFIX' | 'SERIAL' | 'SEPARATOR' | 'DATE' | 'CATEGORY';
  value?: string;
  length?: number;
  padChar?: string;
  format?: string;
}

@Entity('plm_material_code_rule')
@Index('uk_plm_code_rule', ['tenantId', 'code'], { unique: true })
@Index('idx_plm_code_rule_cat', ['tenantId', 'categoryId'])
export class PlmMaterialCodeRule {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ length: 50 })
  code!: string;

  @Column({ length: 100 })
  name!: string;

  @Column({ name: 'code_type', length: 20 })
  codeType!: string; // AUTO / MANUAL / MIXED

  @Column({ name: 'category_id', type: 'bigint', nullable: true })
  categoryId?: string;

  @Column({ type: 'json', nullable: true })
  segments?: CodeSegment[];

  @Column({ name: 'serial_length', default: 4 })
  serialLength!: number;

  @Column({ name: 'current_serial', default: 0 })
  currentSerial!: number;

  @Column({ length: 10, nullable: true })
  separator?: string;

  @Column({ name: 'is_default', default: false })
  isDefault!: boolean;

  @Column({ length: 20, default: 'ACTIVE' })
  status!: string;

  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
