import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('sys_config')
@Index('uk_sys_config', ['tenantId', 'key'], { unique: true })
export class SysConfig {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ name: 'tenant_id', length: 50 }) tenantId!: string;
  @Column({ length: 100 }) key!: string;
  @Column({ type: 'text', nullable: true }) value?: string;
  @Column({ length: 50, nullable: true }) group?: string;
  @Column({ length: 200, nullable: true }) description?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}
