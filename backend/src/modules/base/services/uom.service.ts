import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SysUom, SysUomConversion } from '../entities/sys-uom.entity.js';
import { TenantContext } from '../../../shared/tenant/tenant.context.js';

@Injectable()
export class UomService {
  constructor(
    @InjectRepository(SysUom) private readonly uomRepo: Repository<SysUom>,
    @InjectRepository(SysUomConversion)
    private readonly convRepo: Repository<SysUomConversion>,
  ) {}

  async findAll(): Promise<SysUom[]> {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.uomRepo.find({ where: { tenantId, status: 'ACTIVE' } });
  }

  async create(data: Partial<SysUom>): Promise<SysUom> {
    const tenantId = TenantContext.requireCurrentTenant();
    data.tenantId = tenantId;
    return this.uomRepo.save(this.uomRepo.create(data));
  }

  async convert(
    fromUomId: string,
    toUomId: string,
    quantity: number,
  ): Promise<number> {
    if (fromUomId === toUomId) return quantity;
    const tenantId = TenantContext.requireCurrentTenant();

    const conv = await this.convRepo.findOne({
      where: { tenantId, fromUomId, toUomId },
    });
    if (!conv) {
      throw new BadRequestException(
        `BASE_UOM_NO_CONVERSION: no conversion from ${fromUomId} to ${toUomId}`,
      );
    }
    return quantity * Number(conv.factor);
  }

  async setConversion(
    fromUomId: string,
    toUomId: string,
    factor: number,
  ): Promise<SysUomConversion> {
    const tenantId = TenantContext.requireCurrentTenant();
    const existing = await this.convRepo.findOne({
      where: { tenantId, fromUomId, toUomId },
    });
    if (existing) {
      await this.convRepo.update(existing.id, { factor });
      return { ...existing, factor };
    }
    return this.convRepo.save(
      this.convRepo.create({ tenantId, fromUomId, toUomId, factor }),
    );
  }
}
