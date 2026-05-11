import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('plm_process_parameter')
@Index('idx_plm_pp_operation', ['operationId'])
@Index('idx_plm_pp_tenant', ['tenantId', 'status'])
export class PlmProcessParameter {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'operation_id', type: 'bigint', nullable: true })
  operationId?: string; // 关联工序（null 表示通用模板）

  @Column({ length: 100 })
  name!: string; // 参数名，如"焊接温度"

  @Column({ length: 20 })
  type!: string; // NUMERIC | TEXT | BOOLEAN | ENUM

  @Column({ length: 20, nullable: true })
  unit?: string; // 单位，如"℃"、"MPa"

  @Column({ name: 'std_value', length: 100, nullable: true })
  stdValue?: string; // 标准值

  @Column({
    name: 'min_value',
    type: 'decimal',
    precision: 18,
    scale: 6,
    nullable: true,
  })
  minValue?: number; // 下公差

  @Column({
    name: 'max_value',
    type: 'decimal',
    precision: 18,
    scale: 6,
    nullable: true,
  })
  maxValue?: number; // 上公差

  @Column({ name: 'enum_options', type: 'json', nullable: true })
  enumOptions?: string[]; // ENUM 类型的可选值

  @Column({ name: 'is_required', type: 'tinyint', default: 0 })
  isRequired!: number; // 是否必填

  @Column({ name: 'sort_order', default: 0 })
  sortOrder!: number;

  @Column({ length: 20, default: 'ACTIVE' })
  status!: string;

  @Column({ length: 500, nullable: true })
  remark?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
