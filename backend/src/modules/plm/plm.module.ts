import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

// Entities
import { PlmMaterialCategory } from './entities/plm-material-category.entity.js';
import { PlmMaterial } from './entities/plm-material.entity.js';
import { PlmMaterialCodeRule } from './entities/plm-material-code-rule.entity.js';
import { PlmMaterialSubstitute } from './entities/plm-material-substitute.entity.js';
import { PlmBom } from './entities/plm-bom.entity.js';
import { PlmBomLine } from './entities/plm-bom-line.entity.js';
import { PlmBomChangeLog } from './entities/plm-bom-change-log.entity.js';
import { PlmRouting } from './entities/plm-routing.entity.js';
import { PlmRoutingOperation } from './entities/plm-routing-operation.entity.js';
import { PlmProcessParameter } from './entities/plm-process-parameter.entity.js';
import { PlmEcr } from './entities/plm-ecr.entity.js';
import { PlmEcn } from './entities/plm-ecn.entity.js';
import { PlmDocument } from './entities/plm-document.entity.js';
import { PlmDocumentPermission } from './entities/plm-document-permission.entity.js';
// ECN Execution entities
import { PlmEcnExecutionPlan } from './entities/plm-ecn-execution-plan.entity.js';
import { PlmEcnExecutionPlanItem } from './entities/plm-ecn-execution-plan-item.entity.js';
import { PlmWipAssessment } from './entities/plm-wip-assessment.entity.js';
import { PlmWipAssessmentItem } from './entities/plm-wip-assessment-item.entity.js';
import { PlmEcnExecutionLog } from './entities/plm-ecn-execution-log.entity.js';
import { PlmStandardOperation } from './entities/plm-standard-operation.entity.js';

// Services
import { MaterialService } from './services/material.service.js';
import { MaterialCodeService } from './services/material-code.service.js';
import { MaterialExcelService } from './services/material-excel.service.js';
import { BomService } from './services/bom.service.js';
import { BomExcelService } from './services/bom-excel.service.js';
import { RoutingService } from './services/routing.service.js';
import { ChangeService } from './services/change.service.js';
import { DocumentService } from './services/document.service.js';
import { EcnExecutionService } from './services/ecn-execution.service.js';
import { WipImpactService } from './services/wip-impact.service.js';
import { StandardOperationService } from './services/standard-operation.service.js';

// Controllers
import { PlmController } from './plm.controller.js';
import { EcnExecutionController } from './ecn-execution.controller.js';

// Shared
import { FileModule } from '../file/file.module.js';
import { MessageModule } from '../../shared/message/message.module.js';
import { CacheModule } from '../../shared/cache/cache.module.js';
import { BaseModule } from '../base/base.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PlmMaterialCategory,
      PlmMaterial,
      PlmMaterialCodeRule,
      PlmMaterialSubstitute,
      PlmBom,
      PlmBomLine,
      PlmBomChangeLog,
      PlmRouting,
      PlmRoutingOperation,
      PlmProcessParameter,
      PlmEcr,
      PlmEcn,
      PlmDocument,
      PlmDocumentPermission,
      // ECN Execution
      PlmEcnExecutionPlan,
      PlmEcnExecutionPlanItem,
      PlmWipAssessment,
      PlmWipAssessmentItem,
      PlmEcnExecutionLog,
      PlmStandardOperation,
    ]),
    MulterModule.register({ storage: memoryStorage() }),
    FileModule,
    MessageModule,
    CacheModule,
    BaseModule,
  ],
  controllers: [PlmController, EcnExecutionController],
  providers: [
    MaterialService,
    MaterialCodeService,
    MaterialExcelService,
    BomService,
    BomExcelService,
    RoutingService,
    ChangeService,
    DocumentService,
    EcnExecutionService,
    WipImpactService,
    StandardOperationService,
  ],
  exports: [
    MaterialService,
    BomService,
    RoutingService,
    EcnExecutionService,
    WipImpactService,
    StandardOperationService,
  ],
})
export class PlmModule {}
