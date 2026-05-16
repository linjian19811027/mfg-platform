import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtPayload } from '../auth/strategies/jwt.strategy.js';
import { TenantContext } from '../../shared/tenant/tenant.context.js';

import {
  EmployeeService,
  CreateEmployeeDto,
  UpdateEmployeeDto,
  UpdateStatusDto,
  FindEmployeesDto,
} from './services/employee.service.js';
import {
  CertificationService,
  CreateCertTypeDto,
  AddCertDto,
  RenewCertDto,
} from './services/certification.service.js';
import {
  ShiftService,
  CreateShiftDto,
  CreateScheduleDto,
  BatchCreateScheduleDto,
  FindSchedulesDto,
} from './services/shift.service.js';
import {
  WorkHourService,
  GetSummaryDto,
  GetRecordsDto,
} from './services/work-hour.service.js';
import { JobTypeService } from './services/job-type.service.js';
import { EmployeeHistoryService } from './services/employee-history.service.js';
import { HrJobType } from './entities/hr-job-type.entity.js';

@UseGuards(JwtAuthGuard)
@Controller('api/v1/hr')
export class HrController {
  constructor(
    private readonly employeeSvc: EmployeeService,
    private readonly certSvc: CertificationService,
    private readonly shiftSvc: ShiftService,
    private readonly workHourSvc: WorkHourService,
    private readonly jobTypeSvc: JobTypeService,
    private readonly historySvc: EmployeeHistoryService,
  ) {}

  // ── 员工 ──────────────────────────────────────────────────────────────────

  @Get('employees/overview')
  getOverview() {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.employeeSvc.getOverview(tenantId);
  }

  @Get('employees')
  findEmployees(
    @Query() query: FindEmployeesDto & { page?: string; pageSize?: string },
  ) {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.employeeSvc.findAll(tenantId, {
      ...query,
      page: query.page ? Number(query.page) : 1,
      pageSize: query.pageSize ? Number(query.pageSize) : 20,
    });
  }

  @Post('employees')
  createEmployee(
    @Body() dto: CreateEmployeeDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.employeeSvc.create(tenantId, dto, user.sub);
  }

  @Get('employees/:id')
  findEmployee(@Param('id') id: string) {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.employeeSvc.findOne(tenantId, Number(id));
  }

  @Patch('employees/:id')
  updateEmployee(
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.employeeSvc.update(tenantId, Number(id), dto, user.sub);
  }

  @Patch('employees/:id/status')
  updateEmployeeStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.employeeSvc.updateStatus(tenantId, Number(id), dto, user.sub);
  }

  // ── 员工履历 ──────────────────────────────────────────────────────────────

  @Get('employees/:id/history')
  findEmployeeHistory(@Param('id') id: string) {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.historySvc.findByEmployee(tenantId, id);
  }

  // ── 技能认证 ──────────────────────────────────────────────────────────────

  @Get('certification-types')
  findCertTypes() {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.certSvc.findTypes(tenantId);
  }

  @Post('certification-types')
  createCertType(@Body() dto: CreateCertTypeDto) {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.certSvc.createType(tenantId, dto);
  }

  @Get('employees/:id/certifications')
  findEmployeeCerts(@Param('id') id: string) {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.certSvc.findByEmployee(tenantId, Number(id));
  }

  @Post('employees/:id/certifications')
  addCertification(@Param('id') id: string, @Body() dto: AddCertDto) {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.certSvc.addCertification(tenantId, Number(id), dto);
  }

  @Get('certifications/expiring')
  getExpiringAlert() {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.certSvc.getExpiringAlert(tenantId);
  }

  @Get('certifications/export')
  async exportCerts(@Res() res: Response) {
    const tenantId = TenantContext.requireCurrentTenant();
    const buffer = await this.certSvc.exportExcel(tenantId);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="certifications.xlsx"',
    );
    res.send(buffer);
  }

  @Patch('certifications/:id/renew')
  renewCert(@Param('id') id: string, @Body() dto: RenewCertDto) {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.certSvc.renew(tenantId, Number(id), dto);
  }

  @Delete('certifications/:id')
  deleteCert(@Param('id') id: string) {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.certSvc.delete(tenantId, Number(id));
  }

  // ── 排班 ──────────────────────────────────────────────────────────────────

  @Get('shifts')
  findShifts() {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.shiftSvc.findShifts(tenantId);
  }

  @Post('shifts')
  createShift(@Body() dto: CreateShiftDto) {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.shiftSvc.createShift(tenantId, dto);
  }

  @Get('schedules/stats')
  getScheduleStats(
    @Query()
    query: {
      startDate: string;
      endDate: string;
      workCenterId?: string;
    },
  ) {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.shiftSvc.getStats(
      tenantId,
      query.startDate,
      query.endDate,
      query.workCenterId ? Number(query.workCenterId) : undefined,
    );
  }

  @Get('schedules')
  findSchedules(
    @Query() query: FindSchedulesDto & { page?: string; pageSize?: string },
  ) {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.shiftSvc.findSchedules(tenantId, {
      ...query,
      empId: query.empId ? Number(query.empId) : undefined,
      workCenterId: query.workCenterId ? Number(query.workCenterId) : undefined,
      page: query.page ? Number(query.page) : 1,
      pageSize: query.pageSize ? Number(query.pageSize) : 20,
    });
  }

  @Post('schedules')
  createSchedule(@Body() dto: CreateScheduleDto) {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.shiftSvc.createSchedule(tenantId, dto);
  }

  @Post('schedules/batch')
  batchCreateSchedule(@Body() dto: BatchCreateScheduleDto) {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.shiftSvc.batchCreateSchedule(tenantId, dto);
  }

  @Delete('schedules/:id')
  deleteSchedule(@Param('id') id: string) {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.shiftSvc.deleteSchedule(tenantId, Number(id));
  }

  // ── 工时 ──────────────────────────────────────────────────────────────────

  @Get('work-hours/dashboard')
  getWorkHourDashboard() {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.workHourSvc.getDashboard(tenantId);
  }

  @Get('work-hours/summary')
  getWorkHourSummary(
    @Query() query: GetSummaryDto & { page?: string; pageSize?: string },
  ) {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.workHourSvc.getSummary(tenantId, {
      ...query,
      empId: query.empId ? Number(query.empId) : undefined,
      page: query.page ? Number(query.page) : 1,
      pageSize: query.pageSize ? Number(query.pageSize) : 20,
    });
  }

  @Get('work-hours/records')
  getWorkHourRecords(
    @Query() query: GetRecordsDto & { page?: string; pageSize?: string },
  ) {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.workHourSvc.getRecords(tenantId, {
      ...query,
      empId: query.empId ? Number(query.empId) : undefined,
      workCenterId: query.workCenterId ? Number(query.workCenterId) : undefined,
      page: query.page ? Number(query.page) : 1,
      pageSize: query.pageSize ? Number(query.pageSize) : 20,
    });
  }

  @Get('work-hours/export')
  async exportWorkHours(
    @Query() query: GetSummaryDto & { page?: string; pageSize?: string },
    @Res() res: Response,
  ) {
    const tenantId = TenantContext.requireCurrentTenant();
    const buffer = await this.workHourSvc.exportExcel(tenantId, {
      ...query,
      empId: query.empId ? Number(query.empId) : undefined,
    });
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="work-hours.xlsx"',
    );
    res.send(buffer);
  }

  // ── 工种基础数据 ──────────────────────────────────────────────────────────

  @Get('job-types')
  findJobTypes() {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.jobTypeSvc.findAll(tenantId);
  }

  @Post('job-types')
  createJobType(@Body() dto: { name: string; code?: string; description?: string }) {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.jobTypeSvc.create(tenantId, dto);
  }

  @Put('job-types/:id')
  updateJobType(
    @Param('id') id: string,
    @Body() dto: { name?: string; code?: string; description?: string; enabled?: number },
  ) {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.jobTypeSvc.update(tenantId, Number(id), dto);
  }

  @Delete('job-types/:id')
  deleteJobType(@Param('id') id: string) {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.jobTypeSvc.delete(tenantId, Number(id));
  }
}
