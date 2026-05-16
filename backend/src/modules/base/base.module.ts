import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SysOrganization } from './entities/sys-organization.entity.js';
import { SysUom, SysUomConversion } from './entities/sys-uom.entity.js';
import { MaterialBatch } from './entities/material-batch.entity.js';
import { SysFile } from '../file/entities/sys-file.entity.js';
import { SysNumberingRule } from './entities/sys-numbering-rule.entity.js';
import { MfgWorkCenter } from './entities/mfg-work-center.entity.js';
import { HrShift } from '../hr/entities/hr-shift.entity.js';
import { HrCertificationType } from '../hr/entities/hr-certification-type.entity.js';
import { OrganizationService } from './services/organization.service.js';
import { UomService } from './services/uom.service.js';
import { BatchService } from './services/batch.service.js';
import { NumberingService } from './services/numbering.service.js';
import { WorkCenterService } from './services/work-center.service.js';
import { ShiftService } from './services/shift.service.js';
import { CertificationTypeService } from './services/certification-type.service.js';
import { BaseController } from './base.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SysOrganization,
      SysUom,
      SysUomConversion,
      MaterialBatch,
      SysFile,
      SysNumberingRule,
      MfgWorkCenter,
      HrShift,
      HrCertificationType,
    ]),
  ],
  controllers: [BaseController],
  providers: [
    OrganizationService,
    UomService,
    BatchService,
    NumberingService,
    WorkCenterService,
    ShiftService,
    CertificationTypeService,
  ],
  exports: [
    OrganizationService,
    UomService,
    BatchService,
    NumberingService,
    WorkCenterService,
    ShiftService,
    CertificationTypeService,
  ],
})
export class BaseModule {}
