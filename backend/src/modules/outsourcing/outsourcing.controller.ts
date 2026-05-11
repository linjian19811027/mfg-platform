import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { TenantContext } from '../../shared/tenant/tenant.context.js';
import {
  OutsourcingOrderService,
  CreateOutsourcingOrderDto,
  OutsourcingOrderQuery,
} from './services/outsourcing-order.service.js';
import {
  OutsourcingIssueService,
  CreateIssueDto,
} from './services/outsourcing-issue.service.js';
import {
  OutsourcingReceiptService,
  CreateReceiptDto,
} from './services/outsourcing-receipt.service.js';
import {
  OutsourcingSettlementService,
  CreateSettlementDto,
} from './services/outsourcing-settlement.service.js';
import { OutsourcingAnalyticsService } from './services/outsourcing-analytics.service.js';
import { OutsourcingOperationLog } from './entities/outsourcing-operation-log.entity.js';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OutsourcingOrderStatus } from './entities/outsourcing-order.entity.js';

@UseGuards(JwtAuthGuard)
@Controller('api/v1/outsourcing')
export class OutsourcingController {
  constructor(
    private readonly orderSvc: OutsourcingOrderService,
    private readonly issueSvc: OutsourcingIssueService,
    private readonly receiptSvc: OutsourcingReceiptService,
    private readonly settlementSvc: OutsourcingSettlementService,
    private readonly analyticsSvc: OutsourcingAnalyticsService,
    @InjectRepository(OutsourcingOperationLog)
    private readonly logRepo: Repository<OutsourcingOperationLog>,
  ) {}

  // ── 看板 ──────────────────────────────────────────────────────────────────

  @Get('dashboard')
  getDashboard() {
    return this.analyticsSvc.getDashboard();
  }

  // ── 外协工单 ──────────────────────────────────────────────────────────────

  @Get('orders')
  findOrders(
    @Query()
    query: {
      status?: OutsourcingOrderStatus;
      supplierId?: string;
      processName?: string;
      deliveryFrom?: string;
      deliveryTo?: string;
      mesWoId?: string;
      page?: string;
      pageSize?: string;
    },
  ) {
    const q: OutsourcingOrderQuery = {
      status: query.status,
      supplierId: query.supplierId,
      processName: query.processName,
      mesWoId: query.mesWoId,
      deliveryFrom: query.deliveryFrom
        ? new Date(query.deliveryFrom)
        : undefined,
      deliveryTo: query.deliveryTo ? new Date(query.deliveryTo) : undefined,
      page: query.page ? Number(query.page) : 1,
      pageSize: query.pageSize ? Number(query.pageSize) : 20,
    };
    return this.orderSvc.findAll(q);
  }

  @Get('orders/export')
  exportOrders(
    @Query()
    query: {
      status?: string;
      supplierId?: string;
      deliveryFrom?: string;
      deliveryTo?: string;
    },
  ) {
    return this.analyticsSvc.exportExcel({
      status: query.status,
      supplierId: query.supplierId,
      deliveryFrom: query.deliveryFrom
        ? new Date(query.deliveryFrom)
        : undefined,
      deliveryTo: query.deliveryTo ? new Date(query.deliveryTo) : undefined,
    });
  }

  @Post('orders')
  createOrder(@Body() dto: CreateOutsourcingOrderDto, @Req() req: any) {
    const operatorId = req.user?.userId ?? 'system';
    return this.orderSvc.create({ ...dto, createdBy: operatorId });
  }

  @Get('orders/:id')
  findOrder(@Param('id') id: string) {
    return this.orderSvc.findOne(id);
  }

  @Patch('orders/:id/confirm')
  confirmOrder(@Param('id') id: string, @Req() req: any) {
    const operatorId = req.user?.userId ?? 'system';
    return this.orderSvc.confirm(id, operatorId);
  }

  @Patch('orders/:id/cancel')
  cancelOrder(
    @Param('id') id: string,
    @Body() body: { remark?: string },
    @Req() req: any,
  ) {
    const operatorId = req.user?.userId ?? 'system';
    return this.orderSvc.cancel(id, operatorId, body.remark);
  }

  @Get('orders/:id/progress')
  getProgress(@Param('id') id: string) {
    return this.orderSvc.getProgress(id);
  }

  @Get('orders/:id/logs')
  async getLogs(@Param('id') id: string) {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.logRepo.find({
      where: { tenantId, ocId: id },
      order: { createdAt: 'DESC' },
    });
  }

  // ── 发料 ──────────────────────────────────────────────────────────────────

  @Get('orders/:id/issues')
  findIssues(@Param('id') id: string) {
    return this.issueSvc.findByOcId(id);
  }

  @Post('orders/:id/issues')
  createIssue(
    @Param('id') id: string,
    @Body() dto: CreateIssueDto,
    @Req() req: any,
  ) {
    const operatorId = req.user?.userId ?? 'system';
    return this.issueSvc.create(id, { ...dto, operatorId });
  }

  @Patch('issues/:id/confirm')
  confirmIssue(@Param('id') id: string, @Req() req: any) {
    const operatorId = req.user?.userId ?? 'system';
    return this.issueSvc.confirm(id, operatorId);
  }

  // ── 收货 ──────────────────────────────────────────────────────────────────

  @Get('orders/:id/receipts')
  findReceipts(@Param('id') id: string) {
    return this.receiptSvc.findByOcId(id);
  }

  @Post('orders/:id/receipts')
  createReceipt(
    @Param('id') id: string,
    @Body() dto: CreateReceiptDto,
    @Req() req: any,
  ) {
    const operatorId = req.user?.userId ?? 'system';
    return this.receiptSvc.create(id, { ...dto, operatorId });
  }

  @Patch('receipts/:id/confirm')
  confirmReceipt(@Param('id') id: string, @Req() req: any) {
    const operatorId = req.user?.userId ?? 'system';
    return this.receiptSvc.confirm(id, operatorId);
  }

  // ── 结算 ──────────────────────────────────────────────────────────────────

  @Get('orders/:id/settlements')
  findSettlements(@Param('id') id: string) {
    return this.settlementSvc.findByOcId(id);
  }

  @Post('orders/:id/settlements')
  createSettlement(
    @Param('id') id: string,
    @Body() dto: CreateSettlementDto,
    @Req() req: any,
  ) {
    const operatorId = req.user?.userId ?? 'system';
    return this.settlementSvc.create(id, { ...dto, createdBy: operatorId });
  }

  @Patch('settlements/:id/approve')
  approveSettlement(@Param('id') id: string, @Req() req: any) {
    const approvedBy = req.user?.userId ?? 'system';
    return this.settlementSvc.approve(id, approvedBy);
  }
}
