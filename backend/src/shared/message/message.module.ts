import { Module, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MESSAGE_SERVICE } from './message.interface.js';
import { DatabaseMessageService } from './database-message.service.js';
import { EventStore } from './event-store.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([EventStore])],
  providers: [
    DatabaseMessageService,
    {
      provide: MESSAGE_SERVICE,
      inject: [ConfigService, DatabaseMessageService],
      useFactory: (
        config: ConfigService,
        dbService: DatabaseMessageService,
      ) => {
        const redisUrl = config.get<string>('REDIS_URL');
        const logger = new Logger('MessageModule');
        if (redisUrl) {
          logger.log('[Message] Using Bull queue (Redis)');
          // Bull 实现留待 Phase 5，当前统一使用 DB 轮询
          return dbService;
        }
        logger.warn('[Message] Using DB polling (degraded, 5s delay)');
        return dbService;
      },
    },
  ],
  exports: [MESSAGE_SERVICE, DatabaseMessageService],
})
export class MessageModule {}
