import { Controller, Get, Post, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { EventStore } from '../../shared/message/event-store.entity.js';
import { TenantContext } from '../../shared/tenant/tenant.context.js';

@ApiTags('事件总线')
@ApiBearerAuth()
@Controller('api/v1/events')
export class EventController {
  constructor(
    @InjectRepository(EventStore)
    private readonly eventRepo: Repository<EventStore>,
  ) {}

  @Get()
  @ApiOperation({ summary: '事件列表' })
  async findAll(
    @Query('status') status?: string,
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
  ) {
    const tenantId = TenantContext.requireCurrentTenant();
    const where: Partial<EventStore> = { tenantId };
    if (status) where.status = status as EventStore['status'];

    const [list, total] = await this.eventRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (Number(page) - 1) * Number(pageSize),
      take: Number(pageSize),
    });
    return {
      list,
      pagination: { page: Number(page), pageSize: Number(pageSize), total },
    };
  }

  @Get('dead-letters')
  @ApiOperation({ summary: '死信队列列表' })
  async getDeadLetters(
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
  ) {
    const tenantId = TenantContext.requireCurrentTenant();
    const [list, total] = await this.eventRepo.findAndCount({
      where: { tenantId, status: 'DEAD_LETTER' },
      order: { createdAt: 'DESC' },
      skip: (Number(page) - 1) * Number(pageSize),
      take: Number(pageSize),
    });
    return {
      list,
      pagination: { page: Number(page), pageSize: Number(pageSize), total },
    };
  }

  @Get(':id')
  @ApiOperation({ summary: '事件详情' })
  async findOne(@Param('id') id: string) {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.eventRepo.findOne({ where: { id, tenantId } });
  }

  @Post(':id/retry')
  @ApiOperation({ summary: '手动重试失败事件' })
  async retry(@Param('id') id: string) {
    const tenantId = TenantContext.requireCurrentTenant();
    await this.eventRepo.update(
      { id, tenantId },
      { status: 'PENDING', retryCount: 0, lastError: undefined },
    );
    return { message: 'Event queued for retry' };
  }
}
