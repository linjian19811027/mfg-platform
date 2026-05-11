import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/** PENDING | PARTIAL | ALL_READY | CANCELLED */
export type ReadinessStatus = 'PENDING' | 'PARTIAL' | 'ALL_READY' | 'CANCELLED';

@Entity('mes_work_order')
@Index('uk_mes_wo', ['tenantId', 'woNo'], { unique: true })
@Index('idx_mes_wo_status', ['tenantId', 'status'])
@Index('idx_mes_wo_material', ['materialId'])
@Index('idx_wo_parent', ['tenantId', 'parentWoId'])
@Index('idx_wo_root', ['tenantId', 'rootWoId'])
export class MesWorkOrder {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'wo_no', length: 50 })
  woNo!: string;

  @Column({ name: 'wo_type', length: 20, default: 'STANDARD' })
  woType!: string; // STANDARD | REWORK | REPAIR

  @Column({ name: 'source_type', length: 20, nullable: true })
  sourceType?: string; // APS | ERP | MANUAL

  @Column({ name: 'source_id', length: 50, nullable: true })
  sourceId?: string;

  @Column({ name: 'material_id', type: 'bigint' })
  materialId!: string;

  @Column({ name: 'bom_id', type: 'bigint', nullable: true })
  bomId?: string;

  @Column({ name: 'routing_id', type: 'bigint', nullable: true })
  routingId?: string;

  @Column({ name: 'planned_qty', type: 'decimal', precision: 18, scale: 6 })
  plannedQty!: number;

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

  @Column({ name: 'uom_id', type: 'bigint' })
  uomId!: string;

  @Column({ name: 'planned_start', type: 'date', nullable: true })
  plannedStart?: Date;

  @Column({ name: 'planned_end', type: 'date', nullable: true })
  plannedEnd?: Date;

  @Column({ name: 'actual_start', type: 'timestamp', nullable: true })
  actualStart?: Date;

  @Column({ name: 'actual_end', type: 'timestamp', nullable: true })
  actualEnd?: Date;

  @Column({ length: 20, default: 'RELEASED' })
  status!: string; // RELEASED | IN_PROGRESS | COMPLETED | CLOSED

  @Column({ default: 5 })
  priority!: number; // 1-10，越小越优先

  @Column({ name: 'work_center_id', type: 'bigint', nullable: true })
  workCenterId?: string;

  /** 父工单 ID */
  @Column({ name: 'parent_wo_id', type: 'bigint', nullable: true })
  parentWoId?: string;

  /** 根工单 ID */
  @Column({ name: 'root_wo_id', type: 'bigint', nullable: true })
  rootWoId?: string;

  /** BOM 层级（根节点为 0） */
  @Column({ name: 'bom_level', type: 'int', default: 0 })
  bomLevel!: number;

  /** 物料齐套明细（JSON 列表） */
  @Column({ name: 'material_readiness', type: 'json', nullable: true })
  materialReadiness?: Record<string, unknown>[];

  /** 物料齐套整体状态：PENDING | PARTIAL | ALL_READY | CANCELLED */
  @Column({ name: 'readiness_status', length: 20, default: 'PENDING' })
  readinessStatus!: ReadinessStatus;

  /** 是否关键工单（CPM TF=0） */
  @Column({ name: 'is_critical', type: 'tinyint', width: 1, default: 0 })
  isCritical!: number;

  /** CPM 最早开始时间 */
  @Column({ name: 'es', type: 'datetime', nullable: true })
  es?: Date;

  /** CPM 最早完成时间 */
  @Column({ name: 'ef', type: 'datetime', nullable: true })
  ef?: Date;

  /** CPM 最晚开始时间 */
  @Column({ name: 'ls', type: 'datetime', nullable: true })
  ls?: Date;

  /** CPM 最晚完成时间 */
  @Column({ name: 'lf', type: 'datetime', nullable: true })
  lf?: Date;

  /** 总浮动时间（小时） */
  @Column({
    name: 'total_float',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  totalFloat?: number;

  /** 实际已入库数量（自动入库回写） */
  @Column({
    name: 'actual_receipt_qty',
    type: 'decimal',
    precision: 18,
    scale: 6,
    default: 0,
  })
  actualReceiptQty!: number;

  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  /** 计划数量与实际入库数量的差异（虚拟字段，查询时计算） */
  get receiptVariance(): number {
    return Number(this.plannedQty) - Number(this.actualReceiptQty);
  }
}
