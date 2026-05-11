import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  QmsInspectionStandard,
  QmsInspectionItem,
} from './entities/qms-inspection-standard.entity.js';
import { QmsInspectionRecord } from './entities/qms-inspection-record.entity.js';
import { QmsNonconformance } from './entities/qms-nonconformance.entity.js';
import { QmsCorrectiveAction } from './entities/qms-corrective-action.entity.js';
import { QmsSpcDataPoint } from './entities/qms-spc-data-point.entity.js';
import {
  QmsSip,
  QmsFinalInspection,
  QmsSupplierQualityRecord,
  QmsCustomerComplaint,
  QmsRecall,
} from './entities/qms-sip.entity.js';

import { InspectionService } from './services/inspection.service.js';
import { InspectionStandardService } from './services/inspection-standard.service.js';
import { NonconformanceService } from './services/nonconformance.service.js';
import { SpcService } from './services/spc.service.js';
import { QmsEventService } from './services/qms-event.service.js';

import { QmsController } from './qms.controller.js';
import { MessageModule } from '../../shared/message/message.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      QmsInspectionStandard,
      QmsInspectionItem,
      QmsInspectionRecord,
      QmsNonconformance,
      QmsCorrectiveAction,
      QmsSpcDataPoint,
      QmsSip,
      QmsFinalInspection,
      QmsSupplierQualityRecord,
      QmsCustomerComplaint,
      QmsRecall,
    ]),
    MessageModule,
  ],
  controllers: [QmsController],
  providers: [
    InspectionService,
    InspectionStandardService,
    NonconformanceService,
    SpcService,
    QmsEventService,
  ],
  exports: [InspectionService, NonconformanceService],
})
export class QmsModule {}
