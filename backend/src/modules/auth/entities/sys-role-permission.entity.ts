import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('sys_role_permission')
@Index('idx_rp_role', ['roleId'])
export class SysRolePermission {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'role_id', type: 'bigint' })
  roleId!: string;

  @Column({ name: 'permission_id', type: 'bigint' })
  permissionId!: string;
}
