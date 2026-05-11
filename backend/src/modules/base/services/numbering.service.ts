import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SysNumberingRule, NumberingSegment } from '../entities/sys-numbering-rule.entity.js';

@Injectable()
export class NumberingService {
  constructor(
    @InjectRepository(SysNumberingRule)
    private readonly ruleRepo: Repository<SysNumberingRule>,
  ) {}

  /**
   * 生成业务编码
   * @param businessKey 业务标识，如 PLM_MATERIAL
   * @param tenantId 租户ID
   * @param context 业务上下文数据，用于解析 FIELD 段
   */
  async generate(
    businessKey: string,
    tenantId: string,
    context: Record<string, any> = {},
  ): Promise<string> {
    const rule = await this.findRule(tenantId, businessKey, context);
    if (!rule) {
      throw new BadRequestException(`No active numbering rule found for ${businessKey}`);
    }

    if (rule.mode === 'MANUAL') {
      throw new BadRequestException(`Rule for ${businessKey} is set to MANUAL mode`);
    }

    const segments = rule.segments ?? [];
    const parts: string[] = [];

    for (const seg of segments) {
      parts.push(await this.resolveSegment(seg, rule, context));
    }

    // 拼装并返回
    let code = parts.join('');
    
    // 如果是 MIXED 模式，可能需要外部传入后缀，此处 context['suffix'] 可用
    if (rule.mode === 'MIXED' && context.suffix) {
      code += context.suffix;
    }

    return code;
  }

  /**
   * 获取匹配的规则
   * 逻辑：根据业务标识查找，如果有多个，可扩展为根据 context 进一步匹配（如分类）
   */
  async findRule(
    tenantId: string,
    businessKey: string,
    context: Record<string, any> = {},
  ): Promise<SysNumberingRule | null> {
    // 基础逻辑：查找该业务下的默认规则
    // 未来可扩展为：查找与 context.categoryId 绑定的特定规则
    const qb = this.ruleRepo.createQueryBuilder('r')
      .where('r.tenant_id = :tenantId', { tenantId })
      .andWhere('r.business_key = :businessKey', { businessKey })
      .andWhere('r.status = :status', { status: 'ACTIVE' });

    // 如果 context 中包含分类，可以优先尝试匹配分类规则
    // 这里简单处理：如果有 categoryId 且有对应规则则返回，否则返回默认
    const all = await qb.getMany();
    if (all.length === 0) return null;

    if (context.categoryId) {
      // 假设 rule 实体里暂未加 categoryId，我们可以通过 code 命名规范或者 attributes 扩展
      // 暂时取第一个或者标记为 isDefault 的
    }

    return all.find(r => r.isDefault) || all[0];
  }

  // ─── 私有方法 ────────────────────────────────────────────────────────────────

  private async resolveSegment(
    seg: NumberingSegment,
    rule: SysNumberingRule,
    context: Record<string, any>,
  ): Promise<string> {
    switch (seg.type) {
      case 'CONST':
        return seg.value ?? '';

      case 'DATE':
        return this.formatDate(seg.format ?? 'YYYYMMDD');

      case 'SERIAL': {
        const serial = await this.incrementSerial(rule);
        const len = seg.length ?? 4;
        const pad = seg.padChar ?? '0';
        return String(serial).padStart(len, pad);
      }

      case 'FIELD': {
        const val = context[seg.value ?? ''] ?? '';
        const len = seg.length;
        return len ? String(val).substring(0, len) : String(val);
      }

      default:
        return '';
    }
  }

  private async incrementSerial(rule: SysNumberingRule): Promise<number> {
    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const current = await this.ruleRepo.findOne({ where: { id: rule.id } });
      if (!current) throw new NotFoundException('Numbering rule not found');

      const oldSerial = current.currentSerial;
      const newSerial = oldSerial + 1;

      const result = await this.ruleRepo
        .createQueryBuilder()
        .update(SysNumberingRule)
        .set({ currentSerial: newSerial })
        .where('id = :id AND current_serial = :oldSerial', {
          id: rule.id,
          oldSerial,
        })
        .execute();

      if (result.affected && result.affected > 0) {
        return newSerial;
      }
    }
    throw new BadRequestException('Serial generation conflict, please retry');
  }

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
