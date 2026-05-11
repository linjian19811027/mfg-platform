import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { ApsMrp, ApsMrpStatus } from '../entities/aps-mrp.entity';
import {
  ApsMrpLine,
  ApsMrpLineSuggestedAction,
  ApsMrpLineStatus,
} from '../entities/aps-mrp-line.entity';
import {
  MessageService,
  MESSAGE_SERVICE,
} from '../../../shared/message/message.interface.js';

// ─── 输入 / 输出类型 ──────────────────────────────────────────────────────────

export interface MrpLineInput {
  materialId: string;
  requiredQty: number;
  availableQty: number;
  requiredDate: Date;
  bomExpansion?: Array<{ materialId: string; qty: number }>;
}

export interface MrpCalculateInput {
  soId?: string;
  lines: MrpLineInput[];
}

export interface MrpCalculateResult {
  mrp: ApsMrp;
  lines: ApsMrpLine[];
  shortages: ApsMrpLine[];
}

export interface MrpReadinessResult {
  ready: boolean;
  shortageCount: number;
  shortages: ApsMrpLine[];
}

export interface MrpFindAllQuery {
  page?: number;
  pageSize?: number;
  status?: ApsMrpStatus;
}

export interface MrpFindAllResult {
  items: ApsMrp[];
  total: number;
  page: number;
  pageSize: number;
}

export interface MrpFindOneResult {
  mrp: ApsMrp;
  lines: ApsMrpLine[];
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class MrpService {
  constructor(
    @InjectRepository(ApsMrp)
    private readonly mrpRepo: Repository<ApsMrp>,
    @InjectRepository(ApsMrpLine)
    private readonly mrpLineRepo: Repository<ApsMrpLine>,
    @Inject(MESSAGE_SERVICE) private readonly messageService: MessageService,
  ) {}

  /**
   * 生成 MRP 编号：MRP-YYYYMMDD-序号（当天序号从1开始）
   */
  private async generateMrpNo(tenantId: string): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
    const prefix = `MRP-${dateStr}-`;

    const count = await this.mrpRepo
      .createQueryBuilder('m')
      .where('m.tenantId = :tenantId', { tenantId })
      .andWhere('m.mrpNo LIKE :prefix', { prefix: `${prefix}%` })
      .getCount();

    const seq = String(count + 1).padStart(4, '0');
    return `${prefix}${seq}`;
  }

  /**
   * 3.15.1 MRP 计算
   */
  async calculate(
    tenantId: string,
    input: MrpCalculateInput,
  ): Promise<MrpCalculateResult> {
    const { soId, lines } = input;

    // 生成 MRP 编号
    const mrpNo = await this.generateMrpNo(tenantId);

    // 创建 ApsMrp 记录
    const mrp = this.mrpRepo.create({
      tenantId,
      mrpNo,
      soId,
      status: ApsMrpStatus.CALCULATED,
      calculatedAt: new Date(),
    });
    const savedMrp = await this.mrpRepo.save(mrp);

    // 处理每个 line（含 BOM 展开）
    const allLineInputs: MrpLineInput[] = [];
    for (const line of lines) {
      allLineInputs.push(line);
      // BOM 展开：将子物料也加入计算
      if (line.bomExpansion && line.bomExpansion.length > 0) {
        for (const bom of line.bomExpansion) {
          allLineInputs.push({
            materialId: bom.materialId,
            requiredQty: bom.qty,
            availableQty: 0,
            requiredDate: line.requiredDate,
          });
        }
      }
    }

    // 创建 ApsMrpLine 记录
    const savedLines: ApsMrpLine[] = [];
    for (const lineInput of allLineInputs) {
      const shortageQty = Math.max(
        0,
        lineInput.requiredQty - lineInput.availableQty,
      );
      const suggestedAction =
        shortageQty > 0
          ? ApsMrpLineSuggestedAction.PURCHASE
          : ApsMrpLineSuggestedAction.PRODUCE;

      const mrpLine = this.mrpLineRepo.create({
        tenantId,
        mrpId: savedMrp.id,
        materialId: lineInput.materialId,
        requiredQty: lineInput.requiredQty,
        availableQty: lineInput.availableQty,
        shortageQty,
        requiredDate: lineInput.requiredDate,
        suggestedAction,
        status: ApsMrpLineStatus.OPEN,
      });

      const saved = await this.mrpLineRepo.save(mrpLine);
      savedLines.push(saved);
    }

    const shortages = savedLines.filter((l) => l.shortageQty > 0);

    return { mrp: savedMrp, lines: savedLines, shortages };
  }

  /**
   * 3.15.2 齐套检查
   */
  async checkReadiness(
    tenantId: string,
    mrpId: string,
  ): Promise<MrpReadinessResult> {
    const lines = await this.mrpLineRepo.find({
      where: { tenantId, mrpId },
    });

    const shortages = lines.filter((l) => Number(l.shortageQty) > 0);

    return {
      ready: shortages.length === 0,
      shortageCount: shortages.length,
      shortages,
    };
  }

  /**
   * 3.15.3 发布 MRP（CALCULATED → RELEASED）
   */
  async release(tenantId: string, mrpId: string): Promise<ApsMrp> {
    const mrp = await this.mrpRepo.findOne({ where: { id: mrpId, tenantId } });
    if (!mrp) {
      throw new NotFoundException(`MRP ${mrpId} not found`);
    }

    mrp.status = ApsMrpStatus.RELEASED;
    const savedMrp = await this.mrpRepo.save(mrp);

    // 查询有缺料的 line，发布采购申请事件
    const shortageLines = await this.mrpLineRepo.find({
      where: { tenantId, mrpId },
    });

    const purchaseLines = shortageLines.filter(
      (l) => Number(l.shortageQty) > 0,
    );

    if (purchaseLines.length > 0) {
      await this.messageService.publish({
        eventId: uuidv4(),
        eventType: 'MRP_PURCHASE_REQUEST',
        tenantId,
        sourceModule: 'APS',
        targetModule: 'SCM',
        payload: {
          mrpId,
          mrpNo: mrp.mrpNo,
          soId: mrp.soId,
          purchaseLines: purchaseLines.map((l) => ({
            materialId: l.materialId,
            shortageQty: l.shortageQty,
            requiredDate: l.requiredDate,
          })),
        },
        createdAt: new Date(),
      });
    }

    return savedMrp;
  }

  /**
   * 3.15.4 分页查询 MRP 列表
   */
  async findAll(
    tenantId: string,
    query: MrpFindAllQuery = {},
  ): Promise<MrpFindAllResult> {
    const { page = 1, pageSize = 20, status } = query;

    const qb = this.mrpRepo
      .createQueryBuilder('m')
      .where('m.tenantId = :tenantId', { tenantId })
      .orderBy('m.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    if (status) {
      qb.andWhere('m.status = :status', { status });
    }

    const [items, total] = await qb.getManyAndCount();

    return { items, total, page, pageSize };
  }

  /**
   * 3.15.5 查询单条 MRP 含明细
   */
  async findOne(tenantId: string, id: string): Promise<MrpFindOneResult> {
    const mrp = await this.mrpRepo.findOne({ where: { id, tenantId } });
    if (!mrp) {
      throw new NotFoundException(`MRP ${id} not found`);
    }

    const lines = await this.mrpLineRepo.find({
      where: { tenantId, mrpId: id },
      order: { createdAt: 'ASC' },
    });

    return { mrp, lines };
  }
}
