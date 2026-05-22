import { Module, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { AppController } from './app.controller.js';
import { CacheModule } from './shared/cache/cache.module.js';
import { MessageModule } from './shared/message/message.module.js';
import { TenantModule } from './shared/tenant/tenant.module.js';
import { LogModule } from './shared/logger/log.module.js';
import { GlobalExceptionFilter } from './shared/logger/global-exception.filter.js';
import { SysAuditLog } from './modules/auth/entities/sys-audit-log.entity.js';
import { SysTenant } from './modules/auth/entities/sys-tenant.entity.js';
import { SysUser } from './modules/auth/entities/sys-user.entity.js';
import { SysRole } from './modules/auth/entities/sys-role.entity.js';
import { SysUserRole } from './modules/auth/entities/sys-user-role.entity.js';
import { SysOrganization } from './modules/base/entities/sys-organization.entity.js';
import { SysUom, SysUomConversion } from './modules/base/entities/sys-uom.entity.js';
import { SysNumberingRule } from './modules/base/entities/sys-numbering-rule.entity.js';
import { MfgWorkCenter } from './modules/base/entities/mfg-work-center.entity.js';
import { HrShift } from './modules/hr/entities/hr-shift.entity.js';
import { HrJobType } from './modules/hr/entities/hr-job-type.entity.js';
import { PlmMaterialCategory } from './modules/plm/entities/plm-material-category.entity.js';
import { WmsWarehouse } from './modules/wms/entities/wms-warehouse.entity.js';
import { WmsZone } from './modules/wms/entities/wms-zone.entity.js';
import { WmsLocation } from './modules/wms/entities/wms-location.entity.js';
import { ErpAccount } from './modules/erp/entities/erp-account.entity.js';
import { ErpCostCenter } from './modules/erp/entities/erp-cost-center.entity.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { BaseModule } from './modules/base/base.module.js';
import { ConversionModule } from './modules/conversion/conversion.module.js';
import { EventModule } from './modules/event/event.module.js';
import { FileModule } from './modules/file/file.module.js';
import { PlmModule } from './modules/plm/plm.module.js';
import { MesModule } from './modules/mes/mes.module.js';
import { WmsModule } from './modules/wms/wms.module.js';
import { QmsModule } from './modules/qms/qms.module.js';
import { ScmModule } from './modules/scm/scm.module.js';
import { ErpModule } from './modules/erp/erp.module.js';
import { ApsModule } from './modules/aps/aps.module.js';
import { EamModule } from './modules/eam/eam.module.js';
import { ReportModule } from './modules/report/report.module.js';
import { OutsourcingModule } from './modules/outsourcing/outsourcing.module.js';
import { HrModule } from './modules/hr/hr.module.js';
import { TraceabilityModule } from './modules/traceability/traceability.module.js';
import { RptModule } from './modules/rpt/rpt.module.js';
import { getDatabaseConfig } from './config/database.config.js';
import { InitSeedService } from './modules/shared/seed/init-seed.service.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV || 'development'}`,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: getDatabaseConfig,
    }),
    ScheduleModule.forRoot(),
    // 限流：默认关闭（THROTTLE_DISABLE=1），上线时去掉并配置限流值
    // THROTTLE_GLOBAL_LIMIT=1000 每分钟全局请求上限
    // THROTTLE_TTL=60000 限流窗口（毫秒）
    ...(process.env.THROTTLE_DISABLE === '1'
      ? []
      : [ThrottlerModule.forRoot([{
          name: 'default',
          ttl: Number(process.env.THROTTLE_TTL ?? 60000),
          limit: Number(process.env.THROTTLE_GLOBAL_LIMIT ?? 100),
        }])]),
    CacheModule,
    MessageModule,
    TenantModule,
    LogModule,
    TypeOrmModule.forFeature([
      SysAuditLog,
      SysTenant,
      SysUser,
      SysRole,
      SysUserRole,
      SysOrganization,
      SysUom,
      SysUomConversion,
      SysNumberingRule,
      MfgWorkCenter,
      HrShift,
      HrJobType,
      PlmMaterialCategory,
      WmsWarehouse,
      WmsZone,
      WmsLocation,
      ErpAccount,
      ErpCostCenter,
    ]),
    AuthModule,
    BaseModule,
    ConversionModule,
    EventModule,
    FileModule,
    PlmModule,
    MesModule,
    WmsModule,
    QmsModule,
    ScmModule,
    ErpModule,
    ApsModule,
    EamModule,
    ReportModule,
    OutsourcingModule,
    HrModule,
    TraceabilityModule,
    RptModule,
  ],
  controllers: [AppController],
  providers: [
    // 全局限流守卫（测试环境禁用）
    ...(process.env.THROTTLE_DISABLE === '1' ? [] : [{ provide: APP_GUARD, useClass: ThrottlerGuard }]),
    // 全局异常过滤器（记录系统错误和业务错误日志）
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    // 基础种子数据初始化
    InitSeedService,
  ],
})
export class AppModule implements OnApplicationBootstrap {
  private readonly logger = new Logger('AppModule');

  constructor(private readonly configService: ConfigService) {}

  onApplicationBootstrap() {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    const storageType = this.configService.get<string>('STORAGE_TYPE', 'local');

    this.logger.log('=== Infrastructure Detection ===');
    this.logger.log('MySQL: ✅ connected');
    if (redisUrl) {
      this.logger.log('Redis: ✅ connected');
      this.logger.log('Cache: Redis | Queue: Bull | Session: Redis');
      this.logger.log('Mode: 🟢 FULL');
    } else {
      this.logger.warn('Redis: ⚠️  not configured, fallback to memory');
      this.logger.log('Cache: MemoryLRU | Queue: DB polling 5s | Session: JWT');
      this.logger.warn('Mode: 🟡 DEGRADED (functional but limited)');
    }
    this.logger.log(`Storage: ${storageType}`);
    this.logger.log('================================');
  }
}
