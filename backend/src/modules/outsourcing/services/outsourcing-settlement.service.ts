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
  OutsourcingSettlement,
  OutsourcingSettlementStatus,
} from '../entities/outsourcing-settlement.entity.js';
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

export interface CreateSettlementDto {
  settleQty: number;
  settleDate: Date;
  currency?: string;
  createdBy: string;
}

@Injectable()
export class OutsourcingSettlementService {
  constructor(
    @InjectRepository(OutsourcingSettlement)
    private readonly settlementRepo: Repository<OutsourcingSettlement>,
    @InjectRepository(OutsourcingOrder)
    private readonly orderRepo: Repository<OutsourcingOrder>,
    private readonly orderSvc: OutsourcingOrderService,
    @Inject(MESSAGE_SERVICE)
    private readonly messageSvc: MessageService,
  ) {}

  // ── 创建结算单 ────────────────────────────────────────────────────────────

  async create(
    ocId: string,
    dto: CreateSettlementDto,
  ): Promise<OutsourcingSettlement> {
    const tenantId = TenantContext.requireCurrentTenant();
    const order = await this.findOrderOrFail(tenantId, ocId);

    const allowedStatuses = [
      OutsourcingOrderStatus.RECEIVED,
      OutsourcingOrderStatus.PARTIAL_RECEIVED,
      OutsourcingOrderStatus.INSPECTING,
    ];
    if (
      !allowedStatuses.includes(order.status) &&
      Number(order.inspectedQty) <= 0
    ) {
      throw new BadRequestException(
        `外协工单状态 ${order.status} 或已检验合格数量为 0，不允许创建结算单`,
      );
    }

    // 校验累计结算不超合格数量
    const totalSettled = await this.getTotalSettledQty(tenantId, ocId);
    const maxSettleable = Number(order.inspectedQty);
    if (totalSettled + dto.settleQty > maxSettleable) {
      throw new BadRequestException(
        `结算数量超出已检验合格数量，已检验合格 ${maxSettleable}，已结算 ${totalSettled}，可结算 ${maxSettleable - totalSettled}`,
      );
    }

    // 计算金额：含税金额 = 结算数量 × 含税单价
    const amountWithTax = Number(
      (dto.settleQty * Number(order.unitPrice)).toFixed(4),
    );
    const taxRate = Number(order.taxRate);
    // 税额 = 含税金额 × 税率 / (1 + 税率)
    const taxAmount = Number(
      ((amountWithTax * taxRate) / (1 + taxRate)).toFixed(4),
    );
    const amountWithoutTax = Number((amountWithTax - taxAmount).toFixed(4));

    const settlement = await this.settlementRepo.save(
      this.settlementRepo.create({
        tenantId,
        ocId,
        settleQty: dto.settleQty,
        taxAmount,
        amountWithTax,
        amountWithoutTax,
        taxRate,
        currency: dto.currency ?? order.currency,
        settleDate: dto.settleDate,
        status: OutsourcingSettlementStatus.DRAFT,
      }),
    );

    await this.orderSvc.writeLog(
      tenantId,
      ocId,
      'SETTLEMENT_CREATED',
      undefined,
      undefined,
      dto.createdBy,
    );
    return settlement;
  }

  // ── 审核结算单 ────────────────────────────────────────────────────────────

  async approve(
    settlementId: string,
    approvedBy: string,
  ): Promise<OutsourcingSettlement> {
    const tenantId = TenantContext.requireCurrentTenant();
    const settlement = await this.settlementRepo.findOne({
      where: { id: settlementId, tenantId },
    });
    if (!settlement)
      throw new NotFoundException(`结算单 ${settlementId} 不存在`);
    if (settlement.status !== OutsourcingSettlementStatus.DRAFT) {
      throw new BadRequestException(
        `结算单状态 ${settlement.status} 不允许审核`,
      );
    }

    const order = await this.findOrderOrFail(tenantId, settlement.ocId);

    const updated = await this.settlementRepo.save({
      ...settlement,
      status: OutsourcingSettlementStatus.APPROVED,
      approvedBy,
      approvedAt: new Date(),
    });

    // 累加工单已结算数量
    await this.orderSvc.incrementSettledQty(
      tenantId,
      settlement.ocId,
      Number(settlement.settleQty),
    );

    // 记录操作日志
    await this.orderSvc.writeLog(
      tenantId,
      settlement.ocId,
      'SETTLEMENT_APPROVED',
      undefined,
      undefined,
      approvedBy,
    );

    // 发布事件 → SCM 创建应付账款
    await this.messageSvc.publish({
      eventId: uuidv4(),
      eventType: EventTypes.OUTSOURCING_SETTLEMENT_APPROVED,
      tenantId,
      sourceModule: 'OUTSOURCING',
      targetModule: 'SCM',
      payload: {
        ocId: settlement.ocId,
        settlementId: settlement.id,
        supplierId: order.supplierId,
        amount: Number(settlement.amountWithTax),
        taxAmount: Number(settlement.taxAmount),
        amountWithoutTax: Number(settlement.amountWithoutTax),
        currency: settlement.currency,
        approvedBy,
      },
      createdAt: new Date(),
    });

    return updated;
  }

  // ── 查询结算单列表 ────────────────────────────────────────────────────────

  async findByOcId(ocId: string): Promise<OutsourcingSettlement[]> {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.settlementRepo.find({
      where: { tenantId, ocId },
      order: { createdAt: 'DESC' },
    });
  }

  // ── 内部：回填 scm_payable_id ─────────────────────────────────────────────

  async updatePayableId(
    tenantId: string,
    settlementId: string,
    scmPayableId: string,
  ): Promise<void> {
    await this.settlementRepo.update(
      { id: settlementId, tenantId },
      { scmPayableId },
    );
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

  private async getTotalSettledQty(
    tenantId: string,
    ocId: string,
  ): Promise<number> {
    const result = await this.settlementRepo
      .createQueryBuilder('s')
      .select('SUM(s.settle_qty)', 'total')
      .where('s.tenant_id = :tenantId', { tenantId })
      .andWhere('s.oc_id = :ocId', { ocId })
      .andWhere('s.status != :cancelled', {
        cancelled: OutsourcingSettlementStatus.CANCELLED,
      })
      .getRawOne<{ total: string }>();
    return Number(result?.total ?? 0);
  }
}
