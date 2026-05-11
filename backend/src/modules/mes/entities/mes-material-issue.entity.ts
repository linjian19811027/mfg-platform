import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('mes_material_issue')
@Index('idx_mes_mi_wo', ['woId'])
@Index('idx_mes_mi_batch', ['batchId'])
@Index('idx_mes_mi_type', ['tenantId', 'issueType'])
export class MesMaterialIssue {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'wo_id', type: 'bigint' })
  woId!: string;

  @Column({ name: 'woo_id', type: 'bigint', nullable: true })
  wooId?: string;

  @Column({ name: 'material_id', type: 'bigint' })
  materialId!: string;

  @Column({ name: 'batch_id', type: 'bigint', nullable: true })
  batchId?: string;

  @Column({ type: 'decimal', precision: 18, scale: 6 })
  quantity!: number;

  @Column({ name: 'uom_id', type: 'bigint' })
  uomId!: string;

  @Column({ name: 'issue_type', length: 20, default: 'ISSUE' })
  issueType!: string; // ISSUE（领料）| RETURN（退料）| SUPPLEMENT（补料）

  @Column({ name: 'issue_reason', length: 200, nullable: true })
  issueReason?: string; // 补料原因：OVER_CONSUMPTION | SCRAP

  @Column({ name: 'operator_id', type: 'bigint', nullable: true })
  operatorId?: string;

  @Column({ name: 'from_location_id', type: 'bigint', nullable: true })
  fromLocationId?: string;

  @CreateDateColumn({ name: 'issue_time' })
  issueTime!: Date;
}
