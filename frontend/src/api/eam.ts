import { request, MOCK_ENABLED } from '@/utils/request'

function rethrowIfNoMock(e: unknown) { if (!MOCK_ENABLED) throw e }

export interface Equipment {
  id: string
  equipmentCode: string
  equipmentName: string
  equipmentType: string
  category: string
  status: string
  workshopId?: string
  model?: string
  manufacturer?: string
  installDate?: string
}

export interface MaintenancePlan {
  id: string
  equipmentId: string
  equipmentName?: string
  planType: string
  status: string
  scheduledDate: string
  completedDate?: string
  description?: string
}

export interface MaintenanceStrategy {
  id: string
  equipmentId: string
  equipmentName?: string
  name: string
  strategyType: string  // PERIODIC/PREDICTIVE/CORRECTIVE
  triggerType: string   // DAYS/HOURS
  triggerValue: number
  content?: string
  status: string
}

export interface FaultRecord {
  id: string
  equipmentId: string
  equipmentName?: string
  faultType: string
  severity: string
  status: string
  reportedAt: string
  description?: string
}

export interface InspectionRecord {
  id: string
  equipmentId: string
  equipmentName?: string
  inspectorId?: string
  items?: { name: string; value: string; normal: boolean }[]
  status: string
  createdAt: string
}

export interface ChangeRecord {
  id: string
  changedAt: string
  changeType: string
  beforeValue: string
  afterValue: string
  operator: string
}

export interface LubricationPoint {
  id: string
  equipmentId: string
  equipmentName?: string
  pointName: string
  lubricantType?: string
  cycleDays: number
  lastDate?: string
  nextDate?: string
  status: string  // NORMAL/DUE_SOON/OVERDUE
}

export interface SparePart {
  id: string
  code: string
  name: string
  spec?: string
  qty: number
  safetyQty: number
  unit: string
  status: string
}

export interface SparePartTransaction {
  id: string
  sparePartId: string
  sparePartName?: string
  type: string  // IN/OUT/ISSUE
  qty: number
  operatorId?: string
  createdAt: string
}

export interface OeeRecord {
  id: string
  equipmentId: string
  equipmentName?: string
  date: string
  plannedTime: number
  actualTime: number
  output: number
  qualifiedOutput: number
  availability?: number
  performance?: number
  quality?: number
  oee?: number
}

export interface FaultKnowledge {
  id: string
  equipmentType?: string
  symptom: string
  cause?: string
  solution: string
  preventionMeasure?: string
  createdAt: string
}

export const eamApi = {
  // 设备
  getEquipments: async (params: object) => {
    try {
      const res = await request.get<{ data?: Equipment[]; list?: Equipment[]; total: number }>('/v1/eam/equipment', params)
      // 后端返回 data 字段，统一映射为 list
      const rawList = res.list ?? (res as any).data ?? []
      // 字段反向映射
      const list = rawList.map((e: any) => ({
        ...e,
        code: e.code ?? e.equipmentCode,
        name: e.name ?? e.equipmentName,
        type: e.type ?? e.equipmentType,
      })) as Equipment[]
      return { list, total: res.total }
    } catch (e) { rethrowIfNoMock(e); return { list: [], total: 0 } }
  },
  getEquipment: async (id: string) => {
    try { return await request.get<Equipment>(`/v1/eam/equipment/${id}`) }
    catch { return null as unknown as Equipment }
  },
  createEquipment: async (data: object) => {
    // 字段映射：前端用 code/name/type，后端用 equipmentCode/equipmentName/equipmentType
    const d = data as Record<string, unknown>
    const mapped = {
      ...d,
      equipmentCode: d.code ?? d.equipmentCode,
      equipmentName: d.name ?? d.equipmentName,
      equipmentType: d.type ?? d.equipmentType,
      category: d.category ?? d.type ?? 'GENERAL',
    }
    return await request.post<{ id: string }>('/v1/eam/equipment', mapped)
  },
  updateEquipment: async (id: string, data: object) => {
    return await request.put<Equipment>(`/v1/eam/equipment/${id}`, data)
  },
  getTechSpecs: async (id: string) => {
    try { return await request.get<Record<string, unknown>>(`/v1/eam/equipment/${id}/tech-specs`) }
    catch { return {} as Record<string, unknown> }
  },
  saveTechSpecs: async (id: string, data: object) => {
    return await request.post<void>(`/v1/eam/equipment/${id}/tech-specs`, data)
  },
  getFinance: async (id: string) => {
    try { return await request.get<Record<string, unknown>>(`/v1/eam/equipment/${id}/finance`) }
    catch { return {} as Record<string, unknown> }
  },
  saveFinance: async (id: string, data: object) => {
    return await request.post<void>(`/v1/eam/equipment/${id}/finance`, data)
  },

  // 维保计划
  getMaintenancePlans: async (params: object) => {
    try { return await request.get<{ list: MaintenancePlan[]; total: number }>('/v1/eam/maintenance/plans', params) }
    catch { return { list: [], total: 0 } }
  },

  // 维保策略
  getStrategies: async (params: object) => {
    try { return await request.get<{ list: MaintenanceStrategy[]; total: number }>('/v1/eam/maintenance/strategies', params) }
    catch { return { list: [], total: 0 } }
  },
  createStrategy: async (data: object) => {
    return await request.post<MaintenanceStrategy>('/v1/eam/maintenance/strategies', data)
  },
  updateStrategy: async (id: string, data: object) => {
    return await request.put<MaintenanceStrategy>(`/v1/eam/maintenance/strategies/${id}`, data)
  },

  // 故障
  getFaults: async (params: object) => {
    try { return await request.get<{ list: FaultRecord[]; total: number }>('/v1/eam/fault-records', params) }
    catch { return { list: [], total: 0 } }
  },
  reportFault: async (data: object) => {
    return await request.post<{ id: string }>('/v1/eam/fault-records', data)
  },
  respondFault: async (id: string, data: object) => {
    return await request.put<void>(`/v1/eam/fault-records/${id}/respond`, data)
  },
  completeFaultRepair: async (id: string, data: object) => {
    return await request.put<void>(`/v1/eam/fault-records/${id}/complete-repair`, data)
  },

  // 点检
  getInspections: async (params: object) => {
    try { return await request.get<{ list: InspectionRecord[]; total: number }>('/v1/eam/inspection-records', params) }
    catch { return { list: [], total: 0 } }
  },
  createInspection: async (data: object) => {
    return await request.post<InspectionRecord>('/v1/eam/inspection-records', data)
  },

  // 润滑
  getLubricationPoints: async (params: object) => {
    try { return await request.get<{ list: LubricationPoint[]; total: number }>('/v1/eam/lubrication-records', params) }
    catch { return { list: [], total: 0 } }
  },
  getDueLubrication: async (daysAhead?: number) => {
    try { return await request.get<{ list: LubricationPoint[] }>('/v1/eam/lubrication-records/due', { daysAhead }) }
    catch { return { list: [] } }
  },
  recordLubrication: async (id: string, data: object) => {
    return await request.put<void>(`/v1/eam/lubrication-records/${id}`, data)
  },

  // 备件
  getSpareParts: async (params: object) => {
    try { return await request.get<{ list: SparePart[]; total: number }>('/v1/eam/spare-parts', params) }
    catch { return { list: [], total: 0 } }
  },
  createSparePart: async (data: object) => {
    return await request.post<SparePart>('/v1/eam/spare-parts', data)
  },
  updateSparePart: async (id: string, data: object) => {
    return await request.put<SparePart>(`/v1/eam/spare-parts/${id}`, data)
  },
  issueSparePart: async (id: string, data: object) => {
    return await request.post<void>(`/v1/eam/spare-parts/${id}/issue`, data)
  },
  receiveSparePart: async (id: string, data: object) => {
    return await request.post<void>(`/v1/eam/spare-parts/${id}/receive`, data)
  },
  getSparePartTransactions: async (params: object) => {
    try { return await request.get<{ list: SparePartTransaction[] }>('/v1/eam/spare-part-transactions', params) }
    catch { return { list: [] } }
  },

  // OEE
  getOeeRecords: async (params: object) => {
    try { return await request.get<{ list: OeeRecord[]; total: number }>('/v1/eam/oee', params) }
    catch { return { list: [], total: 0 } }
  },
  createOee: async (data: object) => {
    return await request.post<OeeRecord>('/v1/eam/oee', data)
  },

  // 故障知识库
  getKnowledge: async (params: object) => {
    try { return await request.get<{ list: FaultKnowledge[]; total: number }>('/v1/eam/fault-knowledge', params) }
    catch { return { list: [], total: 0 } }
  },
  searchKnowledge: async (keyword: string) => {
    try { return await request.get<{ list: FaultKnowledge[] }>('/v1/eam/fault-knowledge/search', { keyword }) }
    catch { return { list: [] } }
  },
  createKnowledge: async (data: object) => {
    return await request.post<FaultKnowledge>('/v1/eam/fault-knowledge', data)
  },

  // 分析
  getMaintenanceAnalytics: async (params: object) => {
    try {
      return await request.get<{ costTrend: { month: string; labor: number; parts: number; outsource: number }[]; faultPareto: { type: string; count: number; cumRate: number }[] }>('/v1/eam/analytics/maintenance', params)
    } catch {
      const months = Array.from({ length: 6 }, (_, i) => { const d = new Date(); d.setMonth(d.getMonth() - 5 + i); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` })
      return {
        costTrend: months.map(m => ({ month: m, labor: Math.round(Math.random()*8000+2000), parts: Math.round(Math.random()*15000+5000), outsource: Math.round(Math.random()*5000+1000) })),
        faultPareto: [{ type: '电气故障', count: 28, cumRate: 0.35 }, { type: '机械磨损', count: 22, cumRate: 0.62 }, { type: '液压泄漏', count: 15, cumRate: 0.81 }, { type: '传感器故障', count: 9, cumRate: 0.92 }, { type: '其他', count: 6, cumRate: 1.0 }]
      }
    }
  },

  // 变更历史
  getEquipmentHistory: async (id: string) => {
    try {
      return await request.get<ChangeRecord[]>(`/v1/eam/equipment/${id}/history`)
    } catch (e) { rethrowIfNoMock(e); return [] as ChangeRecord[] }
  },
}
