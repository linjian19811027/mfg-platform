import {
  Injectable,
  UnauthorizedException,
  HttpException,
  HttpStatus,
  Logger,
  Inject,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { SysUser } from './entities/sys-user.entity.js';
import { SysTenant } from './entities/sys-tenant.entity.js';
import { SysUserRole } from './entities/sys-user-role.entity.js';
import { SysRolePermission } from './entities/sys-role-permission.entity.js';
import { SysRole } from './entities/sys-role.entity.js';
import { SysPermission } from './entities/sys-permission.entity.js';
import { JwtPayload } from './strategies/jwt.strategy.js';
import {
  CACHE_PROVIDER,
  CacheProvider,
} from '../../shared/cache/cache.interface.js';
import { LogService } from '../../shared/logger/log.service.js';

const LOCK_THRESHOLD = 5;
const LOCK_MINUTES = 30;
const SALT_ROUNDS = 12;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(SysUser) private readonly userRepo: Repository<SysUser>,
    @InjectRepository(SysTenant)
    private readonly tenantRepo: Repository<SysTenant>,
    @InjectRepository(SysUserRole)
    private readonly userRoleRepo: Repository<SysUserRole>,
    @InjectRepository(SysRolePermission)
    private readonly rolePermRepo: Repository<SysRolePermission>,
    @InjectRepository(SysRole) private readonly roleRepo: Repository<SysRole>,
    @InjectRepository(SysPermission)
    private readonly permRepo: Repository<SysPermission>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @Inject(CACHE_PROVIDER) private readonly cache: CacheProvider,
    private readonly logSvc: LogService,
  ) {}

  async login(
    username: string,
    password: string,
    tenantCode: string,
    meta?: { ip?: string; userAgent?: string; requestTime?: Date },
  ) {
    // 1. 查找租户
    const tenant = await this.tenantRepo.findOne({
      where: { code: tenantCode, status: 'ACTIVE' },
    });
    if (!tenant) {
      void this.logSvc.login({
        username,
        tenantId: tenantCode,
        result: 'FAILED',
        errorMessage: 'AUTH_TENANT_NOT_FOUND',
        ipAddress: meta?.ip,
        userAgent: meta?.userAgent,
        requestTime: meta?.requestTime,
      });
      throw new UnauthorizedException('AUTH_TENANT_NOT_FOUND');
    }

    // 2. 查找用户
    const user = await this.userRepo.findOne({
      where: { username, tenantId: tenant.code },
    });
    if (!user) {
      void this.logSvc.login({
        username,
        tenantId: tenantCode,
        result: 'FAILED',
        errorMessage: 'AUTH_INVALID_CREDENTIALS',
        ipAddress: meta?.ip,
        userAgent: meta?.userAgent,
        requestTime: meta?.requestTime,
      });
      throw new UnauthorizedException('AUTH_INVALID_CREDENTIALS');
    }

    // 3. 检查锁定
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remaining = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / 60000,
      );
      void this.logSvc.login({
        username,
        tenantId: tenantCode,
        userId: user.id,
        result: 'LOCKED',
        errorMessage: `Account locked, retry in ${remaining} minutes`,
        ipAddress: meta?.ip,
        userAgent: meta?.userAgent,
        requestTime: meta?.requestTime,
      });
      throw new HttpException(
        {
          errorCode: 'AUTH_USER_LOCKED',
          message: `Account locked, retry in ${remaining} minutes`,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // 4. 验证密码
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      const failCount = user.loginFailCount + 1;
      const update: Partial<SysUser> = { loginFailCount: failCount };
      if (failCount >= LOCK_THRESHOLD) {
        update.lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
        update.loginFailCount = 0;
      }
      await this.userRepo.update(user.id, update);
      void this.logSvc.login({
        username,
        tenantId: tenantCode,
        userId: user.id,
        result: 'FAILED',
        errorMessage: 'AUTH_INVALID_CREDENTIALS',
        ipAddress: meta?.ip,
        userAgent: meta?.userAgent,
        requestTime: meta?.requestTime,
      });
      throw new UnauthorizedException('AUTH_INVALID_CREDENTIALS');
    }

    // 5. 重置失败计数，更新登录时间
    await this.userRepo.update(user.id, {
      loginFailCount: 0,
      lockedUntil: undefined,
      lastLoginAt: new Date(),
    });

    // 6. 获取角色和权限
    const { roles, permissions } = await this.getUserRolesAndPermissions(
      user.id,
      tenant.code,
    );

    // 7. 记录登录成功日志
    void this.logSvc.login({
      username,
      tenantId: tenantCode,
      userId: user.id,
      result: 'SUCCESS',
      ipAddress: meta?.ip,
      userAgent: meta?.userAgent,
      requestTime: meta?.requestTime,
    });

    // 8. 生成 Token
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      tenantId: tenant.code,
      roles,
      permissions,
      tokenVersion: user.tokenVersion ?? 0,
    };

    // 9. 构建菜单树
    const menus = await this.getMenus(tenant.code, roles, permissions);

    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken: this.jwtService.sign(payload, {
        expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN', '7d'),
      }),
      expiresIn: 28800,
      tokenType: 'Bearer',
      user: {
        id: user.id,
        username: user.username,
        realName: user.realName,
        tenantId: tenant.code,
        roles,
        permissions,
        enabledModules: tenant.enabledModules ?? [],
      },
      menus,
    };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken);
      const newPayload: JwtPayload = {
        sub: payload.sub,
        username: payload.username,
        tenantId: payload.tenantId,
        roles: payload.roles,
        permissions: payload.permissions,
      };
      return {
        accessToken: this.jwtService.sign(newPayload),
        expiresIn: 28800,
      };
    } catch {
      throw new UnauthorizedException('AUTH_TOKEN_EXPIRED');
    }
  }

  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
  ) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('AUTH_USER_NOT_FOUND');

    const valid = await bcrypt.compare(oldPassword, user.password);
    if (!valid) throw new UnauthorizedException('AUTH_INVALID_CREDENTIALS');

    const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await this.userRepo.update(userId, {
      password: hashed,
      passwordChangedAt: new Date(),
    });
    // 递增 tokenVersion 使旧 token 失效
    await this.userRepo.increment({ id: userId }, 'tokenVersion', 1);
    return { message: 'Password changed successfully' };
  }

  async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, SALT_ROUNDS);
  }

  /**
   * 构建菜单树：查全部权限建树（保持父子关系），只返回 MENU 类型节点
   */
  async getMenus(tenantCode: string, roles: string[], permissions: string[]): Promise<Record<string, unknown>[]> {
    const isSuperAdmin = roles.includes('SUPER_ADMIN');

    // 查全部权限（不仅 MENU，也查 BUTTON/API，用于构建完整父子关系）
    const allPerms = await this.permRepo.find({
      order: { sortOrder: 'ASC' },
    });

    // 超管看全部，其他角色按 enabledModules 过滤
    let visibleIds: Set<string> | null = null;
    if (!isSuperAdmin) {
      const tenant = await this.tenantRepo.findOne({
        where: { code: tenantCode },
        select: ['enabledModules'],
      });
      const enabled = tenant?.enabledModules ?? [];
      const alwaysVisible = new Set(['SYS', 'BASE']);
      visibleIds = new Set(
        allPerms
          .filter((p) => alwaysVisible.has(p.module) || enabled.includes(p.module))
          .map((p) => p.id),
      );
    }

    // 构建完整树（所有类型），然后只保留 MENU 节点
    const tree = this.buildMenuTree(allPerms, visibleIds);

    // 诊断日志
    const menuCount = allPerms.filter(p => p.type === 'MENU').length;
    const linkedCount = allPerms.filter(p => p.parentCode).length;
    this.logger.log(`[getMenus] total=${allPerms.length} menu=${menuCount} parentCodeSet=${linkedCount} tree=${tree.length}`);

    return tree;
  }

  /**
   * 构建菜单树
   * @param allPerms 全部权限（用于构建父子关系）
   * @param visibleIds 可见权限 ID 集合（null = 全部可见）
   *
   * 使用 parentCode（如 'plm'、'mes'）而非 parentId（数据库 ID）构建树，
   * 因为 parentCode 在种子阶段直接赋值，不依赖单独的 linking pass。
   */
  private buildMenuTree(allPerms: SysPermission[], visibleIds: Set<string> | null): Record<string, unknown>[] {
    // 按 parentCode 分组（parentCode=null 的为根节点）
    const childrenMap = new Map<string, SysPermission[]>();
    for (const p of allPerms) {
      const pid = p.parentCode ?? '__root__';
      if (!childrenMap.has(pid)) childrenMap.set(pid, []);
      childrenMap.get(pid)!.push(p);
    }

    // 递归构建树，只保留 MENU 类型 + 可见节点
    const build = (parentCode: string): Record<string, unknown>[] => {
      const children = childrenMap.get(parentCode) ?? [];
      const result: Record<string, unknown>[] = [];

      for (const m of children) {
        // 可见性检查
        if (visibleIds && !visibleIds.has(m.id)) continue;

        // 只保留 MENU 类型节点（BUTTON/API 不进菜单）
        if (m.type !== 'MENU') continue;

        const childNodes = build(m.code);

        result.push({
          key: m.code,
          title: m.name,
          icon: m.icon,
          path: m.path,
          sortOrder: m.sortOrder,
          children: childNodes.length > 0 ? childNodes : undefined,
        });
      }

      return result.sort((a, b) => ((a.sortOrder as number) ?? 0) - ((b.sortOrder as number) ?? 0));
    };

    return build('__root__');
  }

  async switchTenant(userId: string, tenantCode: string) {
    // 验证目标租户存在且活跃
    const tenant = await this.tenantRepo.findOne({
      where: { code: tenantCode, status: 'ACTIVE' },
    });
    if (!tenant) {
      throw new UnauthorizedException('AUTH_TENANT_NOT_FOUND');
    }

    // 验证用户存在
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('AUTH_USER_NOT_FOUND');
    }

    // 获取用户在目标租户的角色和权限
    const { roles, permissions } = await this.getUserRolesAndPermissions(userId, tenantCode);

    // 记录审计日志
    void this.logSvc.login({
      username: user.username,
      tenantId: tenantCode,
      userId: user.id,
      result: 'SUCCESS',
      errorMessage: `切换租户: ${tenantCode} (${tenant.name})`,
    });

    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      tenantId: tenantCode,
      roles,
      permissions,
    };

    const menus = await this.getMenus(tenantCode, roles, permissions);

    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken: this.jwtService.sign(payload, { expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN', '7d') }),
      tenantId: tenantCode,
      menus,
    };
  }

  private async getUserRolesAndPermissions(userId: string, tenantId: string) {
    const cacheKey = `auth:perms:${tenantId}:${userId}`;
    const cached = await this.cache.get<{
      roles: string[];
      permissions: string[];
    }>(cacheKey);
    if (cached) return cached;

    const userRoles = await this.userRoleRepo.find({
      where: { userId, tenantId },
    });
    const roleIds = userRoles.map((ur) => ur.roleId);

    if (roleIds.length === 0) return { roles: [], permissions: [] };

    const roles = await this.roleRepo.findBy({ id: In(roleIds) });
    const roleCodes = roles.map((r) => r.code);

    // 管理员角色拥有全部权限
    if (roles.some((r) => r.type === 'SUPER_ADMIN')) {
      const allPerms = await this.permRepo.find();
      const allPermCodes = allPerms.map((p) => p.code);
      const result = { roles: roleCodes, permissions: allPermCodes };
      await this.cache.set(cacheKey, result, 1800);
      return result;
    }

    // 租户管理员：按租户启用的模块过滤权限
    if (roles.some((r) => r.type === 'TENANT_ADMIN')) {
      const tenant = await this.tenantRepo.findOne({
        where: { code: tenantId },
        select: ['enabledModules'],
      });
      const query = this.permRepo.createQueryBuilder('p');
      if (tenant?.enabledModules?.length) {
        query.where('p.module IN (:...modules)', { modules: tenant.enabledModules });
      }
      const perms = await query.getMany();
      const permCodes = perms.map((p) => p.code);
      const result = { roles: roleCodes, permissions: permCodes };
      await this.cache.set(cacheKey, result, 1800);
      return result;
    }

    const rolePerms = await this.rolePermRepo.find({
      where: roleIds.map((id) => ({ roleId: id, tenantId })),
    });
    const permIds = [...new Set(rolePerms.map((rp) => rp.permissionId))];

    if (permIds.length === 0) {
      const result = { roles: roleCodes, permissions: [] };
      await this.cache.set(cacheKey, result, 1800);
      return result;
    }

    const perms = await this.permRepo.findBy({ id: In(permIds) });
    const permCodes = perms.map((p) => p.code);

    const result = { roles: roleCodes, permissions: permCodes };
    await this.cache.set(cacheKey, result, 1800);
    return result;
  }

  // ── 租户到期自动禁用 ──────────────────────────────────────────────────

  @Cron(CronExpression.EVERY_HOUR)
  async checkTenantExpiry() {
    try {
      const now = new Date();
      const expired = await this.tenantRepo
        .createQueryBuilder('t')
        .where('t.expire_at IS NOT NULL')
        .andWhere('t.expire_at < :now', { now })
        .andWhere('t.status = :status', { status: 'ACTIVE' })
        .getMany();

      if (expired.length === 0) return;

      for (const tenant of expired) {
        await this.tenantRepo.update(tenant.id, { status: 'EXPIRED' });
        this.logger.warn(`租户 ${tenant.name}(${tenant.code}) 已过期，自动禁用`);
      }
    } catch (err) {
      this.logger.error('租户到期检查失败', (err as Error).stack);
    }
  }

  // ── 异常租户检查（每小时） ──────────────────────────────────────────────

  @Cron(CronExpression.EVERY_HOUR)
  async checkTenantAnomalies() {
    try {
      const maxUsers = 1000; // 阈值：单租户超过 1000 用户告警
      const tenants = await this.tenantRepo.find({ where: { status: 'ACTIVE' } });
      for (const tenant of tenants) {
        const userCount = await this.userRepo.count({ where: { tenantId: tenant.code, status: 'ACTIVE' } });
        if (userCount > (tenant.maxUsers ?? maxUsers)) {
          this.logger.warn(`租户 ${tenant.name}(${tenant.code}) 用户数 ${userCount} 超过限额 ${tenant.maxUsers}`);
        }
      }
    } catch (err) {
      this.logger.error('异常租户检查失败', (err as Error).stack);
    }
  }
}
