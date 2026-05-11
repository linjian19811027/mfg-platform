import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ConversionDefinitionService } from './services/conversion-definition.service.js';
import { ConversionInstanceService } from './services/conversion-instance.service.js';
import { TraceabilityService } from './services/traceability.service.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtPayload } from '../auth/strategies/jwt.strategy.js';
import { ConversionStatus } from './entities/conversion-instance.entity.js';

@ApiTags('转换引擎')
@ApiBearerAuth()
@Controller('api/v1/conversion')
export class ConversionController {
  constructor(
    private readonly defService: ConversionDefinitionService,
    private readonly instanceService: ConversionInstanceService,
    private readonly traceService: TraceabilityService,
  ) {}

  // ── 转换定义 ──────────────────────────────────────────
  @Get('definitions')
  @ApiOperation({ summary: '转换定义列表' })
  getDefinitions(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.defService.findAll(page, pageSize);
  }

  @Get('definitions/:id')
  @ApiOperation({ summary: '转换定义详情（含输入输出）' })
  getDefinition(@Param('id') id: string) {
    return this.defService.findOne(id);
  }

  @Post('definitions')
  @ApiOperation({ summary: '创建转换定义' })
  createDefinition(@Body() body: Record<string, unknown>) {
    return this.defService.create(body);
  }

  @Put('definitions/:id')
  @ApiOperation({ summary: '更新转换定义' })
  updateDefinition(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.defService.update(id, body);
  }

  // ── 转换实例 ──────────────────────────────────────────
  @Get('instances')
  @ApiOperation({ summary: '转换实例列表' })
  getInstances(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('status') status?: string,
  ) {
    return this.instanceService.findAll(page, pageSize, status);
  }

  @Get('instances/:id')
  @ApiOperation({ summary: '转换实例详情' })
  getInstance(@Param('id') id: string) {
    return this.instanceService.findOne(id);
  }

  @Post('instances')
  @ApiOperation({ summary: '创建转换实例' })
  createInstance(@Body() body: Record<string, unknown>) {
    return this.instanceService.create(body);
  }

  @Patch('instances/:id/status')
  @ApiOperation({ summary: '更新实例状态（状态机流转）' })
  updateInstanceStatus(
    @Param('id') id: string,
    @Body('status') status: ConversionStatus,
  ) {
    return this.instanceService.updateStatus(id, status);
  }

  // ── 追溯 ──────────────────────────────────────────────
  @Get('traceability/forward/:batchId')
  @ApiOperation({ summary: '正向追溯（成品→原料）' })
  traceForward(
    @Param('batchId') batchId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.traceService.traceForward(batchId, user.tenantId);
  }

  @Get('traceability/backward/:batchId')
  @ApiOperation({ summary: '反向追溯（原料→成品）' })
  traceBackward(
    @Param('batchId') batchId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.traceService.traceBackward(batchId, user.tenantId);
  }
}
