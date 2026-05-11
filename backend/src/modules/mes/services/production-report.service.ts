import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Inject,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { MesProductionReport } from '../entities/mes-production-report.entity.js';
import { MesWorkOrder } from '../entities/mes-work-order.entity.js';
import { MesWorkOrderOperation } from '../entities/mes-work-order-operation.entity.js';
import { MesLaborRecord } from '../entities/mes-labor-record.entity.js';
import { MesWip } from '../entities/mes-wip.entity.js';
import {
  ConversionInstance,
  CiInput,
  CiOutput,
} from '../../conversion/entities/conversion-instance.entity.js';
import { TenantContext } from '../../../shared/tenant/tenant.context.js';
import {
  MESSAGE_SERVICE,
  MessageService,
} from '../../../shared/message/message.interface.js';
import { EventTypes } from '../../event/event-types.constant.js';
import { SkillValidatorService } from '../../hr/services/skill-validator.service.js';

export interface ReportRequest {
  woId: string;
  wooId?: string;
  reportType: 'START' | 'COMPLETE' | 'SCRAP' | 'TRANSFER' | 'EXCEPTION';
  completedQty?: number;
  scrapQty?: number;
  uomId?: string;
  operatorId?: string;
  equipmentId?: string;
  inputBatchIds?: string[];
  outputBatchId?: string;
  exceptionType?: string;
  exceptionReason?: string;
}

@Injectable()
export class ProductionReportService {
  constructor(
    @InjectRepository(MesProductionReport)
    private readonly reportRepo: Repository<MesProductionReport>,
    @InjectRepository(MesWorkOrder)
    private readonly woRepo: Repository<MesWorkOrder>,
    @InjectRepository(MesWorkOrderOperation)
    private readonly wooRepo: Repository<MesWorkOrderOperation>,
    @InjectRepository(MesLaborRecord)
    private readonly laborRepo: Repository<MesLaborRecord>,
    @InjectRepository(MesWip)
    private readonly wipRepo: Repository<MesWip>,
    @InjectRepository(ConversionInstance)
    private readonly ciRepo: Repository<ConversionInstance>,
    @InjectRepository(CiInput)
    private readonly ciInputRepo: Repository<CiInput>,
    @InjectRepository(CiOutput)
    private readonly ciOutputRepo: Repository<CiOutput>,
    @Inject(MESSAGE_SERVICE)
    private readonly messageSvc: MessageService,
    @Optional()
    private readonly skillValidator?: SkillValidatorService,
  ) {}

  // ── 核心报工 ──────────────────────────────────────────────────────────────

  async report(req: ReportRequest): Promise<MesProductionReport> {
    const tenantId = TenantContext.requireCurrentTenant();
    const wo = await this.woRepo.findOne({ where: { id: req.woId, tenantId } });
    if (!wo) throw new NotFoundException('MES_WO_NOT_FOUND');

    switch (req.reportType) {
      case 'START':
        return this.handleStart(req, wo, tenantId);
      case 'COMPLETE':
        return this.handleComplete(req, wo, tenantId);
      case 'SCRAP':
        return this.handleScrap(req, wo, tenantId);
      case 'TRANSFER':
        return this.handleTransfer(req, wo, tenantId);
      case 'EXCEPTION':
        return this.handleException(req, wo, tenantId);
      default:
        throw new BadRequestException('MES_REPORT_UNKNOWN_TYPE');
    }
  }

  // ── START 开工 ────────────────────────────────────────────────────────────

  private async handleStart(
    req: ReportRequest,
    wo: MesWorkOrder,
    tenantId: string,
  ): Promise<MesProductionReport> {
    if (!['RELEASED', 'IN_PROGRESS'].includes(wo.status)) {
      throw new BadRequestException('MES_REPORT_START_INVALID_STATUS');
    }

    // 4.1.1 技能认证校验（operatorId 和 wooId 都存在时才校验）
    if (req.operatorId && req.wooId && this.skillValidator) {
      const result = await this.skillValidator.validate(
        tenantId,
        req.operatorId,
        req.wooId,
      );
      // 4.1.2 校验失败时拒绝报工，返回缺失认证列表
      if (!result.valid) {
        throw new BadRequestException({
          message: 'MES_REPORT_SKILL_VALIDATION_FAILED',
          missingCerts: result.missingCerts,
          expiredCerts: result.expiredCerts,
          errors: result.errors,
        });
      }
    }

    // 工单状态 → IN_PROGRESS
    if (wo.status === 'RELEASED') {
      await this.woRepo.update(wo.id, {
        status: 'IN_PROGRESS',
        actualStart: new Date(),
      });
    }

    // 激活工序
    if (req.wooId) {
      await this.wooRepo.update(req.wooId, {
        status: 'IN_PROGRESS',
        actualStart: new Date(),
      });
    }

    // 写工时开始记录
    if (req.operatorId) {
      await this.laborRepo.save(
        this.laborRepo.create({
          tenantId,
          woId: wo.id,
          wooId: req.wooId,
          operatorId: req.operatorId,
          startTime: new Date(),
          directHours: 0,
          indirectHours: 0,
        }),
      );
    }

    return this.saveReport(req, tenantId);
  }

  // ── COMPLETE 完工 ─────────────────────────────────────────────────────────

  private async handleComplete(
    req: ReportRequest,
    wo: MesWorkOrder,
    tenantId: string,
  ): Promise<MesProductionReport> {
    if (wo.status !== 'IN_PROGRESS') {
      throw new BadRequestException('MES_REPORT_COMPLETE_INVALID_STATUS');
    }

    const completedQty = Number(req.completedQty ?? 0);
    const scrapQty = Number(req.scrapQty ?? 0);

    // 更新工单累计完工量
    const newCompleted = Number(wo.completedQty) + completedQty;
    const newScrap = Number(wo.scrapQty) + scrapQty;
    await this.woRepo.update(wo.id, {
      completedQty: newCompleted,
      scrapQty: newScrap,
    });

    // 更新工序
    if (req.wooId) {
      const woo = await this.wooRepo.findOne({
        where: { id: req.wooId, tenantId } as any,
      });
      if (woo) {
        const wooCompleted = Number(woo.completedQty) + completedQty;
        await this.wooRepo.update(req.wooId, {
          completedQty: wooCompleted,
          scrapQty: Number(woo.scrapQty) + scrapQty,
          status: 'COMPLETED',
          actualEnd: new Date(),
        });
      }
    }

    // 写转换实例（追溯链）
    await this.writeConversionInstance(
      req,
      wo,
      tenantId,
      completedQty,
      scrapQty,
    );

    // 计算直接工时
    await this.calcLaborHours(wo.id, req.wooId, req.operatorId, tenantId);

    // 更新在制品
    await this.updateWip(wo.id, req.wooId, tenantId, -completedQty);

    // 检查工单是否全部完工
    const updatedWo = await this.woRepo.findOne({
      where: { id: wo.id, tenantId },
    });
    if (
      updatedWo &&
      Number(updatedWo.completedQty) >= Number(updatedWo.plannedQty)
    ) {
      await this.woRepo.update(wo.id, {
        status: 'COMPLETED',
        actualEnd: new Date(),
      });

      // 发布 PRODUCTION_COMPLETED 事件
      await this.messageSvc.publish({
        eventId: uuidv4(),
        eventType: EventTypes.PRODUCTION_COMPLETED,
        tenantId,
        sourceModule: 'MES',
        targetModule: 'WMS',
        payload: {
          woId: wo.id,
          materialId: wo.materialId,
          completedQty: updatedWo.completedQty,
          scrapQty: updatedWo.scrapQty,
          outputBatchId: req.outputBatchId,
          inputBatches:
            req.inputBatchIds?.map((id) => ({
              batchId: id,
              materialId: wo.materialId,
              qty: completedQty,
            })) ?? [],
        },
        createdAt: new Date(),
      });
    }

    const savedReport = await this.saveReport(req, tenantId);

    // 4.1.3 报工完成时发布 OPERATION_REPORTED 事件（供 HR 工时汇总）
    if (req.operatorId) {
      // 查询本次开工的 labor 记录获取 startTime
      const labor = await this.laborRepo.findOne({
        where: {
          woId: wo.id,
          wooId: req.wooId as any,
          operatorId: req.operatorId,
          tenantId,
        } as any,
        order: { createdAt: 'DESC' },
      });

      // 查询工序信息获取 operationCode
      let operationCode = req.wooId ?? '';
      if (req.wooId) {
        const woo = await this.wooRepo.findOne({
          where: { id: req.wooId, tenantId } as any,
        });
        if (woo?.operationCode) operationCode = woo.operationCode;
      }

      await this.messageSvc.publish({
        eventId: uuidv4(),
        eventType: EventTypes.OPERATION_REPORTED,
        tenantId,
        sourceModule: 'MES',
        targetModule: 'HR',
        payload: {
          empId: req.operatorId,
          operationCode,
          workCenterId: wo.workCenterId,
          startTime: (labor?.startTime ?? new Date()).toISOString(),
          endTime: new Date().toISOString(),
          reportId: savedReport.id,
        },
        createdAt: new Date(),
      });
    }

    return savedReport;
  }

  // ── SCRAP 报废 ────────────────────────────────────────────────────────────

  private async handleScrap(
    req: ReportRequest,
    wo: MesWorkOrder,
    tenantId: string,
  ): Promise<MesProductionReport> {
    const scrapQty = Number(req.scrapQty ?? 0);
    if (scrapQty <= 0)
      throw new BadRequestException('MES_REPORT_SCRAP_QTY_POSITIVE');

    await this.woRepo.update(wo.id, {
      scrapQty: Number(wo.scrapQty) + scrapQty,
    });
    return this.saveReport(req, tenantId);
  }

  // ── TRANSFER 转序 ─────────────────────────────────────────────────────────

  private async handleTransfer(
    req: ReportRequest,
    wo: MesWorkOrder,
    tenantId: string,
  ): Promise<MesProductionReport> {
    // 更新在制品位置到下道工序
    if (req.wooId) {
      await this.wipRepo.update({ woId: wo.id, tenantId } as any, {
        wooId: req.wooId,
        status: 'IN_PROCESS',
      });
    }
    return this.saveReport(req, tenantId);
  }

  // ── EXCEPTION 异常 ────────────────────────────────────────────────────────

  private async handleException(
    req: ReportRequest,
    wo: MesWorkOrder,
    tenantId: string,
  ): Promise<MesProductionReport> {
    if (!req.exceptionType)
      throw new BadRequestException('MES_REPORT_EXCEPTION_TYPE_REQUIRED');

    // 设备故障时发布事件
    if (req.exceptionType === 'MACHINE_DOWN') {
      await this.messageSvc.publish({
        eventId: uuidv4(),
        eventType: EventTypes.EQUIPMENT_FAILURE_REPORTED,
        tenantId,
        sourceModule: 'MES',
        payload: {
          woId: wo.id,
          equipmentId: req.equipmentId,
          reason: req.exceptionReason,
        },
        createdAt: new Date(),
      });
    }

    return this.saveReport(req, tenantId);
  }

  // ── 报工修正 ──────────────────────────────────────────────────────────────

  async correct(
    reportId: string,
    correction: { completedQty?: number; scrapQty?: number; reason: string },
    userRoles: string[],
  ): Promise<MesProductionReport> {
    const tenantId = TenantContext.requireCurrentTenant();
    const allowed = ['TEAM_LEADER', 'QC', 'ADMIN'];
    if (!userRoles.some((r) => allowed.includes(r))) {
      throw new ForbiddenException('MES_REPORT_CORRECT_FORBIDDEN');
    }

    const original = await this.reportRepo.findOne({
      where: { id: reportId, tenantId },
    });
    if (!original) throw new NotFoundException('MES_REPORT_NOT_FOUND');

    // 创建修正记录
    return this.reportRepo.save(
      this.reportRepo.create({
        tenantId,
        woId: original.woId,
        wooId: original.wooId,
        reportType: original.reportType,
        completedQty: correction.completedQty ?? original.completedQty,
        scrapQty: correction.scrapQty ?? original.scrapQty,
        uomId: original.uomId,
        operatorId: original.operatorId,
        reportTime: new Date(),
        correctionReason: correction.reason,
        originalReportId: original.id,
      }),
    );
  }

  // ── 查询 ──────────────────────────────────────────────────────────────────

  async findByWo(woId: string): Promise<MesProductionReport[]> {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.reportRepo.find({
      where: { woId, tenantId },
      order: { reportTime: 'DESC' },
    });
  }

  async findAll(query: {
    operatorId?: string;
    woId?: string;
    page?: number;
    pageSize?: number;
  }) {
    const tenantId = TenantContext.requireCurrentTenant();
    const { operatorId, woId, page = 1, pageSize = 20 } = query;
    const qb = this.reportRepo
      .createQueryBuilder('r')
      .where('r.tenant_id = :tenantId', { tenantId });
    if (operatorId) qb.andWhere('r.operator_id = :operatorId', { operatorId });
    if (woId) qb.andWhere('r.wo_id = :woId', { woId });
    const [items, total] = await qb
      .orderBy('r.report_time', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return { items, total };
  }

  // ── 私有辅助 ──────────────────────────────────────────────────────────────

  private async saveReport(
    req: ReportRequest,
    tenantId: string,
  ): Promise<MesProductionReport> {
    return this.reportRepo.save(
      this.reportRepo.create({
        tenantId,
        woId: req.woId,
        wooId: req.wooId,
        reportType: req.reportType,
        completedQty: req.completedQty ?? 0,
        scrapQty: req.scrapQty ?? 0,
        uomId: req.uomId,
        operatorId: req.operatorId,
        equipmentId: req.equipmentId,
        reportTime: new Date(),
        inputBatchIds: req.inputBatchIds,
        outputBatchId: req.outputBatchId,
        exceptionType: req.exceptionType,
        exceptionReason: req.exceptionReason,
      }),
    );
  }

  private async writeConversionInstance(
    req: ReportRequest,
    wo: MesWorkOrder,
    tenantId: string,
    completedQty: number,
    scrapQty: number,
  ): Promise<void> {
    const ci = await this.ciRepo.save(
      this.ciRepo.create({
        tenantId,
        definitionId: wo.routingId ?? '0',
        definitionVersion: 1,
        businessType: 'PRODUCTION',
        businessId: wo.id,
        businessNo: wo.woNo ?? wo.id,
        status: 'COMPLETED',
        actualStart: new Date(),
        actualEnd: new Date(),
      }),
    );

    // 写投入批次
    if (req.inputBatchIds?.length) {
      for (const batchId of req.inputBatchIds) {
        await this.ciInputRepo.save(
          this.ciInputRepo.create({
            tenantId,
            ciId: ci.id,
            materialId: wo.materialId,
            batchId,
            actualQty: completedQty,
            uomId: wo.uomId,
            isConsumed: 1,
            consumedAt: new Date(),
          }),
        );
      }
    }

    // 写产出批次
    if (req.outputBatchId) {
      await this.ciOutputRepo.save(
        this.ciOutputRepo.create({
          tenantId,
          ciId: ci.id,
          materialId: wo.materialId,
          batchId: req.outputBatchId,
          actualQty: completedQty,
          scrapQty,
          uomId: wo.uomId,
          qualityStatus: 'UNINSPECTED',
        }),
      );
    }
  }

  private async calcLaborHours(
    woId: string,
    wooId: string | undefined,
    operatorId: string | undefined,
    tenantId: string,
  ): Promise<void> {
    if (!operatorId) return;
    const labor = await this.laborRepo.findOne({
      where: { woId, wooId: wooId as any, operatorId, tenantId } as any,
      order: { createdAt: 'DESC' },
    });
    if (labor && !labor.endTime) {
      const endTime = new Date();
      const directHours =
        (endTime.getTime() - labor.startTime.getTime()) / 60000;
      await this.laborRepo.update(labor.id, { endTime, directHours });
    }
  }

  private async updateWip(
    woId: string,
    wooId: string | undefined,
    tenantId: string,
    delta: number,
  ): Promise<void> {
    const wip = await this.wipRepo.findOne({
      where: { woId, tenantId } as any,
    });
    if (wip) {
      const newQty = Number(wip.quantity) + delta;
      await this.wipRepo.update(wip.id, {
        quantity: Math.max(0, newQty),
        wooId: wooId ?? wip.wooId,
        status: newQty <= 0 ? 'COMPLETED' : 'IN_PROCESS',
      });
    }
  }
}
