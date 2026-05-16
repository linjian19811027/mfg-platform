import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HrShift } from '../../hr/entities/hr-shift.entity.js';

@Injectable()
export class ShiftService {
  constructor(
    @InjectRepository(HrShift)
    private readonly repo: Repository<HrShift>,
  ) {}

  findAll(tenantId: string) {
    return this.repo.find({
      where: { tenantId, enabled: 1 },
      order: { name: 'ASC' },
    });
  }

  findAllAdmin(tenantId: string) {
    return this.repo.find({
      where: { tenantId },
      order: { name: 'ASC' },
    });
  }

  findOne(tenantId: string, id: number) {
    return this.repo.findOne({ where: { id, tenantId } });
  }

  create(
    tenantId: string,
    data: { code: string; name: string; startTime: string; endTime: string; enabled?: number },
  ) {
    return this.repo.save(
      this.repo.create({ ...data, tenantId }),
    );
  }

  async update(
    tenantId: string,
    id: number,
    data: { code?: string; name?: string; startTime?: string; endTime?: string; enabled?: number },
  ) {
    await this.repo.update({ id, tenantId }, data);
    return this.repo.findOne({ where: { id, tenantId } });
  }

  async delete(tenantId: string, id: number) {
    return this.repo.delete({ id, tenantId });
  }
}
