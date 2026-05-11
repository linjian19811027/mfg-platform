import {
  Injectable,
  UnauthorizedException,
  HttpException,
  HttpStatus,
  Logger,
  Inject,
} from '@nestjs/common';
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
    };

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
      },
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
    return { message: 'Password changed successfully' };
  }

  async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, SALT_ROUNDS);
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
}
