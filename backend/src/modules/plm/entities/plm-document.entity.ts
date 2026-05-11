import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('plm_document')
@Index('idx_plm_doc_ref', ['tenantId', 'refType', 'refId'])
@Index('idx_plm_doc_file', ['fileId'])
export class PlmDocument {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'file_id', type: 'bigint' })
  fileId!: string;

  @Column({ name: 'ref_type', length: 20 })
  refType!: string; // MATERIAL | BOM | ROUTING | OPERATION

  @Column({ name: 'ref_id', type: 'bigint' })
  refId!: string;

  @Column({ name: 'doc_type', length: 20 })
  docType!: string; // DRAWING | SOP | WI | SPEC | OTHER

  @Column({ default: 1 })
  version!: number;

  @Column({ name: 'is_latest', type: 'tinyint', default: 1 })
  isLatest!: number;

  @Column({ type: 'json', nullable: true })
  tags?: string[];

  @Column({ length: 20, default: 'ACTIVE' })
  status!: string;

  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
