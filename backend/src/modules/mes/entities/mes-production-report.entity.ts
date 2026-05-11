import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('mes_production_report')
@Index('idx_mes_pr_wo', ['woId'])
@Index('idx_mes_pr_time', ['reportTime'])
@Index('idx_mes_pr_operator', ['tenantId', 'operatorId'])
export class MesProductionReport {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'wo_id', type: 'bigint' })
  woId!: string;

  @Column({ name: 'woo_id', type: 'bigint', nullable: true })
  wooId?: string; // 工单工序 ID

  @Column({ name: 'report_type', length: 20 })
  reportType!: string; // START | COMPLETE | SCRAP | TRANSFER | EXCEPTION

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

  @Column({ name: 'uom_id', type: 'bigint', nullable: true })
  uomId?: string;

  @Column({ name: 'operator_id', type: 'bigint', nullable: true })
  operatorId?: string;

  @Column({ name: 'equipment_id', type: 'bigint', nullable: true })
  equipmentId?: string;

  @Column({ name: 'report_time', type: 'timestamp' })
  reportTime!: Date;

  @Column({ name: 'shift_id', type: 'bigint', nullable: true })
  shiftId?: string;

  /** 投入批次 ID 列表（JSON 数组） */
  @Column({ name: 'input_batch_ids', type: 'json', nullable: true })
  inputBatchIds?: string[];

  @Column({ name: 'output_batch_id', type: 'bigint', nullable: true })
  outputBatchId?: string;

  @Column({ name: 'exception_type', length: 50, nullable: true })
  exceptionType?: string; // MACHINE_DOWN | MATERIAL_SHORTAGE | QUALITY | OTHER

  @Column({ name: 'exception_reason', length: 500, nullable: true })
  exceptionReason?: string;

  /** 修正原因（报工修正时填写） */
  @Column({ name: 'correction_reason', length: 500, nullable: true })
  correctionReason?: string;

  /** 原报工 ID（修正时关联） */
  @Column({ name: 'original_report_id', type: 'bigint', nullable: true })
  originalReportId?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
