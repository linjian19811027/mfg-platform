import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('eam_oee_record')
@Index('idx_eam_oee_equip_date', ['equipmentId', 'recordDate'])
@Index('idx_eam_oee_tenant_date', ['tenantId', 'recordDate'])
export class EamOeeRecord {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'equipment_id', type: 'bigint' })
  equipmentId!: string;

  @Column({ name: 'record_date', type: 'date' })
  recordDate!: Date;

  @Column({ length: 50, nullable: true })
  shift?: string;

  @Column({ name: 'planned_time', type: 'decimal', precision: 10, scale: 2 })
  plannedTime!: string;

  @Column({ name: 'actual_run_time', type: 'decimal', precision: 10, scale: 2 })
  actualRunTime!: string;

  @Column({
    name: 'down_time',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  downTime!: string;

  @Column({ type: 'decimal', precision: 5, scale: 4 })
  availability!: string;

  @Column({
    name: 'theoretical_output',
    type: 'decimal',
    precision: 10,
    scale: 3,
  })
  theoreticalOutput!: string;

  @Column({ name: 'actual_output', type: 'decimal', precision: 10, scale: 3 })
  actualOutput!: string;

  @Column({ type: 'decimal', precision: 5, scale: 4 })
  performance!: string;

  @Column({
    name: 'qualified_output',
    type: 'decimal',
    precision: 10,
    scale: 3,
  })
  qualifiedOutput!: string;

  @Column({ type: 'decimal', precision: 5, scale: 4 })
  quality!: string;

  @Column({ type: 'decimal', precision: 5, scale: 4 })
  oee!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
