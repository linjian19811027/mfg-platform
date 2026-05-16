import { request } from '@/utils/request'

export function getOutsourcingDashboard() {
  return request.get('/v1/outsourcing/dashboard')
}
export function getOutsourcingOrders(params: any) {
  return request.get('/v1/outsourcing/orders', params)
}
export function getOutsourcingOrder(id: string) {
  return request.get(`/v1/outsourcing/orders/${id}`)
}
export function createOutsourcingOrder(data: any) {
  return request.post('/v1/outsourcing/orders', data)
}
export function confirmOutsourcingOrder(id: string) {
  return request.patch(`/v1/outsourcing/orders/${id}/confirm`)
}
export function cancelOutsourcingOrder(id: string, data: any) {
  return request.patch(`/v1/outsourcing/orders/${id}/cancel`, data)
}
export function getOutsourcingProgress(id: string) {
  return request.get(`/v1/outsourcing/orders/${id}/progress`)
}
export function getOutsourcingLogs(id: string) {
  return request.get(`/v1/outsourcing/orders/${id}/logs`)
}
export function exportOutsourcingOrders(params: any) {
  return request.getBlob('/v1/outsourcing/orders/export', params)
}

// 发料
export function getOutsourcingIssues(ocId: string) {
  return request.get(`/v1/outsourcing/orders/${ocId}/issues`)
}
export function createOutsourcingIssue(ocId: string, data: any) {
  return request.post(`/v1/outsourcing/orders/${ocId}/issues`, data)
}
export function confirmOutsourcingIssue(id: string) {
  return request.patch(`/v1/outsourcing/issues/${id}/confirm`)
}

// 收货
export function getOutsourcingReceipts(ocId: string) {
  return request.get(`/v1/outsourcing/orders/${ocId}/receipts`)
}
export function createOutsourcingReceipt(ocId: string, data: any) {
  return request.post(`/v1/outsourcing/orders/${ocId}/receipts`, data)
}
export function confirmOutsourcingReceipt(id: string) {
  return request.patch(`/v1/outsourcing/receipts/${id}/confirm`)
}

// 结算
export function getOutsourcingSettlements(ocId: string) {
  return request.get(`/v1/outsourcing/orders/${ocId}/settlements`)
}
export function createOutsourcingSettlement(ocId: string, data: any) {
  return request.post(`/v1/outsourcing/orders/${ocId}/settlements`, data)
}
export function approveOutsourcingSettlement(id: string) {
  return request.patch(`/v1/outsourcing/settlements/${id}/approve`)
}
