import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  HrEmployeeHistory,
  EmployeeEventType,
} from '../entities/hr-employee-history.entity.js';

@Injectable()
export class EmployeeHistoryService {
  constructor(
    @InjectRepository(HrEmployeeHistory)
    private readonly historyRepo: Repository<HrEmployeeHistory>,
  ) {}

  /** 批量查询某个员工的履历 */
  async findByEmployee(
    tenantId: string,
    employeeId: string,
  ): Promise<HrEmployeeHistory[]> {
    return this.historyRepo.find({
      where: { tenantId, employeeId },
      order: { createdAt: 'DESC' },
    });
  }

  /** 写入一条履历 */
  async record(
    dto: Pick<
      HrEmployeeHistory,
      | 'tenantId'
      | 'employeeId'
      | 'eventType'
      | 'description'
      | 'operatorId'
      | 'fromJobType'
      | 'toJobType'
      | 'fromWorkCenterId'
      | 'toWorkCenterId'
      | 'fromStatus'
      | 'toStatus'
      | 'remark'
    >,
  ): Promise<HrEmployeeHistory> {
    return this.historyRepo.save(this.historyRepo.create(dto));
  }

  /** 便捷：记录入职 */
  async recordOnboard(
    tenantId: string,
    employeeId: string,
    jobType: string,
    workCenterId?: number,
    operatorId?: string,
  ): Promise<HrEmployeeHistory> {
    return this.record({
      tenantId,
      employeeId,
      eventType: EmployeeEventType.ONBOARD,
      description: `员工入职，工种：${jobType}`,
      operatorId,
      toJobType: jobType,
      toWorkCenterId: workCenterId,
    });
  }

  /** 便捷：记录调动 */
  async recordTransfer(
    tenantId: string,
    employeeId: string,
    fromJobType: string | undefined,
    toJobType: string | undefined,
    fromWorkCenterId: number | undefined,
    toWorkCenterId: number | undefined,
    operatorId?: string,
    remark?: string,
  ): Promise<HrEmployeeHistory | null> {
    // 如果没有实际变更，不记录
    if (
      fromJobType === toJobType &&
      fromWorkCenterId === toWorkCenterId
    ) {
      return null;
    }

    const parts: string[] = [];
    if (fromJobType !== toJobType) {
      parts.push(
        `工种：${fromJobType ?? '无'} → ${toJobType ?? '无'}`,
      );
    }
    if (fromWorkCenterId !== toWorkCenterId) {
      parts.push(
        `工作中心：${fromWorkCenterId ?? '无'} → ${toWorkCenterId ?? '无'}`,
      );
    }

    return this.record({
      tenantId,
      employeeId,
      eventType: EmployeeEventType.TRANSFER,
      description: `岗位调动：${parts.join('；')}`,
      operatorId,
      fromJobType,
      toJobType,
      fromWorkCenterId,
      toWorkCenterId,
      remark,
    });
  }

  /** 便捷：记录状态变更 */
  async recordStatusChange(
    tenantId: string,
    employeeId: string,
    fromStatus: string,
    toStatus: string,
    operatorId?: string,
    remark?: string,
  ): Promise<HrEmployeeHistory> {
    const statusLabels: Record<string, string> = {
      ACTIVE: '在职',
      INACTIVE: '离职',
      SUSPENDED: '停职',
    };

    const eventType =
      toStatus === 'INACTIVE'
        ? EmployeeEventType.RESIGN
        : EmployeeEventType.STATUS_CHANGE;

    const label = eventType === EmployeeEventType.RESIGN ? '离职' : '状态变更';

    return this.record({
      tenantId,
      employeeId,
      eventType,
      description: `${label}：${statusLabels[fromStatus] ?? fromStatus} → ${statusLabels[toStatus] ?? toStatus}`,
      operatorId,
      fromStatus,
      toStatus,
      remark,
    });
  }

  /** 便捷：记录信息修改 */
  async recordInfoUpdate(
    tenantId: string,
    employeeId: string,
    changedFields: string[],
    operatorId?: string,
  ): Promise<HrEmployeeHistory> {
    return this.record({
      tenantId,
      employeeId,
      eventType: EmployeeEventType.INFO_UPDATE,
      description: `修改信息：${changedFields.join('、')}`,
      operatorId,
    });
  }
}
