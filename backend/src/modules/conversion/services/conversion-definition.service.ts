import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ConversionDefinition,
  CdInput,
  CdOutput,
} from '../entities/conversion-definition.entity.js';
import { TenantContext } from '../../../shared/tenant/tenant.context.js';
import { sanitizeUpdateData } from '../../../shared/utils/sanitize.js';

@Injectable()
export class ConversionDefinitionService {
  constructor(
    @InjectRepository(ConversionDefinition)
    private readonly defRepo: Repository<ConversionDefinition>,
    @InjectRepository(CdInput) private readonly inputRepo: Repository<CdInput>,
    @InjectRepository(CdOutput)
    private readonly outputRepo: Repository<CdOutput>,
  ) {}

  async findAll(page = 1, pageSize = 20) {
    const tenantId = TenantContext.requireCurrentTenant();
    const [list, total] = await this.defRepo.findAndCount({
      where: { tenantId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return {
      list,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async findOne(id: string) {
    const tenantId = TenantContext.requireCurrentTenant();
    const def = await this.defRepo.findOne({ where: { id, tenantId } });
    if (!def) throw new NotFoundException('CONV_DEFINITION_NOT_FOUND');
    const inputs = await this.inputRepo.find({ where: { cdId: id, tenantId } });
    const outputs = await this.outputRepo.find({
      where: { cdId: id, tenantId },
    });
    return { ...def, inputs, outputs };
  }

  async create(
    data: Partial<ConversionDefinition> & {
      inputs?: Partial<CdInput>[];
      outputs?: Partial<CdOutput>[];
    },
  ) {
    const tenantId = TenantContext.requireCurrentTenant();
    const { inputs = [], outputs = [], ...defData } = data;
    defData.tenantId = tenantId;

    const saved = await this.defRepo.save(this.defRepo.create(defData));

    const savedInputs = await Promise.all(
      inputs.map((i) =>
        this.inputRepo.save(
          this.inputRepo.create({ ...i, cdId: saved.id, tenantId }),
        ),
      ),
    );
    const savedOutputs = await Promise.all(
      outputs.map((o) =>
        this.outputRepo.save(
          this.outputRepo.create({ ...o, cdId: saved.id, tenantId }),
        ),
      ),
    );

    return { ...saved, inputs: savedInputs, outputs: savedOutputs };
  }

  async update(id: string, data: Partial<ConversionDefinition>) {
    const tenantId = TenantContext.requireCurrentTenant();
    const def = await this.defRepo.findOne({ where: { id, tenantId } });
    if (!def) throw new NotFoundException('CONV_DEFINITION_NOT_FOUND');
    await this.defRepo.update(id, sanitizeUpdateData(data) as any);
    return { ...def, ...data };
  }
}
