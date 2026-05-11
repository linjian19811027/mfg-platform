import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { PlmBom } from '../entities/plm-bom.entity.js';
import { PlmBomLine } from '../entities/plm-bom-line.entity.js';
import { PlmMaterial } from '../entities/plm-material.entity.js';
import { BomService } from './bom.service.js';
import { TenantContext } from '../../../shared/tenant/tenant.context.js';

export interface BomImportError {
  row: number;
  field: string;
  message: string;
}

export interface BomImportResult {
  success: number;
  failed: number;
  errors: BomImportError[];
}

/**
 * BOM Excel 格式（平铺，每行一个 BOM 明细）：
 * 成品物料编码 | 成品物料名称 | 子料编码* | 子料名称 | 用量* | 计量单位ID* | 损耗率 | 父行序号 | 行序号*
 */
const BOM_COLUMNS = [
  { header: '成品物料编码*', key: 'parentCode', width: 20 },
  { header: '成品物料名称', key: 'parentName', width: 30 },
  { header: '子料编码*', key: 'childCode', width: 20 },
  { header: '子料名称', key: 'childName', width: 30 },
  { header: '用量*', key: 'quantity', width: 12 },
  { header: '计量单位ID*', key: 'uomId', width: 15 },
  { header: '损耗率', key: 'lossRate', width: 10 },
  { header: '父行序号', key: 'parentSeq', width: 12 },
  { header: '行序号*', key: 'sequence', width: 10 },
];

@Injectable()
export class BomExcelService {
  constructor(
    @InjectRepository(PlmBom)
    private readonly bomRepo: Repository<PlmBom>,
    @InjectRepository(PlmBomLine)
    private readonly lineRepo: Repository<PlmBomLine>,
    @InjectRepository(PlmMaterial)
    private readonly materialRepo: Repository<PlmMaterial>,
    private readonly bomService: BomService,
  ) {}

  async import(buffer: Buffer): Promise<BomImportResult> {
    const tenantId = TenantContext.requireCurrentTenant();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

    const sheet = workbook.worksheets[0];
    if (!sheet) throw new BadRequestException('PLM_BOM_IMPORT_EMPTY_FILE');

    const errors: BomImportError[] = [];

    // 按成品物料编码分组
    const groups = new Map<
      string,
      {
        row: number;
        childCode: string;
        quantity: number;
        uomId: string;
        lossRate: number;
        parentSeq?: number;
        sequence: number;
      }[]
    >();

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const parentCode = String(row.getCell(1).value ?? '').trim();
      const childCode = String(row.getCell(3).value ?? '').trim();
      const quantity = Number(row.getCell(5).value ?? 0);
      const uomId = String(row.getCell(6).value ?? '').trim();
      const lossRate = Number(row.getCell(7).value ?? 0);
      const parentSeq = row.getCell(8).value
        ? Number(row.getCell(8).value)
        : undefined;
      const sequence = Number(row.getCell(9).value ?? rowNumber - 1);

      if (!parentCode) {
        errors.push({
          row: rowNumber,
          field: 'parentCode',
          message: '成品物料编码不能为空',
        });
        return;
      }
      if (!childCode) {
        errors.push({
          row: rowNumber,
          field: 'childCode',
          message: '子料编码不能为空',
        });
        return;
      }
      if (!quantity || quantity <= 0) {
        errors.push({
          row: rowNumber,
          field: 'quantity',
          message: '用量必须大于0',
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

      const arr = groups.get(parentCode) ?? [];
      arr.push({
        row: rowNumber,
        childCode,
        quantity,
        uomId,
        lossRate,
        parentSeq,
        sequence,
      });
      groups.set(parentCode, arr);
    });

    let success = 0;

    for (const [parentCode, lineRows] of groups) {
      // 查找成品物料
      const parent = await this.materialRepo.findOne({
        where: { tenantId, code: parentCode },
      });
      if (!parent) {
        lineRows.forEach((r) =>
          errors.push({
            row: r.row,
            field: 'parentCode',
            message: `物料 ${parentCode} 不存在`,
          }),
        );
        continue;
      }

      // 查找所有子料
      const childCodes = [...new Set(lineRows.map((r) => r.childCode))];
      const children = await this.materialRepo
        .createQueryBuilder('m')
        .where('m.tenant_id = :tenantId AND m.code IN (:...codes)', {
          tenantId,
          codes: childCodes,
        })
        .getMany();
      const childMap = new Map(children.map((m) => [m.code, m]));

      const lines: Partial<PlmBomLine>[] = [];
      // 行序号 → lineId 映射（用于父行关联）
      const seqToTempId = new Map<number, string>();

      let hasError = false;
      for (const r of lineRows) {
        const child = childMap.get(r.childCode);
        if (!child) {
          errors.push({
            row: r.row,
            field: 'childCode',
            message: `子料 ${r.childCode} 不存在`,
          });
          hasError = true;
          continue;
        }
        const tempId = `temp_${r.sequence}`;
        seqToTempId.set(r.sequence, tempId);
        lines.push({
          tenantId,
          materialId: child.id,
          quantity: r.quantity,
          uomId: r.uomId,
          lossRate: r.lossRate,
          sequence: r.sequence,
        });
      }

      if (hasError) continue;

      await this.bomService.create(
        { materialId: parent.id, status: 'DRAFT' },
        lines,
      );
      success++;
    }

    return { success, failed: errors.length, errors };
  }

  async export(bomId: string): Promise<Buffer> {
    const tenantId = TenantContext.requireCurrentTenant();
    const bom = await this.bomRepo.findOne({ where: { id: bomId, tenantId } });
    if (!bom) throw new BadRequestException('PLM_BOM_NOT_FOUND');

    const parent = await this.materialRepo.findOne({
      where: { id: bom.materialId, tenantId },
    });
    const lines = await this.lineRepo.find({
      where: { bomId, tenantId } as any,
      order: { sequence: 'ASC' },
    });

    // 批量查子料信息
    const matIds = [
      ...new Set(
        lines.map((l) => l.materialId).filter((id): id is string => !!id),
      ),
    ];
    const materials =
      matIds.length > 0
        ? await this.materialRepo
            .createQueryBuilder('m')
            .where('m.id IN (:...ids)', { ids: matIds })
            .getMany()
        : [];
    const matMap = new Map(materials.map((m) => [m.id, m]));

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('BOM明细');
    sheet.columns = BOM_COLUMNS;
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9E1F2' },
    };

    for (const line of lines) {
      const child = line.materialId ? matMap.get(line.materialId) : undefined;
      sheet.addRow({
        parentCode: parent?.code ?? '',
        parentName: parent?.name ?? '',
        childCode: child?.code ?? '',
        childName: child?.name ?? '',
        quantity: line.quantity,
        uomId: line.uomId,
        lossRate: line.lossRate,
        parentSeq: '',
        sequence: line.sequence,
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async template(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('BOM导入模板');
    sheet.columns = BOM_COLUMNS;
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9E1F2' },
    };
    sheet.addRow({
      parentCode: 'FIN-001',
      parentName: '成品示例',
      childCode: 'RAW-001',
      childName: '原料示例',
      quantity: 2,
      uomId: '1',
      lossRate: 0.01,
      parentSeq: '',
      sequence: 10,
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
