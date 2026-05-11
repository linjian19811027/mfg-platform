import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum EquipmentEventType {
  PURCHASE = 'PURCHASE',
  INSTALL = 'INSTALL',
  COMMISSION = 'COMMISSION',
  MAINTENANCE = 'MAINTENANCE',
  REPAIR = 'REPAIR',
  MODIFICATION = 'MODIFICATION',
  SCRAP = 'SCRAP',
}

@Entity('eam_equipment_history')
@Index('idx_eam_history_equip', ['equipmentId', 'eventDate'])
export class EamEquipmentHistory {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'equipment_id', type: 'bigint' })
  equipmentId!: string;

  @Column({ name: 'event_type', type: 'enum', enum: EquipmentEventType })
  eventType!: EquipmentEventType;

  @Column({ name: 'event_date', type: 'datetime' })
  eventDate!: Date;

  @Column({ type: 'text' })
  description!: string;

  @Column({ name: 'operator_id', type: 'bigint', nullable: true })
  operatorId?: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  cost?: string;

  @Column({ name: 'related_task_id', type: 'bigint', nullable: true })
  relatedTaskId?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
