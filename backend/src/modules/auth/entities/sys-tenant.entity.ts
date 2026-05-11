import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('sys_tenant')
export class SysTenant {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ length: 50, unique: true })
  code!: string;

  @Column({ length: 100 })
  name!: string;

  @Column({ length: 20, default: 'ACTIVE' })
  status!: string;

  @Column({ length: 20, default: 'STANDARD' })
  plan!: string;

  @Column({ name: 'expire_at', type: 'timestamp', nullable: true })
  expireAt?: Date;

  @Column({ name: 'max_users', default: 50 })
  maxUsers!: number;

  @Column({ name: 'enabled_modules', type: 'json', nullable: true })
  enabledModules?: string[];

  @Column({ name: 'contact_name', length: 50, nullable: true })
  contactName?: string;

  @Column({ name: 'contact_phone', length: 20, nullable: true })
  contactPhone?: string;

  @Column({ name: 'contact_email', length: 100, nullable: true })
  contactEmail?: string;

  @Column({ type: 'json', nullable: true })
  attributes?: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
