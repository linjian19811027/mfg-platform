import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessageModule } from '../../shared/message/message.module.js';

// Entities
import { HrEmployee } from './entities/hr-employee.entity.js';
import { HrCertificationType } from './entities/hr-certification-type.entity.js';
import { HrEmployeeCertification } from './entities/hr-employee-certification.entity.js';
import { HrShift } from './entities/hr-shift.entity.js';
import { HrShiftSchedule } from './entities/hr-shift-schedule.entity.js';
import { HrWorkHourRecord } from './entities/hr-work-hour-record.entity.js';
import { HrWorkHourSummary } from './entities/hr-work-hour-summary.entity.js';

// Services
import { EmployeeService } from './services/employee.service.js';
import { CertificationService } from './services/certification.service.js';
import { ShiftService } from './services/shift.service.js';
import { WorkHourService } from './services/work-hour.service.js';
import { SkillValidatorService } from './services/skill-validator.service.js';
import { HrEventService } from './services/hr-event.service.js';

// Controller
import { HrController } from './hr.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      HrEmployee,
      HrCertificationType,
      HrEmployeeCertification,
      HrShift,
      HrShiftSchedule,
      HrWorkHourRecord,
      HrWorkHourSummary,
    ]),
    MessageModule,
  ],
  controllers: [HrController],
  providers: [
    EmployeeService,
    CertificationService,
    ShiftService,
    WorkHourService,
    SkillValidatorService,
    HrEventService,
  ],
  exports: [SkillValidatorService, EmployeeService, CertificationService],
})
export class HrModule {}
