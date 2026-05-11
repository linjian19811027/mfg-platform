import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('plm_document_permission')
@Index('uk_plm_doc_perm', ['tenantId', 'docType', 'roleCode'], { unique: true })
@Index('idx_plm_doc_perm_role', ['tenantId', 'roleCode'])
export class PlmDocumentPermission {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  /** 文档类型：DRAWING | SOP | WI | SPEC | OTHER，或 '*' 表示全部 */
  @Column({ name: 'doc_type', length: 20 })
  docType!: string;

  @Column({ name: 'role_code', length: 50 })
  roleCode!: string;

  /** 查看权限 */
  @Column({ name: 'can_view', type: 'tinyint', default: 0 })
  canView!: number;

  /** 下载权限 */
  @Column({ name: 'can_download', type: 'tinyint', default: 0 })
  canDownload!: number;

  /** 编辑权限（上传新版本） */
  @Column({ name: 'can_edit', type: 'tinyint', default: 0 })
  canEdit!: number;

  /** 审批权限（审批文档发布） */
  @Column({ name: 'can_approve', type: 'tinyint', default: 0 })
  canApprove!: number;

  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
