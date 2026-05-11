import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ApsPriorityRule,
  ApsPriorityRuleType,
} from '../entities/aps-priority-rule.entity';
import {
  ApsOptimizationTarget,
  ApsOptimizationTargetType,
} from '../entities/aps-optimization-target.entity';

export interface CreatePriorityRuleDto {
  name: string;
  ruleType: ApsPriorityRuleType;
  weight?: number;
  isActive?: number;
  config?: Record<string, any>;
}

export interface CreateOptimizationTargetDto {
  name: string;
  targetType: ApsOptimizationTargetType;
  weight?: number;
  isActive?: number;
}

export interface CombinedStrategy {
  rules: ApsPriorityRule[];
  targets: ApsOptimizationTarget[];
  primaryRule: string;
}

@Injectable()
export class PriorityRuleService {
  constructor(
    @InjectRepository(ApsPriorityRule)
    private readonly ruleRepo: Repository<ApsPriorityRule>,
    @InjectRepository(ApsOptimizationTarget)
    private readonly targetRepo: Repository<ApsOptimizationTarget>,
  ) {}

  // ── Priority Rules ──────────────────────────────────────────────

  async createRule(
    tenantId: string,
    data: CreatePriorityRuleDto,
  ): Promise<ApsPriorityRule> {
    const rule = this.ruleRepo.create({ ...data, tenantId });
    return this.ruleRepo.save(rule);
  }

  async findAllRules(tenantId: string): Promise<ApsPriorityRule[]> {
    return this.ruleRepo.find({
      where: { tenantId },
      order: { weight: 'DESC', createdAt: 'ASC' },
    });
  }

  async getActiveRules(tenantId: string): Promise<ApsPriorityRule[]> {
    return this.ruleRepo.find({
      where: { tenantId, isActive: 1 },
      order: { weight: 'DESC' },
    });
  }

  async updateRule(
    tenantId: string,
    id: string,
    data: Partial<CreatePriorityRuleDto>,
  ): Promise<ApsPriorityRule> {
    const rule = await this.ruleRepo.findOne({ where: { id, tenantId } });
    if (!rule) throw new NotFoundException(`ApsPriorityRule #${id} not found`);
    Object.assign(rule, data);
    return this.ruleRepo.save(rule);
  }

  async removeRule(tenantId: string, id: string): Promise<void> {
    const rule = await this.ruleRepo.findOne({ where: { id, tenantId } });
    if (!rule) throw new NotFoundException(`ApsPriorityRule #${id} not found`);
    await this.ruleRepo.remove(rule);
  }

  async toggleRule(
    tenantId: string,
    id: string,
    isActive: boolean,
  ): Promise<ApsPriorityRule> {
    const rule = await this.ruleRepo.findOne({ where: { id, tenantId } });
    if (!rule) throw new NotFoundException(`ApsPriorityRule #${id} not found`);
    rule.isActive = isActive ? 1 : 0;
    return this.ruleRepo.save(rule);
  }

  // ── Optimization Targets ────────────────────────────────────────

  async createTarget(
    tenantId: string,
    data: CreateOptimizationTargetDto,
  ): Promise<ApsOptimizationTarget> {
    const target = this.targetRepo.create({ ...data, tenantId });
    return this.targetRepo.save(target);
  }

  async findAllTargets(tenantId: string): Promise<ApsOptimizationTarget[]> {
    return this.targetRepo.find({
      where: { tenantId },
      order: { weight: 'DESC', createdAt: 'ASC' },
    });
  }

  async getActiveTargets(tenantId: string): Promise<ApsOptimizationTarget[]> {
    return this.targetRepo.find({
      where: { tenantId, isActive: 1 },
      order: { weight: 'DESC' },
    });
  }

  // ── Combined Strategy ───────────────────────────────────────────

  async getCombinedStrategy(tenantId: string): Promise<CombinedStrategy> {
    const [rules, targets] = await Promise.all([
      this.getActiveRules(tenantId),
      this.getActiveTargets(tenantId),
    ]);

    const primaryRule = rules.length > 0 ? rules[0].ruleType : '';

    return { rules, targets, primaryRule };
  }
}
