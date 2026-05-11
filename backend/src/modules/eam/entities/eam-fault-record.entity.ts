import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum FaultSource {
  MES_AUTO = 'MES_AUTO',
  FIELD_REPORT = 'FIELD_REPORT',
  ALARM_SYSTEM = 'ALARM_SYSTEM',
}

export enum FaultSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum FaultStatus {
  REPORTED = 'REPORTED',
  RESPONDING = 'RESPONDING',
  DIAGNOSING = 'DIAGNOSING',
  REPAIRING = 'REPAIRING',
  VERIFIED = 'VERIFIED',
  CLOSED = 'CLOSED',
}

@Entity('eam_fault_record')
@Index('idx_eam_fault_equip', ['equipmentId', 'reportedAt'])
@Index('idx_eam_fault_status', ['tenantId', 'status'])
@Index('idx_eam_fault_code', ['tenantId', 'faultCode'])
export class EamFaultRecord {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'fault_code', length: 100 })
  faultCode!: string;

  @Column({ name: 'equipment_id', type: 'bigint' })
  equipmentId!: string;

  @Column({ name: 'fault_source', type: 'enum', enum: FaultSource })
  faultSource!: FaultSource;

  @Column({ name: 'fault_type', length: 100 })
  faultType!: string;

  @Column({ name: 'fault_description', type: 'text' })
  faultDescription!: string;

  @Column({ type: 'enum', enum: FaultSeverity })
  severity!: FaultSeverity;

  @Column({ type: 'enum', enum: FaultStatus, default: FaultStatus.REPORTED })
  status!: FaultStatus;

  @Column({ name: 'reported_at', type: 'datetime' })
  reportedAt!: Date;

  @Column({ name: 'reported_by', type: 'bigint', nullable: true })
  reportedBy?: string;

  @Column({ name: 'responded_at', type: 'datetime', nullable: true })
  respondedAt?: Date;

  @Column({ name: 'diagnosis_result', type: 'text', nullable: true })
  diagnosisResult?: string;

  @Column({ name: 'root_cause', type: 'text', nullable: true })
  rootCause?: string;

  @Column({ name: 'repair_method', type: 'text', nullable: true })
  repairMethod?: string;

  @Column({ name: 'assigned_to', type: 'bigint', nullable: true })
  assignedTo?: string;

  @Column({ name: 'start_repair_at', type: 'datetime', nullable: true })
  startRepairAt?: Date;

  @Column({ name: 'end_repair_at', type: 'datetime', nullable: true })
  endRepairAt?: Date;

  @Column({ name: 'verified_at', type: 'datetime', nullable: true })
  verifiedAt?: Date;

  @Column({ name: 'verified_by', type: 'bigint', nullable: true })
  verifiedBy?: string;

  @Column({
    name: 'labor_hours',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  laborHours?: string;

  @Column({
    name: 'labor_cost',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  laborCost?: string;

  @Column({
    name: 'material_cost',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  materialCost?: string;

  @Column({
    name: 'production_loss',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  productionLoss?: string;

  @Column({ name: 'related_knowledge_id', type: 'bigint', nullable: true })
  relatedKnowledgeId?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
