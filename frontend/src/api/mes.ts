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
  operatorId?: string
  completedQty: number
  scrapQty?: number
  reportTime: string
  action: string
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
    try { return await request.post<WorkOrder>('/v1/mes/work-orders', mapped) }
    catch { return null as unknown as WorkOrder }
  },
  transitionWorkOrder: async (id: string, status: string) => {
    try {
      return await request.patch<WorkOrder>(`/v1/mes/work-orders/${id}/status`, { status })
    } catch { return null as unknown as WorkOrder }
  },
  splitWorkOrder: async (id: string, data: object) => {
    try {
      return await request.post<WorkOrder[]>(`/v1/mes/work-orders/${id}/split`, data)
    } catch { return [] as WorkOrder[] }
  },
  mergeWorkOrders: async (data: object) => {
    try {
      return await request.post<WorkOrder>('/v1/mes/work-orders/merge', data)
    } catch { return null as unknown as WorkOrder }
  },

  // 报工
  getProductionReports: async (params: object) => {
    try {
      return await request.get<{ list: ProductionReport[]; total: number }>('/v1/mes/production-reports', params)
    } catch { return { list: [], total: 0 } }
  },

  // 领料
  getMaterialIssues: async (woId: string, params?: object) => {
    try {
      return await request.get<{ list: MaterialIssue[]; total: number }>(`/v1/mes/work-orders/${woId}/material-issues`, params)
    } catch { return { list: [], total: 0 } }
  },
  issueMaterials: async (woId: string, data: object) => {
    try {
      return await request.post<void>(`/v1/mes/work-orders/${woId}/material-issues`, data)
    } catch { return }
  },
  returnMaterials: async (woId: string, data: object) => {
    try {
      return await request.post<void>(`/v1/mes/work-orders/${woId}/material-returns`, data)
    } catch { return }
  },
  kitCheck: async (woId: string) => {
    try {
      return await request.get<{ items: { materialId: string; materialCode?: string; materialName?: string; required: number; available: number; sufficient: boolean }[] }>(`/v1/mes/work-orders/${woId}/kit-check`)
    } catch { return { items: [] } }
  },

  // 工序操作
  startOperation: async (opId: string, data: object) => {
    try {
      return await request.post<void>(`/v1/mes/operations/${opId}/start`, data)
    } catch { return }
  },
  completeOperation: async (opId: string, data: object) => {
    try {
      return await request.post<void>(`/v1/mes/operations/${opId}/complete`, data)
    } catch { return }
  },
  reportException: async (opId: string, data: object) => {
    try {
      return await request.post<void>(`/v1/mes/operations/${opId}/exception`, data)
    } catch { return }
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
