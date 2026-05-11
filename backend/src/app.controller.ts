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
    let mysqlStatus = 'UP';
    let mysqlLatencyMs = 0;
    try {
      const t0 = Date.now();
      await this.dataSource.query('SELECT 1');
      mysqlLatencyMs = Date.now() - t0;
    } catch {
      mysqlStatus = 'DOWN';
    }

    return {
      status: mysqlStatus === 'UP' ? 'UP' : 'DOWN',
      mode: redisUrl ? 'FULL' : 'DEGRADED',
      components: {
        mysql: { status: mysqlStatus, latencyMs: mysqlLatencyMs },
        redis: { status: redisUrl ? 'UP' : 'DEGRADED' },
        storage: {
          status: 'UP',
          type: this.config.get<string>('STORAGE_TYPE', 'local'),
          path: this.config.get<string>('STORAGE_LOCAL_PATH', './data/files'),
        },
      },
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    };
  }

  // ── 系统监控指标 ──────────────────────────────────────────────────────────

  @Get('api/metrics')
  @ApiOperation({ summary: '系统监控指标（CPU/内存/磁盘/进程/数据库）' })
  async metrics() {
    // CPU
    const cpus = os.cpus();
    const cpuCount = cpus.length;
    const cpuModel = cpus[0]?.model ?? 'Unknown';
    const loadAvg = os.loadavg(); // [1min, 5min, 15min]
    const cpuUsagePercent = Math.min(
      100,
      Math.round((loadAvg[0] / cpuCount) * 100),
    );

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
      qb.andWhere('l.username LIKE :username', { username: `%${username}%` });
    if (startTime) qb.andWhere('l.createdAt >= :startTime', { startTime });
    if (endTime) qb.andWhere('l.createdAt <= :endTime', { endTime });
    if (keyword)
      qb.andWhere(
        '(l.requestUrl LIKE :kw OR l.errorMessage LIKE :kw OR l.action LIKE :kw)',
        { kw: `%${keyword}%` },
      );

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, pageSize };
  }
}
