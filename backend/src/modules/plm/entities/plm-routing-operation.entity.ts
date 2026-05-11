import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('plm_routing_operation')
@Index('idx_plm_rop_routing', ['routingId'])
export class PlmRoutingOperation {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'routing_id', type: 'bigint' })
  routingId!: string;

  @Column()
  sequence!: number; // 10, 20, 30...

  @Column({ name: 'operation_code', length: 50 })
  operationCode!: string;

  @Column({ name: 'operation_name', length: 100 })
  operationName!: string;

  @Column({ name: 'work_center_id', type: 'bigint', nullable: true })
  workCenterId?: string;

  @Column({ name: 'equipment_type', length: 50, nullable: true })
  equipmentType?: string;

  @Column({ name: 'skill_level', length: 20, nullable: true })
  skillLevel?: string; // JUNIOR | SENIOR | EXPERT

  @Column({
    name: 'std_hours',
    type: 'decimal',
    precision: 8,
    scale: 2,
    nullable: true,
  })
  stdHours?: number;

  @Column({
    name: 'setup_time',
    type: 'decimal',
    precision: 8,
    scale: 2,
    nullable: true,
  })
  setupTime?: number;

  @Column({
    name: 'teardown_time',
    type: 'decimal',
    precision: 8,
    scale: 2,
    nullable: true,
  })
  teardownTime?: number;

  /** 工艺参数：[{name, type, unit, min, max, target}] */
  @Column({ type: 'json', nullable: true })
  parameters?: Record<string, unknown>[];

  @Column({ name: 'quality_requirements', type: 'json', nullable: true })
  qualityRequirements?: Record<string, unknown>;

  @Column({ length: 500, nullable: true })
  remark?: string;
}
