import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { PlmEcr } from '../entities/plm-ecr.entity.js';
import { PlmEcn } from '../entities/plm-ecn.entity.js';
import { SysUser } from '../../auth/entities/sys-user.entity.js';
import { TenantContext } from '../../../shared/tenant/tenant.context.js';
import {
  MESSAGE_SERVICE,
  MessageService,
} from '../../../shared/message/message.interface.js';
import { EventTypes } from '../../event/event-types.constant.js';
import type { EcnExecutionService } from './ecn-execution.service.js';
import { sanitizeUpdateData } from '../../../shared/utils/sanitize.js';
import { NumberingService } from '../../base/services/numbering.service.js';

// ECR 状态流转
const ECR_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['APPROVED', 'REJECTED'],
  APPROVED: ['CLOSED'],
  REJECTED: ['DRAFT'], // 可退回修改
  CLOSED: [],
};

@Injectable()
export class ChangeService {
  constructor(
    @InjectRepository(PlmEcr)
    private readonly ecrRepo: Repository<PlmEcr>,
    @InjectRepository(PlmEcn)
    private readonly ecnRepo: Repository<PlmEcn>,
    @Inject(MESSAGE_SERVICE)
    private readonly messageSvc: MessageService,
    private readonly numberingSvc: NumberingService,
    @Optional()
    private readonly ecnExecutionSvc?: EcnExecutionService,
  ) {}

  // ── ECR ───────────────────────────────────────────────────────────────────

  async findAllEcr(
    status?: string,
    keyword?: string,
  ): Promise<{ list: PlmEcr[]; total: number }> {
    const tenantId = TenantContext.requireCurrentTenant();
    const qb = this.ecrRepo
      .createQueryBuilder('e')
      .where('e.tenant_id = :tenantId', { tenantId });

    if (status) qb.andWhere('e.status = :status', { status });
    if (keyword)
      qb.andWhere('(e.ecr_no LIKE :kw OR e.title LIKE :kw)', {
        kw: `%${keyword}%`,
      });

    qb.orderBy('e.created_at', 'DESC');
    const total = await qb.getCount();
    const list = await qb.getMany();
    return { list, total };
  }

  async findOneEcr(id: string): Promise<PlmEcr & { submittedByName?: string; approvedByName?: string }> {
    const tenantId = TenantContext.requireCurrentTenant();
    const ecr = await this.ecrRepo.findOne({ where: { id, tenantId } });
    if (!ecr) throw new NotFoundException('PLM_ECR_NOT_FOUND');

    // 补充提交人和审批人姓名
    const userIds: string[] = [];
    if (ecr.submittedBy) userIds.push(ecr.submittedBy);
    if (ecr.approvedBy) userIds.push(ecr.approvedBy);
    if (userIds.length > 0) {
      const users = await this.ecrRepo.manager.getRepository(SysUser).find({
        where: { id: In(userIds) },
      });
      const userMap = new Map(users.map((u) => [u.id, u.realName || u.username]));
      return {
        ...ecr,
        submittedByName: ecr.submittedBy ? userMap.get(ecr.submittedBy) : undefined,
        approvedByName: ecr.approvedBy ? userMap.get(ecr.approvedBy) : undefined,
      } as any;
    }

    return ecr;
  }

  async createEcr(data: Partial<PlmEcr>): Promise<PlmEcr> {
    const tenantId = TenantContext.requireCurrentTenant();
    data.tenantId = tenantId;
    data.status = 'DRAFT';
    // 确保必填 JSON 字段有默认值
    if (!data.affectedItems) data.affectedItems = [];
    if (!data.changeType) data.changeType = 'MATERIAL';

    // 自动生成 ECR 编号
    if (!data.ecrNo) {
      try {
        data.ecrNo = await this.numberingSvc.generate('PLM_ECR', tenantId, data);
      } catch (err) {
        // 如果没有配置规则，回退到默认逻辑
        const count = await this.ecrRepo.count({ where: { tenantId } });
        data.ecrNo = `ECR-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
      }
    }

    return this.ecrRepo.save(this.ecrRepo.create(data));
  }

  async updateEcr(id: string, data: Partial<PlmEcr>): Promise<PlmEcr> {
    const tenantId = TenantContext.requireCurrentTenant();
    const ecr = await this.ecrRepo.findOne({ where: { id, tenantId } });
    if (!ecr) throw new NotFoundException('PLM_ECR_NOT_FOUND');
    if (ecr.status !== 'DRAFT')
      throw new BadRequestException('PLM_ECR_NOT_EDITABLE');

    delete (data as any).status;
    await this.ecrRepo.update(id, sanitizeUpdateData(data) as any);
    return { ...ecr, ...data };
  }

  /** 审批操作：submit / approve / reject / close */
  async transitionEcr(
    id: string,
    action: 'submit' | 'approve' | 'reject' | 'close',
    operatorId: string,
  ): Promise<PlmEcr> {
    const tenantId = TenantContext.requireCurrentTenant();
    const ecr = await this.ecrRepo.findOne({ where: { id, tenantId } });
    if (!ecr) throw new NotFoundException('PLM_ECR_NOT_FOUND');

    const actionToStatus: Record<string, string> = {
      submit: 'SUBMITTED',
      approve: 'APPROVED',
      reject: 'REJECTED',
      close: 'CLOSED',
    };
    const newStatus = actionToStatus[action];
    const allowed = ECR_TRANSITIONS[ecr.status] ?? [];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `PLM_ECR_INVALID_TRANSITION:${ecr.status}->${newStatus}`,
      );
    }

    const update: Partial<PlmEcr> = { status: newStatus };
    if (action === 'submit') {
      update.submittedBy = operatorId;
      update.submittedAt = new Date();
    }
    if (action === 'approve') {
      update.approvedBy = operatorId;
      update.approvedAt = new Date();
    }

    await this.ecrRepo.update(id, update as any);
    return { ...ecr, ...update };
  }

  // ── ECN ───────────────────────────────────────────────────────────────────

  async findAllEcn(ecrId?: string): Promise<PlmEcn[]> {
    const tenantId = TenantContext.requireCurrentTenant();
    const where: any = { tenantId };
    if (ecrId) where.ecrId = ecrId;
    return this.ecnRepo.find({ where, order: { issuedAt: 'DESC' } });
  }

  async findOneEcn(id: string): Promise<PlmEcn> {
    const tenantId = TenantContext.requireCurrentTenant();
    const ecn = await this.ecnRepo.findOne({ where: { id, tenantId } });
    if (!ecn) throw new NotFoundException('PLM_ECN_NOT_FOUND');
    return ecn;
  }

  /** 从已审批的 ECR 签发 ECN，并自动推送变更事件 */
  async issueEcn(data: Partial<PlmEcn>, issuedBy: string): Promise<PlmEcn> {
    const tenantId = TenantContext.requireCurrentTenant();
    data.tenantId = tenantId;
    data.status = 'ISSUED';
    data.issuedBy = issuedBy;
    // 确保必填 JSON 字段有默认值
    if (!data.changeItems) data.changeItems = [];

    // 校验 ECR 已审批
    const ecr = await this.ecrRepo.findOne({
      where: { id: data.ecrId!, tenantId },
    });
    if (!ecr) throw new NotFoundException('PLM_ECR_NOT_FOUND');
    if (ecr.status !== 'APPROVED')
      throw new BadRequestException('PLM_ECR_NOT_APPROVED');

    // 自动生成 ECN 编号
    if (!data.ecnNo) {
      try {
        data.ecnNo = await this.numberingSvc.generate('PLM_ECN', tenantId, data);
      } catch (err) {
        // 如果没有配置规则，回退到默认逻辑
        const count = await this.ecnRepo.count({ where: { tenantId } });
        data.ecnNo = `ECN-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
      }
    }

    const ecn = await this.ecnRepo.save(this.ecnRepo.create(data));

    // 根据变更类型推送对应事件
    await this.publishChangeEvents(ecr, ecn, tenantId);

    // 触发 ECN 执行联动（自动生成执行计划）
    if (this.ecnExecutionSvc) {
      this.ecnExecutionSvc.onEcnIssued(tenantId, ecn.id).catch((err) => {
        // 非阻塞：执行计划生成失败不影响 ECN 签发
        console.error(
          `[ChangeService] onEcnIssued failed for ECN ${ecn.id}: ${err}`,
        );
      });
    }

    return ecn;
  }

  async completeEcn(id: string): Promise<PlmEcn> {
    const tenantId = TenantContext.requireCurrentTenant();
    const ecn = await this.ecnRepo.findOne({ where: { id, tenantId } });
    if (!ecn) throw new NotFoundException('PLM_ECN_NOT_FOUND');
    if (ecn.status === 'COMPLETED')
      throw new BadRequestException('PLM_ECN_ALREADY_COMPLETED');

    await this.ecnRepo.update(id, {
      status: 'COMPLETED',
      completedAt: new Date(),
    });
    return { ...ecn, status: 'COMPLETED', completedAt: new Date() };
  }

  /** 变更历史查询（完整审计 trail） */
  async getChangeHistory(
    refType: 'ECR' | 'ECN',
    refId: string,
  ): Promise<PlmEcr | PlmEcn | null> {
    const tenantId = TenantContext.requireCurrentTenant();
    if (refType === 'ECR')
      return this.ecrRepo.findOne({ where: { id: refId, tenantId } });
    return this.ecnRepo.findOne({ where: { id: refId, tenantId } });
  }

  // ── 私有：推送变更事件 ────────────────────────────────────────────────────

  private async publishChangeEvents(
    ecr: PlmEcr,
    ecn: PlmEcn,
    tenantId: string,
  ): Promise<void> {
    const modules = ecn.notifyModules ?? [];
    const basePayload = {
      ecnId: ecn.id,
      ecnNo: ecn.ecnNo,
      ecrId: ecr.id,
      changeType: ecr.changeType,
      affectedItems: ecr.affectedItems,
      effectiveDate: ecn.effectiveDate,
    };

    if (ecr.changeType === 'BOM' || modules.includes('MES')) {
      await this.messageSvc.publish({
        eventId: uuidv4(),
        eventType: EventTypes.BOM_REVISED,
        tenantId,
        sourceModule: 'PLM',
        targetModule: 'MES',
        payload: basePayload,
        createdAt: new Date(),
      });
    }

    if (ecr.changeType === 'ROUTING' || modules.includes('MES')) {
      await this.messageSvc.publish({
        eventId: uuidv4(),
        eventType: EventTypes.ROUTING_REVISED,
        tenantId,
        sourceModule: 'PLM',
        targetModule: 'MES',
        payload: basePayload,
        createdAt: new Date(),
      });
    }
  }
}
