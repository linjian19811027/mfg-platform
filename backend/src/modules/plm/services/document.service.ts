import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlmDocument } from '../entities/plm-document.entity.js';
import { PlmDocumentPermission } from '../entities/plm-document-permission.entity.js';
import { FileService } from '../../file/file.service.js';
import { TenantContext } from '../../../shared/tenant/tenant.context.js';

export type DocAction = 'view' | 'download' | 'edit' | 'approve';

@Injectable()
export class DocumentService {
  constructor(
    @InjectRepository(PlmDocument)
    private readonly repo: Repository<PlmDocument>,
    @InjectRepository(PlmDocumentPermission)
    private readonly permRepo: Repository<PlmDocumentPermission>,
    private readonly fileService: FileService,
  ) {}

  // ── 权限检查 ──────────────────────────────────────────────────────────────

  async checkPermission(
    docType: string,
    action: DocAction,
    userRoles: string[],
  ): Promise<void> {
    const tenantId = TenantContext.requireCurrentTenant();
    const actionCol: Record<DocAction, keyof PlmDocumentPermission> = {
      view: 'canView',
      download: 'canDownload',
      edit: 'canEdit',
      approve: 'canApprove',
    };

    for (const role of userRoles) {
      const perm = await this.permRepo.findOne({
        where: [
          { tenantId, roleCode: role, docType } as any,
          { tenantId, roleCode: role, docType: '*' } as any,
        ],
      });
      if (perm && perm[actionCol[action]]) return; // 有权限
    }

    throw new ForbiddenException(`PLM_DOC_PERMISSION_DENIED:${action}`);
  }

  async setPermission(
    data: Partial<PlmDocumentPermission>,
  ): Promise<PlmDocumentPermission> {
    const tenantId = TenantContext.requireCurrentTenant();
    data.tenantId = tenantId;

    // upsert：同 docType+roleCode 只保留一条
    const existing = await this.permRepo.findOne({
      where: {
        tenantId,
        docType: data.docType!,
        roleCode: data.roleCode!,
      } as any,
    });
    if (existing) {
      await this.permRepo.update(existing.id, data as any);
      return { ...existing, ...data };
    }
    return this.permRepo.save(this.permRepo.create(data));
  }

  async findPermissions(roleCode?: string): Promise<PlmDocumentPermission[]> {
    const tenantId = TenantContext.requireCurrentTenant();
    const where: any = { tenantId };
    if (roleCode) where.roleCode = roleCode;
    return this.permRepo.find({
      where,
      order: { docType: 'ASC', roleCode: 'ASC' },
    });
  }

  // ── 文档上传 ──────────────────────────────────────────────────────────────

  async upload(
    file: Express.Multer.File,
    refType: string,
    refId: string,
    docType: string,
    uploadedBy: string,
    tags?: string[],
  ): Promise<PlmDocument> {
    const tenantId = TenantContext.requireCurrentTenant();

    const sysFile = await this.fileService.upload(
      file,
      `plm_${refType.toLowerCase()}`,
      refId,
      uploadedBy,
    );

    // 旧版本标记为非最新
    await this.repo.update(
      { tenantId, refType, refId: refId as any, docType, isLatest: 1 } as any,
      { isLatest: 0 },
    );

    const latest = await this.repo.findOne({
      where: { tenantId, refType, refId: refId as any, docType } as any,
      order: { version: 'DESC' },
    });
    const version = (latest?.version ?? 0) + 1;

    return this.repo.save(
      this.repo.create({
        tenantId,
        fileId: sysFile.id,
        refType,
        refId,
        docType,
        version,
        isLatest: 1,
        tags,
        createdBy: uploadedBy,
      }),
    );
  }

  // ── 查询 ──────────────────────────────────────────────────────────────────

  async findByRef(
    refType: string,
    refId: string,
    latestOnly = true,
  ): Promise<PlmDocument[]> {
    const tenantId = TenantContext.requireCurrentTenant();
    const where: any = { tenantId, refType, refId };
    if (latestOnly) where.isLatest = 1;
    return this.repo.find({
      where,
      order: { docType: 'ASC', version: 'DESC' },
    });
  }

  /**
   * 文档检索：按文件名模糊搜索 + 标签匹配
   * GET /api/v1/plm/documents/search?keyword=xxx&refType=MATERIAL&docType=DRAWING
   */
  async search(
    keyword: string,
    refType?: string,
    docType?: string,
  ): Promise<unknown[]> {
    const tenantId = TenantContext.requireCurrentTenant();

    let sql = `
      SELECT d.id, d.ref_type, d.ref_id, d.doc_type, d.version, d.is_latest,
             d.tags, d.created_at,
             f.original_name, f.url, f.mime_type, f.size_bytes
      FROM plm_document d
      JOIN sys_file f ON f.id = d.file_id
      WHERE d.tenant_id = ? AND d.status = 'ACTIVE'
        AND (f.original_name LIKE ? OR JSON_SEARCH(d.tags, 'one', ?) IS NOT NULL)
    `;
    const params: unknown[] = [tenantId, `%${keyword}%`, keyword];

    if (refType) {
      sql += ' AND d.ref_type = ?';
      params.push(refType);
    }
    if (docType) {
      sql += ' AND d.doc_type = ?';
      params.push(docType);
    }

    sql += ' ORDER BY d.created_at DESC LIMIT 100';

    return this.repo.manager.query(sql, params);
  }

  async delete(id: string): Promise<void> {
    const tenantId = TenantContext.requireCurrentTenant();
    const doc = await this.repo.findOne({ where: { id, tenantId } });
    if (!doc) throw new NotFoundException('PLM_DOCUMENT_NOT_FOUND');
    await this.repo.update(id, { status: 'DELETED' });
  }
}
