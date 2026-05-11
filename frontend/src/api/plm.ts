import { request } from '@/utils/request'

export interface Material {
  id: string
  code: string
  name: string
  type: string
  unit: string
  status: string
  spec?: string
  description?: string
}

export interface BomNode {
  id: string
  materialId: string
  materialCode: string
  materialName: string
  quantity: number
  unit: string
  children?: BomNode[]
}

export interface Bom {
  id: string
  materialId: string
  materialCode?: string
  materialName?: string
  version: string
  status: string // DRAFT / ACTIVE / INACTIVE
  effectiveDate?: string
  expiryDate?: string
}

export interface BomLine {
  id: string
  bomId: string
  materialId: string
  materialCode?: string
  materialName?: string
  quantity: number
  unit: string
  lossRate?: number
  seqNo?: number
}

export interface BomCompareResult {
  added: BomLine[]
  removed: BomLine[]
  modified: BomLine[]
}

export interface Routing {
  id: string
  code: string
  name: string
  materialId: string
  materialCode?: string
  materialName?: string
  version?: string
  status: string // DRAFT/ACTIVE/INACTIVE
  operations?: RoutingOperation[]
}

export interface RoutingOperation {
  id: string
  routingId: string
  seqNo: number
  name: string
  workcenterId?: string
  workcenterName?: string
  standardTime?: number  // 标准工时（分钟）
  setupTime?: number     // 准备时间（分钟）
  description?: string
}

// keep legacy alias
export type Operation = RoutingOperation

export interface Ecr {
  id: string
  ecrNo: string
  title: string
  changeReason: string
  affectedMaterials?: string
  status: string // DRAFT/SUBMITTED/APPROVED/REJECTED
  createdAt: string
  submittedAt?: string
  approvedAt?: string
}

export interface Ecn {
  id: string
  ecnNo: string
  ecrId: string
  ecrNo?: string
  description: string
  status: string // ISSUED/COMPLETED
  issuedAt: string
  effectiveDate?: string
}

export interface MaterialCategory {
  id: string
  code: string
  name: string
  parentId?: string
  children?: MaterialCategory[]
  level?: number
  path?: string
}

export interface MaterialCodeRule {
  id: string
  code: string
  name: string
  pattern: string
  prefix?: string
  categoryId?: string
  seqDigits?: number
  status: string
  description?: string
}

export interface PlmDocument {
  id: string
  fileName: string
  refType: string
  refId: string
  fileSize?: number
  fileType?: string
  uploadedBy?: string
  createdAt: string
  downloadUrl?: string
}

export interface StandardOperation {
  id: string
  code: string
  name: string
  workCenterId?: string
  workCenterName?: string
  stdHours?: number
  setupTime?: number
  description?: string
  status: string
}

export const plmApi = {
  getMaterials: async (params: object) => {
    try {
      return await request.get<{ list: Material[]; total: number }>('/v1/plm/materials', params)
    } catch { return { list: [], total: 0 } }
  },
  getMaterial: async (id: string) => {
    try {
      return await request.get<Material>(`/v1/plm/materials/${id}`)
    } catch { return null as unknown as Material }
  },
  createMaterial: async (data: object) => {
    try {
      return await request.post<Material>('/v1/plm/materials', data)
    } catch { return null as unknown as Material }
  },
  updateMaterial: async (id: string, data: object) => {
    try {
      return await request.put<Material>(`/v1/plm/materials/${id}`, data)
    } catch { return null as unknown as Material }
  },
  changeMaterialStatus: async (id: string, status: string) => {
    try {
      return await request.patch<Material>(`/v1/plm/materials/${id}/status`, { status })
    } catch { return null as unknown as Material }
  },

  // BOM
  getBomList: async (params: object) => {
    try {
      return await request.get<{ list: Bom[]; total: number }>('/v1/plm/boms', params)
    } catch { return { list: [], total: 0 } }
  },
  getBom: async (id: string) => {
    try {
      return await request.get<Bom>(`/v1/plm/boms/${id}`)
    } catch { return null as unknown as Bom }
  },
  createBom: async (data: { bom: object; lines?: object[]; copyFromBomId?: string }) => {
    try {
      return await request.post<Bom>('/v1/plm/boms', data)
    } catch { return null as unknown as Bom }
  },
  deleteBom: async (id: string) => {
    try {
      return await request.delete<void>(`/v1/plm/boms/${id}`)
    } catch { return }
  },
  activateBom: async (id: string) => {
    try {
      return await request.post<void>(`/v1/plm/boms/${id}/activate`, {})
    } catch { return }
  },
  deactivateBom: async (id: string) => {
    try {
      return await request.post<void>(`/v1/plm/boms/${id}/deactivate`, {})
    } catch { return }
  },
  obsoleteBom: async (id: string) => {
    try {
      return await request.post<void>(`/v1/plm/boms/${id}/obsolete`, {})
    } catch { return }
  },
  expandBomTree: async (id: string) => {
    try {
      return await request.get<BomNode>(`/v1/plm/boms/${id}/expand`)
    } catch { return null as unknown as BomNode }
  },
  addBomLine: async (bomId: string, data: object) => {
    try {
      return await request.post<BomLine>(`/v1/plm/boms/${bomId}/lines`, data)
    } catch { return null as unknown as BomLine }
  },
  updateBomLine: async (_bomId: string, lineId: string, data: object) => {
    try {
      return await request.put<BomLine>(`/v1/plm/boms/lines/${lineId}`, data)
    } catch { return null as unknown as BomLine }
  },
  deleteBomLine: async (_bomId: string, lineId: string) => {
    try {
      return await request.delete<void>(`/v1/plm/boms/lines/${lineId}`)
    } catch { return }
  },
  compareBoms: async (v1: string, v2: string) => {
    try {
      return await request.get<BomCompareResult>('/v1/plm/boms/compare', { v1, v2 })
    } catch { return { added: [], removed: [], modified: [] } as BomCompareResult }
  },

  // Legacy (kept for backward compat)
  getBoms: async (materialId?: string) => {
    try {
      return await request.get<{ list: BomNode[] }>('/v1/plm/boms', { materialId })
    } catch { return { list: [] } }
  },
  expandBom: async (id: string) => {
    try {
      return await request.get<BomNode>(`/v1/plm/boms/${id}/expand`)
    } catch { return null as unknown as BomNode }
  },

  // Routing
  getRoutingList: async (params: object) => {
    try {
      return await request.get<{ list: Routing[]; total: number }>('/v1/plm/routings', params)
    } catch { return { list: [], total: 0 } }
  },
  getRouting: async (id: string) => {
    try {
      return await request.get<Routing>(`/v1/plm/routings/${id}`)
    } catch { return null as unknown as Routing }
  },
  createRouting: async (data: object) => {
    try {
      return await request.post<Routing>('/v1/plm/routings', data)
    } catch { return null as unknown as Routing }
  },
  updateRouting: async (id: string, data: object) => {
    try {
      return await request.put<Routing>(`/v1/plm/routings/${id}`, data)
    } catch { return null as unknown as Routing }
  },
  activateRouting: async (id: string) => {
    try {
      return await request.post<void>(`/v1/plm/routings/${id}/activate`, {})
    } catch { return }
  },
  retireRouting: async (id: string) => {
    try {
      return await request.post<void>(`/v1/plm/routings/${id}/retire`, {})
    } catch { return }
  },
  copyRouting: async (id: string, data?: object) => {
    try {
      return await request.post<Routing>(`/v1/plm/routings/${id}/copy`, data ?? {})
    } catch { return null as unknown as Routing }
  },
  deleteRouting: async (id: string) => {
    try {
      return await request.delete<void>(`/v1/plm/routings/${id}`)
    } catch { return }
  },
  addOperation: async (routingId: string, data: object) => {
    try {
      return await request.post<RoutingOperation>(`/v1/plm/routings/${routingId}/operations`, data)
    } catch { return null as unknown as RoutingOperation }
  },
  updateOperation: async (opId: string, data: object) => {
    try {
      return await request.put<RoutingOperation>(`/v1/plm/routings/operations/${opId}`, data)
    } catch { return null as unknown as RoutingOperation }
  },
  deleteOperation: async (opId: string) => {
    try {
      return await request.delete<void>(`/v1/plm/routings/operations/${opId}`)
    } catch { return }
  },

  // Legacy aliases
  getRoutings: async (params: object) => {
    try {
      return await request.get<{ list: Routing[]; total: number }>('/v1/plm/routings', params)
    } catch { return { list: [], total: 0 } }
  },

  // ECR
  getEcrs: async (params: object) => {
    try {
      return await request.get<{ list: Ecr[]; total: number }>('/v1/plm/ecrs', params)
    } catch { return { list: [], total: 0 } }
  },
  getEcr: async (id: string) => {
    try {
      return await request.get<Ecr>(`/v1/plm/ecrs/${id}`)
    } catch { return null as unknown as Ecr }
  },
  createEcr: async (data: object) => {
    try {
      return await request.post<Ecr>('/v1/plm/ecrs', data)
    } catch { return null as unknown as Ecr }
  },
  updateEcr: async (id: string, data: object) => {
    try {
      return await request.put<Ecr>(`/v1/plm/ecrs/${id}`, data)
    } catch { return null as unknown as Ecr }
  },
  submitEcr: async (id: string, operatorId: string) => {
    try {
      return await request.patch<void>(`/v1/plm/ecrs/${id}/submit`, { operatorId })
    } catch { return }
  },
  approveEcr: async (id: string, operatorId: string) => {
    try {
      return await request.patch<void>(`/v1/plm/ecrs/${id}/approve`, { operatorId })
    } catch { return }
  },
  rejectEcr: async (id: string, operatorId: string) => {
    try {
      return await request.patch<void>(`/v1/plm/ecrs/${id}/reject`, { operatorId })
    } catch { return }
  },

  // ECN
  getEcns: async (params: object) => {
    try {
      return await request.get<{ list: Ecn[]; total: number }>('/v1/plm/ecns', params)
    } catch { return { list: [], total: 0 } }
  },
  getEcn: async (id: string) => {
    try {
      return await request.get<Ecn>(`/v1/plm/ecns/${id}`)
    } catch { return null as unknown as Ecn }
  },
  issueEcn: async (data: object) => {
    try {
      return await request.post<Ecn>('/v1/plm/ecns', data)
    } catch { return null as unknown as Ecn }
  },
  completeEcn: async (id: string) => {
    try {
      return await request.patch<void>(`/v1/plm/ecns/${id}/complete`, {})
    } catch { return }
  },

  // 物料分类
  getCategories: async () => {
    try {
      return await request.get<MaterialCategory[]>('/v1/plm/materials/categories')
    } catch { return [] as MaterialCategory[] }
  },
  createCategory: async (data: object) => {
    try {
      return await request.post<MaterialCategory>('/v1/plm/materials/categories', data)
    } catch { return null as unknown as MaterialCategory }
  },
  updateCategory: async (id: string, data: object) => {
    try {
      return await request.put<MaterialCategory>(`/v1/plm/materials/categories/${id}`, data)
    } catch { return null as unknown as MaterialCategory }
  },
  deleteCategory: async (id: string) => {
    try {
      return await request.delete<void>(`/v1/plm/materials/categories/${id}`)
    } catch { return }
  },

  // 物料编码规则
  getCodeRules: async (params?: object) => {
    try {
      return await request.get<{ list: MaterialCodeRule[]; total: number }>('/v1/plm/materials/code-rules', params)
    } catch { return { list: [], total: 0 } }
  },
  createCodeRule: async (data: object) => {
    try {
      return await request.post<MaterialCodeRule>('/v1/plm/materials/code-rules', data)
    } catch { return null as unknown as MaterialCodeRule }
  },
  updateCodeRule: async (id: string, data: object) => {
    try {
      return await request.put<MaterialCodeRule>(`/v1/plm/materials/code-rules/${id}`, data)
    } catch { return null as unknown as MaterialCodeRule }
  },

  // PLM 文档
  getDocuments: async (params: object) => {
    try {
      return await request.get<{ list: PlmDocument[]; total: number }>('/v1/plm/documents', params)
    } catch { return { list: [], total: 0 } }
  },
  uploadDocument: async (formData: FormData) => {
    try {
      return await request.post<PlmDocument>('/v1/plm/documents', formData)
    } catch { return null as unknown as PlmDocument }
  },
  deleteDocument: async (id: string) => {
    try {
      return await request.delete<void>(`/v1/plm/documents/${id}`)
    } catch { return }
  },

  // 标准工序库
  getStandardOperations: async (params?: object) => {
    try {
      return await request.get<{ items: StandardOperation[]; total: number }>('/v1/plm/standard-operations', params)
    } catch { return { items: [], total: 0 } }
  },
  getStandardOperation: async (id: string) => {
    try {
      return await request.get<StandardOperation>(`/v1/plm/standard-operations/${id}`)
    } catch { return null as unknown as StandardOperation }
  },
  createStandardOperation: async (data: object) => {
    try {
      return await request.post<StandardOperation>('/v1/plm/standard-operations', data)
    } catch { return null as unknown as StandardOperation }
  },
  updateStandardOperation: async (id: string, data: object) => {
    try {
      return await request.put<StandardOperation>(`/v1/plm/standard-operations/${id}`, data)
    } catch { return null as unknown as StandardOperation }
  },
  deleteStandardOperation: async (id: string) => {
    try {
      return await request.delete<void>(`/v1/plm/standard-operations/${id}`)
    } catch { return }
  },
}

// ── ECN 执行计划 ──────────────────────────────────────────────────────────

export function getEcnExecutionPlans(params: any) {
  return request.get('/v1/plm/ecn-execution-plans', { params })
}
export function getEcnExecutionPlan(id: string) {
  return request.get(`/v1/plm/ecn-execution-plans/${id}`)
}
export function triggerEcnExecutionPlan(id: string) {
  return request.patch(`/v1/plm/ecn-execution-plans/${id}/trigger`)
}
export function updateEcnEffectiveDate(id: string, data: any) {
  return request.patch(`/v1/plm/ecn-execution-plans/${id}/effective-date`, data)
}
export function retryEcnExecutionPlan(id: string) {
  return request.patch(`/v1/plm/ecn-execution-plans/${id}/retry`)
}
export function cancelEcnExecutionPlan(id: string) {
  return request.patch(`/v1/plm/ecn-execution-plans/${id}/cancel`)
}
export function getWipAssessment(planId: string) {
  return request.get(`/v1/plm/ecn-execution-plans/${planId}/wip-assessment`)
}
export function confirmWipAssessment(planId: string) {
  return request.patch(`/v1/plm/ecn-execution-plans/${planId}/wip-assessment/confirm`)
}
export function overrideWipAssessmentItem(itemId: string, data: any) {
  return request.patch(`/v1/plm/wip-assessment-items/${itemId}/override`, data)
}
