import axios, { type AxiosInstance, type AxiosRequestConfig, type InternalAxiosRequestConfig, type AxiosResponse, type AxiosError } from 'axios'
import { Message } from '@arco-design/web-vue'
import { useAuthStore } from '@/stores/auth'

// 后端统一响应格式
interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T
}

// 递归处理响应数据：格式化日期字段
function processResponseData(data: unknown): unknown {
  if (data === null || data === undefined) return data
  if (data instanceof Date) return data
  if (Array.isArray(data)) return data.map(processResponseData)
  if (typeof data === 'object') {
    const obj = data as Record<string, unknown>
    const result: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(obj)) {
      if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
        // ISO 日期字符串 → YYYY-MM-DD HH:mm:ss
        result[key] = val.replace('T', ' ').substring(0, 19)
      } else if (Array.isArray(val) || (val !== null && typeof val === 'object')) {
        result[key] = processResponseData(val)
      } else {
        result[key] = val
      }
    }
    return result
  }
  return data
}

const instance: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 请求拦截器：注入 token 和 tenantId
instance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const authStore = useAuthStore()
    if (authStore.token) {
      config.headers.set('Authorization', `Bearer ${authStore.token}`)
    }
    if (authStore.tenantId) {
      config.headers.set('X-Tenant-Id', authStore.tenantId)
    }
    return config
  },
  (error: AxiosError) => Promise.reject(error),
)

// 响应拦截器：统一处理响应格式和错误
instance.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => {
    const res = response.data
    if (res.code === 200) {
      const processed = processResponseData(res.data) as Record<string, unknown>
      // 后端部分接口返回 items 或 data 字段，统一映射为 list
      if (processed && typeof processed === 'object') {
        if ('items' in processed && !('list' in processed) && Array.isArray((processed as Record<string, unknown>).items)) processed.list = (processed as Record<string, unknown>).items
        if ('data' in processed && Array.isArray(processed.data) && !('list' in processed)) processed.list = processed.data
      }
      return processed as never
    }
    if (res.code === 401) {
      const authStore = useAuthStore()
      authStore.token = null
      authStore.tenantId = null
      window.location.href = '/login'
      return Promise.reject(new Error(res.message || '未授权'))
    }
    Message.error(res.message || '请求失败')
    return Promise.reject(new Error(res.message || '请求失败'))
  },
  (error: AxiosError) => {
    const url = error.config?.url ?? ''
    const method = (error.config?.method ?? '').toUpperCase()
    const status = error.response?.status

    if (status === 401) {
      const authStore = useAuthStore()
      authStore.token = null
      authStore.tenantId = null
      window.location.href = '/login'
    } else if (status === 404) {
      console.warn(`[API 404] ${method} ${url} — 接口不存在，请检查路径`)
    } else if (status === 403) {
      console.warn(`[API 403] ${method} ${url} — 权限不足`)
    } else if (status && status >= 500) {
      console.error(`[API ${status}] ${method} ${url} — 服务器错误`, error.response?.data)
      Message.error(`服务器错误 (${status})，请联系管理员`)
    } else {
      console.error(`[API Error] ${method} ${url}`, error.message)
      Message.error(error.message || '网络错误，请检查网络连接')
    }
    return Promise.reject(error)
  },
)

// 类型安全的请求方法（async 确保 Promise 解包）
export const request = {
  async get<T = any>(url: string, params?: object): Promise<T> {
    return (await instance.get(url, { params } as AxiosRequestConfig)) as T
  },
  /** GET 请求返回 Blob（用于文件导出） */
  async getBlob(url: string, params?: object): Promise<Blob> {
    const res = await instance.get(url, { params, responseType: 'blob' } as AxiosRequestConfig)
    return res as unknown as Blob
  },
  async post<T = any>(url: string, data?: object): Promise<T> {
    return (await instance.post(url, data)) as T
  },
  async put<T = any>(url: string, data?: object): Promise<T> {
    return (await instance.put(url, data)) as T
  },
  async patch<T = any>(url: string, data?: object): Promise<T> {
    return (await instance.patch(url, data)) as T
  },
  async delete<T = any>(url: string, params?: object): Promise<T> {
    return (await instance.delete(url, { params } as AxiosRequestConfig)) as T
  },
}

/**
 * Mock 降级开关：所有环境默认关闭
 * - 后端报错直接暴露，便于排查
 * - 上生产时改为 true 开启降级
 */
export const MOCK_ENABLED = import.meta.env.VITE_MOCK_ENABLED === 'true'

/** Mock 降级工具：开关关闭时直接抛错，开关开启时返回兜底数据 */
export function mockFallback<T>(url: string, fallback: T, ms = 300): Promise<T> {
  if (!MOCK_ENABLED) {
    // 测试阶段不降级，让错误暴露出来
    return Promise.reject(new Error(`[Mock 关闭] ${url} — 后端未返回，Mock 降级已禁用`))
  }
  console.warn(`[Mock 降级] ${url} — 后端未就绪，使用前端 Mock 数据`)
  return new Promise(resolve => setTimeout(() => resolve(fallback), ms))
}

export { instance }
export default instance
