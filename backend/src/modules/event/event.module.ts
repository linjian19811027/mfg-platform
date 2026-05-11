import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventStore } from '../../shared/message/event-store.entity.js';
import { EventController } from './event.controller.js';
import { MessageModule } from '../../shared/message/message.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([EventStore]), MessageModule],
  controllers: [EventController],
  exports: [],
})
export class EventModule {}
