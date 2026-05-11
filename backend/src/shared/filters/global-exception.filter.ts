import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { requestId?: string }>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorCode = 'INTERNAL_ERROR';
    let message = 'Internal server error';
    let details: unknown = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse() as Record<string, unknown>;
      message = (res['message'] as string) || exception.message;
      errorCode = (res['errorCode'] as string) || `HTTP_${status}`;
      if (Array.isArray(res['message'])) {
        // ValidationPipe 错误
        details = res['message'];
        message = 'Validation failed';
        errorCode = 'VALIDATION_ERROR';
      }
    } else if (exception instanceof QueryFailedError) {
      status = HttpStatus.BAD_REQUEST;
      errorCode = 'DATABASE_ERROR';
      const err = exception as QueryFailedError & { code?: string };
      if (err.code === 'ER_DUP_ENTRY') {
        errorCode = 'DUPLICATE_ENTRY';
        message = 'Duplicate entry, resource already exists';
      } else {
        message = 'Database operation failed';
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    this.logger.error(
      `${request.method} ${request.url} → ${status} [${errorCode}] ${message}`,
      exception instanceof Error ? exception.stack : '',
    );

    response.status(status).json({
      code: status,
      errorCode,
      message,
      details,
      timestamp: new Date().toISOString(),
      requestId: request.requestId || 'unknown',
    });
  }
}
