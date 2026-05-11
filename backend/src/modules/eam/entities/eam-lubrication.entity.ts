import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('eam_lubrication')
@Index('idx_eam_lub_equip', ['equipmentId'])
@Index('idx_eam_lub_next_date', ['nextLubricationDate'])
export class EamLubrication {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'equipment_id', type: 'bigint' })
  equipmentId!: string;

  @Column({ name: 'lubrication_point', length: 200 })
  lubricationPoint!: string;

  @Column({ name: 'lubricant_type', length: 100 })
  lubricantType!: string;

  @Column({ name: 'lubricant_spec', length: 200, nullable: true })
  lubricantSpec?: string;

  @Column({ name: 'interval_days', type: 'int' })
  intervalDays!: number;

  @Column({ name: 'last_lubrication_date', type: 'date', nullable: true })
  lastLubricationDate?: Date;

  @Column({ name: 'next_lubrication_date', type: 'date', nullable: true })
  nextLubricationDate?: Date;

  @Column({ name: 'lubrication_date', type: 'date', nullable: true })
  lubricationDate?: Date;

  @Column({ type: 'decimal', precision: 10, scale: 3, nullable: true })
  quantity?: string;

  @Column({ length: 50, nullable: true })
  unit?: string;

  @Column({ name: 'operator_id', type: 'bigint', nullable: true })
  operatorId?: string;

  @Column({ type: 'text', nullable: true })
  remark?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
