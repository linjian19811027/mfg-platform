import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  EamEquipmentFinance,
  DepreciationMethod,
} from '../entities/eam-equipment-finance.entity.js';

// ─── DTO ─────────────────────────────────────────────────────────────────────

interface FinanceDto {
  originalValue: number;
  depreciationMethod: DepreciationMethod;
  usefulLife: number;
  salvageValue: number;
  currentNetValue?: number;
}

@Injectable()
export class EquipmentFinanceService {
  constructor(
    @InjectRepository(EamEquipmentFinance)
    private readonly financeRepo: Repository<EamEquipmentFinance>,
  ) {}

  // ─── 获取财务信息 ─────────────────────────────────────────────────────────

  async findByEquipment(
    tenantId: string,
    equipmentId: string,
  ): Promise<EamEquipmentFinance | null> {
    return this.financeRepo.findOne({ where: { tenantId, equipmentId } });
  }

  // ─── 创建或更新财务信息 ───────────────────────────────────────────────────

  async upsert(
    tenantId: string,
    equipmentId: string,
    dto: FinanceDto,
  ): Promise<EamEquipmentFinance> {
    const existing = await this.financeRepo.findOne({
      where: { tenantId, equipmentId },
    });

    const monthlyDep = this.calculateMonthlyDepreciation(
      dto.originalValue,
      dto.salvageValue,
      dto.usefulLife,
      dto.depreciationMethod,
      0,
    );

    if (existing) {
      existing.originalValue = String(dto.originalValue);
      existing.depreciationMethod = dto.depreciationMethod;
      existing.usefulLife = dto.usefulLife;
      existing.salvageValue = String(dto.salvageValue);
      existing.currentNetValue = String(
        dto.currentNetValue ?? dto.originalValue,
      );
      existing.monthlyDepreciation = String(monthlyDep);
      return this.financeRepo.save(existing);
    }

    const finance = this.financeRepo.create({
      tenantId,
      equipmentId,
      originalValue: String(dto.originalValue),
      depreciationMethod: dto.depreciationMethod,
      usefulLife: dto.usefulLife,
      salvageValue: String(dto.salvageValue),
      currentNetValue: String(dto.currentNetValue ?? dto.originalValue),
      accumulatedDepreciation: '0',
      monthlyDepreciation: String(monthlyDep),
    });
    return this.financeRepo.save(finance);
  }

  // ─── 折旧计算 ─────────────────────────────────────────────────────────────

  calculateMonthlyDepreciation(
    originalValue: number,
    salvageValue: number,
    usefulLifeYears: number,
    method: DepreciationMethod,
    elapsedMonths = 0,
  ): number {
    if (usefulLifeYears <= 0) return 0;

    switch (method) {
      case DepreciationMethod.STRAIGHT_LINE: {
        // (原值 - 残值) / (年限 * 12)
        return (originalValue - salvageValue) / (usefulLifeYears * 12);
      }

      case DepreciationMethod.DOUBLE_DECLINING: {
        // 当前净值 * (2 / 年限) / 12
        const totalMonths = usefulLifeYears * 12;
        const annualRate = 2 / usefulLifeYears;
        // 计算经过 elapsedMonths 后的当前净值
        const currentNetValue =
          originalValue * Math.pow(1 - annualRate / 12, elapsedMonths);
        const remaining = totalMonths - elapsedMonths;
        if (remaining <= 0) return 0;
        return currentNetValue * (annualRate / 12);
      }

      case DepreciationMethod.SUM_OF_YEARS: {
        // (原值 - 残值) * 剩余年数 / 年数总和 / 12
        const totalMonths = usefulLifeYears * 12;
        const remainingMonths = totalMonths - elapsedMonths;
        if (remainingMonths <= 0) return 0;
        // 年数总和 = n*(n+1)/2，按月计算剩余年数（向上取整）
        const remainingYears = Math.ceil(remainingMonths / 12);
        const sumOfYears = (usefulLifeYears * (usefulLifeYears + 1)) / 2;
        return (
          ((originalValue - salvageValue) * remainingYears) / sumOfYears / 12
        );
      }

      default:
        return 0;
    }
  }

  // ─── 更新净值（每月调用）─────────────────────────────────────────────────

  async updateNetValue(
    tenantId: string,
    equipmentId: string,
  ): Promise<EamEquipmentFinance> {
    const finance = await this.financeRepo.findOne({
      where: { tenantId, equipmentId },
    });
    if (!finance)
      throw new NotFoundException(`设备 ${equipmentId} 财务信息不存在`);

    const originalValue = parseFloat(finance.originalValue);
    const salvageValue = parseFloat(finance.salvageValue);
    const currentNetValue = parseFloat(finance.currentNetValue);
    const accumulated = parseFloat(finance.accumulatedDepreciation);

    // 计算已折旧月数
    const elapsedMonths = Math.round(
      accumulated /
        ((originalValue - salvageValue) / (finance.usefulLife * 12) || 1),
    );

    const monthly = this.calculateMonthlyDepreciation(
      originalValue,
      salvageValue,
      finance.usefulLife,
      finance.depreciationMethod,
      elapsedMonths,
    );

    const newNetValue = Math.max(currentNetValue - monthly, salvageValue);
    const newAccumulated = accumulated + monthly;

    finance.currentNetValue = String(newNetValue);
    finance.accumulatedDepreciation = String(newAccumulated);
    finance.monthlyDepreciation = String(monthly);
    finance.lastDepreciationDate = new Date();

    return this.financeRepo.save(finance);
  }
}
