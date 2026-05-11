import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { LogService } from './log.service.js';
import { TenantContext } from '../tenant/tenant.context.js';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly logSvc: LogService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const message = isHttp
      ? ((exception.getResponse() as { message?: string })?.message ??
        exception.message)
      : exception instanceof Error
        ? exception.message
        : 'Internal Server Error';
    const stack = exception instanceof Error ? exception.stack : undefined;

    const user = req.user as
      | { id?: string; username?: string; tenantId?: string }
      | undefined;
    const tenantId = TenantContext.getCurrentTenant() ?? user?.tenantId;
    const ip = (req.headers['x-forwarded-for'] as string) ?? req.ip;

    if (status >= 500) {
      this.logger.error(
        `[${req.method}] ${req.originalUrl} → ${status}: ${message}`,
        stack,
      );
      void this.logSvc.systemError({
        tenantId,
        userId: user?.id,
        username: user?.username,
        requestMethod: req.method,
        requestUrl: req.originalUrl,
        errorMessage: message,
        errorStack: stack,
        ipAddress: ip,
      });
    } else {
      this.logger.warn(
        `[${req.method}] ${req.originalUrl} → ${status}: ${message}`,
      );
      void this.logSvc.bizError({
        tenantId,
        userId: user?.id,
        username: user?.username,
        requestMethod: req.method,
        requestUrl: req.originalUrl,
        responseCode: status,
        errorMessage: message,
        ipAddress: ip,
      });
    }

    res.status(status).json({
      statusCode: status,
      errorCode: isHttp
        ? (exception.getResponse() as { errorCode?: string })?.errorCode
        : 'INTERNAL_SERVER_ERROR',
      message,
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
    });
  }
}
