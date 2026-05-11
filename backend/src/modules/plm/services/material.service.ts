import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { PlmMaterial } from '../entities/plm-material.entity.js';
import { PlmMaterialSubstitute } from '../entities/plm-material-substitute.entity.js';
import { PlmMaterialCategory } from '../entities/plm-material-category.entity.js';
import { TenantContext } from '../../../shared/tenant/tenant.context.js';
import { UserContext } from '../../../shared/user/user.context.js';
import {
  CACHE_PROVIDER,
  CacheProvider,
} from '../../../shared/cache/cache.interface.js';
import { MaterialCodeService } from './material-code.service.js';

// 状态流转规则：key=当前状态, value=允许流转到的状态
const STATUS_TRANSITIONS: Record<string, string[]> = {
  DESIGN: ['TRIAL', 'ACTIVE'],
  TRIAL: ['ACTIVE', 'INACTIVE'],
  ACTIVE: ['INACTIVE'],
  INACTIVE: ['ACTIVE', 'OBSOLETE'],
  OBSOLETE: [],
};

// 各状态允许操作的角色（空数组=任意角色可操作）
const STATUS_ALLOWED_ROLES: Record<string, string[]> = {
  DESIGN: [],
  TRIAL: ['ENGINEER', 'ADMIN'],
  ACTIVE: ['ENGINEER', 'ADMIN'],
  INACTIVE: ['ENGINEER', 'ADMIN'],
  OBSOLETE: ['ADMIN'],
};

export interface MaterialQuery {
  categoryId?: string;
  status?: string;
  type?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class MaterialService {
  constructor(
    @InjectRepository(PlmMaterial)
    private readonly repo: Repository<PlmMaterial>,
    @InjectRepository(PlmMaterialSubstitute)
    private readonly subRepo: Repository<PlmMaterialSubstitute>,
    @InjectRepository(PlmMaterialCategory)
    private readonly categoryRepo: Repository<PlmMaterialCategory>,
    @Inject(CACHE_PROVIDER)
    private readonly cache: CacheProvider,
    private readonly codeSvc: MaterialCodeService,
  ) {}

  async findAll(
    query: MaterialQuery,
  ): Promise<{ items: PlmMaterial[]; total: number }> {
    const tenantId = TenantContext.requireCurrentTenant();
    const {
      categoryId,
      status,
      type,
      keyword,
      page = 1,
      pageSize = 20,
    } = query;

    const qb = this.repo
      .createQueryBuilder('m')
      .where('m.tenant_id = :tenantId', { tenantId });

    if (categoryId) qb.andWhere('m.category_id = :categoryId', { categoryId });
    if (status) qb.andWhere('m.status = :status', { status });
    if (type) qb.andWhere('m.type = :type', { type });
    if (keyword) {
      qb.andWhere(
        '(m.name LIKE :kw OR m.code LIKE :kw OR m.specification LIKE :kw)',
        { kw: `%${keyword}%` },
      );
    }

    const [items, total] = await qb
      .orderBy('m.created_at', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { items, total };
  }

  async findOne(id: string): Promise<PlmMaterial> {
    const tenantId = TenantContext.requireCurrentTenant();
    const cacheKey = `plm:material:${tenantId}:${id}`;
    const cached = await this.cache.get<PlmMaterial>(cacheKey);
    if (cached) return cached;

    const material = await this.repo.findOne({ where: { id, tenantId } });
    if (!material) throw new NotFoundException('PLM_MATERIAL_NOT_FOUND');

    await this.cache.set(cacheKey, material, 3600);
    return material;
  }

  async create(data: Partial<PlmMaterial>): Promise<PlmMaterial> {
    const tenantId = TenantContext.requireCurrentTenant();
    data.tenantId = tenantId;
    data.status = data.status ?? 'DESIGN';
    data.createdBy = data.createdBy ?? UserContext.getCurrentUserId();

    // ── 编码处理逻辑 ──
    const rule = await this.codeSvc.findRule(tenantId, data.categoryId);

    if (!data.code) {
      // 如果未提供编码，尝试根据规则自动生成
      if (!rule) {
        throw new BadRequestException('PLM_MATERIAL_CODE_REQUIRED');
      }

      if (rule.codeType === 'AUTO') {
        let categoryCode: string | undefined;
        if (data.categoryId) {
          const category = await this.categoryRepo.findOne({ where: { id: data.categoryId, tenantId } });
          categoryCode = category?.code;
        }
        data.code = await this.codeSvc.generate(rule.id, categoryCode);
      } else if (rule.codeType === 'MIXED') {
        // MIXED 模式通常需要用户提供后缀，如果未提供则报错
        throw new BadRequestException('PLM_MATERIAL_CODE_SUFFIX_REQUIRED');
      } else {
        // MANUAL 模式必须提供编码
        throw new BadRequestException('PLM_MATERIAL_CODE_REQUIRED');
      }
    } else {
      // 如果提供了编码，校验唯一性并根据规则校验（如果是 MANUAL 模式）
      if (rule && rule.codeType === 'MANUAL') {
        await this.codeSvc.validateManual(tenantId, data.code);
      } else {
        // 通用唯一性校验
        const exists = await this.repo.findOne({
          where: { tenantId, code: data.code },
        });
        if (exists) throw new BadRequestException('PLM_MATERIAL_CODE_EXISTS');
      }
    }

    return this.repo.save(this.repo.create(data));
  }

  async update(id: string, data: Partial<PlmMaterial>): Promise<PlmMaterial> {
    const tenantId = TenantContext.requireCurrentTenant();
    const material = await this.repo.findOne({ where: { id, tenantId } });
    if (!material) throw new NotFoundException('PLM_MATERIAL_NOT_FOUND');

    // OBSOLETE 状态不允许修改
    if (material.status === 'OBSOLETE') {
      throw new ForbiddenException('PLM_MATERIAL_OBSOLETE_READONLY');
    }

    // 只允许更新业务字段，过滤掉系统字段
    const {
      status,
      tenantId: _t,
      id: _id,
      createdAt: _ca,
      updatedAt: _ua,
      createdBy: _cb,
      updatedBy: _ub,
      ...allowedData
    } = data as any;
    void status;
    void _t;
    void _id;
    void _ca;
    void _ua;
    void _cb;
    void _ub;

    const updateData = {
      ...allowedData,
      updatedBy: UserContext.getCurrentUserId(),
    };
    await this.repo.update(id, updateData);
    // 失效缓存
    await this.cache.del(`plm:material:${material.tenantId}:${id}`);
    return { ...material, ...updateData };
  }

  async changeStatus(
    id: string,
    newStatus: string,
    userRoles: string[],
  ): Promise<PlmMaterial> {
    const tenantId = TenantContext.requireCurrentTenant();
    const material = await this.repo.findOne({ where: { id, tenantId } });
    if (!material) throw new NotFoundException('PLM_MATERIAL_NOT_FOUND');

    const allowed = STATUS_TRANSITIONS[material.status] ?? [];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `PLM_MATERIAL_INVALID_TRANSITION:${material.status}->${newStatus}`,
      );
    }

    // 角色权限检查
    const requiredRoles = STATUS_ALLOWED_ROLES[newStatus] ?? [];
    if (
      requiredRoles.length > 0 &&
      !userRoles.some((r) => requiredRoles.includes(r))
    ) {
      throw new ForbiddenException('PLM_MATERIAL_STATUS_FORBIDDEN');
    }

    await this.repo.update(id, { status: newStatus });
    // 失效缓存
    await this.cache.del(`plm:material:${material.tenantId}:${id}`);
    return { ...material, status: newStatus };
  }

  /** 查询物料被哪些 BOM 使用（反查） */
  async findBomUsage(
    materialId: string,
  ): Promise<{ bomId: string; materialId: string }[]> {
    const tenantId = TenantContext.requireCurrentTenant();
    // 通过 plm_bom_line 关联查询（BOM 实体在后续任务创建，此处用原生查询）
    const rows = await this.repo.manager.query(
      `SELECT DISTINCT bl.bom_id, b.material_id
       FROM plm_bom_line bl
       JOIN plm_bom b ON b.id = bl.bom_id
       WHERE bl.material_id = ? AND b.tenant_id = ?`,
      [materialId, tenantId],
    );
    return rows as { bomId: string; materialId: string }[];
  }

  // ── 替代关系 ──────────────────────────────────────────────────────────────

  async findSubstitutes(materialId: string): Promise<PlmMaterialSubstitute[]> {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.subRepo.find({
      where: {
        tenantId,
        materialId,
        status: 'ACTIVE',
      } as FindOptionsWhere<PlmMaterialSubstitute>,
      order: { priority: 'ASC' },
    });
  }

  async addSubstitute(
    data: Partial<PlmMaterialSubstitute>,
  ): Promise<PlmMaterialSubstitute> {
    const tenantId = TenantContext.requireCurrentTenant();
    data.tenantId = tenantId;
    return this.subRepo.save(this.subRepo.create(data));
  }

  async removeSubstitute(id: string): Promise<void> {
    const tenantId = TenantContext.requireCurrentTenant();
    await this.subRepo.update({ id, tenantId } as any, { status: 'INACTIVE' });
  }
}
