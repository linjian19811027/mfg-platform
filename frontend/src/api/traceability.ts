import { request } from '@/utils/request'

// 追溯批次管理
export function getTraceBatches(params: any) {
  return request.get('/v1/traceability/batches', params)
}

export function getTraceBatch(id: string) {
  return request.get(`/v1/traceability/batches/${id}`)
}

export function manualCreateBatch(data: any) {
  return request.post('/v1/traceability/batches/manual', data)
}

export function exportBatches(params: any) {
  return request.get('/v1/traceability/batches/export/excel', params)
}

export function archiveBatches(data: any) {
  return request.post('/v1/traceability/batches/archive', data)
}

// 正向追溯
export function forwardTrace(traceCode: string) {
  return request.get(`/v1/traceability/forward/${traceCode}`)
}

export function forwardTracePdf(traceCode: string) {
  return request.get(`/v1/traceability/forward/${traceCode}/pdf`)
}

// 反向追溯
export function backwardTrace(traceCode: string) {
  return request.get(`/v1/traceability/backward/${traceCode}`)
}

export function backwardTracePdf(traceCode: string) {
  return request.get(`/v1/traceability/backward/${traceCode}/pdf`)
}

// 召回评估
export function assessRecall(data: any) {
  return request.post('/v1/traceability/recall/assess', data)
}

export function getRecallAssessments(params: any) {
  return request.get('/v1/traceability/recall/assessments', params)
}

export function getRecallAssessment(id: string) {
  return request.get(`/v1/traceability/recall/assessments/${id}`)
}

export function confirmRecall(id: string) {
  return request.post(`/v1/traceability/recall/assessments/${id}/confirm`)
}

// 追溯报告
export function getReports(params: any) {
  return request.get('/v1/traceability/reports', params)
}

export function generateReport(data: any) {
  return request.post('/v1/traceability/reports/generate', data)
}

// 分析看板
export function getAnalyticsDashboard() {
  return request.get('/v1/traceability/analytics/dashboard')
}

export function getCoverageStats(params: any) {
  return request.get('/v1/traceability/analytics/coverage', params)
}

export function getQueryFrequency(params: any) {
  return request.get('/v1/traceability/analytics/query-frequency', params)
}
