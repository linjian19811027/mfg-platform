import { Injectable, OnModuleInit, Inject, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  MESSAGE_SERVICE,
  MessageService,
  DomainEvent,
} from '../../../shared/message/message.interface.js';
import { EventTypes } from '../../event/event-types.constant.js';
import {
  WorkHourService,
  OperationReportedEvent,
} from './work-hour.service.js';

@Injectable()
export class HrEventService implements OnModuleInit {
  private readonly logger = new Logger(HrEventService.name);

  constructor(
    @Inject(MESSAGE_SERVICE)
    private readonly messageSvc: MessageService,
    private readonly workHourService: WorkHourService,
  ) {}

  // ── 3.6.1 订阅 OPERATION_REPORTED → 汇总工时 ─────────────────────────────

  onModuleInit() {
    this.messageSvc.subscribe(EventTypes.OPERATION_REPORTED, (e) =>
      this.onOperationReported(e),
    );
    this.logger.log('HR event subscriptions registered');
  }

  private async onOperationReported(event: DomainEvent): Promise<void> {
    const { tenantId, payload } = event;
    this.logger.debug(
      `[HR] OPERATION_REPORTED received: ${JSON.stringify(payload)}`,
    );

    try {
      const reportEvent: OperationReportedEvent = {
        tenantId,
        empId: String(payload['empId'] ?? ''),
        operationCode: String(payload['operationCode'] ?? ''),
        workCenterId: payload['workCenterId']
          ? Number(payload['workCenterId'])
          : undefined,
        startTime: String(payload['startTime'] ?? ''),
        endTime: String(payload['endTime'] ?? ''),
        reportId: Number(payload['reportId'] ?? 0),
      };

      if (
        !reportEvent.empId ||
        !reportEvent.startTime ||
        !reportEvent.endTime ||
        !reportEvent.reportId
      ) {
        this.logger.warn(
          `[HR] OPERATION_REPORTED payload 缺少必要字段，跳过：${JSON.stringify(payload)}`,
        );
        return;
      }

      await this.workHourService.processReport(reportEvent);
    } catch (err) {
      this.logger.error(`[HR] Failed to process OPERATION_REPORTED: ${err}`);
    }
  }

  // ── 3.6.2 发布 CERTIFICATION_UPDATED（由 CertificationService 调用）────────

  async publishCertificationUpdated(
    tenantId: string,
    empId: number,
    certTypeCode: string,
    action: 'ADD' | 'RENEW' | 'DELETE',
    expireDate?: string,
  ): Promise<void> {
    try {
      await this.messageSvc.publish({
        eventId: uuidv4(),
        eventType: EventTypes.CERTIFICATION_UPDATED,
        tenantId,
        sourceModule: 'HR',
        targetModule: '*',
        payload: { empId, certTypeCode, action, expireDate },
        createdAt: new Date(),
      });
      this.logger.debug(
        `[HR] Published CERTIFICATION_UPDATED: empId=${empId}, code=${certTypeCode}, action=${action}`,
      );
    } catch (err) {
      this.logger.error(`[HR] Failed to publish CERTIFICATION_UPDATED: ${err}`);
    }
  }
}
