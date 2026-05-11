import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ApsResource } from './entities/aps-resource.entity.js';
import { ApsCalendar } from './entities/aps-calendar.entity.js';
import { ApsSchedule } from './entities/aps-schedule.entity.js';
import { ApsScheduleOperation } from './entities/aps-schedule-operation.entity.js';
import { ApsPriorityRule } from './entities/aps-priority-rule.entity.js';
import { ApsOptimizationTarget } from './entities/aps-optimization-target.entity.js';
import { ApsMrp } from './entities/aps-mrp.entity.js';
import { ApsMrpLine } from './entities/aps-mrp-line.entity.js';

import { ApsResourceService } from './services/aps-resource.service.js';
import { ApsCalendarService } from './services/aps-calendar.service.js';
import { CapacityService } from './services/capacity.service.js';
import { SchedulerService } from './services/scheduler.service.js';
import { ConstraintCheckService } from './services/constraint-check.service.js';
import { UrgentOrderService } from './services/urgent-order.service.js';
import { ReplanService } from './services/replan.service.js';
import { ApsEventService } from './services/aps-event.service.js';
import { SimulationService } from './services/simulation.service.js';
import { MrpService } from './services/mrp.service.js';
import { ApsAnalyticsService } from './services/aps-analytics.service.js';
import { PriorityRuleService } from './services/priority-rule.service.js';

import { ApsEamService } from './services/aps-eam.service.js';
import { EamMaintenancePlan } from '../eam/entities/eam-maintenance-plan.entity.js';

import { ApsController } from './aps.controller.js';
import { MessageModule } from '../../shared/message/message.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ApsResource,
      ApsCalendar,
      ApsSchedule,
      ApsScheduleOperation,
      ApsPriorityRule,
      ApsOptimizationTarget,
      ApsMrp,
      ApsMrpLine,
      EamMaintenancePlan,
    ]),
    MessageModule,
  ],
  controllers: [ApsController],
  providers: [
    ApsResourceService,
    ApsCalendarService,
    CapacityService,
    SchedulerService,
    ConstraintCheckService,
    UrgentOrderService,
    ReplanService,
    ApsEventService,
    SimulationService,
    MrpService,
    ApsAnalyticsService,
    PriorityRuleService,
    ApsEamService,
  ],
  exports: [
    ApsResourceService,
    ApsCalendarService,
    CapacityService,
    SchedulerService,
    ConstraintCheckService,
    UrgentOrderService,
    ReplanService,
    ApsEventService,
    SimulationService,
    MrpService,
    ApsAnalyticsService,
    PriorityRuleService,
    ApsEamService,
  ],
})
export class ApsModule {}
