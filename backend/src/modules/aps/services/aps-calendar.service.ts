import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, IsNull, Or } from 'typeorm';
import { ApsCalendar } from '../entities/aps-calendar.entity';

export interface CreateCalendarDto {
  resourceId?: string;
  workDate: Date | string;
  shiftCode?: string;
  startTime: string;
  endTime: string;
  availableHours?: number;
  isHoliday?: number;
}

export interface QueryCalendarDto {
  resourceId?: string;
  startDate?: Date | string;
  endDate?: Date | string;
  isHoliday?: number;
}

@Injectable()
export class ApsCalendarService {
  constructor(
    @InjectRepository(ApsCalendar)
    private readonly calendarRepo: Repository<ApsCalendar>,
  ) {}

  async create(
    tenantId: string,
    data: CreateCalendarDto,
  ): Promise<ApsCalendar> {
    const entry = this.calendarRepo.create({ ...data, tenantId });
    return this.calendarRepo.save(entry);
  }

  async batchCreate(
    tenantId: string,
    entries: CreateCalendarDto[],
  ): Promise<ApsCalendar[]> {
    const records = entries.map((e) =>
      this.calendarRepo.create({ ...e, tenantId }),
    );
    return this.calendarRepo.save(records);
  }

  async findAll(
    tenantId: string,
    query: QueryCalendarDto = {},
  ): Promise<ApsCalendar[]> {
    const qb = this.calendarRepo
      .createQueryBuilder('cal')
      .where('cal.tenant_id = :tenantId', { tenantId });

    if (query.resourceId !== undefined) {
      qb.andWhere('cal.resource_id = :resourceId', {
        resourceId: query.resourceId,
      });
    }
    if (query.startDate !== undefined) {
      qb.andWhere('cal.work_date >= :startDate', {
        startDate: query.startDate,
      });
    }
    if (query.endDate !== undefined) {
      qb.andWhere('cal.work_date <= :endDate', { endDate: query.endDate });
    }
    if (query.isHoliday !== undefined) {
      qb.andWhere('cal.is_holiday = :isHoliday', {
        isHoliday: query.isHoliday,
      });
    }

    return qb
      .orderBy('cal.work_date', 'ASC')
      .addOrderBy('cal.shift_code', 'ASC')
      .getMany();
  }

  async update(
    tenantId: string,
    id: string,
    data: Partial<CreateCalendarDto>,
  ): Promise<ApsCalendar> {
    const entry = await this.calendarRepo.findOne({ where: { id, tenantId } });
    if (!entry) {
      throw new NotFoundException(`ApsCalendar #${id} not found`);
    }
    Object.assign(entry, data);
    return this.calendarRepo.save(entry);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const entry = await this.calendarRepo.findOne({ where: { id, tenantId } });
    if (!entry) {
      throw new NotFoundException(`ApsCalendar #${id} not found`);
    }
    await this.calendarRepo.remove(entry);
  }

  async setHoliday(
    tenantId: string,
    date: Date | string,
    isHoliday: number,
  ): Promise<void> {
    await this.calendarRepo
      .createQueryBuilder()
      .update(ApsCalendar)
      .set({ isHoliday })
      .where('tenant_id = :tenantId', { tenantId })
      .andWhere('work_date = :date', { date })
      .execute();
  }

  async getWorkingHours(
    tenantId: string,
    resourceId: string | null,
    date: Date | string,
  ): Promise<number> {
    const qb = this.calendarRepo
      .createQueryBuilder('cal')
      .where('cal.tenant_id = :tenantId', { tenantId })
      .andWhere('cal.work_date = :date', { date });

    if (resourceId !== null && resourceId !== undefined) {
      qb.andWhere(
        '(cal.resource_id = :resourceId OR cal.resource_id IS NULL)',
        { resourceId },
      );
    } else {
      qb.andWhere('cal.resource_id IS NULL');
    }

    const entries = await qb.getMany();

    if (entries.length === 0) return 0;

    // 如果任意条目标记为节假日，返回 0
    if (entries.some((e) => e.isHoliday === 1)) return 0;

    // 优先使用 resourceId 精确匹配的条目；若无则使用工厂级（resourceId=null）
    const specific = entries.filter((e) => e.resourceId === resourceId);
    const effective = specific.length > 0 ? specific : entries;

    return effective.reduce((sum, e) => sum + this._resolveHours(e), 0);
  }

  async getWorkingHoursBetween(
    tenantId: string,
    resourceId: string | null,
    startDate: Date | string,
    endDate: Date | string,
  ): Promise<number> {
    const qb = this.calendarRepo
      .createQueryBuilder('cal')
      .where('cal.tenant_id = :tenantId', { tenantId })
      .andWhere('cal.work_date >= :startDate', { startDate })
      .andWhere('cal.work_date <= :endDate', { endDate });

    if (resourceId !== null && resourceId !== undefined) {
      qb.andWhere(
        '(cal.resource_id = :resourceId OR cal.resource_id IS NULL)',
        { resourceId },
      );
    } else {
      qb.andWhere('cal.resource_id IS NULL');
    }

    const entries = await qb.orderBy('cal.work_date', 'ASC').getMany();

    if (entries.length === 0) return 0;

    // 按日期分组计算
    const byDate = new Map<string, ApsCalendar[]>();
    for (const e of entries) {
      const key = this._dateKey(e.workDate);
      if (!byDate.has(key)) byDate.set(key, []);
      byDate.get(key)!.push(e);
    }

    let total = 0;
    for (const dayEntries of byDate.values()) {
      if (dayEntries.some((e) => e.isHoliday === 1)) continue;

      const specific = dayEntries.filter((e) => e.resourceId === resourceId);
      const effective = specific.length > 0 ? specific : dayEntries;
      total += effective.reduce((sum, e) => sum + this._resolveHours(e), 0);
    }

    return total;
  }

  // 计算单条记录的可用工时
  private _resolveHours(entry: ApsCalendar): number {
    if (entry.availableHours !== null && entry.availableHours !== undefined) {
      return Number(entry.availableHours);
    }
    // 用 endTime - startTime 计算（格式 HH:MM:SS 或 HH:MM）
    return this._timeDiffHours(entry.startTime, entry.endTime);
  }

  private _timeDiffHours(start: string, end: string): number {
    const toMinutes = (t: string): number => {
      const parts = t.split(':').map(Number);
      return parts[0] * 60 + parts[1] + (parts[2] ?? 0) / 60;
    };
    const diff = toMinutes(end) - toMinutes(start);
    return diff > 0 ? diff / 60 : 0;
  }

  private _dateKey(date: Date | string): string {
    if (typeof date === 'string') return date.slice(0, 10);
    return date.toISOString().slice(0, 10);
  }
}
