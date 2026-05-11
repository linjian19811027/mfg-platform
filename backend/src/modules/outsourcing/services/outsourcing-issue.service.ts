import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import {
  OutsourcingIssue,
  OutsourcingIssueStatus,
} from '../entities/outsourcing-issue.entity.js';
import {
  OutsourcingOrder,
  OutsourcingOrderStatus,
} from '../entities/outsourcing-order.entity.js';
import { OutsourcingOrderService } from './outsourcing-order.service.js';
import {
  MESSAGE_SERVICE,
  MessageService,
} from '../../../shared/message/message.interface.js';
import { EventTypes } from '../../event/event-types.constant.js';
import { TenantContext } from '../../../shared/tenant/tenant.context.js';

export interface CreateIssueDto {
  batchId?: string;
  issueQty: number;
  warehouseId: string;
  locationId: string;
  operatorId: string;
}

@Injectable()
export class OutsourcingIssueService {
  constructor(
    @InjectRepository(OutsourcingIssue)
    private readonly issueRepo: Repository<OutsourcingIssue>,
    @InjectRepository(OutsourcingOrder)
    private readonly orderRepo: Repository<OutsourcingOrder>,
    private readonly orderSvc: OutsourcingOrderService,
    private readonly dataSource: DataSource,
    @Inject(MESSAGE_SERVICE)
    private readonly messageSvc: MessageService,
  ) {}

  // ── 创建发料单 ────────────────────────────────────────────────────────────

  async create(ocId: string, dto: CreateIssueDto): Promise<OutsourcingIssue> {
    const tenantId = TenantContext.requireCurrentTenant();
    const order = await this.findOrderOrFail(tenantId, ocId);

    if (
      order.status !== OutsourcingOrderStatus.CONFIRMED &&
      order.status !== OutsourcingOrderStatus.ISSUED
    ) {
      throw new BadRequestException(
        `外协工单状态 ${order.status} 不允许创建发料单`,
      );
    }

    // 校验累计发料不超计划数量
    const totalIssued = await this.getTotalIssuedQty(tenantId, ocId);
    const remaining = Number(order.plannedQty) - totalIssued;
    if (dto.issueQty > remaining) {
      throw new BadRequestException(`发料数量超出剩余可发料数量 ${remaining}`);
    }

    const issue = await this.issueRepo.save(
      this.issueRepo.create({
        tenantId,
        ocId,
        batchId: dto.batchId,
        issueQty: dto.issueQty,
        warehouseId: dto.warehouseId,
        locationId: dto.locationId,
        status: OutsourcingIssueStatus.PENDING,
        operatorId: dto.operatorId,
      }),
    );

    return issue;
  }

  // ── 确认发料（校验库存 + 发布事件）──────────────────────────────────────

  async confirm(
    issueId: string,
    operatorId: string,
  ): Promise<OutsourcingIssue> {
    const tenantId = TenantContext.requireCurrentTenant();
    const issue = await this.issueRepo.findOne({
      where: { id: issueId, tenantId },
    });
    if (!issue) throw new NotFoundException(`发料单 ${issueId} 不存在`);
    if (issue.status !== OutsourcingIssueStatus.PENDING) {
      throw new BadRequestException(`发料单状态 ${issue.status} 不允许确认`);
    }

    const order = await this.findOrderOrFail(tenantId, issue.ocId);

    // 只读校验库存（跨模块只读查询）
    await this.validateStock(
      tenantId,
      order.materialId,
      issue.batchId,
      issue.locationId,
      issue.issueQty,
    );

    // 更新发料单状态
    const updated = await this.issueRepo.save({
      ...issue,
      status: OutsourcingIssueStatus.CONFIRMED,
    });

    // 累加工单已发料数量
    await this.orderSvc.incrementIssuedQty(
      tenantId,
      issue.ocId,
      Number(issue.issueQty),
    );

    // 记录操作日志
    await this.orderSvc.writeLog(
      tenantId,
      issue.ocId,
      'ISSUE_CONFIRMED',
      undefined,
      undefined,
      operatorId,
    );

    // 发布事件 → WMS 执行出库
    await this.messageSvc.publish({
      eventId: uuidv4(),
      eventType: EventTypes.OUTSOURCING_ISSUE_CONFIRMED,
      tenantId,
      sourceModule: 'OUTSOURCING',
      targetModule: 'WMS',
      payload: {
        ocId: issue.ocId,
        issueId: issue.id,
        materialId: order.materialId,
        batchId: issue.batchId,
        qty: Number(issue.issueQty),
        warehouseId: issue.warehouseId,
        locationId: issue.locationId,
        operatorId,
      },
      createdAt: new Date(),
    });

    return updated;
  }

  // ── 查询发料单列表 ────────────────────────────────────────────────────────

  async findByOcId(ocId: string): Promise<OutsourcingIssue[]> {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.issueRepo.find({
      where: { tenantId, ocId },
      order: { createdAt: 'DESC' },
    });
  }

  // ── 私有辅助 ──────────────────────────────────────────────────────────────

  private async findOrderOrFail(
    tenantId: string,
    ocId: string,
  ): Promise<OutsourcingOrder> {
    const order = await this.orderRepo.findOne({
      where: { id: ocId, tenantId },
    });
    if (!order) throw new NotFoundException(`外协工单 ${ocId} 不存在`);
    return order;
  }

  private async getTotalIssuedQty(
    tenantId: string,
    ocId: string,
  ): Promise<number> {
    const result = await this.issueRepo
      .createQueryBuilder('i')
      .select('SUM(i.issue_qty)', 'total')
      .where('i.tenant_id = :tenantId', { tenantId })
      .andWhere('i.oc_id = :ocId', { ocId })
      .andWhere('i.status != :cancelled', {
        cancelled: OutsourcingIssueStatus.CANCELLED,
      })
      .getRawOne<{ total: string }>();
    return Number(result?.total ?? 0);
  }

  private async validateStock(
    tenantId: string,
    materialId: string,
    batchId: string | undefined,
    locationId: string,
    requiredQty: number,
  ): Promise<void> {
    const sql = batchId
      ? `SELECT available_qty FROM wms_inventory WHERE tenant_id = ? AND material_id = ? AND batch_id = ? AND location_id = ? LIMIT 1`
      : `SELECT SUM(available_qty) as available_qty FROM wms_inventory WHERE tenant_id = ? AND material_id = ? AND location_id = ? AND status = 'AVAILABLE'`;
    const params = batchId
      ? [tenantId, materialId, batchId, locationId]
      : [tenantId, materialId, locationId];

    const rows = await this.dataSource.query(sql, params);
    const available = Number(rows?.[0]?.available_qty ?? 0);
    if (available < requiredQty) {
      throw new BadRequestException(
        `库存不足，当前可用库存 ${available}，需要 ${requiredQty}`,
      );
    }
  }
}
