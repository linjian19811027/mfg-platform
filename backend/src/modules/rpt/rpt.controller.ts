import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RptService } from './rpt.service.js';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator.js';

@ApiTags('报表设计器')
@ApiBearerAuth()
@Controller('api/v1/rpt')
export class RptController {
  constructor(private readonly rptService: RptService) {}

  @Get('reports')
  @ApiOperation({ summary: '报表列表' })
  findAll(
    @CurrentTenant() tenantId: string,
    @Query('type') type?: string,
    @Query('isTemplate') isTemplate?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize?: number,
  ) {
    return this.rptService.findAll({ type, isTemplate: isTemplate ? Number(isTemplate) : undefined, page, pageSize });
  }

  @Get('reports/templates')
  @ApiOperation({ summary: '报表模板列表' })
  getTemplates() {
    return this.rptService.getTemplates();
  }

  @Get('reports/:id')
  @ApiOperation({ summary: '报表详情' })
  findOne(@Param('id') id: string) {
    return this.rptService.findOne(id);
  }

  @Post('reports')
  @ApiOperation({ summary: '创建报表' })
  create(@Body() body: Record<string, unknown>) {
    return this.rptService.create(body as any);
  }

  @Put('reports/:id')
  @ApiOperation({ summary: '更新报表' })
  update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.rptService.update(id, body as any);
  }

  @Delete('reports/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除报表' })
  delete(@Param('id') id: string) {
    return this.rptService.delete(id);
  }
}
