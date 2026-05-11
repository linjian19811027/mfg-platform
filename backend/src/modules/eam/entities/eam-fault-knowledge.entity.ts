import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('eam_fault_knowledge')
@Index('idx_eam_knowledge_type', ['tenantId', 'equipmentType', 'faultType'])
@Index('idx_eam_knowledge_verified', ['tenantId', 'isVerified'])
export class EamFaultKnowledge {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'equipment_type', length: 50 })
  equipmentType!: string;

  @Column({ name: 'fault_type', length: 100 })
  faultType!: string;

  @Column({ name: 'fault_symptoms', type: 'text' })
  faultSymptoms!: string;

  @Column({ name: 'possible_causes', type: 'text' })
  possibleCauses!: string;

  @Column({ name: 'diagnosis_steps', type: 'text' })
  diagnosisSteps!: string;

  @Column({ name: 'repair_solution', type: 'text' })
  repairSolution!: string;

  @Column({ name: 'preventive_measures', type: 'text', nullable: true })
  preventiveMeasures?: string;

  @Column({ length: 500 })
  keywords!: string;

  @Column({ name: 'usage_count', type: 'int', default: 0 })
  usageCount!: number;

  @Column({ name: 'is_verified', type: 'tinyint', default: 0 })
  isVerified!: number;

  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
