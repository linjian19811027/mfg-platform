import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { TenantContext } from './tenant.context.js';
import { UserContext } from '../user/user.context.js';

interface JwtUser {
  tenantId?: string;
  sub?: string;
  username?: string;
}

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{ user?: JwtUser }>();
    const tenantId = request.user?.tenantId;
    const userId = request.user?.sub;

    if (tenantId) {
      return new Observable((observer) => {
        TenantContext.setCurrentTenant(tenantId, () => {
          const run = () =>
            next.handle().subscribe({
              next: (val) => observer.next(val),
              error: (err: unknown) => observer.error(err),
              complete: () => observer.complete(),
            });
          if (userId) {
            UserContext.setCurrentUser(userId, run);
          } else {
            run();
          }
        });
      });
    }

    return next.handle();
  }
}
