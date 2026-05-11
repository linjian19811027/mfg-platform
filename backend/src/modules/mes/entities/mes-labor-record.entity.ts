import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('mes_labor_record')
@Index('idx_mes_lr_wo', ['woId'])
@Index('idx_mes_lr_operator', ['tenantId', 'operatorId'])
export class MesLaborRecord {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'wo_id', type: 'bigint' })
  woId!: string;

  @Column({ name: 'woo_id', type: 'bigint', nullable: true })
  wooId?: string;

  @Column({ name: 'operator_id', type: 'bigint' })
  operatorId!: string;

  @Column({ name: 'start_time', type: 'timestamp' })
  startTime!: Date;

  @Column({ name: 'end_time', type: 'timestamp', nullable: true })
  endTime?: Date;

  /** 直接工时（分钟），从开工/完工时间差自动计算 */
  @Column({
    name: 'direct_hours',
    type: 'decimal',
    precision: 8,
    scale: 2,
    default: 0,
  })
  directHours!: number;

  /** 间接分摊工时（分钟），按产量比例分摊 */
  @Column({
    name: 'indirect_hours',
    type: 'decimal',
    precision: 8,
    scale: 2,
    default: 0,
  })
  indirectHours!: number;

  @Column({ name: 'shift_id', type: 'bigint', nullable: true })
  shiftId?: string;

  @Column({ name: 'labor_type', length: 20, default: 'DIRECT' })
  laborType!: string; // DIRECT | INDIRECT

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
