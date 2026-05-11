import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MesAutoReceiptConfig } from '../entities/mes-auto-receipt-config.entity.js';
import { MesReceiptLog } from '../entities/mes-receipt-log.entity.js';
import { TenantContext } from '../../../shared/tenant/tenant.context.js';

export interface AutoReceiptConfigResult {
  requireFqc: boolean;
  targetWarehouseId?: string;
  targetLocationId?: string;
  isDefault: boolean;
}

export interface CreateConfigDto {
  matchType: 'MATERIAL' | 'CATEGORY';
  matchValue: string;
  requireFqc?: boolean;
  targetWarehouseId?: string;
  targetLocationId?: string;
  enabled?: boolean;
}

@Injectable()
export class AutoReceiptConfigService {
  constructor(
    @InjectRepository(MesAutoReceiptConfig)
    private readonly configRepo: Repository<MesAutoReceiptConfig>,
    @InjectRepository(MesReceiptLog)
    private readonly logRepo: Repository<MesReceiptLog>,
  ) {}

  /**
   * 按物料编码查找配置：精确匹配 > 分类前缀匹配 > 默认配置
   * materialCode: 物料编码（用于分类前缀匹配）
   * materialId: 物料 ID（用于精确匹配 matchType=MATERIAL 时的 matchValue 比对）
   */
  async findConfig(
    tenantId: string,
    materialId: string,
    materialCode?: string,
  ): Promise<AutoReceiptConfigResult> {
    const configs = await this.configRepo.find({
      where: { tenantId, enabled: 1 },
    });

    // 1. 精确匹配 MATERIAL（matchValue = materialId）
    const exactMatch = configs.find(
      (c) => c.matchType === 'MATERIAL' && c.matchValue === materialId,
    );
    if (exactMatch) {
      return this.toResult(exactMatch, false);
    }

    // 2. 分类前缀匹配（matchValue 是物料编码前缀）
    if (materialCode) {
      const categoryMatches = configs
        .filter(
          (c) =>
            c.matchType === 'CATEGORY' && materialCode.startsWith(c.matchValue),
        )
        .sort((a, b) => b.matchValue.length - a.matchValue.length); // 最长前缀优先
      if (categoryMatches.length > 0) {
        return this.toResult(categoryMatches[0], false);
      }
    }

    // 3. 默认配置
    return { requireFqc: false, isDefault: true };
  }

  async findAll(query: {
    matchType?: string;
    matchValue?: string;
    page?: number;
    pageSize?: number;
  }) {
    const tenantId = TenantContext.requireCurrentTenant();
    const { page = 1, pageSize = 20 } = query;
    const qb = this.configRepo
      .createQueryBuilder('c')
      .where('c.tenant_id = :tenantId', { tenantId });
    if (query.matchType)
      qb.andWhere('c.match_type = :mt', { mt: query.matchType });
    if (query.matchValue)
      qb.andWhere('c.match_value LIKE :mv', { mv: `%${query.matchValue}%` });
    const [items, total] = await qb
      .orderBy('c.match_type', 'ASC')
      .addOrderBy('c.match_value', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return { items, total };
  }

  async create(dto: CreateConfigDto): Promise<MesAutoReceiptConfig> {
    const tenantId = TenantContext.requireCurrentTenant();
    await this.validateWarehouseLocation(
      tenantId,
      dto.targetWarehouseId,
      dto.targetLocationId,
    );

    return this.configRepo.save(
      this.configRepo.create({
        tenantId,
        matchType: dto.matchType,
        matchValue: dto.matchValue,
        requireFqc: dto.requireFqc ? 1 : 0,
        targetWarehouseId: dto.targetWarehouseId,
        targetLocationId: dto.targetLocationId,
        enabled: dto.enabled !== false ? 1 : 0,
      }),
    );
  }

  async update(
    id: string,
    dto: Partial<CreateConfigDto>,
  ): Promise<MesAutoReceiptConfig> {
    const tenantId = TenantContext.requireCurrentTenant();
    const config = await this.configRepo.findOne({ where: { id, tenantId } });
    if (!config) throw new NotFoundException('AUTO_RECEIPT_CONFIG_NOT_FOUND');

    const warehouseId = dto.targetWarehouseId ?? config.targetWarehouseId;
    const locationId = dto.targetLocationId ?? config.targetLocationId;
    await this.validateWarehouseLocation(tenantId, warehouseId, locationId);

    await this.configRepo.update(id, {
      ...(dto.matchType !== undefined && { matchType: dto.matchType }),
      ...(dto.matchValue !== undefined && { matchValue: dto.matchValue }),
      ...(dto.requireFqc !== undefined && {
        requireFqc: dto.requireFqc ? 1 : 0,
      }),
      ...(dto.targetWarehouseId !== undefined && {
        targetWarehouseId: dto.targetWarehouseId,
      }),
      ...(dto.targetLocationId !== undefined && {
        targetLocationId: dto.targetLocationId,
      }),
      ...(dto.enabled !== undefined && { enabled: dto.enabled ? 1 : 0 }),
    });
    return this.configRepo.findOneOrFail({ where: { id, tenantId } });
  }

  async delete(id: string): Promise<void> {
    const tenantId = TenantContext.requireCurrentTenant();
    const config = await this.configRepo.findOne({ where: { id, tenantId } });
    if (!config) throw new NotFoundException('AUTO_RECEIPT_CONFIG_NOT_FOUND');

    // 检查是否有在途日志引用（通过 targetWarehouseId 间接关联，实际通过 woId 查 PENDING/RETRYING 日志）
    const pendingCount = await this.logRepo.count({
      where: [
        { tenantId, status: 'PENDING' },
        { tenantId, status: 'RETRYING' },
      ],
    });
    if (pendingCount > 0) {
      throw new BadRequestException(
        `CONFIG_HAS_PENDING_LOGS: ${pendingCount} 条在途入库日志，请等待处理完成后再删除`,
      );
    }

    await this.configRepo.delete(id);
  }

  async toggle(id: string): Promise<MesAutoReceiptConfig> {
    const tenantId = TenantContext.requireCurrentTenant();
    const config = await this.configRepo.findOne({ where: { id, tenantId } });
    if (!config) throw new NotFoundException('AUTO_RECEIPT_CONFIG_NOT_FOUND');
    await this.configRepo.update(id, { enabled: config.enabled ? 0 : 1 });
    return this.configRepo.findOneOrFail({ where: { id, tenantId } });
  }

  // ── 私有方法 ──────────────────────────────────────────────────────────────

  private toResult(
    config: MesAutoReceiptConfig,
    isDefault: boolean,
  ): AutoReceiptConfigResult {
    return {
      requireFqc: config.requireFqc === 1,
      targetWarehouseId: config.targetWarehouseId,
      targetLocationId: config.targetLocationId,
      isDefault,
    };
  }

  private async validateWarehouseLocation(
    tenantId: string,
    warehouseId?: string,
    locationId?: string,
  ): Promise<void> {
    if (!warehouseId) return;

    const wh = await this.configRepo.manager.findOne(
      'wms_warehouse' as any,
      {
        where: { id: warehouseId, tenantId, status: 'ACTIVE' },
      } as any,
    );
    if (!wh) {
      throw new BadRequestException(
        `WAREHOUSE_NOT_FOUND_OR_INACTIVE: warehouseId=${warehouseId}`,
      );
    }

    if (locationId) {
      const loc = await this.configRepo.manager.findOne(
        'wms_location' as any,
        {
          where: { id: locationId, warehouseId, tenantId, status: 'ACTIVE' },
        } as any,
      );
      if (!loc) {
        throw new BadRequestException(
          `LOCATION_NOT_FOUND_OR_INACTIVE: locationId=${locationId}`,
        );
      }
    }
  }
}
