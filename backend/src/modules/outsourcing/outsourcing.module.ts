import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { OutsourcingOrder } from './entities/outsourcing-order.entity.js';
import { OutsourcingIssue } from './entities/outsourcing-issue.entity.js';
import { OutsourcingReceipt } from './entities/outsourcing-receipt.entity.js';
import { OutsourcingSettlement } from './entities/outsourcing-settlement.entity.js';
import { OutsourcingOperationLog } from './entities/outsourcing-operation-log.entity.js';

import { OutsourcingOrderService } from './services/outsourcing-order.service.js';
import { OutsourcingIssueService } from './services/outsourcing-issue.service.js';
import { OutsourcingReceiptService } from './services/outsourcing-receipt.service.js';
import { OutsourcingSettlementService } from './services/outsourcing-settlement.service.js';
import { OutsourcingAnalyticsService } from './services/outsourcing-analytics.service.js';
import { OutsourcingEventService } from './services/outsourcing-event.service.js';

import { OutsourcingController } from './outsourcing.controller.js';
import { MessageModule } from '../../shared/message/message.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OutsourcingOrder,
      OutsourcingIssue,
      OutsourcingReceipt,
      OutsourcingSettlement,
      OutsourcingOperationLog,
    ]),
    MessageModule,
  ],
  controllers: [OutsourcingController],
  providers: [
    OutsourcingOrderService,
    OutsourcingIssueService,
    OutsourcingReceiptService,
    OutsourcingSettlementService,
    OutsourcingAnalyticsService,
    OutsourcingEventService,
  ],
  exports: [
    OutsourcingOrderService,
    OutsourcingIssueService,
    OutsourcingReceiptService,
    OutsourcingSettlementService,
  ],
})
export class OutsourcingModule {}
