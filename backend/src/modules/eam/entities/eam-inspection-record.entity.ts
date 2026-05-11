import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum InspectionType {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
}

export enum InspectionOverallResult {
  NORMAL = 'NORMAL',
  ABNORMAL = 'ABNORMAL',
  NEEDS_REPAIR = 'NEEDS_REPAIR',
}

@Entity('eam_inspection_record')
@Index('idx_eam_inspection_equip', ['equipmentId', 'inspectionDate'])
@Index('idx_eam_inspection_tenant', ['tenantId', 'inspectionType'])
export class EamInspectionRecord {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'equipment_id', type: 'bigint' })
  equipmentId!: string;

  @Column({ name: 'inspection_type', type: 'enum', enum: InspectionType })
  inspectionType!: InspectionType;

  @Column({ name: 'inspection_date', type: 'datetime' })
  inspectionDate!: Date;

  @Column({ name: 'inspector_id', type: 'bigint' })
  inspectorId!: string;

  @Column({ name: 'check_items', type: 'json', nullable: true })
  checkItems?: Array<{
    itemName: string;
    standard: string;
    actualValue: string;
    result: 'NORMAL' | 'ABNORMAL';
    remark?: string;
  }>;

  @Column({
    name: 'overall_result',
    type: 'enum',
    enum: InspectionOverallResult,
  })
  overallResult!: InspectionOverallResult;

  @Column({ name: 'abnormal_description', type: 'text', nullable: true })
  abnormalDescription?: string;

  @Column({ name: 'fault_record_id', type: 'bigint', nullable: true })
  faultRecordId?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
