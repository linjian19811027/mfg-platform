import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ReportService } from './report.service.js';

class CreateReportDto {
  reportType!: string;
  params!: object;
}

@ApiTags('reports')
@Controller('api/v1/reports')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @ApiOperation({ summary: '创建报表异步任务' })
  @Post()
  createTask(@Body() dto: CreateReportDto) {
    // tenantId 简化处理，实际项目从 JWT 中取
    const tenantId =
      ((dto as unknown as Record<string, unknown>)['tenantId'] as string) ??
      'default';
    return this.reportService.createTask(
      tenantId,
      dto.reportType,
      dto.params ?? {},
    );
  }

  @ApiOperation({ summary: '查询报表任务状态与结果' })
  @Get(':taskId')
  getTask(@Param('taskId') taskId: string) {
    return this.reportService.getTask(taskId);
  }
}
