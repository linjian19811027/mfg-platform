import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RptReportDefinition } from './entities/rpt-report-definition.entity.js';
import { RptService } from './rpt.service.js';
import { RptController } from './rpt.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([RptReportDefinition])],
  controllers: [RptController],
  providers: [RptService],
  exports: [RptService],
})
export class RptModule {}
