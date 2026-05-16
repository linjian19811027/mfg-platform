import { request } from '@/utils/request'

export interface WorkOrder {
  id: string
  code: string
  materialId: string
  materialName?: string
  plannedQty: number
  completedQty: number
  status: string
  priority?: number
  plannedStartDate?: string
  plannedEndDate?: string
  operations?: WorkOrderOperation[]
}

export interface WorkOrderOperation {
  id: string
  seqNo: number
  name: string
  status: string
  plannedQty: number
  completedQty: number
  equipmentId?: string
  workcenterName?: string
}

export interface ProductionReport {
  id: string
  woId: string
  wooId?: string
  operatorId?: string
  completedQty: number
  scrapQty?: number
  reportTime: string
  reportType: string  // START / COMPLETE / SCRAP / TRANSFER / EXCEPTION
  uomId?: string
  equipmentId?: string
  shiftId?: string
  inputBatchIds?: string[]
  outputBatchId?: string
  exceptionType?: string
  exceptionReason?: string
  correctionReason?: string
  originalReportId?: string
}

export interface MesLaborRecord {
  id: string
  woId: string
  wooId?: string
  operatorId: string
  operatorName?: string
  startTime: string
  endTime?: string
  directHours: number
  indirectHours: number
  shiftId?: string
  laborType: string  // DIRECT / INDIRECT
  createdAt?: string
}

export interface ProductionReportQuery {
  woId?: string
  operatorId?: string
  startDate?: string
  endDate?: string
  reportType?: string
  page?: number
  pageSize?: number
}

export interface MaterialIssue {
  id: string
  woId: string
  materialId: string
  materialCode?: string
  batchId?: string
  qty: number
  uomId?: string
  issueType: string
  operatorId?: string
  issueTime: string
}

export interface QualityDashboard {
  todayNcCount: number
  firstPassRate: number
  overallPassRate: number
  ncTrend: { date: string; count: number }[]
  operationPassRates: { operationName: string; rate: number }[]
  recentNcs: { woCode?: string; operationName?: string; defectType?: string; qty?: number; time?: string }[]
}

export const mesApi = {
  // 工单
  getMesWorkOrders: async (params: object) => {
    try {
      return await request.get<{ list: WorkOrder[]; total: number }>('/v1/mes/work-orders', params)
    } catch { return { list: [], total: 0 } }
  },
  getMesWorkOrder: async (id: string) => {
    try {
      return await request.get<WorkOrder>(`/v1/mes/work-orders/${id}`)
    } catch { return null as unknown as WorkOrder }
  },
  createMesWorkOrder: async (data: object) => {
    // 字段映射：前端用 code/plannedStartDate/plannedEndDate，后端用 woNo/plannedStart/plannedEnd
    const d = data as Record<string, unknown>
    const mapped = {
      ...d,
      woNo: d.woNo ?? d.code,
      plannedStart: d.plannedStart ?? d.plannedStartDate,
      plannedEnd: d.plannedEnd ?? d.plannedEndDate,
      uomId: d.uomId ?? '1',  // 默认单位
    }
    return await request.post<WorkOrder>('/v1/mes/work-orders', mapped)
  },
  transitionWorkOrder: async (id: string, status: string) => {
    return await request.patch<WorkOrder>(`/v1/mes/work-orders/${id}/status`, { status })
  },
  splitWorkOrder: async (id: string, data: object) => {
    return await request.post<WorkOrder[]>(`/v1/mes/work-orders/${id}/split`, data)
  },
  mergeWorkOrders: async (data: object) => {
    return await request.post<WorkOrder>('/v1/mes/work-orders/merge', data)
  },

  // 报工
  getProductionReports: async (params: object) => {
    try {
      return await request.get<{ list: ProductionReport[]; total: number }>('/v1/mes/production-reports', params)
    } catch { return { list: [], total: 0 } }
  },

  // 工时记录
  getLaborRecords: async (params: object) => {
    try {
      return await request.get<{ list: any[]; total: number }>('/v1/mes/labor-records', params)
    } catch { return { list: [], total: 0 } }
  },

  // 领料
  getMaterialIssues: async (woId: string, params?: object) => {
    try {
      return await request.get<{ list: MaterialIssue[]; total: number }>(`/v1/mes/work-orders/${woId}/material-issues`, params)
    } catch { return { list: [], total: 0 } }
  },
  issueMaterials: async (woId: string, data: object) => {
    return await request.post<void>(`/v1/mes/work-orders/${woId}/material-issues`, data)
  },
  returnMaterials: async (woId: string, data: object) => {
    return await request.post<void>(`/v1/mes/work-orders/${woId}/material-returns`, data)
  },
  kitCheck: async (woId: string) => {
    try {
      return await request.get<{ items: { materialId: string; materialCode?: string; materialName?: string; required: number; available: number; sufficient: boolean }[] }>(`/v1/mes/work-orders/${woId}/kit-check`)
    } catch { return { items: [] } }
  },

  // 工序操作
  startOperation: async (opId: string, data: object) => {
    return await request.post<void>(`/v1/mes/operations/${opId}/start`, data)
  },
  completeOperation: async (opId: string, data: object) => {
    return await request.post<void>(`/v1/mes/operations/${opId}/complete`, data)
  },
  reportException: async (opId: string, data: object) => {
    return await request.post<void>(`/v1/mes/operations/${opId}/exception`, data)
  },

  // 看板
  getQualityDashboard: async () => {
    try {
      return await request.get<QualityDashboard>('/v1/mes/dashboards/quality')
    } catch { return null as unknown as QualityDashboard }
  },
}

// ── 自动入库配置 ──────────────────────────────────────────────────────────

export function getAutoReceiptConfigs(params: any) {
  return request.get('/v1/mes/auto-receipt-config', { params })
}
export function createAutoReceiptConfig(data: any) {
  return request.post('/v1/mes/auto-receipt-config', data)
}
export function updateAutoReceiptConfig(id: string, data: any) {
  return request.put(`/v1/mes/auto-receipt-config/${id}`, data)
}
export function deleteAutoReceiptConfig(id: string) {
  return request.delete(`/v1/mes/auto-receipt-config/${id}`)
}
export function toggleAutoReceiptConfig(id: string) {
  return request.patch(`/v1/mes/auto-receipt-config/${id}/toggle`)
}

// ── 入库日志 ──────────────────────────────────────────────────────────────

export function getReceiptLogs(params: any) {
  return request.get('/v1/mes/receipt-logs', { params })
}
export function retryReceiptLog(id: string) {
  return request.post(`/v1/mes/receipt-logs/${id}/retry`)
}

// ── 多层级工单 ────────────────────────────────────────────────────────────

export function getWorkOrderTree(id: string) {
  return request.get(`/v1/mes/work-orders/${id}/tree`)
}
export function getWorkOrderCriticalPath(id: string) {
  return request.get(`/v1/mes/work-orders/${id}/critical-path`)
}
export function getWorkOrderReadiness(id: string) {
  return request.get(`/v1/mes/work-orders/${id}/readiness`)
}
export function getCancelPreview(id: string) {
  return request.get(`/v1/mes/work-orders/${id}/cancel-preview`)
}
export function cancelWorkOrder(id: string, data: any) {
  return request.post(`/v1/mes/work-orders/${id}/cancel`, data)
}
