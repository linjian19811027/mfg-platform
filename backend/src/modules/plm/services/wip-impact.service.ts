import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { PlmWipAssessment } from '../entities/plm-wip-assessment.entity.js';
import { PlmWipAssessmentItem } from '../entities/plm-wip-assessment-item.entity.js';
import { PlmEcnExecutionPlan } from '../entities/plm-ecn-execution-plan.entity.js';
import { PlmEcnExecutionPlanItem } from '../entities/plm-ecn-execution-plan-item.entity.js';
import {
  MESSAGE_SERVICE,
  MessageService,
} from '../../../shared/message/message.interface.js';

@Injectable()
export class WipImpactService {
  private readonly logger = new Logger('WipImpactService');

  constructor(
    @InjectRepository(PlmWipAssessment)
    private readonly assessmentRepo: Repository<PlmWipAssessment>,
    @InjectRepository(PlmWipAssessmentItem)
    private readonly itemRepo: Repository<PlmWipAssessmentItem>,
    @InjectRepository(PlmEcnExecutionPlan)
    private readonly planRepo: Repository<PlmEcnExecutionPlan>,
    @InjectRepository(PlmEcnExecutionPlanItem)
    private readonly planItemRepo: Repository<PlmEcnExecutionPlanItem>,
    private readonly dataSource: DataSource,
    @Inject(MESSAGE_SERVICE)
    private readonly messageSvc: MessageService,
  ) {}

  /**
   * 扫描在制工单（只读查 mes_work_order），生成 WipAssessment + items。
   * 若已存在评估则直接返回。
   */
  async assess(tenantId: string, planId: string): Promise<PlmWipAssessment> {
    // 幂等：已存在则返回
    const existing = await this.assessmentRepo.findOne({
      where: { planId, tenantId },
    });
    if (existing) return existing;

    const plan = await this.planRepo.findOne({
      where: { id: planId, tenantId },
    });
    if (!plan) throw new NotFoundException('PLM_EXECUTION_PLAN_NOT_FOUND');

    // 获取执行计划项，收集受影响的 BOM/Routing ID
    const planItems = await this.planItemRepo.find({
      where: { planId, tenantId },
    });
    const bomIds = planItems
      .filter((i) => i.itemType === 'BOM')
      .map((i) => i.objectId);
    const routingIds = planItems
      .filter((i) => i.itemType === 'ROUTING')
      .map((i) => i.objectId);

    // 只读查询 mes_work_order（跨模块只读，不注入 MES Service）
    let workOrders: Array<{
      id: string;
      wo_no: string;
      planned_qty: number;
      completed_qty: number;
      bom_id: string | null;
      routing_id: string | null;
    }> = [];

    if (bomIds.length > 0 || routingIds.length > 0) {
      const conditions: string[] = [];
      const params: unknown[] = [tenantId];

      if (bomIds.length > 0) {
        conditions.push(`bom_id IN (${bomIds.map(() => '?').join(',')})`);
        params.push(...bomIds);
      }
      if (routingIds.length > 0) {
        conditions.push(
          `routing_id IN (${routingIds.map(() => '?').join(',')})`,
        );
        params.push(...routingIds);
      }

      const whereClause =
        conditions.length > 0 ? `AND (${conditions.join(' OR ')})` : '';
      workOrders = await this.dataSource.query(
        `SELECT id, wo_no, planned_qty, completed_qty, bom_id, routing_id
         FROM mes_work_order
         WHERE tenant_id = ? AND status IN ('RELEASED','IN_PROGRESS') ${whereClause}`,
        params,
      );
    }

    // 创建评估汇总
    const assessment = await this.assessmentRepo.save(
      this.assessmentRepo.create({
        tenantId,
        planId,
        status: 'PENDING',
        totalWipCount: workOrders.length,
        continueOldCount: 0,
        switchNewCount: 0,
        suspendReviewCount: 0,
        estimatedImpactValue: 0,
      }),
    );

    let continueOld = 0;
    let switchNew = 0;
    let suspendReview = 0;

    // 创建评估明细
    const assessmentItems: PlmWipAssessmentItem[] = [];
    for (const wo of workOrders) {
      const plannedQty = Number(wo.planned_qty ?? 0);
      const completedQty = Number(wo.completed_qty ?? 0);
      const completionPct =
        plannedQty > 0 ? (completedQty / plannedQty) * 100 : 0;
      const suggestion = this.getSuggestion(completionPct);

      if (suggestion === 'CONTINUE_OLD') continueOld++;
      else if (suggestion === 'SWITCH_NEW') switchNew++;
      else suspendReview++;

      assessmentItems.push(
        this.itemRepo.create({
          tenantId,
          assessmentId: assessment.id,
          mesWoId: wo.id,
          woNo: wo.wo_no,
          completionPct: Math.round(completionPct * 100) / 100,
          suggestion,
        }),
      );
    }

    if (assessmentItems.length > 0) {
      await this.itemRepo.save(assessmentItems);
    }

    // 更新汇总计数
    await this.assessmentRepo.update(assessment.id, {
      continueOldCount: continueOld,
      switchNewCount: switchNew,
      suspendReviewCount: suspendReview,
    });

    // 若存在 SUSPEND_REVIEW 工单，发送通知给生产计划员
    if (suspendReview > 0) {
      const suspendWoNos = assessmentItems
        .filter((i) => i.suggestion === 'SUSPEND_REVIEW')
        .map((i) => i.woNo);

      await this.messageSvc
        .publish({
          eventId: uuidv4(),
          eventType: 'WIP_ASSESSMENT_SUSPEND_REVIEW',
          tenantId,
          sourceModule: 'PLM',
          targetModule: 'MES',
          payload: {
            planId,
            assessmentId: assessment.id,
            suspendWoNos,
            message: `ECN 执行计划 ${planId} 存在 ${suspendReview} 张工单需人工审核：${suspendWoNos.join(', ')}`,
          },
          createdAt: new Date(),
        })
        .catch((err) =>
          this.logger.warn(
            `Failed to publish WIP assessment notification: ${err}`,
          ),
        );
    }

    return {
      ...assessment,
      continueOldCount: continueOld,
      switchNewCount: switchNew,
      suspendReviewCount: suspendReview,
    };
  }

  /** 自动建议规则：>80%→CONTINUE_OLD, 0%→SWITCH_NEW, 其他→SUSPEND_REVIEW */
  getSuggestion(
    completionPct: number,
  ): 'CONTINUE_OLD' | 'SWITCH_NEW' | 'SUSPEND_REVIEW' {
    if (completionPct > 80) return 'CONTINUE_OLD';
    if (completionPct === 0) return 'SWITCH_NEW';
    return 'SUSPEND_REVIEW';
  }

  /** 人工覆盖建议 */
  async overrideSuggestion(
    tenantId: string,
    itemId: string,
    suggestion: 'CONTINUE_OLD' | 'SWITCH_NEW',
    reason: string,
    operatorId: string,
  ): Promise<PlmWipAssessmentItem> {
    const item = await this.itemRepo.findOne({
      where: { id: itemId, tenantId },
    });
    if (!item) throw new NotFoundException('PLM_WIP_ASSESSMENT_ITEM_NOT_FOUND');

    await this.itemRepo.update(itemId, {
      overrideSuggestion: suggestion,
      overrideBy: operatorId,
      overrideReason: reason,
      confirmedAt: new Date(),
    });

    // 更新汇总计数
    await this.recalcCounts(tenantId, item.assessmentId);

    return {
      ...item,
      overrideSuggestion: suggestion,
      overrideBy: operatorId,
      overrideReason: reason,
      confirmedAt: new Date(),
    };
  }

  /**
   * 确认评估：检查所有 SUSPEND_REVIEW 项均已人工确认，
   * 然后将 assessment.status = CONFIRMED。
   */
  async confirmAssessment(
    tenantId: string,
    assessmentId: string,
  ): Promise<PlmWipAssessment> {
    const assessment = await this.assessmentRepo.findOne({
      where: { id: assessmentId, tenantId },
    });
    if (!assessment)
      throw new NotFoundException('PLM_WIP_ASSESSMENT_NOT_FOUND');
    if (assessment.status === 'CONFIRMED') return assessment;

    // 检查是否还有未处理的 SUSPEND_REVIEW 项
    const unconfirmed = await this.itemRepo
      .createQueryBuilder('i')
      .where('i.assessment_id = :assessmentId', { assessmentId })
      .andWhere('i.suggestion = :s', { s: 'SUSPEND_REVIEW' })
      .andWhere('i.override_suggestion IS NULL')
      .getCount();

    if (unconfirmed > 0) {
      throw new BadRequestException(
        `PLM_WIP_ASSESSMENT_HAS_UNCONFIRMED: ${unconfirmed} 张工单尚未完成人工确认`,
      );
    }

    await this.assessmentRepo.update(assessmentId, { status: 'CONFIRMED' });
    return { ...assessment, status: 'CONFIRMED' };
  }

  /** 获取评估报告（含明细） */
  async getAssessment(
    tenantId: string,
    planId: string,
  ): Promise<(PlmWipAssessment & { items: PlmWipAssessmentItem[] }) | null> {
    const assessment = await this.assessmentRepo.findOne({
      where: { planId, tenantId },
    });
    if (!assessment) return null;
    const items = await this.itemRepo.find({
      where: { assessmentId: assessment.id, tenantId },
    });
    return { ...assessment, items };
  }

  /** 重新计算评估汇总计数 */
  private async recalcCounts(
    tenantId: string,
    assessmentId: string,
  ): Promise<void> {
    const items = await this.itemRepo.find({
      where: { assessmentId, tenantId },
    });

    let continueOld = 0;
    let switchNew = 0;
    let suspendReview = 0;

    for (const item of items) {
      const effective = item.overrideSuggestion ?? item.suggestion;
      if (effective === 'CONTINUE_OLD') continueOld++;
      else if (effective === 'SWITCH_NEW') switchNew++;
      else suspendReview++;
    }

    await this.assessmentRepo.update(assessmentId, {
      continueOldCount: continueOld,
      switchNewCount: switchNew,
      suspendReviewCount: suspendReview,
    });
  }
}
