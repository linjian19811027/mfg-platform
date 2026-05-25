import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SysTenant } from '../entities/sys-tenant.entity.js';
import { JwtPayload } from '../strategies/jwt.strategy.js';

/** 始终放行的模块（基础功能，不走 enabledModules 检查） */
const ALWAYS_ALLOWED_MODULES = new Set(['SYS', 'BASE', 'AUTH', 'FILES', 'EVENTS', 'REPORTS', 'RPT']);

/** 从 URL 提取模块前缀，如 /api/v1/mes/work-orders → MES */
function extractModule(url: string): string | null {
  const match = url.match(/\/api\/v1\/([^/?]+)/);
  return match?.[1]?.toUpperCase() ?? null;
}

@Injectable()
export class ModuleGuard implements CanActivate {
  constructor(
    @InjectRepository(SysTenant)
    private readonly tenantRepo: Repository<SysTenant>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload | undefined;
    if (!user) return true; // 未认证的请求由 JwtAuthGuard 处理

    // 超管放行
    if (user.roles?.includes('SUPER_ADMIN')) return true;

    const module = extractModule(request.url);
    if (!module) return true;
    if (ALWAYS_ALLOWED_MODULES.has(module)) return true;

    // 检查租户是否启用了该模块
    const tenant = await this.tenantRepo.findOne({
      where: { code: user.tenantId },
      select: ['enabledModules'],
    });

    if (!tenant) return true; // 租户不存在时放行（由其他守卫处理）

    const enabled = tenant.enabledModules ?? [];
    if (!enabled.includes(module)) {
      throw new ForbiddenException(
        `MODULE_NOT_ENABLED: 您的租户未启用 ${module} 模块`,
      );
    }

    return true;
  }
}
