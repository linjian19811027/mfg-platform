import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ConversionDefinition,
  CdInput,
  CdOutput,
} from './entities/conversion-definition.entity.js';
import {
  ConversionInstance,
  CiInput,
  CiOutput,
} from './entities/conversion-instance.entity.js';
import { MaterialBatch } from '../base/entities/material-batch.entity.js';
import { TraceabilityService } from './services/traceability.service.js';
import { ConversionDefinitionService } from './services/conversion-definition.service.js';
import { ConversionInstanceService } from './services/conversion-instance.service.js';
import { ConversionController } from './conversion.controller.js';
import { CacheModule } from '../../shared/cache/cache.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ConversionDefinition,
      CdInput,
      CdOutput,
      ConversionInstance,
      CiInput,
      CiOutput,
      MaterialBatch,
    ]),
    CacheModule,
  ],
  controllers: [ConversionController],
  providers: [
    ConversionDefinitionService,
    ConversionInstanceService,
    TraceabilityService,
  ],
  exports: [
    ConversionDefinitionService,
    ConversionInstanceService,
    TraceabilityService,
  ],
})
export class ConversionModule {}
