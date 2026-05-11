import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request } from 'express';

const SENSITIVE_FIELDS = new Set([
  'phone',
  'mobile',
  'tel',
  'telephone',
  'bankaccount',
  'bankno',
  'accountno',
  'cardno',
  'idcard',
  'idno',
  'password',
  'passwd',
  'pwd',
]);

function normalizeListPayload(data: unknown): unknown {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return data;
  const source = data as Record<string, unknown>;

  if (!('list' in source) && Array.isArray(source.items)) {
    return { ...source, list: source.items };
  }

  return source;
}

function maskValue(key: string, value: unknown): unknown {
  if (typeof value !== 'string' || !value) return value;
  const k = key.toLowerCase().replace(/[_-]/g, '');

  if (k === 'password' || k === 'passwd' || k === 'pwd') return '******';
  if (k === 'phone' || k === 'mobile' || k === 'tel' || k === 'telephone')
    return value.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
  if (
    k === 'bankaccount' ||
    k === 'bankno' ||
    k === 'accountno' ||
    k === 'cardno'
  )
    return '****' + value.slice(-4);
  if (k === 'idcard' || k === 'idno')
    return value.replace(/^(.{3})(.+)(.{4})$/, '$1****$3');
  return value;
}

function desensitize(data: unknown): unknown {
  if (data === null || data === undefined) return data;
  if (Array.isArray(data)) return data.map(desensitize);
  if (typeof data === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(data as Record<string, unknown>)) {
      const normalizedKey = key.toLowerCase().replace(/[_-]/g, '');
      result[key] = SENSITIVE_FIELDS.has(normalizedKey)
        ? maskValue(key, val)
        : desensitize(val);
    }
    return result;
  }
  return data;
}

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { requestId?: string }>();

    return next.handle().pipe(
      map((data) => ({
        code: 200,
        message: 'success',
        data: desensitize(normalizeListPayload(data)),
        timestamp: new Date().toISOString(),
        requestId: request.requestId || 'unknown',
      })),
    );
  }
}
