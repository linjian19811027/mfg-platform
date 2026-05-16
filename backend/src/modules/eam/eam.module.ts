import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { EamEquipment } from './entities/eam-equipment.entity.js';
import { EamEquipmentHistory } from './entities/eam-equipment-history.entity.js';
import { EamEquipmentFinance } from './entities/eam-equipment-finance.entity.js';
import { EamEquipmentTechSpec } from './entities/eam-equipment-tech-spec.entity.js';
import { EamEquipmentSparePart } from './entities/eam-equipment-spare-part.entity.js';
import { EamSparePart } from './entities/eam-spare-part.entity.js';
import { EamSparePartTransaction } from './entities/eam-spare-part-transaction.entity.js';
import { EamMaintenancePlan } from './entities/eam-maintenance-plan.entity.js';
import { EamMaintenanceStrategy } from './entities/eam-maintenance-strategy.entity.js';
import { EamMaintenanceTask } from './entities/eam-maintenance-task.entity.js';
import { EamInspectionRecord } from './entities/eam-inspection-record.entity.js';
import { EamLubrication } from './entities/eam-lubrication.entity.js';
import { EamFaultRecord } from './entities/eam-fault-record.entity.js';
import { EamFaultKnowledge } from './entities/eam-fault-knowledge.entity.js';
import { EamOeeRecord } from './entities/eam-oee-record.entity.js';

import { EquipmentService } from './services/equipment.service.js';
import { EquipmentFinanceService } from './services/equipment-finance.service.js';
import { EquipmentTechSpecService } from './services/equipment-tech-spec.service.js';
import { EquipmentDocumentService } from './services/equipment-document.service.js';
import { EquipmentHistoryService } from './services/equipment-history.service.js';
import { MaintenanceService } from './services/maintenance.service.js';
import { MaintenanceAnalyticsService } from './services/maintenance-analytics.service.js';
import { InspectionService } from './services/inspection.service.js';
import { LubricationService } from './services/lubrication.service.js';
import { FaultService } from './services/fault.service.js';
import { OeeService } from './services/oee.service.js';
import { SparePartService } from './services/spare-part.service.js';
import { EamController } from './eam.controller.js';

import { MessageModule } from '../../shared/message/message.module.js';

@Module({
  controllers: [EamController],
  imports: [
    TypeOrmModule.forFeature([
      EamEquipment,
      EamEquipmentHistory,
      EamEquipmentFinance,
      EamEquipmentTechSpec,
      EamEquipmentSparePart,
      EamSparePart,
      EamSparePartTransaction,
      EamMaintenancePlan,
      EamMaintenanceStrategy,
      EamMaintenanceTask,
      EamInspectionRecord,
      EamLubrication,
      EamFaultRecord,
      EamFaultKnowledge,
      EamOeeRecord,
    ]),
    MessageModule,
  ],
  providers: [
    EquipmentService,
    EquipmentFinanceService,
    EquipmentTechSpecService,
    EquipmentDocumentService,
    EquipmentHistoryService,
    MaintenanceService,
    MaintenanceAnalyticsService,
    InspectionService,
    LubricationService,
    FaultService,
    OeeService,
    SparePartService,
  ],
  exports: [
    EquipmentService,
    EquipmentFinanceService,
    EquipmentTechSpecService,
    EquipmentDocumentService,
    MaintenanceService,
    MaintenanceAnalyticsService,
    InspectionService,
    LubricationService,
    FaultService,
    OeeService,
    SparePartService,
  ],
})
export class EamModule {}
