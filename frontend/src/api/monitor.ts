import { request } from '@/utils/request'

// baseURL 已经是 /api，所以这里路径不需要再加 /api 前缀
export function getHealth() {
  return request.get('/health')
}

export function getMetrics() {
  return request.get('/metrics')
}

export function getMetricsTrend() {
  return request.get('/metrics/trend')
}

export function getLogs(params: any) {
  return request.get('/logs', params)
}
