import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HrCertificationType } from '../../hr/entities/hr-certification-type.entity.js';

@Injectable()
export class CertificationTypeService {
  constructor(
    @InjectRepository(HrCertificationType)
    private readonly repo: Repository<HrCertificationType>,
  ) {}

  findAll(tenantId: string) {
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
    data: { code: string; name: string; isMandatory?: number; defaultValidityMonths?: number },
  ) {
    return this.repo.save(
      this.repo.create({ ...data, tenantId }),
    );
  }

  async update(
    tenantId: string,
    id: number,
    data: { code?: string; name?: string; isMandatory?: number; defaultValidityMonths?: number },
  ) {
    await this.repo.update({ id, tenantId }, data);
    return this.repo.findOne({ where: { id, tenantId } });
  }

  async delete(tenantId: string, id: number) {
    return this.repo.delete({ id, tenantId });
  }
}
