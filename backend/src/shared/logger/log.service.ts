import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import {
  SysAuditLog,
  AuditLogType,
} from '../../modules/auth/entities/sys-audit-log.entity.js';

export interface LogEntry {
  logType: AuditLogType;
  tenantId?: string;
  userId?: string;
  username?: string;
  module?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  requestMethod?: string;
  requestUrl?: string;
  requestBody?: string;
  requestTime?: Date;
  responseCode?: number;
  errorMessage?: string;
  errorStack?: string;
  ipAddress?: string;
  userAgent?: string;
  durationMs?: number;
  loginResult?: string;
}

@Injectable()
export class LogService {
  private readonly logger = new Logger(LogService.name);
  /** 'db' | 'file' | 'both' */
  private readonly target: string;
  private readonly logDir: string;

  constructor(
    @InjectRepository(SysAuditLog)
    private readonly logRepo: Repository<SysAuditLog>,
    private readonly config: ConfigService,
  ) {
    this.target = config.get<string>('LOG_TARGET', 'db');
    this.logDir = config.get<string>('LOG_FILE_DIR', './logs');
    if (this.target === 'file' || this.target === 'both') {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  // ── 公共写入入口 ──────────────────────────────────────────────────────────

  async write(entry: LogEntry): Promise<void> {
    try {
      if (this.target === 'db' || this.target === 'both') {
        await this.writeToDB(entry);
      }
      if (this.target === 'file' || this.target === 'both') {
        this.writeToFile(entry);
      }
    } catch (err) {
      this.logger.error(`[LogService] 写入日志失败: ${err}`);
    }
  }

  // ── 快捷方法 ──────────────────────────────────────────────────────────────

  async login(params: {
    tenantId?: string;
    userId?: string;
    username?: string;
    ipAddress?: string;
    userAgent?: string;
    requestMethod?: string;
    requestUrl?: string;
    requestTime?: Date;
    result: 'SUCCESS' | 'FAILED' | 'LOCKED';
    errorMessage?: string;
  }): Promise<void> {
    await this.write({
      logType: 'LOGIN',
      tenantId: params.tenantId,
      userId: params.userId,
      username: params.username,
      action: 'LOGIN',
      requestMethod: params.requestMethod ?? 'POST',
      requestUrl: params.requestUrl ?? '/api/v1/auth/login',
      requestTime: params.requestTime ?? new Date(),
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      loginResult: params.result,
      errorMessage: params.errorMessage,
      responseCode: params.result === 'SUCCESS' ? 200 : 401,
    });
  }

  async operation(params: {
    tenantId?: string;
    userId?: string;
    username?: string;
    module?: string;
    action?: string;
    resourceType?: string;
    resourceId?: string;
    requestMethod?: string;
    requestUrl?: string;
    requestBody?: string;
    requestTime?: Date;
    responseCode?: number;
    ipAddress?: string;
    userAgent?: string;
    durationMs?: number;
  }): Promise<void> {
    await this.write({ logType: 'OPERATION', ...params });
  }

  async systemError(params: {
    tenantId?: string;
    userId?: string;
    username?: string;
    requestMethod?: string;
    requestUrl?: string;
    requestTime?: Date;
    errorMessage: string;
    errorStack?: string;
    ipAddress?: string;
    durationMs?: number;
  }): Promise<void> {
    await this.write({ logType: 'SYSTEM_ERROR', responseCode: 500, ...params });
  }

  async bizError(params: {
    tenantId?: string;
    userId?: string;
    username?: string;
    requestMethod?: string;
    requestUrl?: string;
    requestTime?: Date;
    responseCode: number;
    errorMessage: string;
    ipAddress?: string;
    durationMs?: number;
  }): Promise<void> {
    await this.write({ logType: 'BIZ_ERROR', ...params });
  }

  // ── 私有：写数据库 ────────────────────────────────────────────────────────

  private async writeToDB(entry: LogEntry): Promise<void> {
    await this.logRepo.save(this.logRepo.create(entry));
  }

  // ── 私有：写文件 ──────────────────────────────────────────────────────────

  private writeToFile(entry: LogEntry): void {
    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const filename = path.join(
      this.logDir,
      `${entry.logType.toLowerCase()}-${date}.log`,
    );
    const line =
      JSON.stringify({ ...entry, timestamp: new Date().toISOString() }) + '\n';
    fs.appendFileSync(filename, line, 'utf8');
  }
}
