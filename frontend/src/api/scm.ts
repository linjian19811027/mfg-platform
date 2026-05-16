import { request, MOCK_ENABLED } from '@/utils/request'

function rethrowIfNoMock(e: unknown) { if (!MOCK_ENABLED) throw e }

export interface Supplier {
  id: string
  code: string
  name: string
  grade: string
  status: string
  contactName?: string
  contactPhone?: string
  email?: string
}

export interface PurchaseOrder {
  id: string
  code: string
  supplierId: string
  supplierName?: string
  status: string
  totalAmount: number
  currency: string
  orderDate: string
  expectedDate?: string
  deliveryAddress?: string
  taxRate?: number
  remark?: string
}

export interface PurchaseRequest {
  id: string
  code?: string
  materialId: string
  materialName?: string
  qty: number
  unit?: string
  expectedDate?: string
  reason?: string
  status: string  // DRAFT/PENDING/APPROVED/REJECTED
  requestedBy?: string
  createdAt: string
}

export interface Asn {
  id: string
  code?: string
  poId?: string
  supplierId: string
  supplierName?: string
  expectedDate?: string
  status: string  // PENDING/RECEIVED/CANCELLED
  createdAt: string
}

export interface Rfq {
  id: string
  code?: string
  status: string  // DRAFT/SENT/QUOTED/CLOSED
  materialId?: string
  materialName?: string
  qty?: number
  createdAt: string
  lines?: RfqLine[]
}

export interface RfqLine {
  id: string
  rfqId: string
  supplierId: string
  supplierName?: string
  unitPrice?: number
  currency?: string
  leadDays?: number
  validUntil?: string
}

export interface PriceAgreement {
  id: string
  supplierId: string
  supplierName?: string
  materialId?: string
  materialName?: string
  price: number
  currency: string
  startDate: string
  endDate: string
  status: string  // ACTIVE/EXPIRED/CANCELLED
}

export interface SupplierQualification {
  id: string
  supplierId: string
  supplierName?: string
  certType: string
  certNo?: string
  issueDate?: string
  expiryDate: string
  status: string  // VALID/EXPIRING/EXPIRED
}

export interface ReceiptException {
  id: string
  receiptId?: string
  supplierId?: string
  exceptionType: string
  description: string
  status: string  // OPEN/PROCESSING/CLOSED
  createdAt: string
}

export interface ScmReconciliation {
  id: string
  supplierId: string
  supplierName?: string
  period: string
  amount: number
  currency: string
  status: string  // DRAFT/CONFIRMED/DISPUTED
  createdAt: string
}

export interface Receipt {
  id: string
  poId?: string
  supplierId: string
  supplierName?: string
  status: string
  receivedDate: string
  materialId?: string
  qty?: number
}

export const scmApi = {

  // 采购订单
  getPurchaseOrders: async (params: object) => {
    try { return await request.get<{ list: PurchaseOrder[]; total: number }>('/v1/scm/purchase-orders', params) }
    catch (e) { rethrowIfNoMock(e); return { list: [], total: 0 } }
  },
  getPurchaseOrder: async (id: string) => {
    try { return await request.get<PurchaseOrder>(`/v1/scm/purchase-orders/${id}`) }
    catch (e) { rethrowIfNoMock(e); return null as unknown as PurchaseOrder }
  },
  createPurchaseOrder: async (data: object) => {
    try { return await request.post<{ id: string }>('/v1/scm/purchase-orders', data) }
    catch (e) { rethrowIfNoMock(e); return null as unknown as { id: string } }
  },
  confirmPurchaseOrder: async (id: string) => {
    try { return await request.patch<void>(`/v1/scm/purchase-orders/${id}/confirm`, {}) }
    catch (e) { rethrowIfNoMock(e); return }
  },

  // 采购申请
  getPurchaseRequests: async (params: object) => {
    try { return await request.get<{ list: PurchaseRequest[]; total: number }>('/v1/scm/purchase-requests', params) }
    catch (e) { rethrowIfNoMock(e); return { list: [], total: 0 } }
  },
  createPurchaseRequest: async (data: object) => {
    try { return await request.post<PurchaseRequest>('/v1/scm/purchase-requests', data) }
    catch (e) { rethrowIfNoMock(e); return null as unknown as PurchaseRequest }
  },
  submitPurchaseRequest: async (id: string) => {
    try { return await request.patch<void>(`/v1/scm/purchase-requests/${id}/submit`, {}) }
    catch (e) { rethrowIfNoMock(e); return }
  },
  approvePurchaseRequest: async (id: string, data?: object) => {
    try { return await request.patch<void>(`/v1/scm/purchase-requests/${id}/approve`, data ?? {}) }
    catch (e) { rethrowIfNoMock(e); return }
  },
  rejectPurchaseRequest: async (id: string, reason?: string) => {
    try { return await request.patch<void>(`/v1/scm/purchase-requests/${id}/reject`, reason ? { approverId: 'current', remarks: reason } : {}) }
    catch (e) { rethrowIfNoMock(e); return }
  },

  // ASN
  getAsns: async (params: object) => {
    try { return await request.get<{ list: Asn[]; total: number }>('/v1/scm/asns', params) }
    catch (e) { rethrowIfNoMock(e); return { list: [], total: 0 } }
  },
  createAsn: async (data: object) => {
    try { return await request.post<Asn>('/v1/scm/asns', data) }
    catch (e) { rethrowIfNoMock(e); return null as unknown as Asn }
  },
  receiveAsn: async (id: string) => {
    try { return await request.patch<void>(`/v1/scm/asns/${id}/receive`, {}) }
    catch (e) { rethrowIfNoMock(e); return }
  },
  cancelAsn: async (id: string) => {
    try { return await request.patch<void>(`/v1/scm/asns/${id}/cancel`, {}) }
    catch (e) { rethrowIfNoMock(e); return }
  },

  // 询价
  getRfqs: async (params: object) => {
    try { return await request.get<{ list: Rfq[]; total: number }>('/v1/scm/inquiries', params) }
    catch (e) { rethrowIfNoMock(e); return { list: [], total: 0 } }
  },
  createRfq: async (data: object) => {
    try { return await request.post<Rfq>('/v1/scm/inquiries', data) }
    catch (e) { rethrowIfNoMock(e); return null as unknown as Rfq }
  },
  sendRfq: async (id: string, supplierIds?: string[]) => {
    try { return await request.patch<void>(`/v1/scm/inquiries/${id}/send`, { supplierIds: supplierIds ?? [] }) }
    catch (e) { rethrowIfNoMock(e); return }
  },
  getRfqComparison: async (id: string) => {
    try { return await request.get<{ lines: RfqLine[] }>(`/v1/scm/inquiries/${id}/comparison`) }
    catch (e) { rethrowIfNoMock(e); return { lines: [] } }
  },
  selectSupplier: async (id: string, lineId: string) => {
    try { return await request.patch<void>(`/v1/scm/inquiries/${id}/select`, { lineId }) }
    catch (e) { rethrowIfNoMock(e); return }
  },

  // 价格协议
  getPriceAgreements: async (params: object) => {
    try { return await request.get<{ list: PriceAgreement[]; total: number }>('/v1/scm/price-agreements', params) }
    catch (e) { rethrowIfNoMock(e); return { list: [], total: 0 } }
  },
  createPriceAgreement: async (data: object) => {
    try { return await request.post<PriceAgreement>('/v1/scm/price-agreements', data) }
    catch (e) { rethrowIfNoMock(e); return null as unknown as PriceAgreement }
  },
  expirePriceAgreement: async (id: string) => {
    try { return await request.patch<void>(`/v1/scm/price-agreements/${id}/expire`, {}) }
    catch (e) { rethrowIfNoMock(e); return }
  },

  // 供应商资质
  getQualifications: async (params: object) => {
    try { return await request.get<{ list: SupplierQualification[]; total: number }>('/v1/scm/supplier-qualifications', params) }
    catch (e) { rethrowIfNoMock(e); return { list: [], total: 0 } }
  },
  createQualification: async (data: object) => {
    try { return await request.post<SupplierQualification>('/v1/scm/supplier-qualifications', data) }
    catch (e) { rethrowIfNoMock(e); return null as unknown as SupplierQualification }
  },
  updateQualification: async (id: string, data: object) => {
    try { return await request.patch<SupplierQualification>(`/v1/scm/supplier-qualifications/${id}`, data) }
    catch (e) { rethrowIfNoMock(e); return null as unknown as SupplierQualification }
  },

  // 到货异常
  getReceiptExceptions: async (params: object) => {
    try { return await request.get<{ list: ReceiptException[]; total: number }>('/v1/scm/receipt-exceptions', params) }
    catch (e) { rethrowIfNoMock(e); return { list: [], total: 0 } }
  },
  createReceiptException: async (data: object) => {
    try { return await request.post<ReceiptException>('/v1/scm/receipt-exceptions', data) }
    catch (e) { rethrowIfNoMock(e); return null as unknown as ReceiptException }
  },
  processException: async (id: string, data: object) => {
    try { return await request.patch<void>(`/v1/scm/receipts/exceptions/${id}/process`, data) }
    catch (e) { rethrowIfNoMock(e); return }
  },
  closeException: async (id: string) => {
    try { return await request.patch<void>(`/v1/scm/receipts/exceptions/${id}/close`, {}) }
    catch (e) { rethrowIfNoMock(e); return }
  },

  // 供应商对账
  getReconciliations: async (params: object) => {
    try { return await request.get<{ list: ScmReconciliation[]; total: number }>('/v1/scm/reconciliations', params) }
    catch (e) { rethrowIfNoMock(e); return { list: [], total: 0 } }
  },
  createReconciliation: async (data: object) => {
    try { return await request.post<ScmReconciliation>('/v1/scm/reconciliations', data) }
    catch (e) { rethrowIfNoMock(e); return null as unknown as ScmReconciliation }
  },
  confirmReconciliation: async (id: string) => {
    try { return await request.patch<void>(`/v1/scm/reconciliations/${id}/confirm`, {}) }
    catch (e) { rethrowIfNoMock(e); return }
  },

  // 到货记录
  getReceipts: async (params: object) => {
    try { return await request.get<{ list: Receipt[]; total: number }>('/v1/scm/receipts', params) }
    catch (e) { rethrowIfNoMock(e); return { list: [], total: 0 } }
  },

  // 供应商
  getSuppliers: async (params: object) => {
    try { return await request.get<{ list: Supplier[]; total: number }>('/v1/scm/suppliers', params) }
    catch (e) { rethrowIfNoMock(e); return { list: [], total: 0 } }
  },
  createSupplier: async (data: object) => {
    try { return await request.post<{ id: string }>('/v1/scm/suppliers', data) }
    catch (e) { rethrowIfNoMock(e); return null as unknown as { id: string } }
  },
  updateSupplier: async (id: string, data: object) => {
    try { return await request.patch<Supplier>(`/v1/scm/suppliers/${id}`, data) }
    catch (e) { rethrowIfNoMock(e); return null as unknown as Supplier }
  },
  getSupplierPerformance: async () => {
    try { return await request.get<{ ranking: { supplierId: string; supplierName: string; score: number; qualityRate: number; deliveryRate: number }[] }>('/v1/scm/suppliers/performance-ranking') }
    catch (e) { rethrowIfNoMock(e); return { ranking: [] } }
  },

  // 采购分析
  getAmountAnalysis: async (params: object) => {
    try {
      return await request.get<{ trend: { month: string; amount: number }[]; bySupplier: { name: string; amount: number }[]; byCategory: { name: string; amount: number }[] }>('/v1/scm/analytics/amount', params)
    } catch {
      const months = Array.from({ length: 12 }, (_, i) => { const d = new Date(); d.setMonth(d.getMonth() - 11 + i); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` })
      return { trend: months.map(m => ({ month: m, amount: Math.round(Math.random()*500000+100000) })), bySupplier: [{ name: '华东钢铁', amount: 320000 }, { name: '南方铝业', amount: 180000 }, { name: '精密橡胶', amount: 95000 }, { name: '天津轴承', amount: 75000 }], byCategory: [{ name: '原材料', amount: 450000 }, { name: '零部件', amount: 220000 }, { name: '辅料', amount: 80000 }] }
    }
  },
  getDeliveryTrend: async (params: object) => {
    try {
      return await request.get<{ trend: { month: string; rate: number }[] }>('/v1/scm/analytics/delivery-trend', params)
    } catch {
      const months = Array.from({ length: 12 }, (_, i) => { const d = new Date(); d.setMonth(d.getMonth() - 11 + i); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` })
      return { trend: months.map(m => ({ month: m, rate: 0.85 + Math.random() * 0.12 })) }
    }
  },
}
