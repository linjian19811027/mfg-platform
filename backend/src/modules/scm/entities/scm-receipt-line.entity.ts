import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('scm_receipt_line')
@Index('idx_scm_receipt_line_receipt', ['receiptId'])
export class ScmReceiptLine {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ name: 'tenant_id', length: 50 }) tenantId!: string;
  @Column({ name: 'receipt_id', type: 'bigint' }) receiptId!: string;
  @Column({ name: 'line_no', default: 1 }) lineNo!: number;
  @Column({ name: 'material_id', type: 'bigint' }) materialId!: string;
  @Column({ name: 'material_code', length: 50, nullable: true }) materialCode?: string;
  @Column({ name: 'material_name', length: 200, nullable: true }) materialName?: string;
  @Column({ name: 'received_qty', type: 'decimal', precision: 18, scale: 6, default: 0 }) receivedQty!: number;
  @Column({ name: 'uom_id', type: 'bigint', nullable: true }) uomId?: string;
  @Column({ name: 'unit_price', type: 'decimal', precision: 18, scale: 4, nullable: true }) unitPrice?: number;
  @Column({ name: 'asn_line_id', type: 'bigint', nullable: true }) asnLineId?: string;
  @Column({ type: 'text', nullable: true }) remark?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}
