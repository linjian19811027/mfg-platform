/**
 * 过滤掉不允许通过 API 更新的系统字段
 * 防止前端传入 id/createdAt/updatedAt 等字段导致 TypeORM 报错
 */
const SYSTEM_FIELDS = new Set([
  'id',
  'tenantId',
  'tenant_id',
  'createdAt',
  'created_at',
  'createdBy',
  'created_by',
  'updatedAt',
  'updated_at',
  'updatedBy',
  'updated_by',
]);

export function sanitizeUpdateData<T extends Record<string, unknown>>(
  data: T,
): Partial<T> {
  const result: Partial<T> = {};
  for (const [key, value] of Object.entries(data)) {
    if (!SYSTEM_FIELDS.has(key)) {
      (result as Record<string, unknown>)[key] = value;
    }
  }
  return result;
}
