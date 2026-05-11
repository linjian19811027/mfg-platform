import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('sys_file')
@Index('idx_sys_file_ref', ['refType', 'refId'])
@Index('idx_sys_file_tenant', ['tenantId'])
export class SysFile {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'file_key', length: 200 })
  fileKey!: string;

  @Column({ name: 'original_name', length: 200 })
  originalName!: string;

  @Column({ name: 'mime_type', length: 100, nullable: true })
  mimeType?: string;

  @Column({ name: 'size_bytes', type: 'bigint', nullable: true })
  sizeBytes?: string;

  @Column({ name: 'storage_type', length: 20, default: 'LOCAL' })
  storageType!: string;

  @Column({ length: 100, nullable: true })
  bucket?: string;

  @Column({ length: 500, nullable: true })
  url?: string;

  @Column({ length: 64, nullable: true })
  checksum?: string;

  @Column({ name: 'ref_type', length: 50, nullable: true })
  refType?: string;

  @Column({ name: 'ref_id', length: 50, nullable: true })
  refId?: string;

  @Column({ default: 1 })
  version!: number;

  @Column({ name: 'is_latest', type: 'tinyint', default: 1 })
  isLatest!: number;

  @Column({ name: 'previous_id', type: 'bigint', nullable: true })
  previousId?: string;

  @Column({ name: 'uploaded_by', type: 'bigint', nullable: true })
  uploadedBy?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
