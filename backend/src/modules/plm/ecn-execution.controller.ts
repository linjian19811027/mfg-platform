import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import {
  EcnExecutionService,
  ExecutionPlanQuery,
} from './services/ecn-execution.service.js';
import { WipImpactService } from './services/wip-impact.service.js';
import { TenantContext } from '../../shared/tenant/tenant.context.js';

@ApiTags('PLM ECN 执行计划')
@ApiBearerAuth()
@Controller('api/v1/plm')
export class EcnExecutionController {
  constructor(
    private readonly executionSvc: EcnExecutionService,
    private readonly wipSvc: WipImpactService,
  ) {}

  // ── 6.1.1 列表（分页+筛选） ───────────────────────────────────────────────

  @Get('ecn-execution-plans')
  @ApiOperation({ summary: 'ECN 执行计划列表（分页+筛选）' })
  findAll(
    @Query('status') status?: string,
    @Query('ecnNo') ecnNo?: string,
    @Query('effectiveDateFrom') effectiveDateFrom?: string,
    @Query('effectiveDateTo') effectiveDateTo?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const query: ExecutionPlanQuery = {
      status,
      ecnNo,
      effectiveDateFrom,
      effectiveDateTo,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
    };
    return this.executionSvc.findAll(query);
  }

  // ── 6.1.2 详情（含 items + assessment + logs） ────────────────────────────

  @Get('ecn-execution-plans/:id')
  @ApiOperation({ summary: 'ECN 执行计划详情（含执行项、评估报告、日志）' })
  findOne(@Param('id') id: string) {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.executionSvc.findOne(id, tenantId);
  }

  // ── 6.1.3 手动触发执行 ────────────────────────────────────────────────────

  @Patch('ecn-execution-plans/:id/trigger')
  @ApiOperation({ summary: '手动触发 ECN 执行计划' })
  @HttpCode(HttpStatus.OK)
  trigger(@Param('id') id: string, @Body() body: { operatorId?: string }) {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.executionSvc.triggerManually(
      tenantId,
      id,
      body.operatorId ?? '0',
    );
  }

  // ── 6.1.4 修改生效日期 ────────────────────────────────────────────────────

  @Patch('ecn-execution-plans/:id/effective-date')
  @ApiOperation({ summary: '修改 ECN 执行计划生效日期（不允许改为过去时间）' })
  @HttpCode(HttpStatus.OK)
  updateEffectiveDate(
    @Param('id') id: string,
    @Body() body: { effectiveDate: string; operatorId?: string },
  ) {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.executionSvc.updateEffectiveDate(
      tenantId,
      id,
      new Date(body.effectiveDate),
      body.operatorId ?? '0',
    );
  }

  // ── 6.1.5 重试失败项 ──────────────────────────────────────────────────────

  @Patch('ecn-execution-plans/:id/retry')
  @ApiOperation({ summary: '重试 ECN 执行计划中的失败项' })
  @HttpCode(HttpStatus.OK)
  retry(@Param('id') id: string) {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.executionSvc.retryFailedItems(tenantId, id);
  }

  // ── 6.1.6 取消 ────────────────────────────────────────────────────────────

  @Patch('ecn-execution-plans/:id/cancel')
  @ApiOperation({ summary: '取消 ECN 执行计划' })
  @HttpCode(HttpStatus.OK)
  cancel(@Param('id') id: string, @Body() body: { operatorId?: string }) {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.executionSvc.cancel(tenantId, id, body.operatorId ?? '0');
  }

  // ── 6.1.7 在制工单评估报告 ────────────────────────────────────────────────

  @Get('ecn-execution-plans/:id/wip-assessment')
  @ApiOperation({ summary: '获取 ECN 执行计划的在制工单影响评估报告' })
  getWipAssessment(@Param('id') id: string) {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.wipSvc.getAssessment(tenantId, id);
  }

  // ── 6.1.9 确认评估 ────────────────────────────────────────────────────────

  @Patch('ecn-execution-plans/:id/wip-assessment/confirm')
  @ApiOperation({
    summary: '确认在制工单影响评估（所有 SUSPEND_REVIEW 处理完后）',
  })
  @HttpCode(HttpStatus.OK)
  async confirmAssessment(@Param('id') planId: string) {
    const tenantId = TenantContext.requireCurrentTenant();
    const assessment = await this.wipSvc.getAssessment(tenantId, planId);
    if (!assessment) {
      return { message: '无评估记录，视为已确认' };
    }
    return this.wipSvc.confirmAssessment(tenantId, assessment.id);
  }

  // ── 6.1.8 人工覆盖建议 ────────────────────────────────────────────────────

  @Patch('wip-assessment-items/:id/override')
  @ApiOperation({ summary: '人工覆盖在制工单处理建议' })
  @HttpCode(HttpStatus.OK)
  overrideSuggestion(
    @Param('id') id: string,
    @Body()
    body: {
      suggestion: 'CONTINUE_OLD' | 'SWITCH_NEW';
      reason: string;
      operatorId?: string;
    },
  ) {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.wipSvc.overrideSuggestion(
      tenantId,
      id,
      body.suggestion,
      body.reason,
      body.operatorId ?? '0',
    );
  }
}
