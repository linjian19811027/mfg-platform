import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { v4 as uuidv4 } from 'uuid';
import { PlmEcnExecutionPlan } from '../entities/plm-ecn-execution-plan.entity.js';
import { PlmEcnExecutionPlanItem } from '../entities/plm-ecn-execution-plan-item.entity.js';
import { PlmEcnExecutionLog } from '../entities/plm-ecn-execution-log.entity.js';
import { PlmWipAssessment } from '../entities/plm-wip-assessment.entity.js';
import { PlmEcn } from '../entities/plm-ecn.entity.js';
import { PlmBom } from '../entities/plm-bom.entity.js';
import { PlmRouting } from '../entities/plm-routing.entity.js';
import { BomService } from './bom.service.js';
import { RoutingService } from './routing.service.js';
import { WipImpactService } from './wip-impact.service.js';
import {
  MESSAGE_SERVICE,
  MessageService,
} from '../../../shared/message/message.interface.js';
import { EventTypes } from '../../event/event-types.constant.js';

export interface ExecutionPlanQuery {
  status?: string;
  ecnNo?: string;
  effectiveDateFrom?: string;
  effectiveDateTo?: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class EcnExecutionService {
  private readonly logger = new Logger('EcnExecutionService');

  constructor(
    @InjectRepository(PlmEcnExecutionPlan)
    private readonly planRepo: Repository<PlmEcnExecutionPlan>,
    @InjectRepository(PlmEcnExecutionPlanItem)
    private readonly planItemRepo: Repository<PlmEcnExecutionPlanItem>,
    @InjectRepository(PlmEcnExecutionLog)
    private readonly logRepo: Repository<PlmEcnExecutionLog>,
    @InjectRepository(PlmWipAssessment)
    private readonly assessmentRepo: Repository<PlmWipAssessment>,
    @InjectRepository(PlmEcn)
    private readonly ecnRepo: Repository<PlmEcn>,
    @InjectRepository(PlmBom)
    private readonly bomRepo: Repository<PlmBom>,
    @InjectRepository(PlmRouting)
    private readonly routingRepo: Repository<PlmRouting>,
    private readonly bomSvc: BomService,
    private readonly routingSvc: RoutingService,
    private readonly wipSvc: WipImpactService,
    @Inject(MESSAGE_SERVICE)
    private readonly messageSvc: MessageService,
  ) {}

  // ── 3.1.1 ECN 签发时自动触发 ─────────────────────────────────────────────

  async onEcnIssued(tenantId: string, ecnId: string): Promise<void> {
    const ecn = await this.ecnRepo.findOne({ where: { id: ecnId, tenantId } });
    if (!ecn) throw new NotFoundException('PLM_ECN_NOT_FOUND');

    const plan = await this.createExecutionPlan(tenantId, ecn);

    // 触发在制工单影响评估
    await this.wipSvc.assess(tenantId, plan.id).catch((err) => {
      this.logger.warn(`WIP assessment failed for plan ${plan.id}: ${err}`);
    });

    // 通知 ECN 负责工程师
    const items = await this.planItemRepo.find({
      where: { planId: plan.id, tenantId },
    });
    const bomCount = items.filter((i) => i.itemType === 'BOM').length;
    const routingCount = items.filter((i) => i.itemType === 'ROUTING').length;

    await this.messageSvc
      .publish({
        eventId: uuidv4(),
        eventType: 'ECN_EXECUTION_PLAN_CREATED',
        tenantId,
        sourceModule: 'PLM',
        payload: {
          planId: plan.id,
          planNo: plan.planNo,
          ecnId,
          ecnNo: ecn.ecnNo,
          bomCount,
          routingCount,
          message: `ECN ${ecn.ecnNo} 执行计划已生成：${plan.planNo}，影响 BOM ${bomCount} 个，工艺路线 ${routingCount} 个`,
          notifyUserId: ecn.issuedBy,
        },
        createdAt: new Date(),
      })
      .catch((err) =>
        this.logger.warn(`Failed to notify ECN engineer: ${err}`),
      );
  }

  // ── 3.1.2 解析 ECN 变更内容，生成 ExecutionPlan + Items ──────────────────

  private async createExecutionPlan(
    tenantId: string,
    ecn: PlmEcn,
  ): Promise<PlmEcnExecutionPlan> {
    // 生成计划编号 EP-{ECN编号}-{4位序号}
    const count = await this.planRepo.count({ where: { tenantId } });
    const planNo = `EP-${ecn.ecnNo}-${String(count + 1).padStart(4, '0')}`;

    const effectiveDate = ecn.effectiveDate
      ? new Date(ecn.effectiveDate)
      : new Date();

    const plan = await this.planRepo.save(
      this.planRepo.create({
        tenantId,
        planNo,
        ecnId: ecn.id,
        effectiveDate,
        status: 'PENDING',
      }),
    );

    await this.writeLog(
      tenantId,
      plan.id,
      'STATUS_CHANGE',
      undefined,
      'PENDING',
      undefined,
      undefined,
      `ECN ${ecn.ecnNo} 签发，自动生成执行计划 ${planNo}`,
    );

    // 解析 ECN changeItems，识别受影响物料/产品
    const changeItems: Record<string, unknown>[] = Array.isArray(
      ecn.changeItems,
    )
      ? ecn.changeItems
      : [];
    const planItems: Partial<PlmEcnExecutionPlanItem>[] = [];

    for (const item of changeItems) {
      const changeType = String(item['changeType'] ?? item['type'] ?? '');
      const materialId = item['materialId']
        ? String(item['materialId'])
        : undefined;
      const productId = item['productId']
        ? String(item['productId'])
        : undefined;
      const targetId = materialId ?? productId;

      if (!targetId) continue;

      if (changeType === 'BOM' || changeType === 'MATERIAL') {
        // 查找该物料当前 ACTIVE BOM
        const activeBom = await this.bomRepo.findOne({
          where: { tenantId, materialId: targetId, status: 'ACTIVE' } as any,
          order: { version: 'DESC' },
        });
        if (activeBom) {
          planItems.push({
            tenantId,
            planId: plan.id,
            itemType: 'BOM',
            objectId: activeBom.id,
            objectCode: String(item['materialCode'] ?? targetId),
            currentVersion: String(activeBom.version),
            status: 'PENDING',
          });
        }
      }

      if (changeType === 'ROUTING' || changeType === 'MATERIAL') {
        // 查找该物料当前 ACTIVE 工艺路线
        const activeRouting = await this.routingRepo.findOne({
          where: { tenantId, materialId: targetId, status: 'ACTIVE' } as any,
          order: { version: 'DESC' },
        });
        if (activeRouting) {
          planItems.push({
            tenantId,
            planId: plan.id,
            itemType: 'ROUTING',
            objectId: activeRouting.id,
            objectCode: activeRouting.code ?? String(targetId),
            currentVersion: String(activeRouting.version),
            status: 'PENDING',
          });
        }
      }
    }

    if (planItems.length > 0) {
      await this.planItemRepo.save(
        planItems.map((i) => this.planItemRepo.create(i)),
      );
    } else {
      // 无需变更，直接完成
      await this.planRepo.update(plan.id, {
        status: 'COMPLETED',
        completedAt: new Date(),
      });
      await this.writeLog(
        tenantId,
        plan.id,
        'STATUS_CHANGE',
        'PENDING',
        'COMPLETED',
        undefined,
        undefined,
        'ECN 中未包含可识别的受影响物料或产品，无需变更',
      );
    }

    return plan;
  }

  // ── 3.1.3 执行计划 ────────────────────────────────────────────────────────

  async executePlan(
    tenantId: string,
    planId: string,
    triggerType: 'SCHEDULED' | 'MANUAL',
  ): Promise<void> {
    const plan = await this.planRepo.findOne({
      where: { id: planId, tenantId },
    });
    if (!plan) throw new NotFoundException('PLM_EXECUTION_PLAN_NOT_FOUND');
    if (plan.status !== 'PENDING') {
      throw new BadRequestException(
        `PLM_EXECUTION_PLAN_INVALID_STATUS: ${plan.status}`,
      );
    }

    // 更新为 IN_PROGRESS
    await this.planRepo.update(planId, {
      status: 'IN_PROGRESS',
      triggerType,
      triggeredAt: new Date(),
    });
    await this.writeLog(
      tenantId,
      planId,
      'TRIGGERED',
      'PENDING',
      'IN_PROGRESS',
      undefined,
      triggerType,
      `计划开始执行，触发方式：${triggerType}`,
    );

    const items = await this.planItemRepo.find({ where: { planId, tenantId } });
    const ecn = await this.ecnRepo.findOne({
      where: { id: plan.ecnId, tenantId },
    });
    const ecnChanges: Record<string, unknown>[] = Array.isArray(
      ecn?.changeItems,
    )
      ? ecn.changeItems
      : [];

    let hasFailure = false;
    const affectedWos: Record<string, unknown>[] = [];

    for (const item of items) {
      if (item.status === 'COMPLETED') continue; // 跳过已完成项（重试场景）

      await this.planItemRepo.update(item.id, {
        startedAt: new Date(),
        status: 'PENDING',
      });

      try {
        let newVersion: string;

        if (item.itemType === 'BOM') {
          const bomChanges = ecnChanges
            .filter(
              (c) =>
                String(c['materialId'] ?? '') === item.objectCode ||
                String(c['changeType']) === 'BOM',
            )
            .map((c) => ({
              action: String(c['action'] ?? 'MODIFY') as
                | 'ADD'
                | 'REMOVE'
                | 'MODIFY',
              materialId: c['componentMaterialId']
                ? String(c['componentMaterialId'])
                : undefined,
              quantity: c['quantity'] ? Number(c['quantity']) : undefined,
              uomId: c['uomId'] ? String(c['uomId']) : undefined,
              lossRate: c['lossRate'] ? Number(c['lossRate']) : undefined,
            }));

          const newBom = await this.bomSvc.cloneAndApply(
            tenantId,
            item.objectId,
            bomChanges,
            ecn?.ecnNo,
          );
          newVersion = String(newBom.version);

          // 收集受影响工单（用于 ECN_EXECUTED 事件）
          const wipItems = await this.wipSvc.getAssessment(tenantId, planId);
          if (wipItems) {
            for (const wipItem of wipItems.items) {
              const effective =
                wipItem.overrideSuggestion ?? wipItem.suggestion;
              affectedWos.push({
                woId: wipItem.mesWoId,
                suggestion: effective,
                newBomId: newBom.id,
              });
            }
          }
        } else {
          const routingChanges = ecnChanges
            .filter((c) => String(c['changeType']) === 'ROUTING')
            .map((c) => ({
              action: String(c['action'] ?? 'MODIFY') as
                | 'ADD'
                | 'REMOVE'
                | 'MODIFY',
              operationCode: c['operationCode']
                ? String(c['operationCode'])
                : undefined,
              operationName: c['operationName']
                ? String(c['operationName'])
                : undefined,
              workCenterId: c['workCenterId']
                ? String(c['workCenterId'])
                : undefined,
              stdHours: c['stdHours'] ? Number(c['stdHours']) : undefined,
            }));

          const newRouting = await this.routingSvc.cloneAndApply(
            tenantId,
            item.objectId,
            routingChanges,
            ecn?.ecnNo,
          );
          newVersion = String(newRouting.version);

          const wipItems = await this.wipSvc.getAssessment(tenantId, planId);
          if (wipItems) {
            for (const wipItem of wipItems.items) {
              const effective =
                wipItem.overrideSuggestion ?? wipItem.suggestion;
              const existing = affectedWos.find(
                (w) => w['woId'] === wipItem.mesWoId,
              );
              if (existing) {
                (existing as any)['newRoutingId'] = newRouting.id;
              } else {
                affectedWos.push({
                  woId: wipItem.mesWoId,
                  suggestion: effective,
                  newRoutingId: newRouting.id,
                });
              }
            }
          }
        }

        await this.planItemRepo.update(item.id, {
          status: 'COMPLETED',
          newVersion,
          completedAt: new Date(),
        });
        await this.writeLog(
          tenantId,
          planId,
          'ITEM_EXECUTED',
          undefined,
          undefined,
          undefined,
          triggerType,
          `${item.itemType} ${item.objectCode} 执行完成，新版本：${newVersion}`,
        );
      } catch (err) {
        hasFailure = true;
        const errorMsg = err instanceof Error ? err.message : String(err);
        await this.planItemRepo.update(item.id, {
          status: 'FAILED',
          errorMessage: errorMsg,
          completedAt: new Date(),
        });
        await this.writeLog(
          tenantId,
          planId,
          'ITEM_EXECUTED',
          undefined,
          undefined,
          undefined,
          triggerType,
          `${item.itemType} ${item.objectCode} 执行失败：${errorMsg}`,
        );
        this.logger.error(`Plan item ${item.id} failed: ${errorMsg}`);
      }
    }

    const finalStatus = hasFailure ? 'FAILED' : 'COMPLETED';
    const now = new Date();
    await this.planRepo.update(planId, {
      status: finalStatus,
      completedAt: now,
    });
    await this.writeLog(
      tenantId,
      planId,
      'STATUS_CHANGE',
      'IN_PROGRESS',
      finalStatus,
      undefined,
      triggerType,
      hasFailure
        ? '部分执行项失败，计划状态置为 FAILED'
        : '所有执行项完成，计划状态置为 COMPLETED',
    );

    // 3.1.9 执行完成后发布 ECN_EXECUTED 事件
    if (!hasFailure) {
      await this.messageSvc
        .publish({
          eventId: uuidv4(),
          eventType: EventTypes.ECN_EXECUTED,
          tenantId,
          sourceModule: 'PLM',
          targetModule: 'MES',
          payload: {
            ecnId: plan.ecnId,
            planId,
            affectedWos,
          },
          createdAt: new Date(),
        })
        .catch((err) =>
          this.logger.error(`Failed to publish ECN_EXECUTED: ${err}`),
        );
    }
  }

  // ── 3.1.4 手动触发 ────────────────────────────────────────────────────────

  async triggerManually(
    tenantId: string,
    planId: string,
    operatorId: string,
  ): Promise<void> {
    const plan = await this.planRepo.findOne({
      where: { id: planId, tenantId },
    });
    if (!plan) throw new NotFoundException('PLM_EXECUTION_PLAN_NOT_FOUND');
    if (plan.status !== 'PENDING') {
      throw new BadRequestException(
        `PLM_EXECUTION_PLAN_INVALID_STATUS: ${plan.status}`,
      );
    }

    // 检查评估是否已确认
    const assessment = await this.assessmentRepo.findOne({
      where: { planId, tenantId },
    });
    if (assessment && assessment.status !== 'CONFIRMED') {
      throw new BadRequestException('PLM_WIP_ASSESSMENT_NOT_CONFIRMED');
    }

    await this.writeLog(
      tenantId,
      planId,
      'TRIGGERED',
      undefined,
      undefined,
      operatorId,
      'MANUAL',
      `操作人 ${operatorId} 手动触发执行`,
    );

    await this.executePlan(tenantId, planId, 'MANUAL');
  }

  // ── 3.1.5 重试失败项 ──────────────────────────────────────────────────────

  async retryFailedItems(tenantId: string, planId: string): Promise<void> {
    const plan = await this.planRepo.findOne({
      where: { id: planId, tenantId },
    });
    if (!plan) throw new NotFoundException('PLM_EXECUTION_PLAN_NOT_FOUND');
    if (plan.status !== 'FAILED') {
      throw new BadRequestException('PLM_EXECUTION_PLAN_NOT_FAILED');
    }

    // 将 FAILED 项重置为 PENDING，COMPLETED 项保持不变
    await this.planItemRepo
      .createQueryBuilder()
      .update(PlmEcnExecutionPlanItem)
      .set({
        status: 'PENDING',
        errorMessage: undefined,
        startedAt: undefined,
        completedAt: undefined,
      })
      .where(
        'plan_id = :planId AND tenant_id = :tenantId AND status = :status',
        {
          planId,
          tenantId,
          status: 'FAILED',
        },
      )
      .execute();

    // 重置计划状态为 PENDING 以允许重新执行
    await this.planRepo.update(planId, {
      status: 'PENDING',
      completedAt: undefined,
    });
    await this.writeLog(
      tenantId,
      planId,
      'STATUS_CHANGE',
      'FAILED',
      'PENDING',
      undefined,
      undefined,
      '重试失败项，计划状态重置为 PENDING',
    );

    await this.executePlan(tenantId, planId, 'MANUAL');
  }

  // ── 3.1.6 修改生效日期 ────────────────────────────────────────────────────

  async updateEffectiveDate(
    tenantId: string,
    planId: string,
    newDate: Date,
    operatorId: string,
  ): Promise<PlmEcnExecutionPlan> {
    const plan = await this.planRepo.findOne({
      where: { id: planId, tenantId },
    });
    if (!plan) throw new NotFoundException('PLM_EXECUTION_PLAN_NOT_FOUND');
    if (plan.status !== 'PENDING') {
      throw new BadRequestException('PLM_EXECUTION_PLAN_NOT_PENDING');
    }

    const now = new Date();
    if (newDate < now) {
      throw new BadRequestException(
        'PLM_EFFECTIVE_DATE_CANNOT_BE_PAST: 生效日期不能早于当前时间',
      );
    }

    const oldDate = plan.effectiveDate;
    await this.planRepo.update(planId, { effectiveDate: newDate });
    await this.writeLog(
      tenantId,
      planId,
      'DATE_UPDATED',
      undefined,
      undefined,
      operatorId,
      undefined,
      `生效日期从 ${oldDate.toISOString()} 修改为 ${newDate.toISOString()}`,
    );

    return { ...plan, effectiveDate: newDate };
  }

  // ── 3.1.7 取消执行计划 ────────────────────────────────────────────────────

  async cancel(
    tenantId: string,
    planId: string,
    operatorId: string,
  ): Promise<PlmEcnExecutionPlan> {
    const plan = await this.planRepo.findOne({
      where: { id: planId, tenantId },
    });
    if (!plan) throw new NotFoundException('PLM_EXECUTION_PLAN_NOT_FOUND');
    if (!['PENDING', 'FAILED'].includes(plan.status)) {
      throw new BadRequestException(
        `PLM_EXECUTION_PLAN_CANNOT_CANCEL: ${plan.status}`,
      );
    }

    await this.planRepo.update(planId, { status: 'CANCELLED' });
    await this.writeLog(
      tenantId,
      planId,
      'STATUS_CHANGE',
      plan.status,
      'CANCELLED',
      operatorId,
      undefined,
      `操作人 ${operatorId} 取消执行计划`,
    );

    return { ...plan, status: 'CANCELLED' };
  }

  // ── 3.1.8 定时检查到期计划 ────────────────────────────────────────────────

  @Cron('*/5 * * * *')
  async checkScheduledPlans(): Promise<void> {
    this.logger.debug('Checking scheduled ECN execution plans...');
    try {
      const plans = await this.planRepo.find({
        where: {
          status: 'PENDING',
          effectiveDate: LessThanOrEqual(new Date()),
        },
      });

      for (const plan of plans) {
        try {
          const assessment = await this.assessmentRepo.findOne({
            where: { planId: plan.id, tenantId: plan.tenantId },
          });

          // 无评估（无在制工单）或评估已确认，则执行
          if (!assessment || assessment.status === 'CONFIRMED') {
            this.logger.log(`Auto-triggering plan ${plan.planNo} (${plan.id})`);
            await this.executePlan(plan.tenantId, plan.id, 'SCHEDULED');
          }
        } catch (err) {
          this.logger.error(`Failed to execute plan ${plan.id}: ${err}`);
        }
      }
    } catch (err) {
      this.logger.error(`checkScheduledPlans error: ${err}`);
    }
  }

  // ── 查询 ──────────────────────────────────────────────────────────────────

  async findAll(
    query: ExecutionPlanQuery,
  ): Promise<{ list: PlmEcnExecutionPlan[]; total: number }> {
    const {
      status,
      ecnNo,
      effectiveDateFrom,
      effectiveDateTo,
      page = 1,
      pageSize = 20,
    } = query;

    const qb = this.planRepo.createQueryBuilder('p');

    if (status) qb.andWhere('p.status = :status', { status });
    if (effectiveDateFrom)
      qb.andWhere('p.effective_date >= :from', { from: effectiveDateFrom });
    if (effectiveDateTo)
      qb.andWhere('p.effective_date <= :to', { to: effectiveDateTo });

    if (ecnNo) {
      qb.innerJoin(PlmEcn, 'ecn', 'ecn.id = p.ecn_id').andWhere(
        'ecn.ecn_no LIKE :ecnNo',
        { ecnNo: `%${ecnNo}%` },
      );
    }

    qb.orderBy('p.created_at', 'DESC');
    const total = await qb.getCount();
    const list = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();
    return { list, total };
  }

  async findOne(
    id: string,
    tenantId: string,
  ): Promise<Record<string, unknown>> {
    const plan = await this.planRepo.findOne({ where: { id, tenantId } });
    if (!plan) throw new NotFoundException('PLM_EXECUTION_PLAN_NOT_FOUND');

    const [items, assessment, logs] = await Promise.all([
      this.planItemRepo.find({
        where: { planId: id, tenantId },
        order: { createdAt: 'ASC' },
      }),
      this.wipSvc.getAssessment(tenantId, id),
      this.logRepo.find({
        where: { planId: id, tenantId },
        order: { createdAt: 'ASC' },
      }),
    ]);

    return { ...plan, items, assessment, logs };
  }

  // ── 私有：写入执行日志 ────────────────────────────────────────────────────

  private async writeLog(
    tenantId: string,
    planId: string,
    action: string,
    fromStatus?: string,
    toStatus?: string,
    operatorId?: string,
    triggerType?: string,
    detail?: string,
  ): Promise<void> {
    await this.logRepo.save(
      this.logRepo.create({
        tenantId,
        planId,
        action,
        fromStatus,
        toStatus,
        operatorId,
        triggerType: triggerType as any,
        detail,
      }),
    );
  }
}
