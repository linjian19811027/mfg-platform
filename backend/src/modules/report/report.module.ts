import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportTask } from './entities/report-task.entity.js';
import { ReportService } from './report.service.js';
import { ReportController } from './report.controller.js';
import { WmsInventory } from '../wms/entities/wms-inventory.entity.js';
import { WmsStockTransaction } from '../wms/entities/wms-stock-transaction.entity.js';
import { MesWorkOrder } from '../mes/entities/mes-work-order.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ReportTask,
      WmsInventory,
      WmsStockTransaction,
      MesWorkOrder,
    ]),
  ],
  providers: [ReportService],
  controllers: [ReportController],
})
export class ReportModule {}
