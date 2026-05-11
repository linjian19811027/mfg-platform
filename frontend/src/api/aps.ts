import { request } from '@/utils/request'

export interface ApsResource {
  id: string; code: string; name: string; type: string; status: string
  capacity?: number; efficiency?: number; tenantId?: string
}

export interface ApsCalendar {
  id: string; resourceId?: string; date: string
  shiftStart?: string; shiftEnd?: string; isHoliday: number; workHours?: number
}

export interface ApsSchedule {
  id: string; woId: string; resourceId: string; resourceName?: string
  operationId?: string; plannedStart: string; plannedEnd: string; status: string
}

export interface ApsMrp {
  id: string; code: string; status: string; calculatedAt?: string; createdAt: string; lines?: ApsMrpLine[]
}

export interface ApsMrpLine {
  id: string; mrpId: string; materialId: string; materialCode?: string; materialName?: string
  requiredQty: number; availableQty: number; shortageQty: number; suggestedOrderQty?: number; requiredDate?: string
}

export interface ApsPriorityRule {
  id: string; name: string; ruleType: string; weight: number; isActive: boolean; description?: string
}

const d = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
  try { return await fn() } catch { return fallback }
}

export const apsApi = {
  getResources: (params: object) =>
    d(() => request.get<{ list: ApsResource[]; total: number }>('/v1/aps/resources', params), { list: [], total: 0 }),
  createResource: (data: object) =>
    d(() => request.post<ApsResource>('/v1/aps/resources', data), null as unknown as ApsResource),
  updateResource: (id: string, data: object) =>
    d(() => request.patch<ApsResource>(`/v1/aps/resources/${id}`, data), null as unknown as ApsResource),
  deleteResource: (id: string) =>
    d(() => request.delete<void>(`/v1/aps/resources/${id}`), undefined),
  updateResourceStatus: (id: string, status: string) =>
    d(() => request.patch<void>(`/v1/aps/resources/${id}/status`, { status }), undefined),
  addAlternativeResource: (id: string, alternativeId: string) =>
    d(() => request.post<void>(`/v1/aps/resources/${id}/alternatives`, { alternativeId }), undefined),
  getCalendars: (params: object) =>
    d(() => request.get<{ list: ApsCalendar[] }>('/v1/aps/calendars', params), { list: [] }),
  createCalendar: (data: object) =>
    d(() => request.post<ApsCalendar>('/v1/aps/calendars', data), null as unknown as ApsCalendar),
  setHoliday: (date: string, isHoliday: number) =>
    d(() => request.patch<void>('/v1/aps/calendars/holiday', { date, isHoliday }), undefined),
  getSchedules: (params: { woId?: string; resourceId?: string; page?: number; pageSize?: number } | string) => {
    const woId = typeof params === 'string' ? params : (params as { woId?: string }).woId
    const p = typeof params === 'object' ? params : {}
    if (woId) return d(() => request.get<{ list: ApsSchedule[]; total?: number }>(`/v1/aps/schedules/wo/${woId}`), { list: [] as ApsSchedule[], total: 0 })
    return d(() => request.get<{ list: ApsSchedule[]; total: number }>('/v1/aps/schedules', p), { list: [] as ApsSchedule[], total: 0 })
  },
  triggerForwardSchedule: (data: object) =>
    d(() => request.post<{ schedules: ApsSchedule[] }>('/v1/aps/schedule', { inputs: [data] }), { schedules: [] }),
  scheduleForward: (data: object) =>
    d(() => request.post<{ schedules: ApsSchedule[] }>('/v1/aps/schedule', data), { schedules: [] }),
  releaseWorkOrders: (scheduleIds: string[]) =>
    d(() => request.post<void>('/v1/aps/schedule/release', { scheduleIds }), undefined),
  getMrpList: (params: object) =>
    d(() => request.get<{ list: ApsMrp[]; total: number }>('/v1/aps/mrp', params), { list: [], total: 0 }),
  getMrp: (id: string) =>
    d(() => request.get<ApsMrp>(`/v1/aps/mrp/${id}`), null as unknown as ApsMrp),
  getMrpLines: (id: string) =>
    d(() => request.get<ApsMrp>(`/v1/aps/mrp/${id}`).then(r => ({ list: r.lines ?? [] })), { list: [] as ApsMrpLine[] }),
  calculateMrp: (data: object) =>
    d(() => request.post<ApsMrp>('/v1/aps/mrp/calculate', { input: data }), null as unknown as ApsMrp),
  releaseMrp: (id: string) =>
    d(() => request.post<void>(`/v1/aps/mrp/${id}/release`, {}), undefined),
  getCapacityAnalysis: (params: object) =>
    d(() => request.get<{ resources: { resourceId: string; resourceName: string; loadRate: number }[] }>('/v1/aps/capacity-analysis', params).then(r => ({ ...r, list: r.resources ?? [] })), { resources: [], list: [] as { resourceId: string; resourceName: string; loadRate: number }[] }),
  getDeliveryAnalysis: (params: object) =>
    d(() => request.get<{ onTimeRate: number; delayedOrders: { woId: string; delayDays: number }[] }>('/v1/aps/delivery-analysis', params).then(r => ({ ...r, list: r.delayedOrders ?? [] })), { onTimeRate: 0, delayedOrders: [], list: [] as { woId: string; delayDays: number }[] }),
  getGanttData: (type: 'resource' | 'order', params: object) =>
    d(() => request.get<{ rows: unknown[] }>(`/v1/aps/gantt/${type}`, params), { rows: [] }),
  getPriorityRules: () =>
    d(() => request.get<{ list: ApsPriorityRule[] }>('/v1/aps/priority-rules'), { list: [] }),
  createPriorityRule: (data: object) =>
    d(() => request.post<ApsPriorityRule>('/v1/aps/priority-rules', data), null as unknown as ApsPriorityRule),
  updatePriorityRule: (id: string, data: object) =>
    d(() => request.patch<ApsPriorityRule>(`/v1/aps/priority-rules/${id}`, data), null as unknown as ApsPriorityRule),
  togglePriorityRule: (id: string, isActive: boolean) =>
    d(() => request.patch<void>(`/v1/aps/priority-rules/${id}/toggle`, { isActive }), undefined),
  deletePriorityRule: (id: string) =>
    d(() => request.delete<void>(`/v1/aps/priority-rules/${id}`), undefined),
}
