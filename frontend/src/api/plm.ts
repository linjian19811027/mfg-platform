import { request, MOCK_ENABLED } from '@/utils/request'

function rethrowIfNoMock(e: unknown) { if (!MOCK_ENABLED) throw e }

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
  affectedItems?: Record<string, unknown>[]
  status: string // DRAFT/SUBMITTED/APPROVED/REJECTED
  submittedBy?: string
  submittedByName?: string
  approvedBy?: string
  approvedByName?: string
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
    } catch (e) { rethrowIfNoMock(e); return { list: [], total: 0 } }
  },
  getMaterial: async (id: string) => {
    try {
      return await request.get<Material>(`/v1/plm/materials/${id}`)
    } catch (e) { rethrowIfNoMock(e); return null as unknown as Material }
  },
  createMaterial: async (data: object) => {
    return await request.post<Material>('/v1/plm/materials', data)
  },
  updateMaterial: async (id: string, data: object) => {
    return await request.put<Material>(`/v1/plm/materials/${id}`, data)
  },
  changeMaterialStatus: async (id: string, status: string) => {
    return await request.patch<Material>(`/v1/plm/materials/${id}/status`, { status })
  },

  // BOM
  getBomList: async (params: object) => {
    try {
      return await request.get<{ list: Bom[]; total: number }>('/v1/plm/boms', params)
    } catch (e) { rethrowIfNoMock(e); return { list: [], total: 0 } }
  },
  getBom: async (id: string) => {
    try {
      return await request.get<Bom>(`/v1/plm/boms/${id}`)
    } catch (e) { rethrowIfNoMock(e); return null as unknown as Bom }
  },
  createBom: async (data: { bom: object; lines?: object[]; copyFromBomId?: string }) => {
    return await request.post<Bom>('/v1/plm/boms', data)
  },
  deleteBom: async (id: string) => {
    return await request.delete<void>(`/v1/plm/boms/${id}`)
  },
  activateBom: async (id: string) => {
    return await request.post<void>(`/v1/plm/boms/${id}/activate`, {})
  },
  deactivateBom: async (id: string) => {
    return await request.post<void>(`/v1/plm/boms/${id}/deactivate`, {})
  },
  obsoleteBom: async (id: string) => {
    return await request.post<void>(`/v1/plm/boms/${id}/obsolete`, {})
  },
  expandBomTree: async (id: string) => {
    try {
      return await request.get<BomNode>(`/v1/plm/boms/${id}/expand`)
    } catch (e) { rethrowIfNoMock(e); return null as unknown as BomNode }
  },
  addBomLine: async (bomId: string, data: object) => {
    return await request.post<BomLine>(`/v1/plm/boms/${bomId}/lines`, data)
  },
  updateBomLine: async (_bomId: string, lineId: string, data: object) => {
    return await request.put<BomLine>(`/v1/plm/boms/lines/${lineId}`, data)
  },
  deleteBomLine: async (_bomId: string, lineId: string) => {
    return await request.delete<void>(`/v1/plm/boms/lines/${lineId}`)
  },
  compareBoms: async (v1: string, v2: string) => {
    try {
      return await request.get<BomCompareResult>('/v1/plm/boms/compare', { v1, v2 })
    } catch (e) { rethrowIfNoMock(e); return { added: [], removed: [], modified: [] } as BomCompareResult }
  },

  // Legacy (kept for backward compat)
  getBoms: async (materialId?: string) => {
    try {
      return await request.get<{ list: BomNode[] }>('/v1/plm/boms', { materialId })
    } catch (e) { rethrowIfNoMock(e); return { list: [] } }
  },
  expandBom: async (id: string) => {
    try {
      return await request.get<BomNode>(`/v1/plm/boms/${id}/expand`)
    } catch (e) { rethrowIfNoMock(e); return null as unknown as BomNode }
  },

  // Routing
  getRoutingList: async (params: object) => {
    try {
      return await request.get<{ list: Routing[]; total: number }>('/v1/plm/routings', params)
    } catch (e) { rethrowIfNoMock(e); return { list: [], total: 0 } }
  },
  getRouting: async (id: string) => {
    try {
      return await request.get<Routing>(`/v1/plm/routings/${id}`)
    } catch (e) { rethrowIfNoMock(e); return null as unknown as Routing }
  },
  createRouting: async (data: object) => {
    return await request.post<Routing>('/v1/plm/routings', data)
  },
  updateRouting: async (id: string, data: object) => {
    return await request.put<Routing>(`/v1/plm/routings/${id}`, data)
  },
  activateRouting: async (id: string) => {
    return await request.post<void>(`/v1/plm/routings/${id}/activate`, {})
  },
  retireRouting: async (id: string) => {
    return await request.post<void>(`/v1/plm/routings/${id}/retire`, {})
  },
  copyRouting: async (id: string, data?: object) => {
    return await request.post<Routing>(`/v1/plm/routings/${id}/copy`, data ?? {})
  },
  deleteRouting: async (id: string) => {
    return await request.delete<void>(`/v1/plm/routings/${id}`)
  },
  addOperation: async (routingId: string, data: object) => {
    return await request.post<RoutingOperation>(`/v1/plm/routings/${routingId}/operations`, data)
  },
  updateOperation: async (opId: string, data: object) => {
    return await request.put<RoutingOperation>(`/v1/plm/routings/operations/${opId}`, data)
  },
  deleteOperation: async (opId: string) => {
    return await request.delete<void>(`/v1/plm/routings/operations/${opId}`)
  },

  // Legacy aliases
  getRoutings: async (params: object) => {
    try {
      return await request.get<{ list: Routing[]; total: number }>('/v1/plm/routings', params)
    } catch (e) { rethrowIfNoMock(e); return { list: [], total: 0 } }
  },

  // ECR
  getEcrs: async (params: object) => {
    try {
      return await request.get<{ list: Ecr[]; total: number }>('/v1/plm/ecrs', params)
    } catch (e) { rethrowIfNoMock(e); return { list: [], total: 0 } }
  },
  getEcr: async (id: string) => {
    try {
      return await request.get<Ecr>(`/v1/plm/ecrs/${id}`)
    } catch (e) { rethrowIfNoMock(e); return null as unknown as Ecr }
  },
  createEcr: async (data: object) => {
    return await request.post<Ecr>('/v1/plm/ecrs', data)
  },
  updateEcr: async (id: string, data: object) => {
    return await request.put<Ecr>(`/v1/plm/ecrs/${id}`, data)
  },
  submitEcr: async (id: string, operatorId: string) => {
    return await request.patch<void>(`/v1/plm/ecrs/${id}/submit`, { operatorId })
  },
  approveEcr: async (id: string, operatorId: string) => {
    return await request.patch<void>(`/v1/plm/ecrs/${id}/approve`, { operatorId })
  },
  rejectEcr: async (id: string, operatorId: string) => {
    return await request.patch<void>(`/v1/plm/ecrs/${id}/reject`, { operatorId })
  },

  // ECN
  getEcns: async (params: object) => {
    try {
      return await request.get<{ list: Ecn[]; total: number }>('/v1/plm/ecns', params)
    } catch (e) { rethrowIfNoMock(e); return { list: [], total: 0 } }
  },
  getEcn: async (id: string) => {
    try {
      return await request.get<Ecn>(`/v1/plm/ecns/${id}`)
    } catch (e) { rethrowIfNoMock(e); return null as unknown as Ecn }
  },
  issueEcn: async (data: object) => {
    return await request.post<Ecn>('/v1/plm/ecns', data)
  },
  completeEcn: async (id: string) => {
    return await request.patch<void>(`/v1/plm/ecns/${id}/complete`, {})
  },

  // 物料分类
  getCategories: async () => {
    try {
      return await request.get<MaterialCategory[]>('/v1/plm/materials/categories')
    } catch (e) { rethrowIfNoMock(e); return [] as MaterialCategory[] }
  },
  createCategory: async (data: object) => {
    return await request.post<MaterialCategory>('/v1/plm/materials/categories', data)
  },
  updateCategory: async (id: string, data: object) => {
    return await request.put<MaterialCategory>(`/v1/plm/materials/categories/${id}`, data)
  },
  deleteCategory: async (id: string) => {
    return await request.delete<void>(`/v1/plm/materials/categories/${id}`)
  },

  // 物料编码规则
  getCodeRules: async (params?: object) => {
    try {
      return await request.get<{ list: MaterialCodeRule[]; total: number }>('/v1/plm/materials/code-rules', params)
    } catch (e) { rethrowIfNoMock(e); return { list: [], total: 0 } }
  },
  createCodeRule: async (data: object) => {
    return await request.post<MaterialCodeRule>('/v1/plm/materials/code-rules', data)
  },
  updateCodeRule: async (id: string, data: object) => {
    return await request.put<MaterialCodeRule>(`/v1/plm/materials/code-rules/${id}`, data)
  },

  // PLM 文档
  getDocuments: async (params: object) => {
    try {
      return await request.get<{ list: PlmDocument[]; total: number }>('/v1/plm/documents', params)
    } catch (e) { rethrowIfNoMock(e); return { list: [], total: 0 } }
  },
  uploadDocument: async (formData: FormData) => {
    return await request.post<PlmDocument>('/v1/plm/documents', formData)
  },
  deleteDocument: async (id: string) => {
    return await request.delete<void>(`/v1/plm/documents/${id}`)
  },

  // 标准工序库
  getStandardOperations: async (params?: object) => {
    try {
      return await request.get<{ items: StandardOperation[]; total: number }>('/v1/plm/standard-operations', params)
    } catch (e) { rethrowIfNoMock(e); return { items: [], total: 0 } }
  },
  getStandardOperation: async (id: string) => {
    try {
      return await request.get<StandardOperation>(`/v1/plm/standard-operations/${id}`)
    } catch (e) { rethrowIfNoMock(e); return null as unknown as StandardOperation }
  },
  createStandardOperation: async (data: object) => {
    return await request.post<StandardOperation>('/v1/plm/standard-operations', data)
  },
  updateStandardOperation: async (id: string, data: object) => {
    return await request.put<StandardOperation>(`/v1/plm/standard-operations/${id}`, data)
  },
  deleteStandardOperation: async (id: string) => {
    return await request.delete<void>(`/v1/plm/standard-operations/${id}`)
  },
}

// ── ECN 执行计划 ──────────────────────────────────────────────────────────

export function getEcnExecutionPlans(params: any) {
  return request.get('/v1/plm/ecn-execution-plans', params)
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
