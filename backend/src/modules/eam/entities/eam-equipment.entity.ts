import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum EquipmentStatus {
  RUNNING = 'RUNNING',
  IDLE = 'IDLE',
  MAINTENANCE = 'MAINTENANCE',
  FAULT = 'FAULT',
  SCRAPPED = 'SCRAPPED',
}

@Entity('eam_equipment')
@Index('idx_eam_equip_tenant_code', ['tenantId', 'equipmentCode'], {
  unique: true,
})
@Index('idx_eam_equip_status', ['tenantId', 'status'])
@Index('idx_eam_equip_workshop', ['workshopId'])
export class EamEquipment {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'equipment_code', length: 100 })
  equipmentCode!: string;

  @Column({ name: 'equipment_name', length: 200 })
  equipmentName!: string;

  @Column({ name: 'equipment_type', length: 50 })
  equipmentType!: string;

  @Column({ length: 100 })
  category!: string;

  @Column({ name: 'parent_id', type: 'bigint', nullable: true })
  parentId?: string;

  @Column({ name: 'workshop_id', type: 'bigint', nullable: true })
  workshopId?: string;

  @Column({ name: 'production_line_id', type: 'bigint', nullable: true })
  productionLineId?: string;

  @Column({ name: 'workstation_id', type: 'bigint', nullable: true })
  workstationId?: string;

  @Column({ length: 500, nullable: true })
  location?: string;

  @Column({ length: 200, nullable: true })
  manufacturer?: string;

  @Column({ length: 100, nullable: true })
  model?: string;

  @Column({ name: 'serial_number', length: 100, nullable: true })
  serialNumber?: string;

  @Column({ name: 'purchase_date', type: 'date', nullable: true })
  purchaseDate?: Date;

  @Column({ name: 'install_date', type: 'date', nullable: true })
  installDate?: Date;

  @Column({ name: 'commission_date', type: 'date', nullable: true })
  commissionDate?: Date;

  @Column({ name: 'warranty_expiry', type: 'date', nullable: true })
  warrantyExpiry?: Date;

  @Column({
    type: 'enum',
    enum: EquipmentStatus,
    default: EquipmentStatus.IDLE,
  })
  status!: EquipmentStatus;

  @Column({ name: 'qr_code', length: 500, nullable: true })
  qrCode?: string;

  @Column({ name: 'image_url', length: 500, nullable: true })
  imageUrl?: string;

  @Column({ type: 'text', nullable: true })
  remark?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
