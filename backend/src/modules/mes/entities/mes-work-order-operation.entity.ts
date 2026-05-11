import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('mes_work_order_operation')
@Index('idx_mes_woo_wo', ['woId'])
@Index('idx_mes_woo_status', ['tenantId', 'status'])
export class MesWorkOrderOperation {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'wo_id', type: 'bigint' })
  woId!: string;

  @Column()
  sequence!: number;

  @Column({ name: 'operation_id', type: 'bigint' })
  operationId!: string;

  @Column({ name: 'operation_code', length: 50, nullable: true })
  operationCode?: string;

  @Column({ name: 'operation_name', length: 100, nullable: true })
  operationName?: string;

  @Column({ name: 'work_center_id', type: 'bigint', nullable: true })
  workCenterId?: string;

  @Column({ name: 'equipment_id', type: 'bigint', nullable: true })
  equipmentId?: string;

  @Column({
    name: 'planned_hours',
    type: 'decimal',
    precision: 8,
    scale: 2,
    nullable: true,
  })
  plannedHours?: number;

  @Column({
    name: 'actual_hours',
    type: 'decimal',
    precision: 8,
    scale: 2,
    nullable: true,
  })
  actualHours?: number;

  @Column({
    name: 'planned_qty',
    type: 'decimal',
    precision: 18,
    scale: 6,
    nullable: true,
  })
  plannedQty?: number;

  @Column({
    name: 'completed_qty',
    type: 'decimal',
    precision: 18,
    scale: 6,
    default: 0,
  })
  completedQty!: number;

  @Column({
    name: 'scrap_qty',
    type: 'decimal',
    precision: 18,
    scale: 6,
    default: 0,
  })
  scrapQty!: number;

  @Column({ length: 20, default: 'PENDING' })
  status!: string; // PENDING | IN_PROGRESS | COMPLETED | SKIPPED

  @Column({ name: 'actual_start', type: 'timestamp', nullable: true })
  actualStart?: Date;

  @Column({ name: 'actual_end', type: 'timestamp', nullable: true })
  actualEnd?: Date;

  /** 是否并行工序（可与上道同时进行） */
  @Column({ name: 'is_parallel', type: 'tinyint', default: 0 })
  isParallel!: number;

  /** 是否允许部分完工入库（完工即触发入库，不等全部工序完成） */
  @Column({ name: 'partial_receipt_enabled', type: 'tinyint', default: 0 })
  partialReceiptEnabled!: number;
}
