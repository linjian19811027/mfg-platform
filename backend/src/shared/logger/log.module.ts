import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SysAuditLog } from '../../modules/auth/entities/sys-audit-log.entity.js';
import { LogService } from './log.service.js';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([SysAuditLog])],
  providers: [LogService],
  exports: [LogService],
})
export class LogModule {}
