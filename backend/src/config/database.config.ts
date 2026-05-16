import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { AuditFieldsSubscriber } from '../shared/user/audit-fields.subscriber.js';

export function getDatabaseConfig(config: ConfigService): TypeOrmModuleOptions {
  return {
    type: 'mysql',
    host: config.get<string>('DATABASE_HOST', 'localhost'),
    port: config.get<number>('DATABASE_PORT', 3306),
    username: config.get<string>('DATABASE_USER', 'root'),
    password: config.get<string>('DATABASE_PASS', ''),
    database: config.get<string>('DATABASE_NAME', 'mfg_platform'),
    // 自动加载通过 TypeOrmModule.forFeature() 注册的实体
    autoLoadEntities: true,
    // 订阅器：自动填充 createdBy/updatedBy
    subscribers: [AuditFieldsSubscriber],
    // 开发环境自动同步表结构，生产环境必须关闭
    synchronize: config.get<string>('NODE_ENV') !== 'production',
    logging:
      config.get<string>('NODE_ENV') === 'development'
        ? ['error', 'warn']
        : ['error'],
    charset: 'utf8mb4',
    timezone: '+08:00',
    extra: {
      connectionLimit: 10,
    },
  };
}
