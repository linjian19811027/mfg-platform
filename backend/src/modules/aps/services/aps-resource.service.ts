import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ApsResource,
  ApsResourceStatus,
  ApsResourceType,
} from '../entities/aps-resource.entity';

export interface CreateResourceDto {
  code: string;
  name: string;
  type: ApsResourceType;
  capacity?: number;
  efficiency?: number;
  status?: ApsResourceStatus;
  alternativeResources?: string[];
  exclusiveResources?: string[];
  attributes?: Record<string, any>;
}

export interface QueryResourceDto {
  type?: ApsResourceType;
  status?: ApsResourceStatus;
  keyword?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable()
export class ApsResourceService {
  constructor(
    @InjectRepository(ApsResource)
    private readonly resourceRepo: Repository<ApsResource>,
  ) {}

  async create(
    tenantId: string,
    data: CreateResourceDto,
  ): Promise<ApsResource> {
    const resource = this.resourceRepo.create({ ...data, tenantId });
    return this.resourceRepo.save(resource);
  }

  async findAll(
    tenantId: string,
    query: QueryResourceDto = {},
  ): Promise<PaginatedResult<ApsResource>> {
    const { type, status, keyword, page = 1, pageSize = 20 } = query;

    const qb = this.resourceRepo
      .createQueryBuilder('r')
      .where('r.tenant_id = :tenantId', { tenantId });

    if (type) {
      qb.andWhere('r.type = :type', { type });
    }
    if (status) {
      qb.andWhere('r.status = :status', { status });
    }
    if (keyword) {
      qb.andWhere('(r.code LIKE :kw OR r.name LIKE :kw)', {
        kw: `%${keyword}%`,
      });
    }

    const total = await qb.getCount();
    const items = await qb
      .orderBy('r.created_at', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();

    return { items, total, page, pageSize };
  }

  async findOne(tenantId: string, id: string): Promise<ApsResource> {
    const resource = await this.resourceRepo.findOne({
      where: { id, tenantId },
    });
    if (!resource) {
      throw new NotFoundException(`ApsResource #${id} not found`);
    }
    return resource;
  }

  async update(
    tenantId: string,
    id: string,
    data: Partial<CreateResourceDto>,
  ): Promise<ApsResource> {
    const resource = await this.findOne(tenantId, id);
    Object.assign(resource, data);
    return this.resourceRepo.save(resource);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const resource = await this.findOne(tenantId, id);
    await this.resourceRepo.remove(resource);
  }

  async updateStatus(
    tenantId: string,
    id: string,
    status: ApsResourceStatus,
  ): Promise<ApsResource> {
    const resource = await this.findOne(tenantId, id);
    resource.status = status;
    return this.resourceRepo.save(resource);
  }

  async addAlternative(
    tenantId: string,
    id: string,
    alternativeId: string,
  ): Promise<void> {
    const [resource, alternative] = await Promise.all([
      this.findOne(tenantId, id),
      this.findOne(tenantId, alternativeId),
    ]);

    if (!resource.alternativeResources) resource.alternativeResources = [];
    if (!alternative.alternativeResources)
      alternative.alternativeResources = [];

    if (!resource.alternativeResources.includes(alternativeId)) {
      resource.alternativeResources = [
        ...resource.alternativeResources,
        alternativeId,
      ];
    }
    if (!alternative.alternativeResources.includes(id)) {
      alternative.alternativeResources = [
        ...alternative.alternativeResources,
        id,
      ];
    }

    await this.resourceRepo.save([resource, alternative]);
  }

  async removeAlternative(
    tenantId: string,
    id: string,
    alternativeId: string,
  ): Promise<void> {
    const [resource, alternative] = await Promise.all([
      this.findOne(tenantId, id),
      this.findOne(tenantId, alternativeId),
    ]);

    if (resource.alternativeResources) {
      resource.alternativeResources = resource.alternativeResources.filter(
        (rid) => rid !== alternativeId,
      );
    }
    if (alternative.alternativeResources) {
      alternative.alternativeResources =
        alternative.alternativeResources.filter((rid) => rid !== id);
    }

    await this.resourceRepo.save([resource, alternative]);
  }

  async getAvailableResources(
    tenantId: string,
    type?: ApsResourceType,
  ): Promise<ApsResource[]> {
    const qb = this.resourceRepo
      .createQueryBuilder('r')
      .where('r.tenant_id = :tenantId', { tenantId })
      .andWhere('r.status = :status', { status: ApsResourceStatus.AVAILABLE });

    if (type) {
      qb.andWhere('r.type = :type', { type });
    }

    return qb.orderBy('r.code', 'ASC').getMany();
  }
}
