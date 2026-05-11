import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ApsResourceService } from './services/aps-resource.service.js';
import { ApsCalendarService } from './services/aps-calendar.service.js';
import { CapacityService } from './services/capacity.service.js';
import { SchedulerService } from './services/scheduler.service.js';
import { ConstraintCheckService } from './services/constraint-check.service.js';
import { UrgentOrderService } from './services/urgent-order.service.js';
import { ReplanService } from './services/replan.service.js';
import { ApsEventService } from './services/aps-event.service.js';
import { SimulationService } from './services/simulation.service.js';
import { MrpService } from './services/mrp.service.js';
import { ApsAnalyticsService } from './services/aps-analytics.service.js';
import { PriorityRuleService } from './services/priority-rule.service.js';
import { ApsSchedule } from './entities/aps-schedule.entity.js';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator.js';

@ApiTags('APS 高级计划排程')
@ApiBearerAuth()
@Controller('api/v1/aps')
export class ApsController {
  constructor(
    private readonly resourceSvc: ApsResourceService,
    private readonly calendarSvc: ApsCalendarService,
    private readonly capacitySvc: CapacityService,
    private readonly schedulerSvc: SchedulerService,
    private readonly constraintSvc: ConstraintCheckService,
    private readonly urgentSvc: UrgentOrderService,
    private readonly replanSvc: ReplanService,
    private readonly eventSvc: ApsEventService,
    private readonly simulationSvc: SimulationService,
    private readonly mrpSvc: MrpService,
    private readonly analyticsSvc: ApsAnalyticsService,
    private readonly priorityRuleSvc: PriorityRuleService,
    @InjectRepository(ApsSchedule)
    private readonly scheduleRepo: Repository<ApsSchedule>,
  ) {}

  // ── 资源 ──────────────────────────────────────────────────────────────────

  @Get('resources')
  @ApiOperation({ summary: '资源列表' })
  getResources(
    @CurrentTenant() tenantId: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('keyword') keyword?: string,
  ) {
    return this.resourceSvc.findAll(tenantId, {
      type: type as any,
      status: status as any,
      keyword,
    });
  }

  @Post('resources')
  @ApiOperation({ summary: '创建资源' })
  createResource(
    @CurrentTenant() tenantId: string,
    @Body() body: Record<string, any>,
  ) {
    return this.resourceSvc.create(tenantId, body as any);
  }

  @Get('resources/:id')
  @ApiOperation({ summary: '资源详情' })
  getResource(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.resourceSvc.findOne(tenantId, id);
  }

  @Patch('resources/:id')
  @ApiOperation({ summary: '更新资源' })
  updateResource(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() body: Record<string, any>,
  ) {
    return this.resourceSvc.update(tenantId, id, body);
  }

  @Delete('resources/:id')
  @ApiOperation({ summary: '删除资源' })
  removeResource(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.resourceSvc.remove(tenantId, id);
  }

  @Patch('resources/:id/status')
  @ApiOperation({ summary: '更新资源状态' })
  updateResourceStatus(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() body: { status: any },
  ) {
    return this.resourceSvc.updateStatus(tenantId, id, body.status);
  }

  @Post('resources/:id/alternatives')
  @ApiOperation({ summary: '添加替代资源' })
  addAlternative(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() body: { alternativeId: string },
  ) {
    return this.resourceSvc.addAlternative(tenantId, id, body.alternativeId);
  }

  @Delete('resources/:id/alternatives/:altId')
  @ApiOperation({ summary: '移除替代资源' })
  removeAlternative(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Param('altId') altId: string,
  ) {
    return this.resourceSvc.removeAlternative(tenantId, id, altId);
  }

  // ── 日历 ──────────────────────────────────────────────────────────────────

  @Get('calendars')
  @ApiOperation({ summary: '查询日历' })
  getCalendars(
    @CurrentTenant() tenantId: string,
    @Query('resourceId') resourceId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('isHoliday') isHoliday?: string,
  ) {
    return this.calendarSvc.findAll(tenantId, {
      resourceId,
      startDate,
      endDate,
      isHoliday: isHoliday !== undefined ? Number(isHoliday) : undefined,
    });
  }

  @Post('calendars')
  @ApiOperation({ summary: '创建日历条目' })
  createCalendar(
    @CurrentTenant() tenantId: string,
    @Body() body: Record<string, any>,
  ) {
    return this.calendarSvc.create(tenantId, body as any);
  }

  @Post('calendars/batch')
  @ApiOperation({ summary: '批量创建日历条目' })
  batchCreateCalendars(
    @CurrentTenant() tenantId: string,
    @Body() body: Record<string, any>[],
  ) {
    return this.calendarSvc.batchCreate(tenantId, body as any[]);
  }

  @Patch('calendars/holiday')
  @ApiOperation({ summary: '设置节假日' })
  setHoliday(
    @CurrentTenant() tenantId: string,
    @Body() body: { date: string; isHoliday: number },
  ) {
    return this.calendarSvc.setHoliday(tenantId, body.date, body.isHoliday);
  }

  @Get('calendars/working-hours')
  @ApiOperation({ summary: '查询工作时间' })
  getWorkingHours(
    @CurrentTenant() tenantId: string,
    @Query('resourceId') resourceId?: string,
    @Query('date') date?: string,
  ) {
    return this.calendarSvc.getWorkingHours(
      tenantId,
      resourceId ?? null,
      date ?? new Date().toISOString().slice(0, 10),
    );
  }

  @Patch('calendars/:id')
  @ApiOperation({ summary: '更新日历条目' })
  updateCalendar(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() body: Record<string, any>,
  ) {
    return this.calendarSvc.update(tenantId, id, body as any);
  }

  @Delete('calendars/:id')
  @ApiOperation({ summary: '删除日历条目' })
  removeCalendar(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.calendarSvc.remove(tenantId, id);
  }

  // ── 排程 ──────────────────────────────────────────────────────────────────

  @Post('schedule')
  @ApiOperation({ summary: '触发正向排程' })
  scheduleForward(
    @CurrentTenant() tenantId: string,
    @Body() body: { inputs: any[]; options?: any },
  ) {
    return this.schedulerSvc.scheduleForward(
      tenantId,
      body.inputs,
      body.options,
    );
  }

  @Post('schedule/backward')
  @ApiOperation({ summary: '反向排程' })
  scheduleBackward(
    @CurrentTenant() tenantId: string,
    @Body() body: { inputs: any[]; deadlines: Record<string, string> },
  ) {
    const deadlineMap = new Map<string, Date>(
      Object.entries(body.deadlines).map(([k, v]) => [k, new Date(v)]),
    );
    return this.schedulerSvc.scheduleBackward(
      tenantId,
      body.inputs,
      deadlineMap,
    );
  }

  @Post('schedule/release')
  @ApiOperation({ summary: '发布派工单' })
  releaseWorkOrders(
    @CurrentTenant() tenantId: string,
    @Body() body: { scheduleIds: string[] },
  ) {
    return this.schedulerSvc.releaseWorkOrders(tenantId, body.scheduleIds);
  }

  @Get('schedules/wo/:woId')
  @ApiOperation({ summary: '查询工单排程' })
  getSchedulesByWo(
    @CurrentTenant() tenantId: string,
    @Param('woId') woId: string,
  ) {
    return this.schedulerSvc.getSchedulesByWo(tenantId, woId);
  }

  @Delete('schedules/:id')
  @ApiOperation({ summary: '取消排程' })
  cancelSchedule(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.schedulerSvc.cancelSchedule(tenantId, id);
  }

  // ── 紧急插单 ──────────────────────────────────────────────────────────────

  @Post('urgent-orders/analyze')
  @ApiOperation({ summary: '紧急插单影响分析' })
  analyzeUrgentImpact(
    @CurrentTenant() tenantId: string,
    @Body() urgentInput: any,
  ) {
    return this.urgentSvc.analyzeImpact(tenantId, urgentInput);
  }

  @Post('urgent-orders')
  @ApiOperation({ summary: '插入紧急工单' })
  insertUrgentOrder(
    @CurrentTenant() tenantId: string,
    @Body() body: { urgentInput: any; forceInsert?: boolean },
  ) {
    return this.urgentSvc.insertUrgentOrder(
      tenantId,
      body.urgentInput,
      body.forceInsert,
    );
  }

  // ── 重排 ──────────────────────────────────────────────────────────────────

  @Put('schedules/:woId/replan')
  @ApiOperation({ summary: '订单变更重排' })
  replanByOrderChange(
    @CurrentTenant() tenantId: string,
    @Param('woId') woId: string,
    @Body() body: { changes: any },
  ) {
    return this.replanSvc.replanByOrderChange(tenantId, woId, body.changes);
  }

  @Post('material-delay-adjust')
  @ApiOperation({ summary: '物料延迟调整' })
  materialDelayAdjust(
    @CurrentTenant() tenantId: string,
    @Body() body: { woId: string; delayHours: number },
  ) {
    return this.replanSvc.replanByMaterialDelay(
      tenantId,
      body.woId,
      body.delayHours,
    );
  }

  // ── 模拟 ──────────────────────────────────────────────────────────────────

  @Post('simulate')
  @ApiOperation({ summary: 'What-if 模拟' })
  simulate(
    @CurrentTenant() tenantId: string,
    @Body() body: { scenarios: any[] },
  ) {
    return this.simulationSvc.simulate(tenantId, body.scenarios);
  }

  @Post('simulate/compare')
  @ApiOperation({ summary: '多方案对比' })
  compareScenarios(
    @CurrentTenant() tenantId: string,
    @Body() body: { scenarios: any[] },
  ) {
    return this.simulationSvc.compareScenarios(tenantId, body.scenarios);
  }

  // ── MRP ───────────────────────────────────────────────────────────────────

  @Post('mrp/calculate')
  @ApiOperation({ summary: 'MRP 计算' })
  calculateMrp(
    @CurrentTenant() tenantId: string,
    @Body() body: { input: any },
  ) {
    return this.mrpSvc.calculate(tenantId, body.input);
  }

  @Get('mrp')
  @ApiOperation({ summary: 'MRP 列表' })
  getMrpList(
    @CurrentTenant() tenantId: string,
    @Query() query: Record<string, any>,
  ) {
    return this.mrpSvc.findAll(tenantId, query);
  }

  @Get('mrp/:id')
  @ApiOperation({ summary: 'MRP 详情' })
  getMrp(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.mrpSvc.findOne(tenantId, id);
  }

  @Post('mrp/:id/release')
  @ApiOperation({ summary: '发布 MRP' })
  releaseMrp(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.mrpSvc.release(tenantId, id);
  }

  @Get('mrp/:id/readiness')
  @ApiOperation({ summary: '齐套检查' })
  checkMrpReadiness(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.mrpSvc.checkReadiness(tenantId, id);
  }

  // ── 产能 / 交期分析 ───────────────────────────────────────────────────────

  @Get('capacity-analysis')
  @ApiOperation({ summary: '产能分析' })
  getCapacityAnalysis(
    @CurrentTenant() tenantId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.analyticsSvc.getCapacityAnalysis(tenantId, startDate, endDate);
  }

  @Get('delivery-analysis')
  @ApiOperation({ summary: '交期分析' })
  getDeliveryAnalysis(
    @CurrentTenant() tenantId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.analyticsSvc.getDeliveryAnalysis(tenantId, startDate, endDate);
  }

  // ── 甘特图 ────────────────────────────────────────────────────────────────

  @Get('gantt/resource')
  @ApiOperation({ summary: '资源甘特图' })
  getResourceGantt(
    @CurrentTenant() tenantId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.analyticsSvc.getGanttData(
      tenantId,
      'resource',
      startDate,
      endDate,
    );
  }

  @Get('gantt/order')
  @ApiOperation({ summary: '订单甘特图' })
  getOrderGantt(
    @CurrentTenant() tenantId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.analyticsSvc.getGanttData(
      tenantId,
      'order',
      startDate,
      endDate,
    );
  }

  // ── 优先级规则 ────────────────────────────────────────────────────────────

  @Get('priority-rules/strategy')
  @ApiOperation({ summary: '获取当前组合策略' })
  getCombinedStrategy(@CurrentTenant() tenantId: string) {
    return this.priorityRuleSvc.getCombinedStrategy(tenantId);
  }

  @Get('priority-rules')
  @ApiOperation({ summary: '优先级规则列表' })
  getPriorityRules(@CurrentTenant() tenantId: string) {
    return this.priorityRuleSvc.findAllRules(tenantId);
  }

  @Post('priority-rules')
  @ApiOperation({ summary: '创建优先级规则' })
  createPriorityRule(
    @CurrentTenant() tenantId: string,
    @Body() body: Record<string, any>,
  ) {
    return this.priorityRuleSvc.createRule(tenantId, body as any);
  }

  @Patch('priority-rules/:id')
  @ApiOperation({ summary: '更新优先级规则' })
  updatePriorityRule(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() body: Record<string, any>,
  ) {
    return this.priorityRuleSvc.updateRule(tenantId, id, body as any);
  }

  @Delete('priority-rules/:id')
  @ApiOperation({ summary: '删除优先级规则' })
  removePriorityRule(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.priorityRuleSvc.removeRule(tenantId, id);
  }

  @Patch('priority-rules/:id/toggle')
  @ApiOperation({ summary: '启用/禁用优先级规则' })
  togglePriorityRule(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() body: { isActive: boolean },
  ) {
    return this.priorityRuleSvc.toggleRule(tenantId, id, body.isActive);
  }

  // ── 排程结果全局列表 ──────────────────────────────────────────────────────

  @Get('schedules')
  @ApiOperation({ summary: '排程结果列表' })
  async getScheduleList(
    @CurrentTenant() tenantId: string,
    @Query('woId') woId?: string,
    @Query('resourceId') resourceId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const tid = tenantId || 'DEFAULT';
    const qb = this.scheduleRepo
      .createQueryBuilder('s')
      .where('s.tenantId = :tid', { tid });
    if (woId) qb.andWhere('s.woId = :woId', { woId });
    if (resourceId) qb.andWhere('s.resourceId = :resourceId', { resourceId });
    const p = Number(page ?? 1);
    const ps = Number(pageSize ?? 20);
    qb.skip((p - 1) * ps)
      .take(ps)
      .orderBy('s.scheduledStart', 'ASC');
    const [list, total] = await qb.getManyAndCount();
    return { list, total };
  }
}
