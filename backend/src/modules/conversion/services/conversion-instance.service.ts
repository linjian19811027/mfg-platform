import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ConversionInstance,
  ConversionStatus,
  STATUS_TRANSITIONS,
  CiInput,
  CiOutput,
} from '../entities/conversion-instance.entity.js';
import { TenantContext } from '../../../shared/tenant/tenant.context.js';

@Injectable()
export class ConversionInstanceService {
  constructor(
    @InjectRepository(ConversionInstance)
    private readonly repo: Repository<ConversionInstance>,
    @InjectRepository(CiInput) private readonly inputRepo: Repository<CiInput>,
    @InjectRepository(CiOutput)
    private readonly outputRepo: Repository<CiOutput>,
  ) {}

  async findAll(page = 1, pageSize = 20, status?: string) {
    const tenantId = TenantContext.requireCurrentTenant();
    const where: Partial<ConversionInstance> = { tenantId };
    if (status) where.status = status as ConversionStatus;

    const [list, total] = await this.repo.findAndCount({
      where,
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
    const instance = await this.repo.findOne({ where: { id, tenantId } });
    if (!instance) throw new NotFoundException('CONV_INSTANCE_NOT_FOUND');
    const inputs = await this.inputRepo.find({ where: { ciId: id, tenantId } });
    const outputs = await this.outputRepo.find({
      where: { ciId: id, tenantId },
    });
    return { ...instance, inputs, outputs };
  }

  async create(data: Partial<ConversionInstance>) {
    const tenantId = TenantContext.requireCurrentTenant();
    data.tenantId = tenantId;
    data.status = 'PLANNED';
    return this.repo.save(this.repo.create(data));
  }

  async updateStatus(id: string, newStatus: ConversionStatus) {
    const tenantId = TenantContext.requireCurrentTenant();
    const instance = await this.repo.findOne({ where: { id, tenantId } });
    if (!instance) throw new NotFoundException('CONV_INSTANCE_NOT_FOUND');

    const allowed = STATUS_TRANSITIONS[instance.status];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `CONV_INSTANCE_INVALID_STATUS: cannot transition from ${instance.status} to ${newStatus}`,
      );
    }

    const update: Partial<ConversionInstance> = { status: newStatus };
    if (newStatus === 'RUNNING') update.actualStart = new Date();
    if (newStatus === 'COMPLETED') update.actualEnd = new Date();

    await this.repo.update(id, update as any);
    return { ...instance, ...update };
  }
}
