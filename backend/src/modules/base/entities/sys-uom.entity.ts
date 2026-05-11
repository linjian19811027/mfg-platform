import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('sys_uom')
export class SysUom {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ name: 'tenant_id', length: 50 }) tenantId!: string;
  @Column({ length: 20 }) code!: string;
  @Column({ length: 50 }) name!: string;
  @Column({ length: 20, nullable: true }) symbol?: string;
  @Column({ length: 20, nullable: true }) category?: string;
  @Column({ name: 'is_base', type: 'tinyint', default: 0 }) isBase!: number;
  @Column({ length: 20, default: 'ACTIVE' }) status!: string;
  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @Column({ name: 'updated_by', type: 'bigint', nullable: true })
  updatedBy?: string;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}

@Entity('sys_uom_conversion')
export class SysUomConversion {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ name: 'tenant_id', length: 50 }) tenantId!: string;
  @Column({ name: 'from_uom_id', type: 'bigint' }) fromUomId!: string;
  @Column({ name: 'to_uom_id', type: 'bigint' }) toUomId!: string;
  @Column({ type: 'decimal', precision: 18, scale: 8 }) factor!: number;
  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @Column({ name: 'updated_by', type: 'bigint', nullable: true })
  updatedBy?: string;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}
