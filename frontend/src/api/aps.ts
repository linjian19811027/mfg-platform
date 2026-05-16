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

const d = async <T>(fn: () => Promise<T>): Promise<T> => {
  return await fn()
}

export const apsApi = {
  getResources: (params: object) =>
    d(() => request.get<{ list: ApsResource[]; total: number }>('/v1/aps/resources', params)),
  createResource: (data: object) =>
    request.post<ApsResource>('/v1/aps/resources', data),
  updateResource: (id: string, data: object) =>
    request.patch<ApsResource>(`/v1/aps/resources/${id}`, data),
  deleteResource: (id: string) =>
    request.delete<void>(`/v1/aps/resources/${id}`),
  updateResourceStatus: (id: string, status: string) =>
    request.patch<void>(`/v1/aps/resources/${id}/status`, { status }),
  addAlternativeResource: (id: string, alternativeId: string) =>
    request.post<void>(`/v1/aps/resources/${id}/alternatives`, { alternativeId }),
  getCalendars: (params: object) =>
    d(() => request.get<{ list: ApsCalendar[] }>('/v1/aps/calendars', params)),
  createCalendar: (data: object) =>
    request.post<ApsCalendar>('/v1/aps/calendars', data),
  setHoliday: (date: string, isHoliday: number) =>
    request.patch<void>('/v1/aps/calendars/holiday', { date, isHoliday }),
  getSchedules: (params: { woId?: string; resourceId?: string; page?: number; pageSize?: number } | string) => {
    const woId = typeof params === 'string' ? params : (params as { woId?: string }).woId
    const p = typeof params === 'object' ? params : {}
    if (woId) return d(() => request.get<{ list: ApsSchedule[]; total?: number }>(`/v1/aps/schedules/wo/${woId}`))
    return d(() => request.get<{ list: ApsSchedule[]; total: number }>('/v1/aps/schedules', p))
  },
  triggerForwardSchedule: (data: object) =>
    request.post<{ schedules: ApsSchedule[] }>('/v1/aps/schedule', { inputs: [data] }),
  scheduleForward: (data: object) =>
    request.post<{ schedules: ApsSchedule[] }>('/v1/aps/schedule', data),
  releaseWorkOrders: (scheduleIds: string[]) =>
    request.post<void>('/v1/aps/schedule/release', { scheduleIds }),
  getMrpList: (params: object) =>
    d(() => request.get<{ list: ApsMrp[]; total: number }>('/v1/aps/mrp', params)),
  getMrp: (id: string) =>
    d(() => request.get<ApsMrp>(`/v1/aps/mrp/${id}`)),
  getMrpLines: (id: string) =>
    d(() => request.get<ApsMrp>(`/v1/aps/mrp/${id}`).then(r => ({ list: r.lines ?? [] }))),
  calculateMrp: (data: object) =>
    request.post<ApsMrp>('/v1/aps/mrp/calculate', { input: data }),
  releaseMrp: (id: string) =>
    request.post<void>(`/v1/aps/mrp/${id}/release`, {}),
  getCapacityAnalysis: (params: object) =>
    d(() => request.get<{ resources: { resourceId: string; resourceName: string; loadRate: number }[] }>('/v1/aps/capacity-analysis', params).then(r => ({ ...r, list: r.resources ?? [] }))),
  getDeliveryAnalysis: (params: object) =>
    d(() => request.get<{ onTimeRate: number; delayedOrders: { woId: string; delayDays: number }[] }>('/v1/aps/delivery-analysis', params).then(r => ({ ...r, list: r.delayedOrders ?? [] }))),
  getGanttData: (type: 'resource' | 'order', params: object) =>
    d(() => request.get<{ rows: unknown[] }>(`/v1/aps/gantt/${type}`, params)),
  getPriorityRules: () =>
    d(() => request.get<{ list: ApsPriorityRule[] }>('/v1/aps/priority-rules')),
  createPriorityRule: (data: object) =>
    request.post<ApsPriorityRule>('/v1/aps/priority-rules', data),
  updatePriorityRule: (id: string, data: object) =>
    request.patch<ApsPriorityRule>(`/v1/aps/priority-rules/${id}`, data),
  togglePriorityRule: (id: string, isActive: boolean) =>
    request.patch<void>(`/v1/aps/priority-rules/${id}/toggle`, { isActive }),
  deletePriorityRule: (id: string) =>
    request.delete<void>(`/v1/aps/priority-rules/${id}`),
}
