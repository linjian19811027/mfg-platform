import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('sys_role')
export class SysRole {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ length: 50 })
  code!: string;

  @Column({ length: 20, default: 'CUSTOM' })
  type!: string;

  @Column({ length: 100 })
  name!: string;

  @Column({ length: 500, nullable: true })
  description?: string;

  @Column({ name: 'is_system', type: 'tinyint', default: 0 })
  isSystem!: number;

  @Column({ length: 20, default: 'ACTIVE' })
  status!: string;

  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
