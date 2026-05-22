import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { SysFile } from './entities/sys-file.entity.js';
import { TenantContext } from '../../shared/tenant/tenant.context.js';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
];

@Injectable()
export class FileService {
  private readonly logger = new Logger(FileService.name);
  private readonly storagePath: string;
  private readonly maxSizeBytes: number;

  constructor(
    @InjectRepository(SysFile) private readonly fileRepo: Repository<SysFile>,
    private readonly config: ConfigService,
  ) {
    this.storagePath = config.get<string>('STORAGE_LOCAL_PATH', './data/files');
    const maxMb = config.get<number>('FILE_MAX_SIZE_MB', 50);
    this.maxSizeBytes = maxMb * 1024 * 1024;
  }

  async upload(
    file: Express.Multer.File,
    refType: string,
    refId: string,
    uploadedBy: string,
  ): Promise<SysFile> {
    const tenantId = TenantContext.requireCurrentTenant();

    // 校验大小
    if (file.size > this.maxSizeBytes) {
      throw new BadRequestException(
        `FILE_TOO_LARGE: max ${this.maxSizeBytes / 1024 / 1024}MB`,
      );
    }

    // 校验 MIME 类型
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(`FILE_TYPE_NOT_ALLOWED: ${file.mimetype}`);
    }

    // 构建存储路径
    const dir = path.join(this.storagePath, tenantId, refType, refId);
    fs.mkdirSync(dir, { recursive: true });

    const ext = path.extname(file.originalname);
    const filename = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
    const filePath = path.join(dir, filename);
    const fileKey = path
      .join(tenantId, refType, refId, filename)
      .replace(/\\/g, '/');

    // 写入文件
    fs.writeFileSync(filePath, file.buffer);

    // 计算 MD5
    const checksum = crypto.createHash('md5').update(file.buffer).digest('hex');

    const entity = this.fileRepo.create({
      tenantId,
      fileKey,
      originalName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: String(file.size),
      storageType: 'LOCAL',
      url: `/api/v1/files/${fileKey}/download`,
      checksum,
      refType,
      refId,
      uploadedBy,
    });

    return this.fileRepo.save(entity);
  }

  async download(id: string): Promise<{ filePath: string; file: SysFile }> {
    const tenantId = TenantContext.requireCurrentTenant();
    const file = await this.fileRepo.findOne({ where: { id, tenantId } });
    if (!file) throw new NotFoundException('FILE_NOT_FOUND');

    const filePath = path.join(this.storagePath, file.fileKey);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('FILE_NOT_FOUND_ON_DISK');
    }

    return { filePath, file };
  }

  async findOne(id: string): Promise<SysFile> {
    const tenantId = TenantContext.requireCurrentTenant();
    const file = await this.fileRepo.findOne({ where: { id, tenantId } });
    if (!file) throw new NotFoundException('FILE_NOT_FOUND');
    return file;
  }

  async delete(id: string): Promise<void> {
    const tenantId = TenantContext.requireCurrentTenant();
    const file = await this.fileRepo.findOne({ where: { id, tenantId } });
    if (!file) throw new NotFoundException('FILE_NOT_FOUND');

    const filePath = path.join(this.storagePath, file.fileKey);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    await this.fileRepo.delete(id);
  }

  /** 读取文本文件内容 */
  async readTextContent(id: string): Promise<{ content: string; mimeType?: string; originalName: string }> {
    const tenantId = TenantContext.requireCurrentTenant();
    const file = await this.fileRepo.findOne({ where: { id, tenantId } });
    if (!file) throw new NotFoundException('FILE_NOT_FOUND');

    const textMimes = ['text/plain', 'text/csv', 'application/json', 'text/xml', 'text/html', 'text/css', 'text/javascript'];
    const isText = textMimes.some(m => (file.mimeType ?? '').includes(m.replace('text/', ''))) || (file.mimeType ?? '').startsWith('text/');
    if (!isText) throw new BadRequestException('FILE_NOT_TEXT_TYPE');

    const filePath = path.join(this.storagePath, file.fileKey);
    if (!fs.existsSync(filePath)) throw new NotFoundException('FILE_NOT_FOUND_ON_DISK');

    const content = fs.readFileSync(filePath, 'utf-8');
    return { content, mimeType: file.mimeType, originalName: file.originalName };
  }

  /** 保存文本文件编辑（创建新版本） */
  async saveTextContent(id: string, content: string, updatedBy: string): Promise<SysFile> {
    const tenantId = TenantContext.requireCurrentTenant();
    const file = await this.fileRepo.findOne({ where: { id, tenantId } });
    if (!file) throw new NotFoundException('FILE_NOT_FOUND');

    const filePath = path.join(this.storagePath, file.fileKey);
    if (!fs.existsSync(filePath)) throw new NotFoundException('FILE_NOT_FOUND_ON_DISK');

    // 写入新内容
    const buffer = Buffer.from(content, 'utf-8');
    fs.writeFileSync(filePath, buffer);

    // 更新 checksum 和版本号
    const checksum = crypto.createHash('md5').update(buffer).digest('hex');
    await this.fileRepo.update(id, {
      sizeBytes: String(buffer.length),
      checksum,
      version: file.version + 1,
      uploadedBy: updatedBy,
    } as any);

    return this.fileRepo.findOne({ where: { id } }) as Promise<SysFile>;
  }

  /** 获取文件版本历史 */
  async getVersions(id: string): Promise<SysFile[]> {
    const tenantId = TenantContext.requireCurrentTenant();
    const file = await this.fileRepo.findOne({ where: { id, tenantId } });
    if (!file) throw new NotFoundException('FILE_NOT_FOUND');

    // 查找同 fileKey 的所有版本
    return this.fileRepo.find({
      where: { tenantId, fileKey: file.fileKey },
      order: { version: 'DESC' },
    });
  }
}
