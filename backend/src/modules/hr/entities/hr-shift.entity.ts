import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('hr_shift')
export class HrShift {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number;
  @Column({ name: 'tenant_id', length: 50 }) tenantId!: string;
  @Column({ length: 20, unique: true }) code!: string;
  @Column({ length: 50 }) name!: string;
  @Column({ name: 'start_time', type: 'time' }) startTime!: string;
  @Column({ name: 'end_time', type: 'time' }) endTime!: string;
  /** 计算列：end_time < start_time 则为跨日班次 */
  @Column({
    name: 'is_cross_day',
    type: 'tinyint',
    generatedType: 'STORED',
    asExpression: 'IF(`end_time` < `start_time`, 1, 0)',
  })
  isCrossDay!: number;
  /** 计算列：班次时长（小时） */
  @Column({
    name: 'duration_hours',
    type: 'decimal',
    precision: 5,
    scale: 2,
    generatedType: 'STORED',
    asExpression:
      'IF(`end_time` >= `start_time`, TIME_TO_SEC(TIMEDIFF(`end_time`, `start_time`)) / 3600, (TIME_TO_SEC(TIMEDIFF(`end_time`, `start_time`)) + 86400) / 3600)',
  })
  durationHours!: number;
  @Column({ type: 'tinyint', default: 1 }) enabled!: number;
  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @Column({ name: 'updated_by', type: 'bigint', nullable: true })
  updatedBy?: string;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}
