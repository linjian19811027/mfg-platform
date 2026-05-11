import { Module, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CACHE_PROVIDER } from './cache.interface.js';
import { MemoryCacheService } from './memory-cache.service.js';

@Module({
  providers: [
    {
      provide: CACHE_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('REDIS_URL');
        const logger = new Logger('CacheModule');
        if (redisUrl) {
          logger.log('[Cache] Using Redis');
          // Redis 实现留待后续 Phase 5 接入，当前降级
          return new MemoryCacheService();
        }
        logger.warn('[Cache] Using MemoryLRU (degraded mode)');
        return new MemoryCacheService();
      },
    },
  ],
  exports: [CACHE_PROVIDER],
})
export class CacheModule {}
