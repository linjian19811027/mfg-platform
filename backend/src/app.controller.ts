import {
  Controller,
  Get,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as os from 'os';
import * as process from 'process';
import { Public } from './modules/auth/decorators/public.decorator.js';
import { SysAuditLog } from './modules/auth/entities/sys-audit-log.entity.js';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual } from 'typeorm';
import { TenantContext } from './shared/tenant/tenant.context.js';
import { escapeLikePattern } from './shared/utils/sanitize.js';
import { AuditInterceptor } from './modules/auth/interceptors/audit.interceptor.js';

@ApiTags('系统')
@Controller()
export class AppController {
  constructor(
    private readonly config: ConfigService,
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(SysAuditLog)
    private readonly auditRepo: Repository<SysAuditLog>,
  ) {}

  // ── 健康检查 ──────────────────────────────────────────────────────────────

  @Get('api/health')
  @Public()
  @ApiOperation({ summary: '健康检查' })
  @ApiResponse({ status: 200 })
  async health() {
    const redisUrl = this.config.get<string>('REDIS_URL');
    const storagePath = this.config.get<string>('STORAGE_LOCAL_PATH', './data/files');

    // MySQL
    let mysqlStatus = 'UP';
    let mysqlLatencyMs = 0;
    try {
      const t0 = Date.now();
      await this.dataSource.query('SELECT 1');
      mysqlLatencyMs = Date.now() - t0;
    } catch {
      mysqlStatus = 'DOWN';
    }

    // 文件存储
    let storageStatus = 'UP';
    try {
      const fs = await import('fs');
      fs.accessSync(storagePath, fs.constants.W_OK);
    } catch {
      storageStatus = 'DOWN';
    }

    // 内存
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const memUsage = Math.round(((totalMem - freeMem) / totalMem) * 100);
    const memStatus = memUsage > 95 ? 'CRITICAL' : memUsage > 85 ? 'WARNING' : 'UP';

    const overallStatus = mysqlStatus === 'DOWN' ? 'DOWN' : memStatus === 'CRITICAL' ? 'DEGRADED' : 'UP';

    return {
      status: overallStatus,
      mode: redisUrl ? 'FULL' : 'DEGRADED',
      uptime: Math.round(process.uptime()),
      nodeVersion: process.version,
      components: {
        mysql: { status: mysqlStatus, latencyMs: mysqlLatencyMs },
        redis: { status: redisUrl ? 'UP' : 'DEGRADED' },
        storage: { status: storageStatus, type: this.config.get<string>('STORAGE_TYPE', 'local') },
        memory: { status: memStatus, usagePercent: memUsage },
      },
      timestamp: new Date().toISOString(),
    };
  }

  // ── 系统监控指标 ──────────────────────────────────────────────────────────

  @Get('api/metrics')
  @ApiOperation({ summary: '系统监控指标（CPU/内存/磁盘/进程/数据库）' })
  async metrics() {
    // CPU：两采样点计算真实使用率（兼容 Windows）
    const cpus1 = os.cpus();
    const cpuCount = cpus1.length;
    const cpuModel = cpus1[0]?.model ?? 'Unknown';
    const loadAvg = os.loadavg();

    // 采样点 1
    const idle1 = cpus1.reduce((s, c) => s + c.times.idle, 0);
    const total1 = cpus1.reduce((s, c) => s + c.times.user + c.times.nice + c.times.sys + c.times.irq + c.times.idle, 0);

    // 等待 100ms 取采样点 2
    await new Promise(r => setTimeout(r, 100));
    const cpus2 = os.cpus();
    const idle2 = cpus2.reduce((s, c) => s + c.times.idle, 0);
    const total2 = cpus2.reduce((s, c) => s + c.times.user + c.times.nice + c.times.sys + c.times.irq + c.times.idle, 0);

    const idleDelta = idle2 - idle1;
    const totalDelta = total2 - total1;
    const cpuUsagePercent = totalDelta > 0 ? Math.round(((totalDelta - idleDelta) / totalDelta) * 100) : 0;

    // 内存
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsagePercent = Math.round((usedMem / totalMem) * 100);

    // 进程内存
    const procMem = process.memoryUsage();

    // 系统运行时间
    const uptimeSec = os.uptime();
    const processUptimeSec = process.uptime();

    // 数据库连接池状态
    let dbConnections = 0;
    let dbActiveConnections = 0;
    let dbSlowQueryCount = 0;
    try {
      const connRows = await this.dataSource.query(
        `SHOW STATUS WHERE Variable_name IN ('Threads_connected','Threads_running','Slow_queries')`,
      );
      for (const row of connRows) {
        if (row.Variable_name === 'Threads_connected')
          dbConnections = Number(row.Value);
        if (row.Variable_name === 'Threads_running')
          dbActiveConnections = Number(row.Value);
        if (row.Variable_name === 'Slow_queries')
          dbSlowQueryCount = Number(row.Value);
      }
    } catch {}

    // 数据库大小
    let dbSizeMB = 0;
    try {
      const sizeRows = await this.dataSource.query(
        `SELECT ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS size_mb
         FROM information_schema.tables
         WHERE table_schema = DATABASE()`,
      );
      dbSizeMB = Number(sizeRows[0]?.size_mb ?? 0);
    } catch {}

    // 最近1小时日志统计
    const oneHourAgo = new Date(Date.now() - 3600 * 1000);
    const logStats = { total: 0, errors: 0, logins: 0, operations: 0 };
    try {
      const rows = await this.auditRepo
        .createQueryBuilder('l')
        .select('l.logType', 'logType')
        .addSelect('COUNT(*)', 'cnt')
        .where('l.createdAt >= :since', { since: oneHourAgo })
        .groupBy('l.logType')
        .getRawMany();
      for (const r of rows) {
        const cnt = Number(r.cnt);
        logStats.total += cnt;
        if (r.logType === 'LOGIN') logStats.logins += cnt;
        if (r.logType === 'OPERATION') logStats.operations += cnt;
        if (r.logType === 'SYSTEM_ERROR' || r.logType === 'BIZ_ERROR')
          logStats.errors += cnt;
      }
    } catch {}

    return {
      timestamp: new Date().toISOString(),
      cpu: {
        model: cpuModel,
        cores: cpuCount,
        loadAvg1m: Math.round(loadAvg[0] * 100) / 100,
        loadAvg5m: Math.round(loadAvg[1] * 100) / 100,
        loadAvg15m: Math.round(loadAvg[2] * 100) / 100,
        usagePercent: cpuUsagePercent,
      },
      memory: {
        totalMB: Math.round(totalMem / 1024 / 1024),
        usedMB: Math.round(usedMem / 1024 / 1024),
        freeMB: Math.round(freeMem / 1024 / 1024),
        usagePercent: memUsagePercent,
        process: {
          heapUsedMB: Math.round(procMem.heapUsed / 1024 / 1024),
          heapTotalMB: Math.round(procMem.heapTotal / 1024 / 1024),
          rssMB: Math.round(procMem.rss / 1024 / 1024),
          externalMB: Math.round(procMem.external / 1024 / 1024),
        },
      },
      system: {
        platform: os.platform(),
        arch: os.arch(),
        hostname: os.hostname(),
        nodeVersion: process.version,
        uptimeSec: Math.round(uptimeSec),
        processUptimeSec: Math.round(processUptimeSec),
      },
      database: {
        connections: dbConnections,
        activeConnections: dbActiveConnections,
        slowQueries: dbSlowQueryCount,
        sizeMB: dbSizeMB,
      },
      logs: logStats,
    };
  }

  // ── 监控历史趋势（最近N分钟的快照，每分钟一个点）────────────────────────

  @Get('api/metrics/trend')
  @ApiOperation({ summary: '日志趋势（最近60分钟，每分钟统计）' })
  async metricsTrend() {
    const points: {
      time: string;
      errors: number;
      operations: number;
      logins: number;
    }[] = [];
    const now = new Date();

    try {
      // 按分钟分组统计最近60分钟的日志
      const rows = await this.dataSource.query(`
        SELECT
          DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') AS minute,
          log_type,
          COUNT(*) AS cnt
        FROM sys_audit_log
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 60 MINUTE)
        GROUP BY minute, log_type
        ORDER BY minute ASC
      `);

      // 构建时间点 map
      const map = new Map<
        string,
        { errors: number; operations: number; logins: number }
      >();
      for (const r of rows) {
        if (!map.has(r.minute))
          map.set(r.minute, { errors: 0, operations: 0, logins: 0 });
        const entry = map.get(r.minute)!;
        const cnt = Number(r.cnt);
        if (r.log_type === 'LOGIN') entry.logins += cnt;
        if (r.log_type === 'OPERATION') entry.operations += cnt;
        if (r.log_type === 'SYSTEM_ERROR' || r.log_type === 'BIZ_ERROR')
          entry.errors += cnt;
      }

      // 填充最近60分钟的所有时间点（无数据的填0）
      for (let i = 59; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 60 * 1000);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        const entry = map.get(key) ?? { errors: 0, operations: 0, logins: 0 };
        points.push({ time: key.slice(11), ...entry }); // 只显示 HH:mm
      }
    } catch {}

    return { points };
  }

  // ── 日志查询 ──────────────────────────────────────────────────────────────

  @Get('api/logs')
  @ApiOperation({ summary: '日志查询（分页+筛选）' })
  async queryLogs(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
    @Query('logType') logType?: string,
    @Query('username') username?: string,
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
    @Query('keyword') keyword?: string,
  ) {
    const qb = this.auditRepo
      .createQueryBuilder('l')
      .orderBy('l.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    if (logType) qb.andWhere('l.logType = :logType', { logType });
    if (username)
      qb.andWhere('l.username LIKE :username', { username: `%${escapeLikePattern(username)}%` });
    if (startTime) qb.andWhere('l.createdAt >= :startTime', { startTime });
    if (endTime) qb.andWhere('l.createdAt <= :endTime', { endTime });
    if (keyword)
      qb.andWhere(
        '(l.requestUrl LIKE :kw OR l.errorMessage LIKE :kw OR l.action LIKE :kw)',
        { kw: `%${escapeLikePattern(keyword)}%` },
      );

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, pageSize };
  }

  // ── 平台仪表盘 ──────────────────────────────────────────────────────────

  @Get('api/platform/dashboard')
  @ApiOperation({ summary: '平台仪表盘：租户统计、API 调用量' })
  async platformDashboard() {
    // 租户统计
    const tenantStats = await this.dataSource.query(`
      SELECT
        COUNT(*) as total_tenants,
        SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) as active_tenants,
        SUM(CASE WHEN expire_at IS NOT NULL AND expire_at < NOW() THEN 1 ELSE 0 END) as expired_tenants
      FROM sys_tenant
    `);

    // 用户统计
    const userStats = await this.dataSource.query(`
      SELECT COUNT(*) as total_users
      FROM sys_user WHERE status = 'ACTIVE'
    `);

    // API 调用量
    const apiStats: Record<string, number> = {};
    for (const [tenantId, count] of AuditInterceptor.apiStats) {
      apiStats[tenantId] = count;
    }

    return {
      tenants: tenantStats[0] ?? { total_tenants: 0, active_tenants: 0, expired_tenants: 0 },
      users: userStats[0] ?? { total_users: 0 },
      apiCalls: { byTenant: apiStats, total: Object.values(apiStats).reduce((s, n) => s + n, 0) },
    };
  }

  // ── 平台级健康检查（含租户状态） ─────────────────────────────────────────

  @Get('api/platform/health')
  @ApiOperation({ summary: '平台级健康检查：所有租户状态' })
  async platformHealth() {
    const tenants = await this.dataSource.query(`
      SELECT code, name, status,
             CASE WHEN expire_at IS NOT NULL AND expire_at < NOW() THEN 1 ELSE 0 END as is_expired
      FROM sys_tenant
      ORDER BY status, name
    `);
    return {
      status: 'UP',
      tenantCount: tenants.length,
      tenants,
      timestamp: new Date().toISOString(),
    };
  }

  // ── 租户活跃用户统计 ──────────────────────────────────────────────────────

  @Get('api/platform/active-users')
  @ApiOperation({ summary: '各租户活跃用户数（最近 24 小时登录）' })
  async getActiveUsers() {
    const stats = await this.dataSource.query(`
      SELECT tenant_id,
             COUNT(*) as total_users,
             SUM(CASE WHEN last_login_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 ELSE 0 END) as active_24h,
             SUM(CASE WHEN last_login_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) as active_7d
      FROM sys_user
      WHERE status = 'ACTIVE'
      GROUP BY tenant_id
    `);
    return { stats };
  }

  // ── 租户存储用量统计 ──────────────────────────────────────────────────────

  @Get('api/platform/storage-stats')
  @ApiOperation({ summary: '各租户文件存储用量' })
  async getStorageStats() {
    const stats = await this.dataSource.query(`
      SELECT tenant_id,
             COUNT(*) as file_count,
             ROUND(SUM(size_bytes) / 1024 / 1024, 2) as total_mb
      FROM sys_file
      GROUP BY tenant_id
      ORDER BY total_mb DESC
    `);
    return { stats };
  }

  // ── 租户 API 调用量统计 ──────────────────────────────────────────────────

  @Get('api/platform/tenant-stats')
  @ApiOperation({ summary: '各租户 API 调用量统计（进程内存）' })
  getTenantApiStats() {
    const stats: Record<string, number> = {};
    for (const [tenantId, count] of AuditInterceptor.apiStats) {
      stats[tenantId] = count;
    }
    return { stats, total: Object.values(stats).reduce((s, n) => s + n, 0) };
  }
}
