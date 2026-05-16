import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator.js';
import { JwtPayload } from '../strategies/jwt.strategy.js';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<{ user: JwtPayload }>();
    const user = request.user;

    // SUPER_ADMIN / TENANT_ADMIN 角色拥有全部权限
    if (user?.roles?.includes('SUPER_ADMIN') || user?.roles?.includes('TENANT_ADMIN')) return true;

    const hasPermission = required.every((p) => user?.permissions?.includes(p));
    if (!hasPermission) {
      throw new ForbiddenException('PERM_FORBIDDEN: insufficient permission');
    }
    return true;
  }
}
