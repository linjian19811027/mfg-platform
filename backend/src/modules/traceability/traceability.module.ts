import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TraceBatch } from './entities/trace-batch.entity.js';
import { TraceLink } from './entities/trace-link.entity.js';
import { TraceRecallAssessment } from './entities/trace-recall-assessment.entity.js';
import { TraceReport } from './entities/trace-report.entity.js';
import { TraceQueryLog } from './entities/trace-query-log.entity.js';

import { TraceBatchService } from './services/trace-batch.service.js';
import { TraceLinkService } from './services/trace-link.service.js';
import { ForwardTraceService } from './services/forward-trace.service.js';
import { BackwardTraceService } from './services/backward-trace.service.js';
import { RecallService } from './services/recall.service.js';
import { TraceReportService } from './services/trace-report.service.js';
import { TraceabilityEventService } from './services/traceability-event.service.js';
import { TraceabilityAnalyticsService } from './services/traceability-analytics.service.js';

import { TraceabilityController } from './traceability.controller.js';
import { MessageModule } from '../../shared/message/message.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TraceBatch,
      TraceLink,
      TraceRecallAssessment,
      TraceReport,
      TraceQueryLog,
    ]),
    MessageModule,
  ],
  controllers: [TraceabilityController],
  providers: [
    TraceBatchService,
    TraceLinkService,
    ForwardTraceService,
    BackwardTraceService,
    RecallService,
    TraceReportService,
    TraceabilityEventService,
    TraceabilityAnalyticsService,
  ],
  exports: [
    TraceBatchService,
    TraceLinkService,
    ForwardTraceService,
    BackwardTraceService,
  ],
})
export class TraceabilityModule {}
