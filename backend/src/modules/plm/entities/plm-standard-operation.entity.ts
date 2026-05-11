import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('plm_standard_operation')
@Index('uk_plm_std_op', ['tenantId', 'code'], { unique: true })
export class PlmStandardOperation {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ length: 50 })
  code!: string;

  @Column({ length: 100 })
  name!: string;

  @Column({ name: 'work_center_id', type: 'bigint', nullable: true })
  workCenterId?: string;

  @Column({ name: 'work_center_name', length: 100, nullable: true })
  workCenterName?: string;

  @Column({
    name: 'std_hours',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  stdHours?: number;

  @Column({
    name: 'setup_time',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  setupTime?: number;

  @Column({ length: 500, nullable: true })
  description?: string;

  @Column({ length: 20, default: 'ACTIVE' })
  status!: string; // ACTIVE | INACTIVE

  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
