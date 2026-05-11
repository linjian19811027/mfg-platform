import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { HrEmployee, EmployeeStatus } from '../entities/hr-employee.entity.js';
import { HrShift } from '../entities/hr-shift.entity.js';
import { HrShiftSchedule } from '../entities/hr-shift-schedule.entity.js';

// ── DTOs ─────────────────────────────────────────────────────────────────────

export interface CreateShiftDto {
  code: string;
  name: string;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
}

export interface CreateScheduleDto {
  empId: number;
  scheduleDate: string; // YYYY-MM-DD
  shiftId: number;
  workCenterId?: number;
  equipmentId?: number;
  remark?: string;
}

export interface BatchCreateScheduleDto {
  items: CreateScheduleDto[];
}

export interface FindSchedulesDto {
  empId?: number;
  startDate?: string;
  endDate?: string;
  shiftCode?: string;
  workCenterId?: number;
  page?: number;
  pageSize?: number;
}

export interface ShiftStatsByShift {
  shiftId: number;
  shiftCode: string;
  shiftName: string;
  count: number;
}

export interface ShiftStatsByWorkCenter {
  workCenterId: number;
  count: number;
}

export interface StatsDto {
  byShift: ShiftStatsByShift[];
  byWorkCenter: ShiftStatsByWorkCenter[];
  unscheduledEmployees: {
    id: number;
    empNo: string;
    name: string;
    jobType: string;
  }[];
}

// ── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class ShiftService {
  constructor(
    @InjectRepository(HrEmployee)
    private readonly employeeRepo: Repository<HrEmployee>,
    @InjectRepository(HrShift)
    private readonly shiftRepo: Repository<HrShift>,
    @InjectRepository(HrShiftSchedule)
    private readonly scheduleRepo: Repository<HrShiftSchedule>,
    private readonly dataSource: DataSource,
  ) {}

  // ── 3.3.1 班次定义 CRUD ───────────────────────────────────────────────────

  async createShift(tenantId: string, dto: CreateShiftDto): Promise<HrShift> {
    const existing = await this.shiftRepo.findOne({
      where: { tenantId, code: dto.code },
    });
    if (existing) {
      throw new ConflictException(`班次代码 ${dto.code} 已存在`);
    }

    const shift = this.shiftRepo.create({
      tenantId,
      code: dto.code,
      name: dto.name,
      startTime: dto.startTime,
      endTime: dto.endTime,
      enabled: 1,
    });

    return this.shiftRepo.save(shift);
  }

  async findShifts(tenantId: string): Promise<HrShift[]> {
    return this.shiftRepo.find({
      where: { tenantId, enabled: 1 },
      order: { code: 'ASC' },
    });
  }

  // ── 3.3.2 创建排班 ────────────────────────────────────────────────────────

  async createSchedule(
    tenantId: string,
    dto: CreateScheduleDto,
  ): Promise<HrShiftSchedule> {
    // 校验员工在职
    const employee = await this.employeeRepo.findOne({
      where: { id: dto.empId, tenantId },
    });
    if (!employee) {
      throw new NotFoundException(`员工 ${dto.empId} 不存在`);
    }
    if (employee.status !== EmployeeStatus.ACTIVE) {
      throw new BadRequestException(
        `员工 ${employee.empNo} 状态为 ${employee.status}，非在职员工不可排班`,
      );
    }

    // 校验班次存在
    const shift = await this.shiftRepo.findOne({
      where: { id: dto.shiftId, tenantId },
    });
    if (!shift) {
      throw new NotFoundException(`班次 ${dto.shiftId} 不存在`);
    }

    // 校验同一天不重复（UNIQUE KEY uk_tenant_emp_date）
    const duplicate = await this.scheduleRepo.findOne({
      where: { tenantId, empId: dto.empId, scheduleDate: dto.scheduleDate },
    });
    if (duplicate) {
      throw new ConflictException(
        `员工 ${employee.empNo} 在 ${dto.scheduleDate} 已存在排班记录（班次ID：${duplicate.shiftId}）`,
      );
    }

    const schedule = this.scheduleRepo.create({
      tenantId,
      empId: dto.empId,
      scheduleDate: dto.scheduleDate,
      shiftId: dto.shiftId,
      workCenterId: dto.workCenterId,
      equipmentId: dto.equipmentId,
      remark: dto.remark,
    });

    return this.scheduleRepo.save(schedule);
  }

  // ── 3.3.3 批量创建排班（最多 500 条）────────────────────────────────────

  async batchCreateSchedule(
    tenantId: string,
    dto: BatchCreateScheduleDto,
  ): Promise<{ success: number; failed: number; errors: string[] }> {
    if ((dto.items ?? []).length > 500) {
      throw new BadRequestException(
        `批量创建排班单次最多 500 条，当前 ${(dto.items ?? []).length} 条`,
      );
    }

    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < (dto.items ?? []).length; i++) {
      const item = (dto.items ?? [])[i];
      try {
        await this.createSchedule(tenantId, item);
        success++;
      } catch (err: unknown) {
        failed++;
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(
          `第 ${i + 1} 条（empId=${item.empId}, date=${item.scheduleDate}）：${msg}`,
        );
      }
    }

    return { success, failed, errors };
  }

  // ── 3.3.4 删除排班（历史日期不可删除）───────────────────────────────────

  async deleteSchedule(tenantId: string, scheduleId: number): Promise<void> {
    const schedule = await this.scheduleRepo.findOne({
      where: { id: scheduleId, tenantId },
    });
    if (!schedule) {
      throw new NotFoundException(`排班记录 ${scheduleId} 不存在`);
    }

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    if (schedule.scheduleDate < today) {
      throw new BadRequestException(
        `排班日期 ${schedule.scheduleDate} 为历史日期，不可删除`,
      );
    }

    await this.scheduleRepo.remove(schedule);
  }

  // ── 3.3.5 查询排班计划（支持日历视图）───────────────────────────────────

  async findSchedules(
    tenantId: string,
    query: FindSchedulesDto,
  ): Promise<{ data: HrShiftSchedule[]; total: number }> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(500, Math.max(1, query.pageSize ?? 20));

    const qb = this.scheduleRepo
      .createQueryBuilder('s')
      .where('s.tenant_id = :tenantId', { tenantId });

    if (query.empId !== undefined) {
      qb.andWhere('s.emp_id = :empId', { empId: query.empId });
    }
    if (query.startDate) {
      qb.andWhere('s.schedule_date >= :startDate', {
        startDate: query.startDate,
      });
    }
    if (query.endDate) {
      qb.andWhere('s.schedule_date <= :endDate', { endDate: query.endDate });
    }
    if (query.shiftCode) {
      qb.andWhere(
        's.shift_id IN (SELECT id FROM hr_shift WHERE code = :shiftCode AND tenant_id = :tenantId)',
        { shiftCode: query.shiftCode, tenantId },
      );
    }
    if (query.workCenterId !== undefined) {
      qb.andWhere('s.work_center_id = :workCenterId', {
        workCenterId: query.workCenterId,
      });
    }

    const [data, total] = await qb
      .orderBy('s.schedule_date', 'ASC')
      .addOrderBy('s.emp_id', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { data, total };
  }

  // ── 3.3.6 排班统计 ────────────────────────────────────────────────────────

  async getStats(
    tenantId: string,
    startDate: string,
    endDate: string,
    workCenterId?: number,
  ): Promise<StatsDto> {
    // 各班次排班人数
    const shiftRows = await this.dataSource.query<
      { shiftId: string; shiftCode: string; shiftName: string; count: string }[]
    >(
      `SELECT s.shift_id AS shiftId, sh.code AS shiftCode, sh.name AS shiftName,
              COUNT(DISTINCT s.emp_id) AS count
       FROM hr_shift_schedule s
       INNER JOIN hr_shift sh ON sh.id = s.shift_id
       WHERE s.tenant_id = ?
         AND s.schedule_date BETWEEN ? AND ?
         ${workCenterId !== undefined ? 'AND s.work_center_id = ?' : ''}
       GROUP BY s.shift_id, sh.code, sh.name
       ORDER BY count DESC`,
      workCenterId !== undefined
        ? [tenantId, startDate, endDate, workCenterId]
        : [tenantId, startDate, endDate],
    );

    // 各工作中心排班人数
    const wcRows = await this.dataSource.query<
      { workCenterId: string; count: string }[]
    >(
      `SELECT s.work_center_id AS workCenterId, COUNT(DISTINCT s.emp_id) AS count
       FROM hr_shift_schedule s
       WHERE s.tenant_id = ?
         AND s.schedule_date BETWEEN ? AND ?
         AND s.work_center_id IS NOT NULL
         ${workCenterId !== undefined ? 'AND s.work_center_id = ?' : ''}
       GROUP BY s.work_center_id
       ORDER BY count DESC`,
      workCenterId !== undefined
        ? [tenantId, startDate, endDate, workCenterId]
        : [tenantId, startDate, endDate],
    );

    // 未排班的在职员工：在职员工中，在指定日期范围内没有任何排班记录的员工
    const unscheduledRows = await this.dataSource.query<
      { id: string; empNo: string; name: string; jobType: string }[]
    >(
      `SELECT e.id, e.emp_no AS empNo, e.name, e.job_type AS jobType
       FROM hr_employee e
       WHERE e.tenant_id = ?
         AND e.status = 'ACTIVE'
         ${workCenterId !== undefined ? 'AND e.work_center_id = ?' : ''}
         AND NOT EXISTS (
           SELECT 1 FROM hr_shift_schedule s
           WHERE s.tenant_id = e.tenant_id
             AND s.emp_id = e.id
             AND s.schedule_date BETWEEN ? AND ?
         )
       ORDER BY e.emp_no ASC`,
      workCenterId !== undefined
        ? [tenantId, workCenterId, startDate, endDate]
        : [tenantId, startDate, endDate],
    );

    return {
      byShift: shiftRows.map((r) => ({
        shiftId: Number(r.shiftId),
        shiftCode: r.shiftCode,
        shiftName: r.shiftName,
        count: Number(r.count),
      })),
      byWorkCenter: wcRows.map((r) => ({
        workCenterId: Number(r.workCenterId),
        count: Number(r.count),
      })),
      unscheduledEmployees: unscheduledRows.map((r) => ({
        id: Number(r.id),
        empNo: r.empNo,
        name: r.name,
        jobType: r.jobType,
      })),
    };
  }
}
