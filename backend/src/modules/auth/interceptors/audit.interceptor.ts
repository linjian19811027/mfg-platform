import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request } from 'express';
import { LogService } from '../../../shared/logger/log.service.js';
import { TenantContext } from '../../../shared/tenant/tenant.context.js';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const SENSITIVE_KEYS = new Set([
  'password',
  'oldPassword',
  'newPassword',
  'confirmPassword',
  'token',
  'secret',
]);

function sanitize(obj: unknown): unknown {
  if (!obj || typeof obj !== 'object') return obj;
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    result[k] = SENSITIVE_KEYS.has(k) ? '***' : sanitize(v);
  }
  return result;
}

/** 从 URL 提取模块名，如 /api/v1/plm/materials → plm */
function extractModule(url: string): string {
  const match = url.match(/\/api\/v1\/([^/?]+)/);
  return match?.[1]?.toUpperCase() ?? '';
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly logSvc: LogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    if (!WRITE_METHODS.has(req.method)) return next.handle();

    const startTime = Date.now();
    const requestTime = new Date();
    const user = req.user as
      | { id?: string; username?: string; tenantId?: string }
      | undefined;
    const module = extractModule(req.originalUrl);

    return next.handle().pipe(
      tap({
        next: () => {
          void this.logSvc.operation({
            tenantId: TenantContext.getCurrentTenant() ?? user?.tenantId,
            userId: user?.id,
            username: user?.username,
            module,
            action: `${req.method} ${req.originalUrl.split('?')[0]}`,
            requestMethod: req.method,
            requestUrl: req.originalUrl,
            requestTime,
            requestBody: req.body
              ? JSON.stringify(sanitize(req.body as unknown))
              : undefined,
            responseCode: 200,
            ipAddress: (req.headers['x-forwarded-for'] as string) ?? req.ip,
            userAgent: req.headers['user-agent'],
            durationMs: Date.now() - startTime,
          });
        },
        error: (err: { status?: number; message?: string }) => {
          const code = err?.status ?? 500;
          const isSystemError = code >= 500;
          if (isSystemError) {
            void this.logSvc.systemError({
              tenantId: TenantContext.getCurrentTenant() ?? user?.tenantId,
              userId: user?.id,
              username: user?.username,
              requestMethod: req.method,
              requestUrl: req.originalUrl,
              requestTime,
              errorMessage: err?.message ?? 'Internal Server Error',
              errorStack: (err as Error)?.stack,
              ipAddress: (req.headers['x-forwarded-for'] as string) ?? req.ip,
              durationMs: Date.now() - startTime,
            });
          } else {
            void this.logSvc.bizError({
              tenantId: TenantContext.getCurrentTenant() ?? user?.tenantId,
              userId: user?.id,
              username: user?.username,
              requestMethod: req.method,
              requestUrl: req.originalUrl,
              requestTime,
              responseCode: code,
              errorMessage: err?.message ?? 'Business Error',
              ipAddress: (req.headers['x-forwarded-for'] as string) ?? req.ip,
              durationMs: Date.now() - startTime,
            });
          }
        },
      }),
    );
  }
}
