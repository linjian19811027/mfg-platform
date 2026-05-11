import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, LessThan } from 'typeorm';
import { TraceBatch } from '../entities/trace-batch.entity.js';
import { TraceLink } from '../entities/trace-link.entity.js';
import * as ExcelJS from 'exceljs';
import * as path from 'path';
import * as fs from 'fs';

export interface ManualCreateBatchDto {
  materialId: string;
  materialCode: string;
  materialName: string;
  batchNo: string;
  plannedQty?: number;
  actualQty?: number;
  uomId?: string;
  mesWoId?: string;
  scmPoId?: string;
  productionStart?: Date;
  productionEnd?: Date;
  manualReason?: string;
}

export interface BatchQueryDto {
  traceCode?: string;
  materialCode?: string;
  batchNo?: string;
  woId?: string;
  inspectionStatus?: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class TraceBatchService {
  constructor(
    @InjectRepository(TraceBatch)
    private readonly batchRepo: Repository<TraceBatch>,
    @InjectRepository(TraceLink)
    private readonly linkRepo: Repository<TraceLink>,
  ) {}

  async generateTraceCode(
    tenantId: string,
    materialCode: string,
  ): Promise<string> {
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const prefix = `TC-${dateStr}-${materialCode}-`;

    const count = await this.batchRepo.count({
      where: { tenantId, traceCode: Like(`${prefix}%`) },
    });
    return `${prefix}${String(count + 1).padStart(6, '0')}`;
  }

  async generateBarcodeImages(
    traceCode: string,
    tenantId: string,
  ): Promise<{ barcodePath: string; qrcodePath: string }> {
    // pdfkit/barcode libs not required — store placeholder paths
    const basePath = `./data/files/${tenantId}/barcodes`;
    const barcodePath = `${basePath}/${traceCode}.barcode.png`;
    const qrcodePath = `${basePath}/${traceCode}.qrcode.png`;
    return { barcodePath, qrcodePath };
  }

  async findByTraceCode(
    tenantId: string,
    traceCode: string,
  ): Promise<TraceBatch> {
    const batch = await this.batchRepo.findOne({
      where: { tenantId, traceCode },
    });
    if (!batch) throw new NotFoundException('TRACE_BATCH_NOT_FOUND');
    return batch;
  }

  async findAll(tenantId: string, query: BatchQueryDto) {
    const {
      traceCode,
      materialCode,
      batchNo,
      woId,
      inspectionStatus,
      page = 1,
      pageSize = 20,
    } = query;
    const qb = this.batchRepo
      .createQueryBuilder('b')
      .where('b.tenant_id = :tenantId', { tenantId });

    if (traceCode)
      qb.andWhere('b.trace_code LIKE :traceCode', {
        traceCode: `%${traceCode}%`,
      });
    if (materialCode)
      qb.andWhere('b.material_code LIKE :materialCode', {
        materialCode: `%${materialCode}%`,
      });
    if (batchNo)
      qb.andWhere('b.batch_no LIKE :batchNo', { batchNo: `%${batchNo}%` });
    if (woId) qb.andWhere('b.mes_wo_id = :woId', { woId });
    if (inspectionStatus)
      qb.andWhere('b.inspection_status = :inspectionStatus', {
        inspectionStatus,
      });

    const [items, total] = await qb
      .orderBy('b.created_at', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { items, total, page, pageSize };
  }

  async findOne(
    tenantId: string,
    id: string,
  ): Promise<
    TraceBatch & { upstreamLinks: TraceLink[]; downstreamLinks: TraceLink[] }
  > {
    const batch = await this.batchRepo.findOne({ where: { id, tenantId } });
    if (!batch) throw new NotFoundException('TRACE_BATCH_NOT_FOUND');

    const [upstreamLinks, downstreamLinks] = await Promise.all([
      this.linkRepo.find({ where: { tenantId, outputBatchId: id } }),
      this.linkRepo.find({ where: { tenantId, inputBatchId: id } }),
    ]);

    return Object.assign(batch, { upstreamLinks, downstreamLinks });
  }

  async manualCreate(
    tenantId: string,
    dto: ManualCreateBatchDto,
    operatorId: string,
  ): Promise<TraceBatch> {
    const traceCode = await this.generateTraceCode(tenantId, dto.materialCode);
    const { barcodePath, qrcodePath } = await this.generateBarcodeImages(
      traceCode,
      tenantId,
    );

    const batch = this.batchRepo.create({
      tenantId,
      traceCode,
      materialId: dto.materialId,
      materialCode: dto.materialCode,
      materialName: dto.materialName,
      batchNo: dto.batchNo,
      plannedQty: dto.plannedQty ?? 0,
      actualQty: dto.actualQty ?? 0,
      uomId: dto.uomId,
      mesWoId: dto.mesWoId,
      scmPoId: dto.scmPoId,
      productionStart: dto.productionStart,
      productionEnd: dto.productionEnd,
      operatorId,
      barcodePath,
      qrcodePath,
    });

    return this.batchRepo.save(batch);
  }

  async exportExcel(tenantId: string, query: BatchQueryDto): Promise<Buffer> {
    const { items } = await this.findAll(tenantId, {
      ...query,
      page: 1,
      pageSize: 5000,
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('追溯批次');

    sheet.columns = [
      { header: '追溯码', key: 'traceCode', width: 30 },
      { header: '物料编码', key: 'materialCode', width: 20 },
      { header: '物料名称', key: 'materialName', width: 30 },
      { header: '批次号', key: 'batchNo', width: 20 },
      { header: '计划数量', key: 'plannedQty', width: 15 },
      { header: '实际数量', key: 'actualQty', width: 15 },
      { header: '检验状态', key: 'inspectionStatus', width: 15 },
      { header: '库存状态', key: 'inventoryStatus', width: 15 },
      { header: '是否冻结', key: 'isFrozen', width: 10 },
      { header: '生产开始', key: 'productionStart', width: 20 },
      { header: '生产结束', key: 'productionEnd', width: 20 },
      { header: '创建时间', key: 'createdAt', width: 20 },
    ];

    for (const item of items) {
      sheet.addRow({
        traceCode: item.traceCode,
        materialCode: item.materialCode,
        materialName: item.materialName,
        batchNo: item.batchNo,
        plannedQty: item.plannedQty,
        actualQty: item.actualQty,
        inspectionStatus: item.inspectionStatus,
        inventoryStatus: item.inventoryStatus,
        isFrozen: item.isFrozen ? '是' : '否',
        productionStart: item.productionStart,
        productionEnd: item.productionEnd,
        createdAt: item.createdAt,
      });
    }

    return workbook.xlsx.writeBuffer() as unknown as Promise<Buffer>;
  }

  async archive(tenantId: string, beforeDate: Date): Promise<number> {
    const cutoff =
      beforeDate ?? new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000);
    const result = await this.batchRepo
      .createQueryBuilder()
      .update(TraceBatch)
      .set({ isArchived: 1 })
      .where('tenant_id = :tenantId', { tenantId })
      .andWhere('is_archived = 0')
      .andWhere('created_at < :cutoff', { cutoff })
      .execute();
    return result.affected ?? 0;
  }
}
