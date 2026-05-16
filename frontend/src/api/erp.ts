import { request, MOCK_ENABLED } from '@/utils/request'

export interface Customer {
  id: string
  code: string
  name: string
  type?: string
  status?: string
  creditLimit?: number
  contactName?: string
  contactPhone?: string
  email?: string
  address?: string
}

export interface Quotation {
  id: string
  quotationNo: string
  customerId: string
  customerName?: string
  status: string  // DRAFT/SENT/ACCEPTED/REJECTED/EXPIRED
  totalAmount: number
  currency: string
  validUntil?: string
  quotationDate?: string
  createdAt: string
}

export interface SalesOrder {
  id: string
  code: string
  customerId: string
  customerName?: string
  status: string
  totalAmount: number
  currency: string
  orderDate: string
  deliveryDate?: string
}

export interface Shipment {
  id: string
  code: string
  soId: string
  status: string  // PENDING/SHIPPED/DELIVERED
  carrier?: string
  trackingNo?: string
  shippedAt?: string
  createdAt: string
}

export interface SalesReturn {
  id: string
  code: string
  soId?: string
  customerId?: string
  status: string  // PENDING/INSPECTING/ACCEPTED/REJECTED
  reason?: string
  createdAt: string
}

export interface Receivable {
  id: string
  soId?: string
  customerId: string
  customerName?: string
  amount: number
  paidAmount: number
  dueDate: string
  status: string  // PENDING/PARTIAL/PAID/OVERDUE
  currency: string
}

export interface Payable {
  id: string
  payableNo: string
  supplierId: string
  supplierName?: string
  amount: number
  paidAmount: number
  dueDate: string
  status: string
  currency: string
  reconId?: string
  paymentPlan?: Record<string, any>[]
}

export interface Account {
  id: string
  code: string
  name: string
  type: string
  parentId?: string
  status: string
  children?: Account[]
}

export interface Voucher {
  id: string
  voucherNo: string
  voucherType: string
  status: string
  totalDebit: number
  totalCredit: number
  voucherDate: string
  description?: string
  createdAt: string
}

export interface CostCenter {
  id: string
  code: string
  name: string
  parentId?: string
  type?: string
  children?: CostCenter[]
}

export interface StandardCost {
  id: string
  materialId: string
  materialCode?: string
  materialName?: string
  materialCost: number
  laborCost: number
  overheadCost: number
  totalCost: number
  currency: string
  version?: string
}

export interface ProductCost {
  materialId: string
  materialName?: string
  standardCost: number
  actualCost?: number
  variance?: number
  currency: string
}

const d = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
  try { return await fn() } catch (e) {
    if (!MOCK_ENABLED) throw e
    return fallback
  }
}

export const erpApi = {
  // 客户
  getCustomers: (params: object) => d(() => request.get<{ list: Customer[]; total: number }>('/v1/erp/customers', params), { list: [], total: 0 }),
  getCustomer: (id: string) => d(() => request.get<Customer>(`/v1/erp/customers/${id}`), null as unknown as Customer),
  createCustomer: (data: object) => d(() => request.post<Customer>('/v1/erp/customers', data), null as unknown as Customer),
  updateCustomer: (id: string, data: object) => d(() => request.patch<Customer>(`/v1/erp/customers/${id}`, data), null as unknown as Customer),
  deleteCustomer: (id: string) => d(() => request.delete<void>(`/v1/erp/customers/${id}`), undefined),
  updateCreditLimit: (id: string, creditLimit: number) => d(() => request.patch<void>(`/v1/erp/customers/${id}/credit-limit`, { creditLimit }), undefined),

  // 报价单
  getQuotations: (params: object) => d(() => request.get<{ list: Quotation[]; total: number }>('/v1/erp/quotations', params), { list: [], total: 0 }),
  getQuotation: (id: string) => d(() => request.get<Quotation>(`/v1/erp/quotations/${id}`), null as unknown as Quotation),
  createQuotation: (data: object) => d(() => request.post<Quotation>('/v1/erp/quotations', data), null as unknown as Quotation),
  sendQuotation: (id: string) => d(() => request.patch<void>(`/v1/erp/quotations/${id}/send`, {}), undefined),
  acceptQuotation: (id: string) => d(() => request.patch<void>(`/v1/erp/quotations/${id}/accept`, {}), undefined),
  rejectQuotation: (id: string) => d(() => request.patch<void>(`/v1/erp/quotations/${id}/reject`, {}), undefined),
  convertQuotation: (id: string) => d(() => request.post<{ id: string }>(`/v1/erp/quotations/${id}/convert`, {}), null as unknown as { id: string }),

  // 销售订单
  getSalesOrders: (params: object) => d(() => request.get<{ list: SalesOrder[]; total: number }>('/v1/erp/sales-orders', params), { list: [], total: 0 }),
  getSalesOrder: (id: string) => d(() => request.get<SalesOrder>(`/v1/erp/sales-orders/${id}`), null as unknown as SalesOrder),
  createSalesOrder: (data: object) => d(() => request.post<{ id: string }>('/v1/erp/sales-orders', data), null as unknown as { id: string }),
  confirmSalesOrder: (id: string) => d(() => request.patch<void>(`/v1/erp/sales-orders/${id}/confirm`, {}), undefined),

  // 发货
  getShipments: (params: object) => d(() => request.get<{ list: Shipment[]; total: number }>('/v1/erp/shipments', params), { list: [], total: 0 }),
  createShipment: (data: object) => d(() => request.post<Shipment>('/v1/erp/shipments', data), null as unknown as Shipment),
  ship: (id: string) => d(() => request.patch<void>(`/v1/erp/shipments/${id}/ship`, {}), undefined),
  updateLogistics: (id: string, data: object) => d(() => request.put<void>(`/v1/erp/shipments/${id}/logistics`, data), undefined),
  confirmDelivery: (id: string) => d(() => request.patch<void>(`/v1/erp/shipments/${id}/confirm-delivery`, {}), undefined),

  // 销售退货
  getSalesReturns: (params: object) => d(() => request.get<{ list: SalesReturn[]; total: number }>('/v1/erp/sales-returns', params), { list: [], total: 0 }),
  createSalesReturn: (data: object) => d(() => request.post<SalesReturn>('/v1/erp/sales-returns', data), null as unknown as SalesReturn),
  acceptReturn: (id: string) => d(() => request.patch<void>(`/v1/erp/sales-returns/${id}/accept`, {}), undefined),
  rejectReturn: (id: string, reason: string) => d(() => request.patch<void>(`/v1/erp/sales-returns/${id}/reject`, { reason }), undefined),

  // 应收账款
  getReceivables: (params: object) => d(() => request.get<{ list: Receivable[]; total: number }>('/v1/erp/receivables', params), { list: [], total: 0 }),
  getAgingAnalysis: () => d(() => request.get<{ buckets: { label: string; amount: number }[] }>('/v1/erp/receivables/aging'), { buckets: [] }),
  recordReceivablePayment: (id: string, paidAmount: number) => d(() => request.patch<void>(`/v1/erp/receivables/${id}/payment`, { paidAmount }), undefined),

  // 应付账款
  getPayables: (params: object) => d(() => request.get<{ list: Payable[]; total: number }>('/v1/erp/payables', params), { list: [], total: 0 }),
  getPaymentPlan: (id: string) => d(() => request.get<{ items: unknown[] }>(`/v1/erp/payables/${id}/payment-plan`), { items: [] }),
  recordPayablePayment: (id: string, paidAmount: number) => d(() => request.patch<void>(`/v1/erp/payables/${id}/payment`, { paidAmount }), undefined),

  // 科目
  getAccounts: (params?: object) => d(() => request.get<{ list: Account[]; total: number }>('/v1/erp/accounts', params), { list: [], total: 0 }),
  getAccountTree: () => d(() => request.get<Account[]>('/v1/erp/accounts/tree'), []),
  createAccount: (data: object) => d(() => request.post<Account>('/v1/erp/accounts', data), null as unknown as Account),
  updateAccount: (id: string, data: object) => d(() => request.patch<Account>(`/v1/erp/accounts/${id}`, data), null as unknown as Account),

  // 凭证
  getVouchers: (params: object) => d(() => request.get<{ list: Voucher[]; total: number }>('/v1/erp/vouchers', params), { list: [], total: 0 }),
  createVoucher: (data: object) => d(() => request.post<{ id: string }>('/v1/erp/vouchers', data), null as unknown as { id: string }),
  approveVoucher: (id: string) => d(() => request.patch<void>(`/v1/erp/vouchers/${id}/approve`, {}), undefined),
  postVoucher: (id: string) => d(() => request.patch<void>(`/v1/erp/vouchers/${id}/post`, {}), undefined),

  // 账簿
  getGeneralLedger: (params: object) => d(() => request.get<{ list: unknown[] }>('/v1/erp/ledger/general', params), { list: [] }),
  getDetailLedger: (params: object) => d(() => request.get<{ list: unknown[] }>('/v1/erp/ledger/detail', params), { list: [] }),
  getJournal: (params: object) => d(() => request.get<{ list: unknown[] }>('/v1/erp/ledger/journal', params), { list: [] }),

  // 成本中心
  getCostCenters: () => d(() => request.get<{ list: CostCenter[] }>('/v1/erp/cost-centers'), { list: [] }),
  getCostCenterTree: () => d(() => request.get<CostCenter[]>('/v1/erp/cost-centers/tree'), []),
  createCostCenter: (data: object) => d(() => request.post<CostCenter>('/v1/erp/cost-centers', data), null as unknown as CostCenter),

  // 标准成本
  getStandardCosts: (params?: object) => d(() => request.get<{ list: StandardCost[]; total: number }>('/v1/erp/standard-costs', params), { list: [], total: 0 }),
  createStandardCost: (data: object) => d(() => request.post<StandardCost>('/v1/erp/standard-costs', data), null as unknown as StandardCost),
  calculateStandardCost: (data: object) => d(() => request.post<{ totalCost: number }>('/v1/erp/standard-costs/calculate', data), { totalCost: 0 }),

  // 成本分析
  getCostVariance: (params: object) => d(() => request.get<{ items: unknown[] }>('/v1/erp/cost-analysis/variance', params), { items: [] }),
  getProductCostReport: (params: object) => d(() => request.get<{ items: unknown[] }>('/v1/erp/cost-analysis/product-cost', params), { items: [] }),
  getCostBreakdown: (params: object) => d(() => request.get<{ items: unknown[] }>('/v1/erp/cost-analysis/cost-breakdown', params), { items: [] }),
  getProductCost: (params: object) => d(() => request.get<ProductCost>('/v1/erp/cost-analysis/product-cost', params), null as unknown as ProductCost),

  // 财务报表
  getBalanceSheet: (params: object) => d(() => request.get<{ assets: unknown[]; liabilities: unknown[] }>('/v1/erp/reports/balance-sheet', params), { assets: [], liabilities: [] }),
  getIncomeStatement: (params: object) => d(() => request.get<{ items: unknown[] }>('/v1/erp/reports/income-statement', params), { items: [] }),
  getCashFlow: (params: object) => d(() => request.get<{ items: unknown[] }>('/v1/erp/reports/cash-flow', params), { items: [] }),

  // 销售分析
  getSalesTrend: (params: object) => d(() => request.get<{ trend: { month: string; amount: number }[] }>('/v1/erp/analytics/sales-trend', params), { trend: [] }),
  getCustomerAnalysis: (params: object) => d(() => request.get<{ ranking: unknown[] }>('/v1/erp/analytics/customers', params), { ranking: [] }),
  getProductAnalysis: (params: object) => d(() => request.get<{ ranking: unknown[] }>('/v1/erp/analytics/products', params), { ranking: [] }),
  getRegionAnalysis: (params: object) => d(() => request.get<{ regions: unknown[] }>('/v1/erp/analytics/regions', params), { regions: [] }),
}
