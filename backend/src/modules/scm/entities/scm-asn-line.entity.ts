import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('scm_asn_line')
@Index('idx_scm_asn_line_asn', ['asnId'])
export class ScmAsnLine {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ name: 'tenant_id', length: 50 }) tenantId!: string;
  @Column({ name: 'asn_id', type: 'bigint' }) asnId!: string;
  @Column({ name: 'line_no', default: 1 }) lineNo!: number;
  @Column({ name: 'material_id', type: 'bigint' }) materialId!: string;
  @Column({ name: 'material_code', length: 50, nullable: true }) materialCode?: string;
  @Column({ name: 'material_name', length: 200, nullable: true }) materialName?: string;
  @Column({ type: 'decimal', precision: 18, scale: 6, default: 0 }) quantity!: number;
  @Column({ name: 'uom_id', type: 'bigint', nullable: true }) uomId?: string;
  @Column({ type: 'decimal', precision: 18, scale: 4, nullable: true }) unitPrice?: number;
  @Column({ name: 'po_line_id', type: 'bigint', nullable: true }) poLineId?: string;
  @Column({ type: 'text', nullable: true }) remark?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}
