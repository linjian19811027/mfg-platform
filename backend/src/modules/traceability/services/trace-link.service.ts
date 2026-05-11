import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TraceLink } from '../entities/trace-link.entity.js';
import { TraceBatch } from '../entities/trace-batch.entity.js';

export interface CreateLinkDto {
  inputBatchId: string;
  outputBatchId: string;
  linkType?: string;
  inputQty?: number;
  mesWoId?: string;
  linkedAt?: Date;
}

export interface ManualCreateLinkDto extends CreateLinkDto {
  manualReason: string;
}

@Injectable()
export class TraceLinkService {
  constructor(
    @InjectRepository(TraceLink)
    private readonly linkRepo: Repository<TraceLink>,
    @InjectRepository(TraceBatch)
    private readonly batchRepo: Repository<TraceBatch>,
  ) {}

  async createLink(tenantId: string, dto: CreateLinkDto): Promise<TraceLink> {
    if (dto.inputBatchId === dto.outputBatchId) {
      throw new BadRequestException('TRACE_LINK_SELF_REFERENCE');
    }

    const link = this.linkRepo.create({
      tenantId,
      inputBatchId: dto.inputBatchId,
      outputBatchId: dto.outputBatchId,
      linkType: dto.linkType ?? 'PRODUCTION',
      inputQty: dto.inputQty ?? 0,
      mesWoId: dto.mesWoId,
      linkedAt: dto.linkedAt ?? new Date(),
      isManual: 0,
    });

    return this.linkRepo.save(link);
  }

  async manualCreate(
    tenantId: string,
    dto: ManualCreateLinkDto,
    operatorId: string,
  ): Promise<TraceLink> {
    if (dto.inputBatchId === dto.outputBatchId) {
      throw new BadRequestException('TRACE_LINK_SELF_REFERENCE');
    }

    const link = this.linkRepo.create({
      tenantId,
      inputBatchId: dto.inputBatchId,
      outputBatchId: dto.outputBatchId,
      linkType: dto.linkType ?? 'PRODUCTION',
      inputQty: dto.inputQty ?? 0,
      mesWoId: dto.mesWoId,
      linkedAt: dto.linkedAt ?? new Date(),
      isManual: 1,
      manualReason: dto.manualReason,
      operatorId,
    });

    return this.linkRepo.save(link);
  }

  async validateInputQty(
    tenantId: string,
    inputBatchId: string,
    qty: number,
  ): Promise<boolean> {
    const batch = await this.batchRepo.findOne({
      where: { id: inputBatchId, tenantId },
    });
    if (!batch) throw new NotFoundException('TRACE_BATCH_NOT_FOUND');

    // Sum already consumed qty via existing links
    const result = await this.linkRepo
      .createQueryBuilder('l')
      .select('SUM(l.input_qty)', 'totalConsumed')
      .where('l.tenant_id = :tenantId', { tenantId })
      .andWhere('l.input_batch_id = :inputBatchId', { inputBatchId })
      .getRawOne();

    const totalConsumed = Number(result?.totalConsumed ?? 0);
    const available = Number(batch.actualQty) - totalConsumed;

    return qty <= available;
  }
}
