import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import * as ExcelJS from 'exceljs';
import { HrEmployee } from '../entities/hr-employee.entity.js';
import { HrShiftSchedule } from '../entities/hr-shift-schedule.entity.js';
import { HrWorkHourRecord } from '../entities/hr-work-hour-record.entity.js';
import {
  HrWorkHourSummary,
  SummaryDimension,
} from '../entities/hr-work-hour-summary.entity.js';

// ── DTOs ─────────────────────────────────────────────────────────────────────

export interface OperationReportedEvent {
  tenantId: string;
  empId: string; // MES 中的操作员 ID（对应 hr_employee.emp_no 或 id）
  operationCode: string;
  workCenterId?: number;
  startTime: string; // ISO 8601
  endTime: string; // ISO 8601
  reportId: number; // MES 报工记录 ID（幂等键）
}

export interface GetSummaryDto {
  empId?: number;
  startDate?: string;
  endDate?: string;
  dimension?: SummaryDimension;
  page?: number;
  pageSize?: number;
}

export interface GetRecordsDto {
  empId?: number;
  startDate?: string;
  endDate?: string;
  operationCode?: string;
  workCenterId?: number;
  page?: number;
  pageSize?: number;
}

export interface DashboardTopEmployee {
  empId: number;
  empNo: string;
  name: string;
  jobType: string;
  totalHours: number;
  normalHours: number;
  overtimeHours: number;
}

export interface DashboardDto {
  totalHours: number;
  normalHours: number;
  overtimeHours: number;
  topEmployees: DashboardTopEmployee[];
}

// ── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class WorkHourService {
  private readonly logger = new Logger(WorkHourService.name);

  constructor(
    @InjectRepository(HrEmployee)
    private readonly employeeRepo: Repository<HrEmployee>,
    @InjectRepository(HrShiftSchedule)
    private readonly scheduleRepo: Repository<HrShiftSchedule>,
    @InjectRepository(HrWorkHourRecord)
    private readonly recordRepo: Repository<HrWorkHourRecord>,
    @InjectRepository(HrWorkHourSummary)
    private readonly summaryRepo: Repository<HrWorkHourSummary>,
    private readonly dataSource: DataSource,
  ) {}

  // ── 3.4.2 计算实际工时（精确到小数点后 2 位）────────────────────────────

  calcActualHours(startTime: string, endTime: string): number {
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    const hours = (end - start) / (1000 * 3600);
    return Math.round(hours * 100) / 100;
  }

  // ── 3.4.1 处理 OPERATION_REPORTED 事件，幂等写入 WorkHourRecord ──────────

  async processReport(event: OperationReportedEvent): Promise<void> {
    // 1. 查找员工（empId 可能是 emp_no 或数字 id）
    let employee: HrEmployee | null = null;

    const isNumericId = /^\d+$/.test(event.empId);
    if (isNumericId) {
      employee = await this.employeeRepo.findOne({
        where: { id: Number(event.empId), tenantId: event.tenantId },
      });
    }
    // 若按 id 未找到，或 empId 非纯数字，则按 emp_no 查找
    if (!employee) {
      employee = await this.employeeRepo.findOne({
        where: { empNo: event.empId, tenantId: event.tenantId },
      });
    }

    // 2. 员工不存在则记录日志跳过
    if (!employee) {
      this.logger.warn(
        `processReport: 员工 ${event.empId} 不存在（tenantId=${event.tenantId}），跳过报工记录 reportId=${event.reportId}`,
      );
      return;
    }

    // 3. 幂等检查：mes_report_id 已存在则跳过
    const existing = await this.recordRepo.findOne({
      where: { tenantId: event.tenantId, mesReportId: event.reportId },
    });
    if (existing) {
      this.logger.debug(
        `processReport: reportId=${event.reportId} 已存在，跳过（幂等）`,
      );
      return;
    }

    // 4. 计算 actualHours
    let actualHours: number;
    try {
      actualHours = this.calcActualHours(event.startTime, event.endTime);
    } catch (err) {
      this.logger.error(
        `processReport: 计算工时失败 reportId=${event.reportId}，原因：${String(err)}`,
      );
      return;
    }

    if (actualHours <= 0) {
      this.logger.warn(
        `processReport: reportId=${event.reportId} 计算工时 ${actualHours} <= 0，跳过`,
      );
      return;
    }

    // 5. 写入 WorkHourRecord
    const reportDate = event.startTime.slice(0, 10); // YYYY-MM-DD
    const record = this.recordRepo.create({
      tenantId: event.tenantId,
      empId: employee.id,
      reportDate,
      operationCode: event.operationCode,
      workCenterId: event.workCenterId,
      actualHours,
      mesReportId: event.reportId,
    });
    await this.recordRepo.save(record);

    // 6. 触发日汇总更新
    await this.updateDailySummary(event.tenantId, employee.id, reportDate);
  }

  // ── 3.4.3 更新日汇总（含加班判断）──────────────────────────────────────

  async updateDailySummary(
    tenantId: string,
    empId: number,
    date: string,
  ): Promise<void> {
    // 1. 查询当日所有 WorkHourRecord，求和 actualHours
    const rows = await this.dataSource.query<{ totalHours: string }[]>(
      `SELECT COALESCE(SUM(actual_hours), 0) AS totalHours
       FROM hr_work_hour_record
       WHERE tenant_id = ? AND emp_id = ? AND report_date = ?`,
      [tenantId, empId, date],
    );
    const totalHours = Math.round(Number(rows[0]?.totalHours ?? 0) * 100) / 100;

    // 2. 查询当日排班计划，获取班次时长 durationHours
    const scheduleRows = await this.dataSource.query<
      { durationHours: string }[]
    >(
      `SELECT sh.duration_hours AS durationHours
       FROM hr_shift_schedule ss
       INNER JOIN hr_shift sh ON sh.id = ss.shift_id
       WHERE ss.tenant_id = ? AND ss.emp_id = ? AND ss.schedule_date = ?
       LIMIT 1`,
      [tenantId, empId, date],
    );

    let normalHours: number;
    let overtimeHours: number;

    if (scheduleRows.length > 0 && scheduleRows[0].durationHours != null) {
      // 3. 有排班：超出班次时长部分为加班
      const shiftDuration = Number(scheduleRows[0].durationHours);
      normalHours = Math.round(Math.min(totalHours, shiftDuration) * 100) / 100;
      overtimeHours =
        Math.round(Math.max(0, totalHours - shiftDuration) * 100) / 100;
    } else {
      // 4. 无排班：全部计入正常工时
      normalHours = totalHours;
      overtimeHours = 0;
    }

    // 5. UPSERT hr_work_hour_summary（DAY 维度）
    // 6. 不变量：totalHours = normalHours + overtimeHours
    await this.dataSource.query(
      `INSERT INTO hr_work_hour_summary (tenant_id, emp_id, summary_date, dimension, total_hours, normal_hours, overtime_hours)
       VALUES (?, ?, ?, 'DAY', ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         total_hours = VALUES(total_hours),
         normal_hours = VALUES(normal_hours),
         overtime_hours = VALUES(overtime_hours),
         updated_at = NOW()`,
      [tenantId, empId, date, totalHours, normalHours, overtimeHours],
    );
  }

  // ── 3.4.4 工时汇总查询 ───────────────────────────────────────────────────

  async getSummary(
    tenantId: string,
    query: GetSummaryDto,
  ): Promise<{ data: HrWorkHourSummary[]; total: number }> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));

    const conditions: string[] = ['s.tenant_id = ?'];
    const params: unknown[] = [tenantId];

    if (query.empId !== undefined) {
      conditions.push('s.emp_id = ?');
      params.push(query.empId);
    }
    if (query.dimension) {
      conditions.push('s.dimension = ?');
      params.push(query.dimension);
    }
    if (query.startDate) {
      conditions.push('s.summary_date >= ?');
      params.push(query.startDate);
    }
    if (query.endDate) {
      conditions.push('s.summary_date <= ?');
      params.push(query.endDate);
    }

    const where = conditions.join(' AND ');

    const countRows = await this.dataSource.query<{ cnt: string }[]>(
      `SELECT COUNT(*) AS cnt FROM hr_work_hour_summary s WHERE ${where}`,
      params,
    );
    const total = Number(countRows[0]?.cnt ?? 0);

    const rows = await this.dataSource.query<
      {
        id: string;
        tenant_id: string;
        emp_id: string;
        summary_date: string;
        dimension: string;
        total_hours: string;
        normal_hours: string;
        overtime_hours: string;
        created_at: string;
        updated_at: string;
        empName: string;
      }[]
    >(
      `SELECT s.*, e.name AS empName
       FROM hr_work_hour_summary s
       LEFT JOIN hr_employee e ON e.id = s.emp_id AND e.tenant_id = s.tenant_id
       WHERE ${where}
       ORDER BY s.summary_date DESC, s.emp_id ASC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize],
    );

    const data = rows.map((r) => ({
      id: Number(r.id),
      tenantId: r.tenant_id,
      empId: Number(r.emp_id),
      summaryDate: r.summary_date,
      dimension: r.dimension,
      totalHours: Number(r.total_hours),
      normalHours: Number(r.normal_hours),
      overtimeHours: Number(r.overtime_hours),
      createdAt: new Date(r.created_at),
      updatedAt: new Date(r.updated_at),
      empName: r.empName,
    })) as unknown as HrWorkHourSummary[];

    return { data, total };
  }

  // ── 3.4.5 工时明细查询 ───────────────────────────────────────────────────

  async getRecords(
    tenantId: string,
    query: GetRecordsDto,
  ): Promise<{ data: HrWorkHourRecord[]; total: number }> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));

    const conditions: string[] = ['r.tenant_id = ?'];
    const params: unknown[] = [tenantId];

    if (query.empId !== undefined) {
      conditions.push('r.emp_id = ?');
      params.push(query.empId);
    }
    if (query.startDate) {
      conditions.push('r.report_date >= ?');
      params.push(query.startDate);
    }
    if (query.endDate) {
      conditions.push('r.report_date <= ?');
      params.push(query.endDate);
    }
    if (query.operationCode) {
      conditions.push('r.operation_code = ?');
      params.push(query.operationCode);
    }
    if (query.workCenterId !== undefined) {
      conditions.push('r.work_center_id = ?');
      params.push(query.workCenterId);
    }

    const where = conditions.join(' AND ');

    const countRows = await this.dataSource.query<{ cnt: string }[]>(
      `SELECT COUNT(*) AS cnt FROM hr_work_hour_record r WHERE ${where}`,
      params,
    );
    const total = Number(countRows[0]?.cnt ?? 0);

    const rows = await this.dataSource.query<
      {
        id: string;
        tenant_id: string;
        emp_id: string;
        report_date: string;
        operation_code: string;
        work_center_id: string | null;
        actual_hours: string;
        mes_report_id: string;
        created_at: string;
        updated_at: string;
        empName: string;
      }[]
    >(
      `SELECT r.*, e.name AS empName
       FROM hr_work_hour_record r
       LEFT JOIN hr_employee e ON e.id = r.emp_id AND e.tenant_id = r.tenant_id
       WHERE ${where}
       ORDER BY r.report_date DESC, r.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize],
    );

    const data = rows.map((r) => ({
      id: Number(r.id),
      tenantId: r.tenant_id,
      empId: Number(r.emp_id),
      reportDate: r.report_date,
      operationCode: r.operation_code,
      workCenterId: r.work_center_id ? Number(r.work_center_id) : undefined,
      actualHours: Number(r.actual_hours),
      mesReportId: Number(r.mes_report_id),
      createdAt: new Date(r.created_at),
      updatedAt: new Date(r.updated_at),
      empName: r.empName,
    })) as unknown as HrWorkHourRecord[];

    return { data, total };
  }

  // ── 3.4.6 工时看板 ───────────────────────────────────────────────────────

  async getDashboard(tenantId: string): Promise<DashboardDto> {
    // 本月第一天
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    // 本月总工时、正常工时、加班工时（DAY 维度汇总）
    const totals = await this.dataSource.query<
      { totalHours: string; normalHours: string; overtimeHours: string }[]
    >(
      `SELECT
         COALESCE(SUM(total_hours), 0)    AS totalHours,
         COALESCE(SUM(normal_hours), 0)   AS normalHours,
         COALESCE(SUM(overtime_hours), 0) AS overtimeHours
       FROM hr_work_hour_summary
       WHERE tenant_id = ?
         AND dimension = 'DAY'
         AND summary_date >= ?`,
      [tenantId, monthStart],
    );

    // 工时排名前 10 员工
    const topRows = await this.dataSource.query<
      {
        empId: string;
        empNo: string;
        name: string;
        jobType: string;
        totalHours: string;
        normalHours: string;
        overtimeHours: string;
      }[]
    >(
      `SELECT
         s.emp_id        AS empId,
         e.emp_no        AS empNo,
         e.name          AS name,
         e.job_type      AS jobType,
         SUM(s.total_hours)    AS totalHours,
         SUM(s.normal_hours)   AS normalHours,
         SUM(s.overtime_hours) AS overtimeHours
       FROM hr_work_hour_summary s
       INNER JOIN hr_employee e ON e.id = s.emp_id
       WHERE s.tenant_id = ?
         AND s.dimension = 'DAY'
         AND s.summary_date >= ?
       GROUP BY s.emp_id, e.emp_no, e.name, e.job_type
       ORDER BY totalHours DESC
       LIMIT 10`,
      [tenantId, monthStart],
    );

    return {
      totalHours: Math.round(Number(totals[0]?.totalHours ?? 0) * 100) / 100,
      normalHours: Math.round(Number(totals[0]?.normalHours ?? 0) * 100) / 100,
      overtimeHours:
        Math.round(Number(totals[0]?.overtimeHours ?? 0) * 100) / 100,
      topEmployees: topRows.map((r) => ({
        empId: Number(r.empId),
        empNo: r.empNo,
        name: r.name,
        jobType: r.jobType,
        totalHours: Math.round(Number(r.totalHours) * 100) / 100,
        normalHours: Math.round(Number(r.normalHours) * 100) / 100,
        overtimeHours: Math.round(Number(r.overtimeHours) * 100) / 100,
      })),
    };
  }

  // ── 3.4.7 导出 Excel ─────────────────────────────────────────────────────

  async exportExcel(tenantId: string, query: GetSummaryDto): Promise<Buffer> {
    // 最多导出 5000 条
    const exportQuery: GetSummaryDto = { ...query, page: 1, pageSize: 5000 };
    const { data } = await this.getSummary(tenantId, exportQuery);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('工时报表');

    sheet.columns = [
      { header: '员工工号', key: 'empNo', width: 15 },
      { header: '姓名', key: 'name', width: 12 },
      { header: '工种', key: 'jobType', width: 15 },
      { header: '汇总日期', key: 'summaryDate', width: 14 },
      { header: '维度', key: 'dimension', width: 8 },
      { header: '总工时', key: 'totalHours', width: 10 },
      { header: '正常工时', key: 'normalHours', width: 10 },
      { header: '加班工时', key: 'overtimeHours', width: 10 },
    ];

    // 表头加粗
    sheet.getRow(1).font = { bold: true };

    for (const row of data) {
      sheet.addRow({
        empNo: (row as any).empNo ?? '',
        name: (row as any).name ?? '',
        jobType: (row as any).jobType ?? '',
        summaryDate: row.summaryDate,
        dimension: row.dimension,
        totalHours: Number(row.totalHours),
        normalHours: Number(row.normalHours),
        overtimeHours: Number(row.overtimeHours),
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  // ── 3.4.8 每小时同步工时 ─────────────────────────────────────────────────

  @Cron('0 * * * *')
  async syncWorkHours(): Promise<void> {
    this.logger.log(
      'syncWorkHours: 每小时工时同步触发，实际同步由 HrEventService 订阅 OPERATION_REPORTED 事件驱动',
    );
  }

  // ── 3.4.9 每日凌晨汇总 ───────────────────────────────────────────────────

  @Cron('0 1 * * *')
  async dailySummary(): Promise<void> {
    this.logger.log('dailySummary: 开始每日工时汇总');

    // 昨日日期
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10); // YYYY-MM-DD

    // 查询所有租户昨日有工时记录的员工
    const employees = await this.dataSource.query<
      { tenantId: string; empId: string }[]
    >(
      `SELECT DISTINCT tenant_id AS tenantId, emp_id AS empId
       FROM hr_work_hour_record
       WHERE report_date = ?`,
      [yesterdayStr],
    );

    // 更新每个员工的 DAY 汇总
    for (const row of employees) {
      try {
        await this.updateDailySummary(
          row.tenantId,
          Number(row.empId),
          yesterdayStr,
        );
      } catch (err) {
        this.logger.error(
          `dailySummary: 更新 DAY 汇总失败 tenantId=${row.tenantId} empId=${row.empId} date=${yesterdayStr}，原因：${String(err)}`,
        );
      }
    }

    // 若为周一，更新上周 WEEK 汇总
    const dayOfWeek = yesterday.getDay(); // 0=周日, 1=周一
    if (dayOfWeek === 0) {
      // 昨天是周日，即上周结束，更新上周汇总（周一为 summary_date）
      await this.updateWeekSummary(yesterday);
    }

    // 若为月初（今天是1号，昨天是上月最后一天）
    const today = new Date();
    if (today.getDate() === 1) {
      await this.updateMonthSummary(yesterday);
    }

    this.logger.log(
      `dailySummary: 完成，共处理 ${employees.length} 条员工工时`,
    );
  }

  // ── 内部：更新 WEEK 汇总 ─────────────────────────────────────────────────

  private async updateWeekSummary(anyDayInWeek: Date): Promise<void> {
    // 计算该周周一
    const day = anyDayInWeek.getDay(); // 0=周日
    const diff = day === 0 ? -6 : 1 - day; // 周一偏移
    const monday = new Date(anyDayInWeek);
    monday.setDate(anyDayInWeek.getDate() + diff);
    const mondayStr = monday.toISOString().slice(0, 10);

    // 该周周日
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const sundayStr = sunday.toISOString().slice(0, 10);

    this.logger.log(`updateWeekSummary: 汇总周 ${mondayStr} ~ ${sundayStr}`);

    // 聚合该周所有 DAY 维度记录
    const rows = await this.dataSource.query<
      {
        tenantId: string;
        empId: string;
        totalHours: string;
        normalHours: string;
        overtimeHours: string;
      }[]
    >(
      `SELECT tenant_id AS tenantId, emp_id AS empId,
              SUM(total_hours)    AS totalHours,
              SUM(normal_hours)   AS normalHours,
              SUM(overtime_hours) AS overtimeHours
       FROM hr_work_hour_summary
       WHERE dimension = 'DAY'
         AND summary_date BETWEEN ? AND ?
       GROUP BY tenant_id, emp_id`,
      [mondayStr, sundayStr],
    );

    for (const row of rows) {
      await this.dataSource.query(
        `INSERT INTO hr_work_hour_summary (tenant_id, emp_id, summary_date, dimension, total_hours, normal_hours, overtime_hours)
         VALUES (?, ?, ?, 'WEEK', ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           total_hours = VALUES(total_hours),
           normal_hours = VALUES(normal_hours),
           overtime_hours = VALUES(overtime_hours),
           updated_at = NOW()`,
        [
          row.tenantId,
          Number(row.empId),
          mondayStr,
          Math.round(Number(row.totalHours) * 100) / 100,
          Math.round(Number(row.normalHours) * 100) / 100,
          Math.round(Number(row.overtimeHours) * 100) / 100,
        ],
      );
    }
  }

  // ── 内部：更新 MONTH 汇总 ────────────────────────────────────────────────

  private async updateMonthSummary(anyDayInMonth: Date): Promise<void> {
    // 该月第一天
    const firstDay = new Date(
      anyDayInMonth.getFullYear(),
      anyDayInMonth.getMonth(),
      1,
    );
    const firstDayStr = firstDay.toISOString().slice(0, 10);

    // 该月最后一天
    const lastDay = new Date(
      anyDayInMonth.getFullYear(),
      anyDayInMonth.getMonth() + 1,
      0,
    );
    const lastDayStr = lastDay.toISOString().slice(0, 10);

    this.logger.log(
      `updateMonthSummary: 汇总月 ${firstDayStr} ~ ${lastDayStr}`,
    );

    const rows = await this.dataSource.query<
      {
        tenantId: string;
        empId: string;
        totalHours: string;
        normalHours: string;
        overtimeHours: string;
      }[]
    >(
      `SELECT tenant_id AS tenantId, emp_id AS empId,
              SUM(total_hours)    AS totalHours,
              SUM(normal_hours)   AS normalHours,
              SUM(overtime_hours) AS overtimeHours
       FROM hr_work_hour_summary
       WHERE dimension = 'DAY'
         AND summary_date BETWEEN ? AND ?
       GROUP BY tenant_id, emp_id`,
      [firstDayStr, lastDayStr],
    );

    for (const row of rows) {
      await this.dataSource.query(
        `INSERT INTO hr_work_hour_summary (tenant_id, emp_id, summary_date, dimension, total_hours, normal_hours, overtime_hours)
         VALUES (?, ?, ?, 'MONTH', ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           total_hours = VALUES(total_hours),
           normal_hours = VALUES(normal_hours),
           overtime_hours = VALUES(overtime_hours),
           updated_at = NOW()`,
        [
          row.tenantId,
          Number(row.empId),
          firstDayStr,
          Math.round(Number(row.totalHours) * 100) / 100,
          Math.round(Number(row.normalHours) * 100) / 100,
          Math.round(Number(row.overtimeHours) * 100) / 100,
        ],
      );
    }
  }
}
