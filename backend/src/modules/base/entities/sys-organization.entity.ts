import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('sys_organization')
@Index('idx_org_parent', ['parentId'])
@Index('idx_org_type', ['tenantId', 'type'])
@Index('idx_org_path', ['path'])
export class SysOrganization {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ length: 50 })
  code!: string;

  @Column({ length: 100 })
  name!: string;

  @Column({ length: 20, default: 'WORKSHOP' })
  type!: string; // COMPANY | FACTORY | WORKSHOP | LINE | WORKSTATION

  @Column({ name: 'parent_id', type: 'bigint', nullable: true })
  parentId?: string;

  @Column({ default: 1 })
  level!: number;

  @Column({ length: 500, nullable: true })
  path?: string; // 全路径 "1/3/7/12"

  @Column({ name: 'sort_order', default: 0 })
  sortOrder!: number;

  @Column({ name: 'manager_id', type: 'bigint', nullable: true })
  managerId?: string;

  @Column({ length: 20, default: 'ACTIVE' })
  status!: string;

  @Column({ type: 'json', nullable: true })
  attributes?: Record<string, unknown>;

  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
