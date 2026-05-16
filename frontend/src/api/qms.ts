import { request } from '@/utils/request'

export interface InspectionRecord {
  id: string
  materialId: string
  materialName?: string
  batchId?: string
  inspectionType: string
  status: string
  result?: string
  standardId?: string
  createdAt: string
}

export interface InspectionStandard {
  id: string
  code: string
  name: string
  materialId?: string
  inspectionType: string
  status: string
  version?: string
  items?: InspectionItem[]
  createdAt: string
}

export interface InspectionItem {
  id: string
  standardId: string
  name: string
  method?: string
  lowerLimit?: number
  upperLimit?: number
  unit?: string
}

export interface Nonconformance {
  id: string
  materialId: string
  materialName?: string
  batchId?: string
  defectType: string
  quantity: number
  status: string
  disposition?: string
  defectDescription?: string
  createdAt: string
}

export interface CorrectiveAction {
  id: string
  ncId?: string
  title: string
  fiveWhy?: Record<string, unknown>[]
  fishbone?: Record<string, unknown>
  actionPlan?: string
  responsibleId?: string
  dueDate?: string
  status: string
  verificationResult?: string
  verifiedBy?: string
  verifiedAt?: string
  createdAt: string
}

export interface FinalInspection {
  id: string
  materialId: string
  materialName?: string
  batchId?: string
  inspectionType: string
  result?: string
  status: string
  inspectorId?: string
  createdAt: string
}

export interface SupplierQualityRecord {
  id: string
  supplierId: string
  supplierName?: string
  materialId?: string
  batchId?: string
  inspectionType: string
  result?: string
  defectQty?: number
  totalQty?: number
  createdAt: string
}

export interface CustomerComplaint {
  id: string
  customerId?: string
  customerName?: string
  productId?: string
  description: string
  severity: string
  status: string
  resolution?: string
  createdAt: string
}

export interface Recall {
  id: string
  code: string
  materialId?: string
  batchIds?: string
  reason: string
  status: string
  affectedQty?: number
  recoveredQty?: number
  createdAt: string
}

export interface SpcDataPoint {
  id: string
  itemId: string
  value: number
  measuredAt: string
  operatorId?: string
}

export const qmsApi = {
  getInspections: async (params: object) => {
    try {
      return await request.get<{ list: InspectionRecord[]; total: number }>('/v1/qms/inspections', params)
    } catch { return { list: [], total: 0 } }
  },
  createInspection: async (data: object) => {
    try {
      return await request.post<{ id: string }>('/v1/qms/inspections', data)
    } catch { return null as unknown as { id: string } }
  },
  submitResult: async (id: string, data: object) => {
    try {
      return await request.patch<void>(`/v1/qms/inspections/${id}/result`, data)
    } catch { return }
  },
  getStandards: async (params: object) => {
    try {
      return await request.get<{ list: InspectionStandard[]; total: number }>('/v1/qms/standards', params)
    } catch { return { list: [], total: 0 } }
  },
  getStandard: async (id: string) => {
    try {
      return await request.get<InspectionStandard>(`/v1/qms/standards/${id}`)
    } catch { return null as unknown as InspectionStandard }
  },
  createStandard: async (data: object) => {
    const d = data as Record<string, unknown>
    // items 是必填字段
    const mapped = { ...d, items: d.items ?? [] }
    try { return await request.post<InspectionStandard>('/v1/qms/standards', mapped) }
    catch { return null as unknown as InspectionStandard }
  },
  createStandardVersion: async (id: string, data: object) => {
    try {
      return await request.post<InspectionStandard>(`/v1/qms/standards/${id}/version`, data)
    } catch { return null as unknown as InspectionStandard }
  },
  getNonconformances: async (params: object) => {
    try {
      return await request.get<{ list: Nonconformance[]; total: number }>('/v1/qms/nonconformances', params)
    } catch { return { list: [], total: 0 } }
  },
  createNonconformance: async (data: object) => {
    try {
      return await request.post<{ id: string }>('/v1/qms/nonconformances', data)
    } catch { return null as unknown as { id: string } }
  },
  updateDisposition: async (id: string, data: object) => {
    try {
      return await request.patch<void>(`/v1/qms/nonconformances/${id}/disposition`, data)
    } catch { return }
  },
  getCapas: async (params: object) => {
    try {
      return await request.get<{ list: CorrectiveAction[]; total: number }>('/v1/qms/corrective-actions', params)
    } catch { return { list: [], total: 0 } }
  },
  createCapa: async (data: object) => {
    try {
      return await request.post<CorrectiveAction>('/v1/qms/corrective-actions', data)
    } catch { return null as unknown as CorrectiveAction }
  },
  updateCapa: async (id: string, data: object) => {
    try {
      return await request.put<CorrectiveAction>(`/v1/qms/corrective-actions/${id}`, data)
    } catch { return null as unknown as CorrectiveAction }
  },
  verifyCapa: async (id: string, data: { result: string; verifiedBy: string }) => {
    try {
      return await request.post<void>(`/v1/qms/corrective-actions/${id}/verify`, data)
    } catch { return }
  },
  getFinalInspections: async (params: object) => {
    try {
      return await request.get<{ list: FinalInspection[]; total: number }>('/v1/qms/inspections', { ...params })
    } catch { return { list: [], total: 0 } }
  },
  createFinalInspection: async (data: object) => {
    try {
      return await request.post<{ id: string }>('/v1/qms/final-inspections/inbound', data)
    } catch { return null as unknown as { id: string } }
  },
  getSupplierQuality: async (params: object) => {
    try {
      return await request.get<{ list: SupplierQualityRecord[]; total: number }>('/v1/qms/inspections', { ...params, inspectionType: 'IQC' })
    } catch { return { list: [], total: 0 } }
  },
  getComplaints: async (params: object) => {
    try {
      return await request.get<{ list: CustomerComplaint[]; total: number }>('/v1/qms/complaints', params)
    } catch { return { list: [], total: 0 } }
  },
  createComplaint: async (data: object) => {
    try {
      return await request.post<CustomerComplaint>('/v1/qms/complaints', data)
    } catch { return null as unknown as CustomerComplaint }
  },
  updateComplaint: async (id: string, data: object) => {
    try {
      return await request.put<CustomerComplaint>(`/v1/qms/complaints/${id}`, data)
    } catch { return null as unknown as CustomerComplaint }
  },
  getRecalls: async (params: object) => {
    try {
      return await request.get<{ list: Recall[]; total: number }>('/v1/qms/recalls', params)
    } catch { return { list: [], total: 0 } }
  },
  createRecall: async (data: object) => {
    try {
      return await request.post<Recall>('/v1/qms/recalls', data)
    } catch { return null as unknown as Recall }
  },
  updateRecall: async (id: string, data: object) => {
    try {
      return await request.put<Recall>(`/v1/qms/recalls/${id}`, data)
    } catch { return null as unknown as Recall }
  },
  getSpcChart: async (itemId: string, limit?: number) => {
    try {
      return await request.get<{ points: SpcDataPoint[]; ucl: number; cl: number; lcl: number }>(`/v1/qms/spc/chart/${itemId}`, { limit })
    } catch { return { points: [], ucl: 0, cl: 0, lcl: 0 } }
  },
  addSpcPoint: async (data: object) => {
    try {
      return await request.post<SpcDataPoint>('/v1/qms/spc/data-points', data)
    } catch { return null as unknown as SpcDataPoint }
  },
}
