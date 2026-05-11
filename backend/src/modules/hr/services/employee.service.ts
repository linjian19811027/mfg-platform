import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { HrEmployee, EmployeeStatus } from '../entities/hr-employee.entity.js';
import { HrShiftSchedule } from '../entities/hr-shift-schedule.entity.js';
import { HrWorkHourRecord } from '../entities/hr-work-hour-record.entity.js';

// ── DTOs ─────────────────────────────────────────────────────────────────────

export interface CreateEmployeeDto {
  name: string;
  jobType: string;
  workCenterId?: number;
  hireDate: string;
  phone?: string;
  idCard?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  remark?: string;
}

export interface UpdateEmployeeDto {
  name?: string;
  jobType?: string;
  workCenterId?: number;
  hireDate?: string;
  phone?: string;
  idCard?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  remark?: string;
}

export interface UpdateStatusDto {
  status: EmployeeStatus;
  reason?: string;
}

export interface FindEmployeesDto {
  empNo?: string;
  name?: string;
  jobType?: string;
  workCenterId?: number;
  status?: EmployeeStatus;
  page?: number;
  pageSize?: number;
}

export interface OverviewDto {
  totalActive: number;
  jobTypeDistribution: { jobType: string; count: number }[];
  workCenterDistribution: { workCenterId: number; count: number }[];
}

// ── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class EmployeeService {
  constructor(
    @InjectRepository(HrEmployee)
    private readonly employeeRepo: Repository<HrEmployee>,
    @InjectRepository(HrShiftSchedule)
    private readonly scheduleRepo: Repository<HrShiftSchedule>,
    @InjectRepository(HrWorkHourRecord)
    private readonly workHourRepo: Repository<HrWorkHourRecord>,
    private readonly dataSource: DataSource,
  ) {}

  // ── 生成工号 ──────────────────────────────────────────────────────────────

  async generateEmpNo(tenantId: string): Promise<string> {
    const result = await this.dataSource.query<{ maxNo: string | null }[]>(
      `SELECT MAX(emp_no) AS maxNo FROM hr_employee WHERE tenant_id = ?`,
      [tenantId],
    );
    const maxNo = result[0]?.maxNo;
    let seq = 1;
    if (maxNo) {
      // 格式 EMP-000001，解析末尾6位数字
      const match = /EMP-(\d{6})/.exec(maxNo);
      if (match) seq = parseInt(match[1], 10) + 1;
    }
    return `EMP-${String(seq).padStart(6, '0')}`;
  }

  // ── 创建员工 ──────────────────────────────────────────────────────────────

  async create(tenantId: string, dto: CreateEmployeeDto): Promise<HrEmployee> {
    const empNo = await this.generateEmpNo(tenantId);

    // 校验工号唯一性（理论上自动生成不会重复，但防并发）
    const existing = await this.employeeRepo.findOne({ where: { empNo } });
    if (existing) {
      throw new ConflictException(`工号 ${empNo} 已存在`);
    }

    const employee = this.employeeRepo.create({
      tenantId,
      empNo,
      name: dto.name,
      jobType: dto.jobType,
      workCenterId: dto.workCenterId,
      hireDate: dto.hireDate,
      status: EmployeeStatus.ACTIVE,
      phone: dto.phone,
      idCard: dto.idCard,
      emergencyContact: dto.emergencyContact,
      emergencyPhone: dto.emergencyPhone,
      remark: dto.remark,
    });

    return this.employeeRepo.save(employee);
  }

  // ── 分页查询 ──────────────────────────────────────────────────────────────

  async findAll(
    tenantId: string,
    query: FindEmployeesDto,
  ): Promise<{ data: HrEmployee[]; total: number }> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));

    const qb = this.employeeRepo
      .createQueryBuilder('e')
      .where('e.tenant_id = :tenantId', { tenantId });

    if (query.empNo) {
      qb.andWhere('e.emp_no LIKE :empNo', { empNo: `%${query.empNo}%` });
    }
    if (query.name) {
      qb.andWhere('e.name LIKE :name', { name: `%${query.name}%` });
    }
    if (query.jobType) {
      qb.andWhere('e.job_type = :jobType', { jobType: query.jobType });
    }
    if (query.workCenterId !== undefined) {
      qb.andWhere('e.work_center_id = :workCenterId', {
        workCenterId: query.workCenterId,
      });
    }
    if (query.status) {
      qb.andWhere('e.status = :status', { status: query.status });
    }

    const [data, total] = await qb
      .orderBy('e.created_at', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { data, total };
  }

  // ── 详情 ──────────────────────────────────────────────────────────────────

  async findOne(tenantId: string, id: number): Promise<HrEmployee> {
    const employee = await this.employeeRepo.findOne({
      where: { id, tenantId },
    });
    if (!employee) throw new NotFoundException(`员工 ${id} 不存在`);
    return employee;
  }

  // ── 更新 ──────────────────────────────────────────────────────────────────

  async update(
    tenantId: string,
    id: number,
    dto: UpdateEmployeeDto,
  ): Promise<HrEmployee> {
    const employee = await this.findOne(tenantId, id);

    // 工号不可修改，只更新允许的字段
    if (dto.name !== undefined) employee.name = dto.name;
    if (dto.jobType !== undefined) employee.jobType = dto.jobType;
    if (dto.workCenterId !== undefined)
      employee.workCenterId = dto.workCenterId;
    if (dto.hireDate !== undefined) employee.hireDate = dto.hireDate;
    if (dto.phone !== undefined) employee.phone = dto.phone;
    if (dto.idCard !== undefined) employee.idCard = dto.idCard;
    if (dto.emergencyContact !== undefined)
      employee.emergencyContact = dto.emergencyContact;
    if (dto.emergencyPhone !== undefined)
      employee.emergencyPhone = dto.emergencyPhone;
    if (dto.remark !== undefined) employee.remark = dto.remark;

    return this.employeeRepo.save(employee);
  }

  // ── 更新状态 ──────────────────────────────────────────────────────────────

  async updateStatus(
    tenantId: string,
    id: number,
    dto: UpdateStatusDto,
  ): Promise<HrEmployee> {
    const employee = await this.findOne(tenantId, id);
    const prevStatus = employee.status;

    employee.status = dto.status;

    // 离职时记录离职日期，并取消未来排班
    if (
      dto.status === EmployeeStatus.INACTIVE &&
      prevStatus !== EmployeeStatus.INACTIVE
    ) {
      const today = new Date().toISOString().slice(0, 10);
      employee.leaveDate = today;

      // 删除未来排班（schedule_date > today）
      await this.dataSource.query(
        `DELETE FROM hr_shift_schedule WHERE emp_id = ? AND tenant_id = ? AND schedule_date > ?`,
        [id, tenantId, today],
      );
    }

    return this.employeeRepo.save(employee);
  }

  // ── 删除 ──────────────────────────────────────────────────────────────────

  async delete(tenantId: string, id: number): Promise<void> {
    const employee = await this.findOne(tenantId, id);

    // 校验无关联工时记录
    const workHourCount = await this.workHourRepo.count({
      where: { empId: id, tenantId },
    });
    if (workHourCount > 0) {
      throw new BadRequestException(
        `员工 ${employee.empNo} 存在 ${workHourCount} 条工时记录，禁止删除，请将状态更新为离职`,
      );
    }

    // 校验无关联排班记录
    const scheduleCount = await this.scheduleRepo.count({
      where: { empId: id, tenantId },
    });
    if (scheduleCount > 0) {
      throw new BadRequestException(
        `员工 ${employee.empNo} 存在 ${scheduleCount} 条排班记录，禁止删除，请将状态更新为离职`,
      );
    }

    await this.employeeRepo.remove(employee);
  }

  // ── 人力资源概览 ──────────────────────────────────────────────────────────

  async getOverview(tenantId: string): Promise<OverviewDto> {
    // 在职总数
    const totalActive = await this.employeeRepo.count({
      where: { tenantId, status: EmployeeStatus.ACTIVE },
    });

    // 各工种分布
    const jobTypeRows = await this.dataSource.query<
      { jobType: string; count: string }[]
    >(
      `SELECT job_type AS jobType, COUNT(*) AS count
       FROM hr_employee
       WHERE tenant_id = ? AND status = 'ACTIVE'
       GROUP BY job_type
       ORDER BY count DESC`,
      [tenantId],
    );

    // 各工作中心分布
    const workCenterRows = await this.dataSource.query<
      { workCenterId: string; count: string }[]
    >(
      `SELECT work_center_id AS workCenterId, COUNT(*) AS count
       FROM hr_employee
       WHERE tenant_id = ? AND status = 'ACTIVE' AND work_center_id IS NOT NULL
       GROUP BY work_center_id
       ORDER BY count DESC`,
      [tenantId],
    );

    return {
      totalActive,
      jobTypeDistribution: jobTypeRows.map((r) => ({
        jobType: r.jobType,
        count: Number(r.count),
      })),
      workCenterDistribution: workCenterRows.map((r) => ({
        workCenterId: Number(r.workCenterId),
        count: Number(r.count),
      })),
    };
  }

  // ── 导出 Excel ────────────────────────────────────────────────────────────

  async exportExcel(
    tenantId: string,
    query: FindEmployeesDto,
  ): Promise<Buffer> {
    const qb = this.employeeRepo
      .createQueryBuilder('e')
      .where('e.tenant_id = :tenantId', { tenantId });

    if (query.empNo) {
      qb.andWhere('e.emp_no LIKE :empNo', { empNo: `%${query.empNo}%` });
    }
    if (query.name) {
      qb.andWhere('e.name LIKE :name', { name: `%${query.name}%` });
    }
    if (query.jobType) {
      qb.andWhere('e.job_type = :jobType', { jobType: query.jobType });
    }
    if (query.workCenterId !== undefined) {
      qb.andWhere('e.work_center_id = :workCenterId', {
        workCenterId: query.workCenterId,
      });
    }
    if (query.status) {
      qb.andWhere('e.status = :status', { status: query.status });
    }

    const employees = await qb.orderBy('e.emp_no', 'ASC').take(5000).getMany();

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('员工花名册');

    sheet.columns = [
      { header: '工号', key: 'empNo', width: 15 },
      { header: '姓名', key: 'name', width: 12 },
      { header: '工种', key: 'jobType', width: 15 },
      { header: '工作中心ID', key: 'workCenterId', width: 14 },
      { header: '状态', key: 'status', width: 10 },
      { header: '入职日期', key: 'hireDate', width: 12 },
      { header: '离职日期', key: 'leaveDate', width: 12 },
      { header: '联系电话', key: 'phone', width: 14 },
    ];

    // 表头样式
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9E1F2' },
    };

    for (const emp of employees) {
      sheet.addRow({
        empNo: emp.empNo,
        name: emp.name,
        jobType: emp.jobType,
        workCenterId: emp.workCenterId ?? '',
        status: emp.status,
        hireDate: emp.hireDate,
        leaveDate: emp.leaveDate ?? '',
        phone: emp.phone ?? '',
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
