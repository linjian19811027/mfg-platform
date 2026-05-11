import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('scm_price_record')
@Index('idx_scm_pr_supplier_material', ['tenantId', 'supplierId', 'materialId'])
@Index('idx_scm_pr_record_date', ['recordDate'])
export class ScmPriceRecord {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ name: 'tenant_id', length: 50 }) tenantId!: string;
  @Column({ name: 'supplier_id', type: 'bigint' }) supplierId!: string;
  @Column({ name: 'material_id', type: 'bigint' }) materialId!: string;
  @Column({ name: 'unit_price', type: 'decimal', precision: 18, scale: 4 })
  unitPrice!: number;
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true })
  quantity?: number;
  @Column({ name: 'po_no', length: 50, nullable: true }) poNo?: string;
  @Column({ name: 'record_date', type: 'date' }) recordDate!: Date;
  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @Column({ name: 'updated_by', type: 'bigint', nullable: true })
  updatedBy?: string;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}
