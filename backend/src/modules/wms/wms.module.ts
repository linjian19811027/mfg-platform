import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { WmsWarehouse } from './entities/wms-warehouse.entity.js';
import { WmsZone } from './entities/wms-zone.entity.js';
import { WmsLocation } from './entities/wms-location.entity.js';
import { WmsInventory } from './entities/wms-inventory.entity.js';
import { WmsStockTransaction } from './entities/wms-stock-transaction.entity.js';
import { WmsSafetyStock } from './entities/wms-safety-stock.entity.js';
import {
  WmsStockTake,
  WmsStockTakeLine,
} from './entities/wms-stock-take.entity.js';
import { WmsBarcodeRule } from './entities/wms-barcode-rule.entity.js';
import { WmsContainer } from './entities/wms-container.entity.js';
import {
  WmsPickTask,
  WmsPickTaskLine,
} from './entities/wms-pick-task.entity.js';

import { InventoryService } from './services/inventory.service.js';
import { LocationStrategyService } from './services/location-strategy.service.js';
import { ReceiptService } from './services/receipt.service.js';
import { IssueService } from './services/issue.service.js';
import { StockTakeService } from './services/stock-take.service.js';
import { WmsReportService } from './services/wms-report.service.js';
import { WmsEventService } from './services/wms-event.service.js';
import { SafetyStockAlertService } from './services/safety-stock-alert.service.js';

import { WmsController } from './wms.controller.js';
import { MessageModule } from '../../shared/message/message.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WmsWarehouse,
      WmsZone,
      WmsLocation,
      WmsInventory,
      WmsStockTransaction,
      WmsSafetyStock,
      WmsStockTake,
      WmsStockTakeLine,
      WmsBarcodeRule,
      WmsContainer,
      WmsPickTask,
      WmsPickTaskLine,
    ]),
    MessageModule,
  ],
  controllers: [WmsController],
  providers: [
    InventoryService,
    LocationStrategyService,
    ReceiptService,
    IssueService,
    StockTakeService,
    WmsReportService,
    WmsEventService,
    SafetyStockAlertService,
  ],
  exports: [InventoryService, ReceiptService, IssueService],
})
export class WmsModule {}
