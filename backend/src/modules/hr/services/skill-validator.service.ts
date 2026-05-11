import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface ValidationResult {
  valid: boolean;
  warnings: string[]; // 即将到期（7天内）的认证预警
  errors: string[]; // 缺失或已过期的认证错误
  missingCerts: { code: string; name: string }[];
  expiredCerts: { code: string; name: string; expireDate: string }[];
  expiringSoonCerts: { code: string; name: string; expireDate: string }[];
}

interface OperationRow {
  required_cert_codes: string | null;
}

interface EmployeeRow {
  id: string;
  emp_no: string;
}

interface CertRow {
  id: string;
  expire_date: string;
  is_expired: number;
  code: string;
  name: string;
  is_expiring_7days: number;
}

@Injectable()
export class SkillValidatorService {
  private readonly logger = new Logger(SkillValidatorService.name);

  constructor(private readonly dataSource: DataSource) {}

  async validate(
    tenantId: string,
    empId: string,
    operationId: string,
  ): Promise<ValidationResult> {
    const empty: ValidationResult = {
      valid: true,
      warnings: [],
      errors: [],
      missingCerts: [],
      expiredCerts: [],
      expiringSoonCerts: [],
    };

    // 1. 解析员工实际 id（empId 可能是 emp_no 或数字 id）
    const employee = await this.resolveEmployee(tenantId, empId);
    if (!employee) {
      this.logger.warn(
        `SkillValidator: 员工 ${empId} 不存在（tenantId=${tenantId}），跳过技能校验`,
      );
      return empty;
    }

    // 2. 查询工序所需认证 codes
    const opRows = await this.dataSource.query<OperationRow[]>(
      `SELECT required_cert_codes FROM mes_operation WHERE id = ? AND tenant_id = ?`,
      [operationId, tenantId],
    );

    if (!opRows.length) {
      return empty;
    }

    const rawCodes = opRows[0].required_cert_codes;
    if (!rawCodes) {
      // 工序未配置技能认证要求，跳过校验
      return empty;
    }

    let requiredCodes: string[];
    try {
      requiredCodes =
        typeof rawCodes === 'string' ? JSON.parse(rawCodes) : rawCodes;
    } catch {
      this.logger.warn(
        `SkillValidator: 工序 ${operationId} required_cert_codes 解析失败：${rawCodes}`,
      );
      return empty;
    }

    if (!Array.isArray(requiredCodes) || requiredCodes.length === 0) {
      return empty;
    }

    // 3. 查询员工持有的认证（含过期状态和7天内到期标记）
    const placeholders = requiredCodes.map(() => '?').join(', ');
    const certRows = await this.dataSource.query<CertRow[]>(
      `SELECT
         c.id, c.expire_date,
         IF(c.expire_date < CURDATE(), 1, 0) AS is_expired,
         ct.code, ct.name,
         IF(c.expire_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY), 1, 0) AS is_expiring_7days
       FROM hr_employee_certification c
       JOIN hr_certification_type ct ON ct.id = c.cert_type_id
       WHERE c.tenant_id = ? AND c.emp_id = ? AND ct.code IN (${placeholders})`,
      [tenantId, employee.id, ...requiredCodes],
    );

    // 4. 构建员工已持有的认证 map（code → row）
    const heldMap = new Map<string, CertRow>();
    for (const row of certRows) {
      // 若同一 code 有多条，优先保留未过期的
      const existing = heldMap.get(row.code);
      if (!existing || (existing.is_expired && !row.is_expired)) {
        heldMap.set(row.code, row);
      }
    }

    const result: ValidationResult = {
      valid: true,
      warnings: [],
      errors: [],
      missingCerts: [],
      expiredCerts: [],
      expiringSoonCerts: [],
    };

    // 5. 检查缺失认证
    for (const code of requiredCodes) {
      if (!heldMap.has(code)) {
        // 需要认证类型名称，查一下
        const typeRows = await this.dataSource.query<{ name: string }[]>(
          `SELECT name FROM hr_certification_type WHERE tenant_id = ? AND code = ? LIMIT 1`,
          [tenantId, code],
        );
        const name = typeRows[0]?.name ?? code;
        result.missingCerts.push({ code, name });
        result.errors.push(`缺少认证：${name}（${code}）`);
      }
    }

    // 6. 检查已过期 / 即将到期
    for (const [, row] of heldMap) {
      if (row.is_expired) {
        result.expiredCerts.push({
          code: row.code,
          name: row.name,
          expireDate: row.expire_date,
        });
        result.errors.push(
          `认证已过期：${row.name}（${row.code}），过期日期：${row.expire_date}`,
        );
      } else if (row.is_expiring_7days) {
        result.expiringSoonCerts.push({
          code: row.code,
          name: row.name,
          expireDate: row.expire_date,
        });
        result.warnings.push(
          `认证即将到期（7天内）：${row.name}（${row.code}），到期日期：${row.expire_date}`,
        );
      }
    }

    // 7. 有缺失或过期 → valid=false，记录日志
    if (result.errors.length > 0) {
      result.valid = false;
      this.logger.warn(
        `SkillValidator 校验失败 | 员工工号=${employee.emp_no} | 工序ID=${operationId} | ` +
          `缺失/过期认证=[${[...result.missingCerts, ...result.expiredCerts].map((c) => c.code).join(',')}] | ` +
          `校验时间=${new Date().toISOString()}`,
      );
    }

    return result;
  }

  // ── 内部：解析员工（empId 可能是 emp_no 或数字 id）────────────────────────

  private async resolveEmployee(
    tenantId: string,
    empId: string,
  ): Promise<EmployeeRow | null> {
    const isNumericId = /^\d+$/.test(empId);

    if (isNumericId) {
      const rows = await this.dataSource.query<EmployeeRow[]>(
        `SELECT id, emp_no FROM hr_employee WHERE id = ? AND tenant_id = ? LIMIT 1`,
        [empId, tenantId],
      );
      if (rows.length) return rows[0];
    }

    // 按 emp_no 查找
    const rows = await this.dataSource.query<EmployeeRow[]>(
      `SELECT id, emp_no FROM hr_employee WHERE emp_no = ? AND tenant_id = ? LIMIT 1`,
      [empId, tenantId],
    );
    return rows[0] ?? null;
  }
}
