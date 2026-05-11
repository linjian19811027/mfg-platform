import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import { TraceReport } from '../entities/trace-report.entity.js';
import { TraceBatch } from '../entities/trace-batch.entity.js';
import { ForwardTraceService } from './forward-trace.service.js';
import { BackwardTraceService } from './backward-trace.service.js';

@Injectable()
export class TraceReportService {
  constructor(
    @InjectRepository(TraceReport)
    private readonly reportRepo: Repository<TraceReport>,
    @InjectRepository(TraceBatch)
    private readonly batchRepo: Repository<TraceBatch>,
    private readonly forwardTrace: ForwardTraceService,
    private readonly backwardTrace: BackwardTraceService,
  ) {}

  async generate(
    tenantId: string,
    batchId: string,
    format: 'PDF' | 'EXCEL',
    operatorId: string,
  ): Promise<TraceReport> {
    const batch = await this.batchRepo.findOne({
      where: { id: batchId, tenantId },
    });
    if (!batch) throw new NotFoundException('TRACE_BATCH_NOT_FOUND');

    const [forwardResult, backwardResult] = await Promise.all([
      this.forwardTrace.trace(tenantId, batchId, undefined, operatorId),
      this.backwardTrace.trace(tenantId, batchId, operatorId),
    ]);

    const allNodes = [...forwardResult.nodes, ...backwardResult.nodes];
    const hasMissingData = allNodes.some((n) => n.missingData) ? 1 : 0;
    const nodeCount = allNodes.length;

    const now = new Date();
    const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const dir = `./data/files/${tenantId}/trace-reports/${yyyymm}`;
    fs.mkdirSync(dir, { recursive: true });

    let filePath: string;

    if (format === 'EXCEL') {
      filePath = path.join(dir, `${batch.traceCode}.xlsx`);
      await this.generateExcel(
        filePath,
        batch,
        forwardResult.nodes,
        backwardResult.nodes,
      );
    } else {
      // PDF: use text placeholder since pdfkit may not be installed
      filePath = path.join(dir, `${batch.traceCode}.txt`);
      await this.generatePdfPlaceholder(
        filePath,
        batch,
        forwardResult.nodes,
        backwardResult.nodes,
      );
    }

    const report = await this.reportRepo.save(
      this.reportRepo.create({
        tenantId,
        traceBatchId: batchId,
        format,
        filePath,
        nodeCount,
        hasMissingData,
        operatorId,
      }),
    );

    return report;
  }

  async batchGenerate(
    tenantId: string,
    batchIds: string[],
    operatorId: string,
  ): Promise<{ queued: number }> {
    const ids = batchIds.slice(0, 50);
    // Fire-and-forget async generation
    Promise.allSettled(
      ids.map((id) => this.generate(tenantId, id, 'EXCEL', operatorId)),
    ).catch(() => {});
    return { queued: ids.length };
  }

  async download(
    tenantId: string,
    reportId: string,
  ): Promise<{ filePath: string; expiresAt: Date }> {
    const report = await this.reportRepo.findOne({
      where: { id: reportId, tenantId },
    });
    if (!report) throw new NotFoundException('TRACE_REPORT_NOT_FOUND');

    const expiresAt = new Date(
      report.createdAt.getTime() + 24 * 60 * 60 * 1000,
    );
    if (new Date() > expiresAt)
      throw new NotFoundException('TRACE_REPORT_EXPIRED');

    return { filePath: report.filePath, expiresAt };
  }

  private async generateExcel(
    filePath: string,
    batch: TraceBatch,
    forwardNodes: any[],
    backwardNodes: any[],
  ): Promise<void> {
    const workbook = new ExcelJS.Workbook();

    // Sheet 1: 批次信息
    const infoSheet = workbook.addWorksheet('批次信息');
    infoSheet.addRow(['字段', '值']);
    infoSheet.addRow(['追溯码', batch.traceCode]);
    infoSheet.addRow(['物料编码', batch.materialCode]);
    infoSheet.addRow(['物料名称', batch.materialName]);
    infoSheet.addRow(['批次号', batch.batchNo]);
    infoSheet.addRow(['检验状态', batch.inspectionStatus]);
    infoSheet.addRow(['库存状态', batch.inventoryStatus]);
    infoSheet.addRow(['计划数量', batch.plannedQty]);
    infoSheet.addRow(['实际数量', batch.actualQty]);

    // Sheet 2: 上游链路
    const upstreamSheet = workbook.addWorksheet('上游链路');
    upstreamSheet.columns = [
      { header: '批次ID', key: 'batchId', width: 20 },
      { header: '追溯码', key: 'traceCode', width: 30 },
      { header: '物料编码', key: 'materialCode', width: 20 },
      { header: '物料名称', key: 'materialName', width: 30 },
      { header: '批次号', key: 'batchNo', width: 20 },
      { header: '层级', key: 'depth', width: 10 },
      { header: '数据缺失', key: 'missingData', width: 10 },
    ];
    for (const node of backwardNodes) {
      upstreamSheet.addRow({
        ...node,
        missingData: node.missingData ? '是' : '否',
      });
    }

    // Sheet 3: 下游链路
    const downstreamSheet = workbook.addWorksheet('下游链路');
    downstreamSheet.columns = [
      { header: '批次ID', key: 'batchId', width: 20 },
      { header: '追溯码', key: 'traceCode', width: 30 },
      { header: '物料编码', key: 'materialCode', width: 20 },
      { header: '物料名称', key: 'materialName', width: 30 },
      { header: '批次号', key: 'batchNo', width: 20 },
      { header: '层级', key: 'depth', width: 10 },
      { header: '数据缺失', key: 'missingData', width: 10 },
    ];
    for (const node of forwardNodes) {
      downstreamSheet.addRow({
        ...node,
        missingData: node.missingData ? '是' : '否',
      });
    }

    await workbook.xlsx.writeFile(filePath);
  }

  private async generatePdfPlaceholder(
    filePath: string,
    batch: TraceBatch,
    forwardNodes: any[],
    backwardNodes: any[],
  ): Promise<void> {
    const lines: string[] = [
      `追溯报告 - ${batch.traceCode}`,
      `生成时间: ${new Date().toISOString()}`,
      '',
      '=== 批次信息 ===',
      `追溯码: ${batch.traceCode}`,
      `物料: ${batch.materialCode} - ${batch.materialName}`,
      `批次号: ${batch.batchNo}`,
      `检验状态: ${batch.inspectionStatus}`,
      `库存状态: ${batch.inventoryStatus}`,
      '',
      `=== 上游链路 (${backwardNodes.length} 节点) ===`,
      ...backwardNodes.map(
        (n) =>
          `  [深度${n.depth}] ${n.traceCode || n.batchId} ${n.missingData ? '[数据缺失]' : ''}`,
      ),
      '',
      `=== 下游链路 (${forwardNodes.length} 节点) ===`,
      ...forwardNodes.map(
        (n) =>
          `  [深度${n.depth}] ${n.traceCode || n.batchId} ${n.missingData ? '[数据缺失]' : ''}`,
      ),
    ];
    fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
  }
}
