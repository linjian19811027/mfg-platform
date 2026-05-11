import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import {
  OutsourcingReceipt,
  OutsourcingReceiptStatus,
  OutsourcingReceiptQualityStatus,
} from '../entities/outsourcing-receipt.entity.js';
import {
  OutsourcingOrder,
  OutsourcingOrderStatus,
} from '../entities/outsourcing-order.entity.js';
import {
  OutsourcingIssue,
  OutsourcingIssueStatus,
} from '../entities/outsourcing-issue.entity.js';
import { OutsourcingOrderService } from './outsourcing-order.service.js';
import {
  MESSAGE_SERVICE,
  MessageService,
} from '../../../shared/message/message.interface.js';
import { EventTypes } from '../../event/event-types.constant.js';
import { TenantContext } from '../../../shared/tenant/tenant.context.js';

export interface CreateReceiptDto {
  issueId: string;
  receiptQty: number;
  qualityStatus?: OutsourcingReceiptQualityStatus;
  stagingLocationId?: string;
  operatorId: string;
}

@Injectable()
export class OutsourcingReceiptService {
  constructor(
    @InjectRepository(OutsourcingReceipt)
    private readonly receiptRepo: Repository<OutsourcingReceipt>,
    @InjectRepository(OutsourcingOrder)
    private readonly orderRepo: Repository<OutsourcingOrder>,
    @InjectRepository(OutsourcingIssue)
    private readonly issueRepo: Repository<OutsourcingIssue>,
    private readonly orderSvc: OutsourcingOrderService,
    @Inject(MESSAGE_SERVICE)
    private readonly messageSvc: MessageService,
  ) {}

  // ── 创建收货单 ────────────────────────────────────────────────────────────

  async create(
    ocId: string,
    dto: CreateReceiptDto,
  ): Promise<OutsourcingReceipt> {
    const tenantId = TenantContext.requireCurrentTenant();
    const order = await this.findOrderOrFail(tenantId, ocId);

    const allowedStatuses = [
      OutsourcingOrderStatus.ISSUED,
      OutsourcingOrderStatus.PARTIAL_RECEIVED,
    ];
    if (!allowedStatuses.includes(order.status)) {
      throw new BadRequestException(
        `外协工单状态 ${order.status} 不允许创建收货单`,
      );
    }

    // 校验发料单
    const issue = await this.issueRepo.findOne({
      where: { id: dto.issueId, tenantId, ocId },
    });
    if (!issue) throw new NotFoundException(`发料单 ${dto.issueId} 不存在`);
    if (issue.status !== OutsourcingIssueStatus.CONFIRMED) {
      throw new BadRequestException(`发料单未确认，无法收货`);
    }

    // 校验收货数量不超发料数量（允许 10% 超收）
    const alreadyReceived = await this.getReceivedQtyForIssue(
      tenantId,
      dto.issueId,
    );
    const maxAllowed = Number(issue.issueQty) * 1.1;
    if (alreadyReceived + dto.receiptQty > maxAllowed) {
      throw new BadRequestException(
        `收货数量超出允许范围，发料数量 ${issue.issueQty}，已收 ${alreadyReceived}，最多可收 ${maxAllowed.toFixed(6)}`,
      );
    }

    const isOverReceipt =
      alreadyReceived + dto.receiptQty > Number(issue.issueQty) ? 1 : 0;

    const receipt = await this.receiptRepo.save(
      this.receiptRepo.create({
        tenantId,
        ocId,
        issueId: dto.issueId,
        receiptQty: dto.receiptQty,
        qualityStatus:
          dto.qualityStatus ?? OutsourcingReceiptQualityStatus.NORMAL,
        isOverReceipt,
        stagingLocationId: dto.stagingLocationId,
        status: OutsourcingReceiptStatus.PENDING,
        operatorId: dto.operatorId,
      }),
    );

    return receipt;
  }

  // ── 确认收货（累加数量 + 发布事件）──────────────────────────────────────

  async confirm(
    receiptId: string,
    operatorId: string,
  ): Promise<OutsourcingReceipt> {
    const tenantId = TenantContext.requireCurrentTenant();
    const receipt = await this.receiptRepo.findOne({
      where: { id: receiptId, tenantId },
    });
    if (!receipt) throw new NotFoundException(`收货单 ${receiptId} 不存在`);
    if (receipt.status !== OutsourcingReceiptStatus.PENDING) {
      throw new BadRequestException(`收货单状态 ${receipt.status} 不允许确认`);
    }

    const order = await this.findOrderOrFail(tenantId, receipt.ocId);

    // 更新收货单状态为 INSPECTING
    const updated = await this.receiptRepo.save({
      ...receipt,
      status: OutsourcingReceiptStatus.INSPECTING,
    });

    // 累加工单已收货数量
    await this.orderSvc.incrementReceivedQty(
      tenantId,
      receipt.ocId,
      Number(receipt.receiptQty),
    );

    // 更新工单状态为 INSPECTING
    await this.orderSvc.setStatus(
      tenantId,
      receipt.ocId,
      OutsourcingOrderStatus.INSPECTING,
    );

    // 记录操作日志
    await this.orderSvc.writeLog(
      tenantId,
      receipt.ocId,
      'RECEIPT_CONFIRMED',
      undefined,
      undefined,
      operatorId,
    );

    // 发布事件 → WMS 暂存入库 + QMS 创建 IQC
    await this.messageSvc.publish({
      eventId: uuidv4(),
      eventType: EventTypes.OUTSOURCING_RECEIPT_CONFIRMED,
      tenantId,
      sourceModule: 'OUTSOURCING',
      payload: {
        ocId: receipt.ocId,
        receiptId: receipt.id,
        materialId: order.materialId,
        qty: Number(receipt.receiptQty),
        stagingLocationId: receipt.stagingLocationId,
        qualityStatus: receipt.qualityStatus,
        issueId: receipt.issueId,
        operatorId,
      },
      createdAt: new Date(),
    });

    return updated;
  }

  // ── 查询收货单列表 ────────────────────────────────────────────────────────

  async findByOcId(ocId: string): Promise<OutsourcingReceipt[]> {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.receiptRepo.find({
      where: { tenantId, ocId },
      order: { createdAt: 'DESC' },
    });
  }

  // ── 内部：回填 qms_ir_id ──────────────────────────────────────────────────

  async updateQmsIrId(
    tenantId: string,
    receiptId: string,
    qmsIrId: string,
  ): Promise<void> {
    await this.receiptRepo.update({ id: receiptId, tenantId }, { qmsIrId });
  }

  async updateStatus(
    tenantId: string,
    receiptId: string,
    status: OutsourcingReceiptStatus,
  ): Promise<void> {
    await this.receiptRepo.update({ id: receiptId, tenantId }, { status });
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

  private async getReceivedQtyForIssue(
    tenantId: string,
    issueId: string,
  ): Promise<number> {
    const result = await this.receiptRepo
      .createQueryBuilder('r')
      .select('SUM(r.receipt_qty)', 'total')
      .where('r.tenant_id = :tenantId', { tenantId })
      .andWhere('r.issue_id = :issueId', { issueId })
      .andWhere('r.status != :cancelled', { cancelled: 'CANCELLED' })
      .getRawOne<{ total: string }>();
    return Number(result?.total ?? 0);
  }
}
