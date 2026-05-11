import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import * as ExcelJS from 'exceljs';
import { HrEmployee, EmployeeStatus } from '../entities/hr-employee.entity.js';
import { HrCertificationType } from '../entities/hr-certification-type.entity.js';
import { HrEmployeeCertification } from '../entities/hr-employee-certification.entity.js';
import {
  MESSAGE_SERVICE,
  MessageService,
} from '../../../shared/message/message.interface.js';
import { EventTypes } from '../../event/event-types.constant.js';
import { v4 as uuidv4 } from 'uuid';

// ── DTOs ─────────────────────────────────────────────────────────────────────

export interface CreateCertTypeDto {
  code: string;
  name: string;
  isMandatory?: boolean;
  defaultValidityMonths?: number;
}

export interface AddCertDto {
  certTypeId: number;
  certNo: string;
  issueDate: string;
  expireDate: string;
  issuer?: string;
  attachmentPath?: string;
  remark?: string;
}

export interface RenewCertDto {
  expireDate: string;
  remark?: string;
}

export interface ExpiringAlertDto {
  expiringSoonCount: number;
  expiredCount: number;
  byType: {
    certTypeCode: string;
    certTypeName: string;
    expiringSoonCount: number;
    expiredCount: number;
  }[];
}

// ── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class CertificationService {
  private readonly logger = new Logger(CertificationService.name);

  constructor(
    @InjectRepository(HrEmployee)
    private readonly employeeRepo: Repository<HrEmployee>,
    @InjectRepository(HrCertificationType)
    private readonly certTypeRepo: Repository<HrCertificationType>,
    @InjectRepository(HrEmployeeCertification)
    private readonly certRepo: Repository<HrEmployeeCertification>,
    private readonly dataSource: DataSource,
    @Inject(MESSAGE_SERVICE)
    private readonly messageSvc: MessageService,
  ) {}

  // ── 3.2.1 认证类型 CRUD ───────────────────────────────────────────────────

  async createType(
    tenantId: string,
    dto: CreateCertTypeDto,
  ): Promise<HrCertificationType> {
    const existing = await this.certTypeRepo.findOne({
      where: { code: dto.code, tenantId },
    });
    if (existing) {
      throw new BadRequestException(`认证类型代码 ${dto.code} 已存在`);
    }

    const certType = this.certTypeRepo.create({
      tenantId,
      code: dto.code,
      name: dto.name,
      isMandatory: dto.isMandatory ? 1 : 0,
      defaultValidityMonths: dto.defaultValidityMonths ?? 12,
      enabled: 1,
    });

    return this.certTypeRepo.save(certType);
  }

  async findTypes(tenantId: string): Promise<HrCertificationType[]> {
    return this.certTypeRepo.find({
      where: { tenantId },
      order: { code: 'ASC' },
    });
  }

  // ── 3.2.2 为员工添加认证 ──────────────────────────────────────────────────

  async addCertification(
    tenantId: string,
    empId: number,
    dto: AddCertDto,
  ): Promise<HrEmployeeCertification> {
    // 校验员工存在且在职
    const employee = await this.employeeRepo.findOne({
      where: { id: empId, tenantId },
    });
    if (!employee) {
      throw new NotFoundException(`员工 ${empId} 不存在`);
    }
    if (employee.status !== EmployeeStatus.ACTIVE) {
      throw new BadRequestException(
        `员工 ${employee.empNo} 状态为 ${employee.status}，仅在职员工可添加认证`,
      );
    }

    // 校验认证类型存在
    const certType = await this.certTypeRepo.findOne({
      where: { id: dto.certTypeId, tenantId },
    });
    if (!certType) {
      throw new NotFoundException(`认证类型 ${dto.certTypeId} 不存在`);
    }

    const cert = this.certRepo.create({
      tenantId,
      empId,
      certTypeId: dto.certTypeId,
      certNo: dto.certNo,
      issueDate: dto.issueDate,
      expireDate: dto.expireDate,
      issuer: dto.issuer,
      attachmentPath: dto.attachmentPath,
      remark: dto.remark,
    });

    const saved = await this.certRepo.save(cert);

    // 发布 CERTIFICATION_UPDATED 事件
    await this.publishCertEvent(
      tenantId,
      empId,
      certType.code,
      'ADD',
      dto.expireDate,
    );

    return saved;
  }

  // ── 3.2.3 续期 ────────────────────────────────────────────────────────────

  async renew(
    tenantId: string,
    certId: number,
    dto: RenewCertDto,
  ): Promise<HrEmployeeCertification> {
    const cert = await this.certRepo.findOne({
      where: { id: certId, tenantId },
    });
    if (!cert) {
      throw new NotFoundException(`认证记录 ${certId} 不存在`);
    }

    cert.expireDate = dto.expireDate;
    if (dto.remark !== undefined) cert.remark = dto.remark;

    const saved = await this.certRepo.save(cert);

    // 查询认证类型 code
    const certType = await this.certTypeRepo.findOne({
      where: { id: cert.certTypeId, tenantId },
    });
    await this.publishCertEvent(
      tenantId,
      cert.empId,
      certType?.code ?? String(cert.certTypeId),
      'RENEW',
      dto.expireDate,
    );

    return saved;
  }

  // ── 3.2.4 删除认证 ────────────────────────────────────────────────────────

  async delete(tenantId: string, certId: number): Promise<void> {
    const cert = await this.certRepo.findOne({
      where: { id: certId, tenantId },
    });
    if (!cert) {
      throw new NotFoundException(`认证记录 ${certId} 不存在`);
    }

    const { empId, certTypeId } = cert;
    await this.certRepo.remove(cert);

    const certType = await this.certTypeRepo.findOne({
      where: { id: certTypeId, tenantId },
    });
    await this.publishCertEvent(
      tenantId,
      empId,
      certType?.code ?? String(certTypeId),
      'DELETE',
    );
  }

  // ── 3.2.5 查询员工认证列表 ────────────────────────────────────────────────

  async findByEmployee(
    tenantId: string,
    empId: number,
  ): Promise<HrEmployeeCertification[]> {
    // 校验员工存在
    const employee = await this.employeeRepo.findOne({
      where: { id: empId, tenantId },
    });
    if (!employee) {
      throw new NotFoundException(`员工 ${empId} 不存在`);
    }

    return this.certRepo.find({
      where: { empId, tenantId },
      order: { expireDate: 'ASC' },
    });
  }

  // ── 3.2.6 按认证类型查询有效员工列表 ─────────────────────────────────────

  async findByType(
    tenantId: string,
    certTypeCode: string,
  ): Promise<HrEmployeeCertification[]> {
    const certType = await this.certTypeRepo.findOne({
      where: { code: certTypeCode, tenantId },
    });
    if (!certType) {
      throw new NotFoundException(`认证类型 ${certTypeCode} 不存在`);
    }

    // 查询持有该认证且未过期的员工
    return this.certRepo
      .createQueryBuilder('c')
      .where('c.tenant_id = :tenantId', { tenantId })
      .andWhere('c.cert_type_id = :certTypeId', { certTypeId: certType.id })
      .andWhere('c.expire_date > CURDATE()')
      .orderBy('c.emp_id', 'ASC')
      .getMany();
  }

  // ── 3.2.7 即将到期/已过期预警 ─────────────────────────────────────────────

  async getExpiringAlert(tenantId: string): Promise<ExpiringAlertDto> {
    // 总计数
    const rows = await this.dataSource.query<
      {
        certTypeCode: string;
        certTypeName: string;
        expiringSoon: string;
        expired: string;
      }[]
    >(
      `SELECT
         ct.code        AS certTypeCode,
         ct.name        AS certTypeName,
         SUM(IF(c.expire_date >= CURDATE() AND c.expire_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY), 1, 0)) AS expiringSoon,
         SUM(IF(c.expire_date < CURDATE(), 1, 0))       AS expired
       FROM hr_employee_certification c
       JOIN hr_certification_type ct ON ct.id = c.cert_type_id
       WHERE c.tenant_id = ?
       GROUP BY ct.id, ct.code, ct.name
       ORDER BY ct.code`,
      [tenantId],
    );

    let expiringSoonCount = 0;
    let expiredCount = 0;
    const byType = rows.map((r) => {
      const es = Number(r.expiringSoon);
      const ex = Number(r.expired);
      expiringSoonCount += es;
      expiredCount += ex;
      return {
        certTypeCode: r.certTypeCode,
        certTypeName: r.certTypeName,
        expiringSoonCount: es,
        expiredCount: ex,
      };
    });

    return { expiringSoonCount, expiredCount, byType };
  }

  // ── 3.2.8 导出 Excel ──────────────────────────────────────────────────────

  async exportExcel(tenantId: string): Promise<Buffer> {
    // 查询即将到期和已过期的认证，最多 5000 条
    const certs = await this.certRepo
      .createQueryBuilder('c')
      .where('c.tenant_id = :tenantId', { tenantId })
      .andWhere(
        '(c.expire_date < CURDATE() OR (c.expire_date >= CURDATE() AND c.expire_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)))',
      )
      .orderBy('c.expire_date', 'ASC')
      .take(5000)
      .getMany();

    // 批量查询员工和认证类型信息
    const empIds = [...new Set(certs.map((c) => c.empId))];
    const certTypeIds = [...new Set(certs.map((c) => c.certTypeId))];
    const empMap = new Map<number, any>();
    const certTypeMap = new Map<number, any>();
    if (empIds.length) {
      const emps = await this.employeeRepo.findByIds(empIds);
      emps.forEach((e) => empMap.set(e.id, e));
    }
    if (certTypeIds.length) {
      const types = await this.certTypeRepo.findByIds(certTypeIds);
      types.forEach((t) => certTypeMap.set(t.id, t));
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('认证预警清单');

    sheet.columns = [
      { header: '员工工号', key: 'empNo', width: 15 },
      { header: '员工姓名', key: 'empName', width: 12 },
      { header: '认证类型', key: 'certTypeName', width: 20 },
      { header: '证书编号', key: 'certNo', width: 20 },
      { header: '有效期至', key: 'expireDate', width: 14 },
      { header: '状态', key: 'statusLabel', width: 12 },
    ];

    // 表头样式
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9E1F2' },
    };

    for (const cert of certs) {
      const isExpired = new Date(cert.expireDate) < new Date();
      const statusLabel = isExpired ? '已过期' : '即将到期';
      const emp = empMap.get(cert.empId);
      const certType = certTypeMap.get(cert.certTypeId);
      sheet.addRow({
        empNo: emp?.empNo ?? '',
        empName: emp?.name ?? '',
        certTypeName: certType?.name ?? '',
        certNo: cert.certNo,
        expireDate: cert.expireDate,
        statusLabel,
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  // ── 3.2.9 每日检查即将到期认证 ───────────────────────────────────────────

  @Cron('0 9 * * *')
  async checkExpiring(): Promise<void> {
    this.logger.log('[CertificationService] 开始每日到期认证检查...');

    try {
      // 查询所有租户即将到期（30天内）认证
      const rows = await this.dataSource.query<
        {
          tenantId: string;
          empNo: string;
          empName: string;
          certTypeCode: string;
          certTypeName: string;
          expireDate: string;
        }[]
      >(
        `SELECT
           c.tenant_id   AS tenantId,
           emp.emp_no    AS empNo,
           emp.name      AS empName,
           ct.code       AS certTypeCode,
           ct.name       AS certTypeName,
           c.expire_date AS expireDate
         FROM hr_employee_certification c
         JOIN hr_employee emp ON emp.id = c.emp_id
         JOIN hr_certification_type ct ON ct.id = c.cert_type_id
         WHERE c.expire_date >= CURDATE() AND c.expire_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
           AND emp.status = 'ACTIVE'
         ORDER BY c.expire_date ASC
         LIMIT 1000`,
      );

      if (rows.length === 0) {
        this.logger.log('[CertificationService] 无即将到期认证');
        return;
      }

      this.logger.warn(
        `[CertificationService] 发现 ${rows.length} 条即将到期认证，详情如下：`,
      );

      for (const row of rows) {
        this.logger.warn(
          `  租户=${row.tenantId} 员工=${row.empNo}(${row.empName}) ` +
            `认证=${row.certTypeCode}(${row.certTypeName}) 到期=${row.expireDate}`,
        );
      }

      this.logger.log('[CertificationService] 每日到期认证检查完成');
    } catch (err) {
      this.logger.error(`[CertificationService] 每日到期检查异常: ${err}`);
    }
  }

  // ── 私有：发布认证变更事件 ────────────────────────────────────────────────

  private async publishCertEvent(
    tenantId: string,
    empId: number,
    certTypeCode: string,
    action: 'ADD' | 'RENEW' | 'DELETE',
    expireDate?: string,
  ): Promise<void> {
    try {
      await this.messageSvc.publish({
        eventId: uuidv4(),
        eventType: EventTypes.CERTIFICATION_UPDATED,
        tenantId,
        sourceModule: 'HR',
        payload: {
          tenantId,
          empId,
          certTypeCode,
          action,
          ...(expireDate !== undefined ? { expireDate } : {}),
        },
        createdAt: new Date(),
      });
    } catch (err) {
      this.logger.error(
        `[CertificationService] 发布 CERTIFICATION_UPDATED 事件失败: ${err}`,
      );
    }
  }
}
