import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { SysController } from './sys.controller.js';
import { AuditInterceptor } from './interceptors/audit.interceptor.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';
import { PermissionsGuard } from './guards/permissions.guard.js';
import { SysUser } from './entities/sys-user.entity.js';
import { SysTenant } from './entities/sys-tenant.entity.js';
import { SysRole } from './entities/sys-role.entity.js';
import { SysPermission } from './entities/sys-permission.entity.js';
import { SysUserRole } from './entities/sys-user-role.entity.js';
import { SysRolePermission } from './entities/sys-role-permission.entity.js';
import { SysAuditLog } from './entities/sys-audit-log.entity.js';
import { SysOrganization } from '../base/entities/sys-organization.entity.js';
import { SysUom, SysUomConversion } from '../base/entities/sys-uom.entity.js';
import { CacheModule } from '../../shared/cache/cache.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SysUser,
      SysTenant,
      SysRole,
      SysPermission,
      SysUserRole,
      SysRolePermission,
      SysAuditLog,
      SysOrganization,
      SysUom,
      SysUomConversion,
    ]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'fallback-secret'),
        signOptions: {
          expiresIn: config.get<string>(
            'JWT_EXPIRES_IN',
            '8h',
          ) as unknown as number,
        },
      }),
    }),
    CacheModule,
  ],
  controllers: [AuthController, SysController],
  providers: [
    AuthService,
    JwtStrategy,
    // 全局拦截器：记录所有写操作日志
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
    // 全局注册 JWT 守卫（所有接口默认需要认证，用 @Public() 豁免）
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
