import { request, MOCK_ENABLED } from '@/utils/request'

// ==================== 物料批次管理 ====================

export type QualityStatus = 'UNINSPECTED' | 'QUALIFIED' | 'UNQUALIFIED' | 'FROZEN'

export interface MaterialBatch {
  id: string
  batchNo: string
  materialId: string
  materialCode: string
  materialName: string
  initialQty: number
  currentQty: number
  uomId: string
  uomName: string
  qualityStatus: QualityStatus
  sourceType: string
  sourceId?: string
  supplierId?: string
  supplierName?: string
  supplierBatchNo?: string
  certificateNo?: string
  producedAt?: string
  expireAt?: string
  createdAt: string
  updatedAt: string
}

export interface BatchListParams {
  batchNo?: string
  materialCode?: string
  qualityStatus?: string
  page?: number
  pageSize?: number
}

export interface QualityInspection {
  id: string
  batchId: string
  inspectionNo: string
  inspectedAt: string
  inspector: string
  result: 'QUALIFIED' | 'UNQUALIFIED'
  remark?: string
}

export interface BatchLedger {
  id: string
  batchId: string
  txType: string
  qty: number
  beforeQty: number
  afterQty: number
  refNo?: string
  operator: string
  occurredAt: string
  remark?: string
}

export interface ChangeStatusParams {
  newStatus: QualityStatus
  reason: string
}

// ---- Mock 数据 ----

function mockDelay<T>(data: T, ms = 300): Promise<T> {
  if (!MOCK_ENABLED) return Promise.reject(new Error('[Mock 关闭] base API — Mock 降级已禁用'))
  console.warn('[Mock 降级] base API — 后端未就绪，使用前端 Mock 数据')
  return new Promise(resolve => setTimeout(() => resolve(data), ms))
}

const MATERIALS = [
  { id: '1', code: 'MAT-001', name: '不锈钢板 304', uomId: '1', uomName: 'kg' },
  { id: '2', code: 'MAT-002', name: '铝合金型材 6061', uomId: '1', uomName: 'kg' },
  { id: '3', code: 'MAT-003', name: '橡胶密封圈 O型', uomId: '2', uomName: 'pcs' },
  { id: '4', code: 'MAT-004', name: '精密轴承 6205', uomId: '2', uomName: 'pcs' },
  { id: '5', code: 'MAT-005', name: '液压油 46号', uomId: '3', uomName: 'L' },
]

const SUPPLIERS = [
  { id: '1', name: '华东钢铁有限公司' },
  { id: '2', name: '南方铝业集团' },
  { id: '3', name: '精密橡胶制品厂' },
  { id: '4', name: '天津轴承制造有限公司' },
  { id: '5', name: '中石化润滑油公司' },
]

const QUALITY_STATUSES: QualityStatus[] = ['UNINSPECTED', 'QUALIFIED', 'UNQUALIFIED', 'FROZEN']

function genDate(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() - offsetDays)
  return d.toISOString().slice(0, 10)
}

function genDateTime(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() - offsetDays)
  d.setHours(8 + Math.floor(Math.random() * 10))
  d.setMinutes(Math.floor(Math.random() * 60))
  return d.toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-')
}

let mockBatches: MaterialBatch[] = Array.from({ length: 20 }, (_, i) => {
  const mat = MATERIALS[i % MATERIALS.length]
  const sup = SUPPLIERS[i % SUPPLIERS.length]
  const status = QUALITY_STATUSES[i % QUALITY_STATUSES.length]
  const initialQty = Math.round((100 + Math.random() * 900) * 100) / 100
  const currentQty = Math.round(initialQty * (0.5 + Math.random() * 0.5) * 100) / 100
  return {
    id: String(i + 1),
    batchNo: `BT-2024-${String(i + 1).padStart(4, '0')}`,
    materialId: mat.id,
    materialCode: mat.code,
    materialName: mat.name,
    initialQty,
    currentQty,
    uomId: mat.uomId,
    uomName: mat.uomName,
    qualityStatus: status,
    sourceType: i % 3 === 0 ? 'PRODUCTION' : 'PURCHASE',
    sourceId: `PO-2024-${String(i + 1).padStart(4, '0')}`,
    supplierId: sup.id,
    supplierName: sup.name,
    supplierBatchNo: `SUP-BT-${String(i + 1).padStart(4, '0')}`,
    certificateNo: `CERT-${String(i + 1).padStart(6, '0')}`,
    producedAt: genDate(30 + i * 3),
    expireAt: genDate(-(365 - i * 10)),
    createdAt: genDateTime(20 + i),
    updatedAt: genDateTime(i),
  }
})

const MOCK_INSPECTIONS: Record<string, QualityInspection[]> = {}
const MOCK_LEDGERS: Record<string, BatchLedger[]> = {}

mockBatches.forEach(b => {
  MOCK_INSPECTIONS[b.id] = Array.from({ length: Math.floor(Math.random() * 3) + 1 }, (_, j) => ({
    id: `${b.id}-ins-${j + 1}`,
    batchId: b.id,
    inspectionNo: `QC-${b.batchNo}-${j + 1}`,
    inspectedAt: genDateTime(15 - j * 3),
    inspector: ['张质检', '李质检', '王质检'][j % 3],
    result: j === 0 && b.qualityStatus === 'UNQUALIFIED' ? 'UNQUALIFIED' : 'QUALIFIED',
    remark: j === 0 ? '首次检验' : '复检',
  }))

  MOCK_LEDGERS[b.id] = [
    {
      id: `${b.id}-ldg-1`,
      batchId: b.id,
      txType: '入库',
      qty: b.initialQty,
      beforeQty: 0,
      afterQty: b.initialQty,
      refNo: b.sourceId,
      operator: '仓管员',
      occurredAt: b.createdAt,
      remark: '采购入库',
    },
    ...(b.currentQty < b.initialQty ? [{
      id: `${b.id}-ldg-2`,
      batchId: b.id,
      txType: '出库',
      qty: -(b.initialQty - b.currentQty),
      beforeQty: b.initialQty,
      afterQty: b.currentQty,
      refNo: `WO-2024-${b.id.padStart(4, '0')}`,
      operator: '仓管员',
      occurredAt: genDateTime(5),
      remark: '生产领料',
    }] : []),
  ]
})

function filterBatches(params: BatchListParams) {
  let list = [...mockBatches]
  if (params.batchNo) list = list.filter(b => b.batchNo.toLowerCase().includes(params.batchNo!.toLowerCase()))
  if (params.materialCode) list = list.filter(b => b.materialCode.toLowerCase().includes(params.materialCode!.toLowerCase()) || b.materialName.includes(params.materialCode!))
  if (params.qualityStatus) list = list.filter(b => b.qualityStatus === params.qualityStatus)
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 20
  const total = list.length
  const start = (page - 1) * pageSize
  return { list: list.slice(start, start + pageSize), total }
}

export interface NumberingRuleParams {
  businessKey?: string
  keyword?: string
  page?: number
  pageSize?: number
}

export interface NumberingRule {
  id: string
  businessKey: string
  code: string
  name: string
  mode: string
  status: string
  segments: any[]
  createdAt: string
  updatedAt: string
}

export interface ShiftRecord {
  id: number
  code: string
  name: string
  startTime: string
  endTime: string
  enabled?: number
}

export interface CertTypeRecord {
  id: number
  code: string
  name: string
  isMandatory?: number
  defaultValidityMonths?: number
}

// ==================== 工作中心管理 ====================

export interface WorkCenter {
  id: string
  name: string
  code?: string
  type?: string
  description?: string
  enabled: number
  createdAt: string
  updatedAt: string
}

export interface WorkCenterFormData {
  name: string
  code?: string
  type?: string
  description?: string
  enabled?: number
}

export const baseApi = {
  // 编码规则管理
  getNumberingRules: (params?: NumberingRuleParams) => 
    request.get<{ list: NumberingRule[]; total: number }>('/v1/base/numbering-rules', params),
  
  createNumberingRule: (data: Partial<NumberingRule>) => 
    request.post<NumberingRule>('/v1/base/numbering-rules', data),
  
  updateNumberingRule: (id: string, data: Partial<NumberingRule>) => 
    request.put<NumberingRule>(`/v1/base/numbering-rules/${id}`, data),
  
  deleteNumberingRule: (id: string) => 
    request.delete<void>(`/v1/base/numbering-rules/${id}`),

  // ── 班次管理 ───────────────────────────────────────────────
  getShifts: () => request.get<ShiftRecord[]>('/v1/base/shifts'),
  getAllShifts: () => request.get<ShiftRecord[]>('/v1/base/shifts/all'),
  createShift: (data: { code: string; name: string; startTime: string; endTime: string; enabled?: number }) =>
    request.post<ShiftRecord>('/v1/base/shifts', data),
  updateShift: (id: number, data: { code?: string; name?: string; startTime?: string; endTime?: string; enabled?: number }) =>
    request.put<ShiftRecord>(`/v1/base/shifts/${id}`, data),
  deleteShift: (id: number) => request.delete<void>(`/v1/base/shifts/${id}`),

  // ── 认证类型管理 ──────────────────────────────────────────
  getCertificationTypes: () => request.get<CertTypeRecord[]>('/v1/base/certification-types'),
  createCertificationType: (data: { code: string; name: string; isMandatory?: number; defaultValidityMonths?: number }) =>
    request.post<CertTypeRecord>('/v1/base/certification-types', data),
  updateCertificationType: (id: number, data: { code?: string; name?: string; isMandatory?: number; defaultValidityMonths?: number }) =>
    request.put<CertTypeRecord>(`/v1/base/certification-types/${id}`, data),
  deleteCertificationType: (id: number) => request.delete<void>(`/v1/base/certification-types/${id}`),

  // ── 工作中心管理 ──────────────────────────────────────────
  getWorkCenters: () => request.get<WorkCenter[]>('/v1/base/work-centers'),

  createWorkCenter: (data: WorkCenterFormData) =>
    request.post<WorkCenter>('/v1/base/work-centers', data),

  updateWorkCenter: (id: string, data: Partial<WorkCenterFormData>) =>
    request.put<WorkCenter>(`/v1/base/work-centers/${id}`, data),

  deleteWorkCenter: (id: string) =>
    request.delete<void>(`/v1/base/work-centers/${id}`),
}

// ── 独立函数导出（供 hr.ts 等其他模块复用） ────────────────────
export const getShifts = baseApi.getShifts
export const getAllShifts = baseApi.getAllShifts
export const createShift = baseApi.createShift
export const updateShift = baseApi.updateShift
export const deleteShift = baseApi.deleteShift

export const getCertificationTypes = baseApi.getCertificationTypes
export const createCertificationType = baseApi.createCertificationType
export const updateCertificationType = baseApi.updateCertificationType
export const deleteCertificationType = baseApi.deleteCertificationType

export const getWorkCenters = baseApi.getWorkCenters
export const createWorkCenter = baseApi.createWorkCenter
export const updateWorkCenter = baseApi.updateWorkCenter
export const deleteWorkCenter = baseApi.deleteWorkCenter

export const batchApi = {
  // 批次列表
  getBatches: async (params: BatchListParams): Promise<{ list: MaterialBatch[]; total: number }> => {
    try {
      return await request.get<{ list: MaterialBatch[]; total: number }>('/v1/base/batches', params)
    } catch {
      return mockDelay(filterBatches(params))
    }
  },

  // 批次详情
  getBatch: async (id: string): Promise<MaterialBatch> => {
    try {
      return await request.get<MaterialBatch>(`/v1/base/batches/${id}`)
    } catch {
      const batch = mockBatches.find(b => b.id === id)
      if (!batch) throw new Error('批次不存在')
      return mockDelay({ ...batch })
    }
  },

  // 质量检验记录
  getInspections: async (batchId: string): Promise<QualityInspection[]> => {
    try {
      return await request.get<QualityInspection[]>(`/v1/base/batches/${batchId}/inspections`)
    } catch {
      return mockDelay(MOCK_INSPECTIONS[batchId] ?? [])
    }
  },

  // 库存流水
  getLedgers: async (batchId: string): Promise<BatchLedger[]> => {
    try {
      return await request.get<BatchLedger[]>(`/v1/base/batches/${batchId}/ledgers`)
    } catch {
      return mockDelay(MOCK_LEDGERS[batchId] ?? [])
    }
  },

  // 变更质量状态
  changeQualityStatus: async (id: string, params: ChangeStatusParams): Promise<void> => {
    try {
      return await request.patch<void>(`/v1/base/batches/${id}/quality-status`, params)
    } catch {
      const idx = mockBatches.findIndex(b => b.id === id)
      if (idx !== -1) {
        mockBatches[idx].qualityStatus = params.newStatus
        mockBatches[idx].updatedAt = new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-')
      }
      return mockDelay(undefined)
    }
  },
}


// ==================== 文件管理 ====================

export type FileType = 'image' | 'document' | 'spreadsheet' | 'pdf' | 'other'

export interface FileRecord {
  id: string
  fileName: string
  fileType: FileType
  fileSize: number        // bytes
  mimeType: string
  uploader: string
  uploadedAt: string
  bizType: string         // 关联业务类型
  bizId?: string
  bizNo?: string          // 关联业务单号
  url: string
}

export interface FileListParams {
  fileName?: string
  fileType?: string
  startTime?: string
  endTime?: string
  page?: number
  pageSize?: number
}

// ---- Mock 数据 ----

const FILE_MOCK_DATA: FileRecord[] = [
  { id: '1',  fileName: '采购合同_华东钢铁_2024.pdf',       fileType: 'pdf',         fileSize: 2457600,  mimeType: 'application/pdf',  uploader: '张采购', uploadedAt: '2024-03-01 09:12:00', bizType: '采购订单', bizId: '1', bizNo: 'PO-2024-0001', url: '' },
  { id: '2',  fileName: '设备验收报告.docx',                 fileType: 'document',    fileSize: 358400,   mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', uploader: '李工程', uploadedAt: '2024-03-02 10:30:00', bizType: '设备', bizId: '2', bizNo: 'EQ-2024-0002', url: '' },
  { id: '3',  fileName: '生产计划表_3月.xlsx',               fileType: 'spreadsheet', fileSize: 512000,   mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', uploader: '王计划', uploadedAt: '2024-03-03 08:45:00', bizType: '生产计划', bizId: '3', bizNo: 'PP-2024-0003', url: '' },
  { id: '4',  fileName: '设备现场照片_01.jpg',               fileType: 'image',       fileSize: 1843200,  mimeType: 'image/jpeg',       uploader: '赵维修', uploadedAt: '2024-03-04 14:20:00', bizType: '工单', bizId: '4', bizNo: 'WO-2024-0004', url: 'https://picsum.photos/seed/eq1/800/600' },
  { id: '5',  fileName: '质量检验报告_批次BT-001.pdf',       fileType: 'pdf',         fileSize: 1024000,  mimeType: 'application/pdf',  uploader: '孙质检', uploadedAt: '2024-03-05 11:00:00', bizType: '批次', bizId: '5', bizNo: 'BT-2024-0001', url: '' },
  { id: '6',  fileName: '供应商资质证书.png',                fileType: 'image',       fileSize: 921600,   mimeType: 'image/png',        uploader: '张采购', uploadedAt: '2024-03-06 09:30:00', bizType: '供应商', bizId: '6', bizNo: 'SUP-0006', url: 'https://picsum.photos/seed/cert/800/600' },
  { id: '7',  fileName: '工艺规程_精密加工.docx',            fileType: 'document',    fileSize: 204800,   mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', uploader: '李工程', uploadedAt: '2024-03-07 15:10:00', bizType: '工艺', bizId: '7', bizNo: 'PROC-0007', url: '' },
  { id: '8',  fileName: '成本核算汇总_Q1.xlsx',              fileType: 'spreadsheet', fileSize: 768000,   mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', uploader: '周财务', uploadedAt: '2024-03-08 16:00:00', bizType: '成本', bizId: '8', bizNo: 'COST-2024-Q1', url: '' },
  { id: '9',  fileName: '设备维保记录照片.jpg',              fileType: 'image',       fileSize: 2150400,  mimeType: 'image/jpeg',       uploader: '赵维修', uploadedAt: '2024-03-09 10:15:00', bizType: '工单', bizId: '9', bizNo: 'WO-2024-0009', url: 'https://picsum.photos/seed/maint/800/600' },
  { id: '10', fileName: '安全操作规程.pdf',                  fileType: 'pdf',         fileSize: 3072000,  mimeType: 'application/pdf',  uploader: '吴安全', uploadedAt: '2024-03-10 08:00:00', bizType: '安全', bizId: '10', bizNo: 'SAFE-0010', url: '' },
  { id: '11', fileName: '原材料检测报告.txt',                fileType: 'other',       fileSize: 10240,    mimeType: 'text/plain',       uploader: '孙质检', uploadedAt: '2024-03-11 13:45:00', bizType: '批次', bizId: '11', bizNo: 'BT-2024-0011', url: '' },
  { id: '12', fileName: '设备铭牌照片.png',                  fileType: 'image',       fileSize: 614400,   mimeType: 'image/png',        uploader: '李工程', uploadedAt: '2024-03-12 09:00:00', bizType: '设备', bizId: '12', bizNo: 'EQ-2024-0012', url: 'https://picsum.photos/seed/plate/800/600' },
  { id: '13', fileName: '采购询价单_铝合金.xlsx',            fileType: 'spreadsheet', fileSize: 307200,   mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', uploader: '张采购', uploadedAt: '2024-03-13 14:30:00', bizType: '采购订单', bizId: '13', bizNo: 'PO-2024-0013', url: '' },
  { id: '14', fileName: '产品合格证模板.docx',               fileType: 'document',    fileSize: 153600,   mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', uploader: '王计划', uploadedAt: '2024-03-14 11:20:00', bizType: '产品', bizId: '14', bizNo: 'PROD-0014', url: '' },
  { id: '15', fileName: '车间平面布局图.jpg',                fileType: 'image',       fileSize: 3276800,  mimeType: 'image/jpeg',       uploader: '李工程', uploadedAt: '2024-03-15 16:45:00', bizType: '设备', bizId: '15', bizNo: 'EQ-2024-0015', url: 'https://picsum.photos/seed/layout/800/600' },
]

let mockFiles = [...FILE_MOCK_DATA]

function filterFiles(params: FileListParams) {
  let list = [...mockFiles]
  if (params.fileName) list = list.filter(f => f.fileName.toLowerCase().includes(params.fileName!.toLowerCase()))
  if (params.fileType) list = list.filter(f => f.fileType === params.fileType)
  if (params.startTime) list = list.filter(f => f.uploadedAt >= params.startTime!)
  if (params.endTime) list = list.filter(f => f.uploadedAt <= params.endTime! + ' 23:59:59')
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 20
  const total = list.length
  return { list: list.slice((page - 1) * pageSize, page * pageSize), total }
}

export const fileApi = {
  getFiles: async (params: FileListParams): Promise<{ list: FileRecord[]; total: number }> => {
    try {
      return await request.get<{ list: FileRecord[]; total: number }>('/v1/base/files', params)
    } catch {
      return mockDelay(filterFiles(params))
    }
  },

  uploadFile: async (file: File, bizType?: string, bizNo?: string): Promise<FileRecord> => {
    try {
      const form = new FormData()
      form.append('file', file)
      if (bizType) form.append('bizType', bizType)
      if (bizNo) form.append('bizNo', bizNo)
      return await request.post<FileRecord>('/v1/files/upload', form)
    } catch {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
      const typeMap: Record<string, FileType> = {
        jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image',
        pdf: 'pdf',
        doc: 'document', docx: 'document', txt: 'document',
        xls: 'spreadsheet', xlsx: 'spreadsheet', csv: 'spreadsheet',
      }
      const fileType: FileType = typeMap[ext] ?? 'other'
      const newFile: FileRecord = {
        id: String(Date.now()),
        fileName: file.name,
        fileType,
        fileSize: file.size,
        mimeType: file.type,
        uploader: '当前用户',
        uploadedAt: new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-'),
        bizType: bizType ?? '—',
        bizNo: bizNo,
        url: fileType === 'image' ? URL.createObjectURL(file) : '',
      }
      mockFiles.unshift(newFile)
      return mockDelay(newFile, 800)
    }
  },

  deleteFile: async (id: string): Promise<void> => {
    try {
      return await request.delete<void>(`/v1/base/files/${id}`)
    } catch {
      mockFiles = mockFiles.filter(f => f.id !== id)
      return mockDelay(undefined)
    }
  },

  downloadFile: async (file: FileRecord): Promise<void> => {
    try {
      const blob = await request.get<Blob>(`/v1/base/files/${file.id}/download`)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = file.fileName
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // Mock: 创建一个示例 Blob 下载
      const content = `文件名: ${file.fileName}\n文件类型: ${file.fileType}\n文件大小: ${file.fileSize} bytes\n上传人: ${file.uploader}\n上传时间: ${file.uploadedAt}`
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = file.fileName
      a.click()
      URL.revokeObjectURL(url)
      return mockDelay(undefined, 200)
    }
  },
}
