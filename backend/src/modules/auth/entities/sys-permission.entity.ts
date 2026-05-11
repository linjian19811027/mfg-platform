import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('sys_permission')
@Index('idx_perm_module', ['module'])
export class SysPermission {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ length: 100, unique: true })
  code!: string;

  @Column({ length: 100 })
  name!: string;

  @Column({ length: 20 })
  module!: string;

  @Column({ length: 20 })
  type!: string; // MENU | BUTTON | API

  @Column({ name: 'parent_id', type: 'bigint', nullable: true })
  parentId?: string;

  @Column({ length: 200, nullable: true })
  path?: string; // 前端路由路径

  @Column({ length: 200, nullable: true })
  component?: string; // 前端组件路径

  @Column({ length: 100, nullable: true })
  icon?: string; // 菜单图标

  @Column({ name: 'sort_order', default: 0 })
  sortOrder!: number;

  @Column({ name: 'is_visible', type: 'tinyint', default: 1 })
  isVisible!: number; // 是否在菜单中显示
}
