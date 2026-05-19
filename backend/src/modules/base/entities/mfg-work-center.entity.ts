import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';

@Entity('mfg_work_center')
export class MfgWorkCenter {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ length: 50 })
  name!: string;

  @Column({ length: 20, nullable: true })
  code?: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'tinyint', default: 1 })
  enabled!: number;

  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
  @DeleteDateColumn({ name: 'deleted_at' }) deletedAt?: Date;
}
