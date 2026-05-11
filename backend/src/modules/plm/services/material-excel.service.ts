import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { PlmMaterial } from '../entities/plm-material.entity.js';
import { TenantContext } from '../../../shared/tenant/tenant.context.js';

export interface ImportError {
  row: number;
  field: string;
  message: string;
}

export interface ImportResult {
  success: number;
  failed: number;
  errors: ImportError[];
}

// Excel 列定义
const COLUMNS = [
  { header: '物料编码*', key: 'code', width: 20 },
  { header: '物料名称*', key: 'name', width: 30 },
  { header: '物料类型*', key: 'type', width: 15 }, // RAW/SEMI/FINISHED
  { header: '规格型号', key: 'specification', width: 30 },
  { header: '计量单位ID*', key: 'uomId', width: 15 },
  { header: '重量(kg)', key: 'weight', width: 12 },
  { header: '体积(m³)', key: 'volume', width: 12 },
  { header: '标准成本', key: 'stdCost', width: 12 },
];

@Injectable()
export class MaterialExcelService {
  constructor(
    @InjectRepository(PlmMaterial)
    private readonly repo: Repository<PlmMaterial>,
  ) {}

  /** 导入：解析 Excel buffer，逐行校验并批量写入，返回错误明细 */
  async import(buffer: Buffer): Promise<ImportResult> {
    const tenantId = TenantContext.requireCurrentTenant();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

    const sheet = workbook.worksheets[0];
    if (!sheet) throw new BadRequestException('PLM_IMPORT_EMPTY_FILE');

    const errors: ImportError[] = [];
    const toSave: Partial<PlmMaterial>[] = [];

    // 从第2行开始（第1行是表头）
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const code = String(row.getCell(1).value ?? '').trim();
      const name = String(row.getCell(2).value ?? '').trim();
      const type = String(row.getCell(3).value ?? '')
        .trim()
        .toUpperCase();
      const specification =
        String(row.getCell(4).value ?? '').trim() || undefined;
      const uomId = String(row.getCell(5).value ?? '').trim();
      const weight = row.getCell(6).value
        ? Number(row.getCell(6).value)
        : undefined;
      const volume = row.getCell(7).value
        ? Number(row.getCell(7).value)
        : undefined;
      const stdCost = row.getCell(8).value
        ? Number(row.getCell(8).value)
        : undefined;

      // 必填校验
      if (!code) {
        errors.push({
          row: rowNumber,
          field: 'code',
          message: '物料编码不能为空',
        });
        return;
      }
      if (!name) {
        errors.push({
          row: rowNumber,
          field: 'name',
          message: '物料名称不能为空',
        });
        return;
      }
      if (!uomId) {
        errors.push({
          row: rowNumber,
          field: 'uomId',
          message: '计量单位ID不能为空',
        });
        return;
      }
      if (!['RAW', 'SEMI', 'FINISHED'].includes(type)) {
        errors.push({
          row: rowNumber,
          field: 'type',
          message: '物料类型必须为 RAW/SEMI/FINISHED',
        });
        return;
      }

      toSave.push({
        tenantId,
        code,
        name,
        type,
        specification,
        uomId,
        weight,
        volume,
        stdCost,
        status: 'DESIGN',
      });
    });

    if (toSave.length === 0) {
      return { success: 0, failed: errors.length, errors };
    }

    // 批量查重（一次查询）
    const codes = toSave.map((m) => m.code!);
    const existing = await this.repo
      .createQueryBuilder('m')
      .select('m.code')
      .where('m.tenant_id = :tenantId AND m.code IN (:...codes)', {
        tenantId,
        codes,
      })
      .getMany();
    const existingCodes = new Set(existing.map((m) => m.code));

    const finalSave: Partial<PlmMaterial>[] = [];
    for (const item of toSave) {
      if (existingCodes.has(item.code!)) {
        // 找到对应行号（从 toSave 索引推算，+2 因为表头占第1行）
        const rowNumber = toSave.indexOf(item) + 2;
        errors.push({
          row: rowNumber,
          field: 'code',
          message: `编码 ${item.code} 已存在`,
        });
      } else {
        finalSave.push(item);
      }
    }

    if (finalSave.length > 0) {
      await this.repo.save(finalSave.map((d) => this.repo.create(d)));
    }

    return { success: finalSave.length, failed: errors.length, errors };
  }

  /** 导出：生成 Excel buffer */
  async export(query: {
    categoryId?: string;
    status?: string;
    type?: string;
  }): Promise<Buffer> {
    const tenantId = TenantContext.requireCurrentTenant();

    const qb = this.repo
      .createQueryBuilder('m')
      .where('m.tenant_id = :tenantId', { tenantId });
    if (query.categoryId)
      qb.andWhere('m.category_id = :categoryId', {
        categoryId: query.categoryId,
      });
    if (query.status)
      qb.andWhere('m.status = :status', { status: query.status });
    if (query.type) qb.andWhere('m.type = :type', { type: query.type });

    const materials = await qb.orderBy('m.code', 'ASC').getMany();

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('物料清单');
    sheet.columns = COLUMNS;

    // 表头样式
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9E1F2' },
    };

    for (const m of materials) {
      sheet.addRow({
        code: m.code,
        name: m.name,
        type: m.type,
        specification: m.specification ?? '',
        uomId: m.uomId,
        weight: m.weight ?? '',
        volume: m.volume ?? '',
        stdCost: m.stdCost ?? '',
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /** 生成导入模板 */
  async template(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('物料导入模板');
    sheet.columns = COLUMNS;
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9E1F2' },
    };
    // 示例行
    sheet.addRow({
      code: 'RAW-001',
      name: '示例原材料',
      type: 'RAW',
      specification: '规格示例',
      uomId: '1',
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
