import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import { MesWorkOrder } from './entities/mes-work-order.entity.js';
import { MesWorkOrderOperation } from './entities/mes-work-order-operation.entity.js';
import { MesProductionReport } from './entities/mes-production-report.entity.js';
import { MesWorkOrderSplit } from './entities/mes-work-order-split.entity.js';
import { MesWorkOrderMerge } from './entities/mes-work-order-merge.entity.js';
import { MesWip } from './entities/mes-wip.entity.js';
import { MesLaborRecord } from './entities/mes-labor-record.entity.js';
import { MesMaterialIssue } from './entities/mes-material-issue.entity.js';
import { MesAutoReceiptConfig } from './entities/mes-auto-receipt-config.entity.js';
import { MesReceiptLog } from './entities/mes-receipt-log.entity.js';

// Services
import { WorkOrderService } from './services/work-order.service.js';
import { MaterialKitService } from './services/material-kit.service.js';
import { ProductionReportService } from './services/production-report.service.js';
import { OperationService } from './services/operation.service.js';
import { MesQualityService } from './services/mes-quality.service.js';
import { MesDashboardService } from './services/mes-dashboard.service.js';
import { MesEventService } from './services/mes-event.service.js';
import { AutoReceiptConfigService } from './services/auto-receipt-config.service.js';
import { AutoReceiptOrchestratorService } from './services/auto-receipt-orchestrator.service.js';
import { ReceiptLogService } from './services/receipt-log.service.js';
import { WorkOrderTreeService } from './services/work-order-tree.service.js';
import { CriticalPathService } from './services/critical-path.service.js';
import { MaterialReadinessService } from './services/material-readiness.service.js';
import { CascadeCancelService } from './services/cascade-cancel.service.js';

// Controller
import { MesController } from './mes.controller.js';

// Shared
import { MessageModule } from '../../shared/message/message.module.js';
import {
  ConversionInstance,
  CiInput,
  CiOutput,
} from '../conversion/entities/conversion-instance.entity.js';
import { HrModule } from '../hr/hr.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MesWorkOrder,
      MesWorkOrderOperation,
      MesProductionReport,
      MesWorkOrderSplit,
      MesWorkOrderMerge,
      MesWip,
      MesLaborRecord,
      MesMaterialIssue,
      MesAutoReceiptConfig,
      MesReceiptLog,
      // 转换实例（追溯链）
      ConversionInstance,
      CiInput,
      CiOutput,
    ]),
    MessageModule,
    HrModule,
  ],
  controllers: [MesController],
  providers: [
    WorkOrderService,
    MaterialKitService,
    ProductionReportService,
    OperationService,
    MesQualityService,
    MesDashboardService,
    MesEventService,
    AutoReceiptConfigService,
    AutoReceiptOrchestratorService,
    ReceiptLogService,
    // 多层级工单父子关联
    WorkOrderTreeService,
    CriticalPathService,
    MaterialReadinessService,
    CascadeCancelService,
  ],
  exports: [WorkOrderService, ProductionReportService],
})
export class MesModule {}
