import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

export interface NumberingSegment {
  type: 'CONST' | 'SERIAL' | 'DATE' | 'FIELD';
  value?: string;     // CONST 的值，或者 FIELD 的字段名
  length?: number;    // SERIAL 的长度，或者 FIELD 的截取长度
  padChar?: string;   // SERIAL 的填充字符，默认 '0'
  format?: string;    // DATE 的格式，如 YYYYMMDD
}

@Entity('sys_numbering_rule')
@Index('uk_sys_num_rule', ['tenantId', 'businessKey', 'code'], { unique: true })
export class SysNumberingRule {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'business_key', length: 50 })
  businessKey!: string; // 如 PLM_MATERIAL, PLM_BOM, SCM_PO 等

  @Column({ length: 50 })
  code!: string; // 规则自身的编码

  @Column({ length: 100 })
  name!: string;

  @Column({ length: 20, default: 'AUTO' })
  mode!: string; // AUTO | MANUAL | MIXED

  @Column({ type: 'json', nullable: true })
  segments?: NumberingSegment[];

  @Column({ name: 'current_serial', default: 0 })
  currentSerial!: number;

  @Column({ name: 'is_default', default: false })
  isDefault!: boolean;

  @Column({ length: 20, default: 'ACTIVE' })
  status!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date;
}
