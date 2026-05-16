// ERP 扩展 API（补全缺失功能）
import { request } from '@/utils/request'

export interface ErpCustomer {
  id: string
  code?: string
  name: string
  type?: string
  status: string
  creditLimit?: number
  contactName?: string
  contactPhone?: string
  email?: string
  address?: string
  taxNo?: string
}

export interface ErpQuotation {
  id: string
  quotationNo?: string
  quotationDate?: string
  customerId: string
  customerName?: string
  status: string  // DRAFT/SENT/ACCEPTED/REJECTED/EXPIRED
  totalAmount?: number
  currency?: string
  validUntil?: string
  createdAt: string
}

export interface ErpShipment {
  id: string
  code?: string
  salesOrderId: string
  status: string  // PENDING/SHIPPED/DELIVERED
  carrier?: string
  trackingNo?: string
  shippedAt?: string
  deliveredAt?: string
  createdAt: string
}

export interface ErpSalesReturn {
  id: string
  code?: string
  salesOrderId?: string
  customerId?: string
  customerName?: string
  status: string  // PENDING/INSPECTING/ACCEPTED/REJECTED
  reason?: string
  createdAt: string
}

export interface ErpReceivable {
  id: string
  receivableNo: string        // 应收单号（关联后端 receivableNo）
  soId: string                // 关联销售订单（关联后端 soId）
  customerId: string
  customerName?: string
  amount: number
  currency: string
  dueDate: string
  status: string  // OPEN/PARTIAL/PAID/OVERDUE
  paidAmount?: number
  createdAt: string
}

export interface ErpPayable {
  id: string
  payableNo: string           // 应付单号
  supplierId: string
  supplierName?: string
  amount: number
  paidAmount?: number
  currency: string
  dueDate: string
  status: string              // PENDING/PARTIAL/PAID
  reconId?: string            // 关联对账记录
  paymentPlan?: Record<string, any>[]  // 付款计划
  createdAt: string
}

export interface ErpAccount {
  id: string
  code: string
  name: string
  type: string  // ASSET/LIABILITY/EQUITY/INCOME/EXPENSE
  direction?: string  // DEBIT/CREDIT
  parentId?: string
  children?: ErpAccount[]
  status: string
}

export interface ErpCostCenter {
  id: string
  code: string
  name: string
  parentId?: string
  responsibleId?: string
  children?: ErpCostCenter[]
}

export interface ErpCostElement {
  id: string
  code: string
  name: string
  type: string
  status: string
}

export interface ErpStandardCost {
  id: string
  materialId: string
  materialName?: string
  version?: string
  materialCost: number
  laborCost: number
  overheadCost: number
  totalCost: number
  currency: string
  status: string
}

const d = async <T>(fn: () => Promise<T>, _fallback: T): Promise<T> => {
  return await fn()
}

export const erpExtApi = {
  // 客户
  getCustomers: (params: object) =>
    d(() => request.get<{ list: ErpCustomer[]; total: number }>('/v1/erp/customers', params), { list: [], total: 0 }),
  createCustomer: (data: object) =>
    d(() => request.post<ErpCustomer>('/v1/erp/customers', data), null as unknown as ErpCustomer),
  updateCustomer: (id: string, data: object) =>
    d(() => request.patch<ErpCustomer>(`/v1/erp/customers/${id}`, data), null as unknown as ErpCustomer),
  deleteCustomer: (id: string) =>
    d(() => request.delete<void>(`/v1/erp/customers/${id}`), undefined),
  updateCreditLimit: (id: string, creditLimit: number) =>
    d(() => request.patch<void>(`/v1/erp/customers/${id}/credit-limit`, { creditLimit }), undefined),

  // 报价单
  getQuotations: (params: object) =>
    d(() => request.get<{ list: ErpQuotation[]; total: number }>('/v1/erp/quotations', params), { list: [], total: 0 }),
  createQuotation: (data: object) =>
    d(() => request.post<ErpQuotation>('/v1/erp/quotations', data), null as unknown as ErpQuotation),
  sendQuotation: (id: string) =>
    d(() => request.patch<void>(`/v1/erp/quotations/${id}/send`, {}), undefined),
  acceptQuotation: (id: string) =>
    d(() => request.patch<void>(`/v1/erp/quotations/${id}/accept`, {}), undefined),
  rejectQuotation: (id: string, reason?: string) =>
    d(() => request.patch<void>(`/v1/erp/quotations/${id}/reject`, { reason }), undefined),
  convertQuotation: (id: string) =>
    d(() => request.post<{ salesOrderId: string }>(`/v1/erp/quotations/${id}/convert`, {}), null as unknown as { salesOrderId: string }),

  // 发货
  getShipments: (params: object) =>
    d(() => request.get<{ list: ErpShipment[]; total: number }>('/v1/erp/shipments', params), { list: [], total: 0 }),
  createShipment: (data: object) =>
    d(() => request.post<ErpShipment>('/v1/erp/shipments', data), null as unknown as ErpShipment),
  ship: (id: string) =>
    d(() => request.patch<void>(`/v1/erp/shipments/${id}/ship`, {}), undefined),
  updateLogistics: (id: string, data: object) =>
    d(() => request.put<void>(`/v1/erp/shipments/${id}/logistics`, data), undefined),
  confirmDelivery: (id: string) =>
    d(() => request.patch<void>(`/v1/erp/shipments/${id}/confirm-delivery`, {}), undefined),

  // 销售退货
  getSalesReturns: (params: object) =>
    d(() => request.get<{ list: ErpSalesReturn[]; total: number }>('/v1/erp/sales-returns', params), { list: [], total: 0 }),
  createSalesReturn: (data: object) =>
    d(() => request.post<ErpSalesReturn>('/v1/erp/sales-returns', data), null as unknown as ErpSalesReturn),
  acceptReturn: (id: string) =>
    d(() => request.patch<void>(`/v1/erp/sales-returns/${id}/accept`, {}), undefined),
  rejectReturn: (id: string, reason?: string) =>
    d(() => request.patch<void>(`/v1/erp/sales-returns/${id}/reject`, { reason }), undefined),

  // 应收账款
  getReceivables: (params: object) =>
    d(() => request.get<{ list: ErpReceivable[]; total: number }>('/v1/erp/receivables', params), { list: [], total: 0 }),
  getAgingAnalysis: () =>
    d(() => request.get<{ buckets: { range: string; amount: number }[] }>('/v1/erp/receivables/aging'), { buckets: [] }),
  recordReceivablePayment: (id: string, data: object) =>
    d(() => request.patch<void>(`/v1/erp/receivables/${id}/payment`, data), undefined),

  // 应付账款
  getPayables: (params: object) =>
    d(() => request.get<{ list: ErpPayable[]; total: number }>('/v1/erp/payables', params), { list: [], total: 0 }),
  getPaymentPlan: (id: string) =>
    d(() => request.get<{ items: unknown[] }>(`/v1/erp/payables/${id}/payment-plan`), { items: [] }),
  recordPayablePayment: (id: string, data: object) =>
    d(() => request.patch<void>(`/v1/erp/payables/${id}/payment`, data), undefined),

  // 科目
  getAccounts: (params?: object) =>
    d(() => request.get<{ list: ErpAccount[]; total: number }>('/v1/erp/accounts', params), { list: [], total: 0 }),
  getAccountTree: () =>
    d(() => request.get<ErpAccount[]>('/v1/erp/accounts/tree'), []),
  createAccount: (data: object) =>
    d(() => request.post<ErpAccount>('/v1/erp/accounts', data), null as unknown as ErpAccount),
  updateAccount: (id: string, data: object) =>
    d(() => request.patch<ErpAccount>(`/v1/erp/accounts/${id}`, data), null as unknown as ErpAccount),

  // 账簿
  getGeneralLedger: (params: object) =>
    d(() => request.get<{ list: Record<string, unknown>[] }>('/v1/erp/ledger/general', params), { list: [] }),
  getDetailLedger: (params: object) =>
    d(() => request.get<{ list: Record<string, unknown>[]; total: number }>('/v1/erp/ledger/detail', params), { list: [], total: 0 }),
  getJournal: (params: object) =>
    d(() => request.get<{ list: Record<string, unknown>[] }>('/v1/erp/ledger/journal', params), { list: [] }),

  // 成本中心
  getCostCenters: () =>
    d(() => request.get<ErpCostCenter[]>('/v1/erp/cost-centers'), []),
  getCostCenterTree: () =>
    d(() => request.get<ErpCostCenter[]>('/v1/erp/cost-centers/tree'), []),
  createCostCenter: (data: object) =>
    d(() => request.post<ErpCostCenter>('/v1/erp/cost-centers', data), null as unknown as ErpCostCenter),

  // 成本要素
  getCostElements: (params?: object) =>
    d(() => request.get<{ list: ErpCostElement[]; total: number }>('/v1/erp/cost-elements', params), { list: [], total: 0 }),
  createCostElement: (data: object) =>
    d(() => request.post<ErpCostElement>('/v1/erp/cost-elements', data), null as unknown as ErpCostElement),
  updateCostElement: (id: string, data: object) =>
    d(() => request.put<ErpCostElement>(`/v1/erp/cost-elements/${id}`, data), null as unknown as ErpCostElement),

  // 标准成本
  getStandardCosts: (params?: object) =>
    d(() => request.get<{ list: ErpStandardCost[]; total: number }>('/v1/erp/standard-costs', params), { list: [], total: 0 }),
  createStandardCost: (data: object) =>
    d(() => request.post<ErpStandardCost>('/v1/erp/standard-costs', data), null as unknown as ErpStandardCost),
  calculateStandardCost: (data: object) =>
    d(() => request.post<{ totalCost: number }>('/v1/erp/standard-costs/calculate', data), { totalCost: 0 }),

  // 成本分析
  getCostVariance: (params: object) =>
    d(() => request.get<{ list: Record<string, unknown>[] }>('/v1/erp/cost-analysis/variance', params), { list: [] }),
  getProductCost: (params: object) =>
    d(() => request.get<Record<string, unknown>>('/v1/erp/cost-analysis/product-cost', params), {}),
  getCostBreakdown: (params: object) =>
    d(() => request.get<Record<string, unknown>>('/v1/erp/cost-analysis/cost-breakdown', params), {}),

  // 销售分析
  getSalesTrend: (params: object) =>
    d(() => request.get<{ trend: { month: string; amount: number }[] }>('/v1/erp/analytics/sales-trend', params), { trend: [] }),
  getCustomerAnalysis: (params: object) =>
    d(() => request.get<{ list: { customerName: string; amount: number }[] }>('/v1/erp/analytics/customers', params), { list: [] }),
  getProductAnalysis: (params: object) =>
    d(() => request.get<{ list: { productName: string; amount: number }[] }>('/v1/erp/analytics/products', params), { list: [] }),
  getRegionAnalysis: (params: object) =>
    d(() => request.get<{ regions: unknown[] }>('/v1/erp/analytics/regions', params), { regions: [] }),

  // 财务报表
  getBalanceSheet: (params: object) =>
    d(() => request.get<Record<string, unknown>>('/v1/erp/reports/balance-sheet', params), {}),
  getIncomeStatement: (params: object) =>
    d(() => request.get<Record<string, unknown>>('/v1/erp/reports/income-statement', params), {}),
  getCashFlow: (params: object) =>
    d(() => request.get<Record<string, unknown>>('/v1/erp/reports/cash-flow', params), {}),
}
