import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum AsnStatus {
  PENDING = 'PENDING',
  RECEIVED = 'RECEIVED',
  CANCELLED = 'CANCELLED',
}

@Entity('scm_asn')
@Index('uk_scm_asn', ['tenantId', 'asnNo'], { unique: true })
@Index('idx_scm_asn_po', ['poId'])
@Index('idx_scm_asn_supplier', ['supplierId'])
export class ScmAsn {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'asn_no', length: 50 })
  asnNo!: string;

  @Column({ name: 'po_id', type: 'bigint' })
  poId!: string;

  @Column({ name: 'supplier_id', type: 'bigint' })
  supplierId!: string;

  /** 冗余：供应商名称 */
  @Column({ name: 'supplier_name', length: 200, nullable: true })
  supplierName?: string;

  @Column({ name: 'expected_date', type: 'date' })
  expectedDate!: Date;

  @Column({ type: 'enum', enum: AsnStatus, default: AsnStatus.PENDING })
  status!: AsnStatus;

  @Column({ type: 'json', nullable: true })
  items?: Record<string, any>[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
