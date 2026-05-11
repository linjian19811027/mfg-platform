import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('sys_user_role')
@Index('idx_ur_user', ['userId'])
@Index('idx_ur_role', ['roleId'])
export class SysUserRole {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'user_id', type: 'bigint' })
  userId!: string;

  @Column({ name: 'role_id', type: 'bigint' })
  roleId!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
