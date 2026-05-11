import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('wms_barcode_rule')
@Index('uk_wms_br', ['tenantId', 'ruleType'], { unique: true })
export class WmsBarcodeRule {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ name: 'tenant_id', length: 50 }) tenantId!: string;
  /** LOCATION | MATERIAL | BATCH | SERIAL */
  @Column({ name: 'rule_type', length: 20 }) ruleType!: string;
  @Column({ length: 100 }) name!: string;
  @Column({ length: 200 }) template!: string;
  @Column({ name: 'prefix', length: 20, nullable: true }) prefix?: string;
  @Column({ name: 'serial_length', default: 6 }) serialLength!: number;
  @Column({ name: 'current_serial', default: 0 }) currentSerial!: number;
  @Column({ length: 20, default: 'ACTIVE' }) status!: string;
  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @Column({ name: 'updated_by', type: 'bigint', nullable: true })
  updatedBy?: string;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}
