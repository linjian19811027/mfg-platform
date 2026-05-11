import {
  BadRequestException,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';
import { JwtPayload } from '../strategies/jwt.strategy.js';

interface TenantRequest {
  user?: JwtPayload;
  headers?: Record<string, string | string[] | undefined>;
  query?: Record<string, unknown>;
}

function pickHeaderTenant(
  headers?: Record<string, string | string[] | undefined>,
): string | undefined {
  if (!headers) return undefined;
  const candidate = headers['x-tenant-id'];
  if (typeof candidate === 'string' && candidate.trim())
    return candidate.trim();
  if (Array.isArray(candidate)) {
    const first = candidate.find((v) => typeof v === 'string' && v.trim());
    return first?.trim();
  }
  return undefined;
}

export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<TenantRequest>();

    const fromJwt = request.user?.tenantId?.trim();
    if (fromJwt) return fromJwt;

    const fromHeader = pickHeaderTenant(request.headers);
    if (fromHeader) return fromHeader;

    // Compatibility fallback for legacy endpoints. New code should not rely on query tenantId.
    const fromQuery = request.query?.tenantId;
    if (typeof fromQuery === 'string' && fromQuery.trim())
      return fromQuery.trim();

    throw new BadRequestException({
      errorCode: 'TENANT_ID_MISSING',
      message:
        'Tenant id is required from JWT (preferred) or X-Tenant-Id header',
    });
  },
);
