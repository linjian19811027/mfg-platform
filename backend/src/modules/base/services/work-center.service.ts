import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MfgWorkCenter } from '../entities/mfg-work-center.entity.js';

@Injectable()
export class WorkCenterService {
  constructor(
    @InjectRepository(MfgWorkCenter)
    private readonly repo: Repository<MfgWorkCenter>,
  ) {}

  findAll(tenantId: string) {
    return this.repo.find({
      where: { tenantId, enabled: 1 },
      order: { name: 'ASC' },
    });
  }

  findOne(tenantId: string, id: number) {
    return this.repo.findOne({ where: { id, tenantId } });
  }

  create(tenantId: string, data: { name: string; code?: string; description?: string }) {
    return this.repo.save(
      this.repo.create({ ...data, tenantId }),
    );
  }

  async update(tenantId: string, id: number, data: { name?: string; code?: string; description?: string; enabled?: number }) {
    await this.repo.update({ id, tenantId }, data);
    return this.repo.findOne({ where: { id, tenantId } });
  }

  async delete(tenantId: string, id: number) {
    return this.repo.delete({ id, tenantId });
  }
}
