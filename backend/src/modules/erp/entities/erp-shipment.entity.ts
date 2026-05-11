import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum ShipmentStatus {
  PENDING = 'PENDING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  SIGNED = 'SIGNED',
}

@Entity('erp_shipment')
@Index('uk_erp_shipment', ['tenantId', 'shipmentNo'], { unique: true })
@Index('idx_erp_shipment_so', ['soId'])
@Index('idx_erp_shipment_customer', ['customerId'])
export class ErpShipment {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'shipment_no', length: 50 })
  shipmentNo!: string;

  @Column({ name: 'so_id', type: 'bigint' })
  soId!: string;

  @Column({ name: 'customer_id', type: 'bigint' })
  customerId!: string;

  @Column({ name: 'ship_date', type: 'date' })
  shipDate!: Date;

  @Column({ length: 100, nullable: true })
  carrier?: string;

  @Column({ name: 'tracking_no', length: 100, nullable: true })
  trackingNo?: string;

  @Column({
    type: 'enum',
    enum: ShipmentStatus,
    default: ShipmentStatus.PENDING,
  })
  status!: ShipmentStatus;

  @Column({ type: 'json', nullable: true })
  items?: Record<string, any>[];

  @Column({ name: 'logistics_info', type: 'json', nullable: true })
  logisticsInfo?: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
