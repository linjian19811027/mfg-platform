import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PlmMaterialCodeRule,
  CodeSegment,
} from '../entities/plm-material-code-rule.entity.js';
import { PlmMaterial } from '../entities/plm-material.entity.js';

@Injectable()
export class MaterialCodeService {
  constructor(
    @InjectRepository(PlmMaterialCodeRule)
    private readonly ruleRepo: Repository<PlmMaterialCodeRule>,
    @InjectRepository(PlmMaterial)
    private readonly materialRepo: Repository<PlmMaterial>,
  ) {}

  /**
   * AUTO 模式：按 segments 配置自动生成编码
   */
  async generate(ruleId: string, categoryCode?: string): Promise<string> {
    const rule = await this.ruleRepo.findOne({ where: { id: ruleId } });
    if (!rule) throw new NotFoundException('PLM_CODE_RULE_NOT_FOUND');

    const segments = rule.segments ?? [];
    const parts: string[] = [];

    for (const seg of segments) {
      parts.push(await this.resolveSegment(seg, rule, categoryCode));
    }

    // 处理 SERIAL 段的乐观锁递增
    const serialIdx = segments.findIndex((s) => s.type === 'SERIAL');
    if (serialIdx !== -1) {
      const serial = await this.incrementSerial(rule);
      const serialLen = rule.serialLength ?? 4;
      parts[serialIdx] = String(serial).padStart(serialLen, '0');
    }

    return parts.join('');
  }

  /**
   * MANUAL 模式：校验编码在租户内唯一
   */
  async validateManual(tenantId: string, code: string): Promise<void> {
    const exists = await this.materialRepo.findOne({
      where: { tenantId, code },
    });
    if (exists) throw new BadRequestException('PLM_MATERIAL_CODE_EXISTS');
  }

  /**
   * MIXED 模式：前缀部分自动生成，后缀由用户提供
   * 非 SERIAL 段自动生成，SERIAL 段自动递增，最后拼接 userSuffix
   */
  async generateMixed(
    ruleId: string,
    userSuffix: string,
    categoryCode?: string,
  ): Promise<string> {
    const rule = await this.ruleRepo.findOne({ where: { id: ruleId } });
    if (!rule) throw new NotFoundException('PLM_CODE_RULE_NOT_FOUND');

    const segments = rule.segments ?? [];
    const parts: string[] = [];

    for (const seg of segments) {
      if (seg.type === 'SERIAL') {
        const serial = await this.incrementSerial(rule);
        const serialLen = rule.serialLength ?? 4;
        parts.push(String(serial).padStart(serialLen, '0'));
      } else {
        parts.push(await this.resolveSegment(seg, rule, categoryCode));
      }
    }

    return parts.join('') + userSuffix;
  }

  /**
   * 获取规则（供 MaterialService 使用）
   * 优先匹配 categoryId，其次取默认规则
   */
  async findRule(
    tenantId: string,
    categoryId?: string,
  ): Promise<PlmMaterialCodeRule | null> {
    if (categoryId) {
      const rule = await this.ruleRepo.findOne({
        where: { tenantId, categoryId, status: 'ACTIVE' },
      });
      if (rule) return rule;
    }

    return this.ruleRepo.findOne({
      where: { tenantId, isDefault: true, status: 'ACTIVE' },
    });
  }

  // ─── 私有方法 ────────────────────────────────────────────────────────────────

  /**
   * 解析单个 segment（SERIAL 段在此返回占位，由调用方替换）
   */
  private async resolveSegment(
    seg: CodeSegment,
    rule: PlmMaterialCodeRule,
    categoryCode?: string,
  ): Promise<string> {
    switch (seg.type) {
      case 'PREFIX':
        return seg.value ?? '';

      case 'SEPARATOR':
        return seg.value ?? rule.separator ?? '';

      case 'DATE':
        return this.formatDate(seg.format ?? 'YYYYMM');

      case 'CATEGORY': {
        const len = seg.length ?? 2;
        return (categoryCode ?? '').substring(0, len);
      }

      case 'SERIAL':
        // 占位，由 generate() / generateMixed() 替换
        return '';

      default:
        return '';
    }
  }

  /**
   * 乐观锁递增 currentSerial，最多重试 3 次
   */
  private async incrementSerial(rule: PlmMaterialCodeRule): Promise<number> {
    const maxRetries = 3;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const current = await this.ruleRepo.findOne({ where: { id: rule.id } });
      if (!current) throw new NotFoundException('PLM_CODE_RULE_NOT_FOUND');

      const oldSerial = current.currentSerial;
      const newSerial = oldSerial + 1;

      const result = await this.ruleRepo
        .createQueryBuilder()
        .update(PlmMaterialCodeRule)
        .set({ currentSerial: newSerial })
        .where('id = :id AND current_serial = :oldSerial', {
          id: rule.id,
          oldSerial,
        })
        .execute();

      if (result.affected && result.affected > 0) {
        return newSerial;
      }
      // 乐观锁冲突，重试
    }

    throw new BadRequestException('PLM_CODE_SERIAL_CONFLICT');
  }

  /**
   * 原生 JS 日期格式化，支持 YYYYMM / YYYYMMDD / YYYY 等
   */
  private formatDate(format: string): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    return format
      .replace('YYYYMMDD', `${year}${month}${day}`)
      .replace('YYYYMM', `${year}${month}`)
      .replace('YYYY', String(year))
      .replace('MM', month)
      .replace('DD', day);
  }
}
