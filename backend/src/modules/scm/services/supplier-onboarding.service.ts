import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ScmSupplierOnboarding,
  OnboardingStage,
} from '../entities/scm-supplier-onboarding.entity.js';
import { ScmSupplier } from '../entities/scm-supplier.entity.js';

const STAGE_ORDER: OnboardingStage[] = [
  OnboardingStage.QUALIFICATION_REVIEW,
  OnboardingStage.SITE_AUDIT,
  OnboardingStage.SAMPLE_TEST,
  OnboardingStage.PILOT_RUN,
];

export interface ApprovalRecord {
  stage: string;
  action: 'PASS' | 'REJECT';
  approverId: string;
  remarks?: string;
  timestamp: string;
}

@Injectable()
export class SupplierOnboardingService {
  constructor(
    @InjectRepository(ScmSupplierOnboarding)
    private readonly onboardingRepo: Repository<ScmSupplierOnboarding>,
    @InjectRepository(ScmSupplier)
    private readonly supplierRepo: Repository<ScmSupplier>,
  ) {}

  /**
   * 发起供应商准入流程，初始阶段为 QUALIFICATION_REVIEW
   */
  async initiate(
    tenantId: string,
    supplierId: string,
    initiatorId: string,
  ): Promise<ScmSupplierOnboarding> {
    // 确认供应商存在
    const supplier = await this.supplierRepo.findOne({
      where: { id: supplierId, tenantId },
    });
    if (!supplier) {
      throw new NotFoundException(`供应商 ${supplierId} 不存在`);
    }

    const record: ApprovalRecord = {
      stage: OnboardingStage.QUALIFICATION_REVIEW,
      action: 'PASS',
      approverId: initiatorId,
      remarks: '发起准入流程',
      timestamp: new Date().toISOString(),
    };

    const onboarding = this.onboardingRepo.create({
      tenantId,
      supplierId,
      stage: OnboardingStage.QUALIFICATION_REVIEW,
      stageData: [record],
      currentApproverId: initiatorId,
    });

    return this.onboardingRepo.save(onboarding);
  }

  /**
   * 推进准入流程：PASS 进入下一阶段，REJECT 直接拒绝
   */
  async advance(
    tenantId: string,
    onboardingId: string,
    approverId: string,
    result: 'PASS' | 'REJECT',
    remarks?: string,
  ): Promise<ScmSupplierOnboarding> {
    const onboarding = await this.findOne(tenantId, onboardingId);

    // 终态不可再操作
    if (
      onboarding.stage === OnboardingStage.APPROVED ||
      onboarding.stage === OnboardingStage.REJECTED
    ) {
      throw new BadRequestException(
        `准入流程已处于终态 ${onboarding.stage}，无法继续操作`,
      );
    }

    const currentStageIndex = STAGE_ORDER.indexOf(
      onboarding.stage as OnboardingStage,
    );
    if (currentStageIndex === -1) {
      throw new BadRequestException(`当前阶段 ${onboarding.stage} 无效`);
    }

    // 追加审批记录
    const stageData: ApprovalRecord[] = Array.isArray(onboarding.stageData)
      ? (onboarding.stageData as ApprovalRecord[])
      : [];

    const record: ApprovalRecord = {
      stage: onboarding.stage,
      action: result,
      approverId,
      remarks,
      timestamp: new Date().toISOString(),
    };
    stageData.push(record);
    onboarding.stageData = stageData as any;

    if (result === 'REJECT') {
      onboarding.stage = OnboardingStage.REJECTED;
      onboarding.remarks = remarks;
    } else {
      // PASS：推进到下一阶段
      const isLastStage = currentStageIndex === STAGE_ORDER.length - 1;
      if (isLastStage) {
        // PILOT_RUN PASS → APPROVED
        onboarding.stage = OnboardingStage.APPROVED;
        onboarding.approvedBy = approverId;
        onboarding.approvedAt = new Date();

        // 同时将供应商状态更新为 ACTIVE（如果之前是 PENDING）
        const supplier = await this.supplierRepo.findOne({
          where: { id: onboarding.supplierId, tenantId },
        });
        if (supplier && supplier.status === 'PENDING') {
          supplier.status = 'ACTIVE';
          await this.supplierRepo.save(supplier);
        }
      } else {
        onboarding.stage = STAGE_ORDER[currentStageIndex + 1];
      }
    }

    return this.onboardingRepo.save(onboarding);
  }

  /**
   * 查询供应商的准入流程列表
   */
  async findBySupplier(
    tenantId: string,
    supplierId: string,
  ): Promise<ScmSupplierOnboarding[]> {
    return this.onboardingRepo.find({
      where: { tenantId, supplierId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * 查询单个准入流程详情
   */
  async findOne(tenantId: string, id: string): Promise<ScmSupplierOnboarding> {
    const onboarding = await this.onboardingRepo.findOne({
      where: { id, tenantId },
    });
    if (!onboarding) {
      throw new NotFoundException(`准入流程 ${id} 不存在`);
    }
    return onboarding;
  }
}
