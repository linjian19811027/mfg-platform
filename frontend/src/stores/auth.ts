import { defineStore } from 'pinia'
import { request } from '@/utils/request'

interface TenantItem {
  id: string
  name: string
}

interface AuthState {
  token: string | null
  userId: string | null
  username: string | null
  tenantId: string | null
  roles: string[]
  permissions: string[]
  tenants: TenantItem[]
  _expiryTimer: ReturnType<typeof setInterval> | null
}

/** 解析 JWT payload，返回过期时间戳（秒），解析失败返回 null */
function getTokenExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return typeof payload.exp === 'number' ? payload.exp : null
  } catch {
    return null
  }
}

interface LoginResponse {
  accessToken: string
  user: {
    id: string
    username: string
    tenantId: string
    roles: string[]
    permissions: string[]
  }
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    token: null,
    userId: null,
    username: null,
    tenantId: null,
    roles: [],
    permissions: [],
    tenants: [],
    _expiryTimer: null,
  }),

  getters: {
    isLoggedIn: (state) => !!state.token,
  },

  actions: {
    async login(username: string, password: string, tenantCode = 'DEFAULT') {
      const data = await request.post<LoginResponse>('/v1/auth/login', { username, password, tenantCode })
      this.token = data.accessToken
      this.userId = data.user.id
      this.username = data.user.username
      this.tenantId = data.user.tenantId
      this.roles = data.user.roles
      this.permissions = data.user.permissions

      localStorage.setItem('token', data.accessToken)
      localStorage.setItem('userId', data.user.id)
      localStorage.setItem('username', data.user.username)
      localStorage.setItem('tenantId', data.user.tenantId)
      localStorage.setItem('roles', JSON.stringify(data.user.roles))
      localStorage.setItem('permissions', JSON.stringify(data.user.permissions))

      this.startExpiryWatch()
    },

    logout() {
      this.stopExpiryWatch()
      this.token = null
      this.userId = null
      this.username = null
      this.tenantId = null
      this.roles = []
      this.permissions = []
      this.tenants = []

      localStorage.removeItem('token')
      localStorage.removeItem('userId')
      localStorage.removeItem('username')
      localStorage.removeItem('tenantId')
      localStorage.removeItem('roles')
      localStorage.removeItem('permissions')
      localStorage.removeItem('tenants')
    },

    initFromStorage() {
      const token = localStorage.getItem('token')
      if (!token) return
      // 初始化时先检查 token 是否已过期
      const exp = getTokenExpiry(token)
      if (exp && Date.now() / 1000 >= exp) {
        this.logout()
        window.location.href = '/login'
        return
      }
      this.token = token
      this.userId = localStorage.getItem('userId')
      this.username = localStorage.getItem('username')
      this.tenantId = localStorage.getItem('tenantId')
      this.roles = JSON.parse(localStorage.getItem('roles') || '[]')
      this.permissions = JSON.parse(localStorage.getItem('permissions') || '[]')
      this.tenants = JSON.parse(localStorage.getItem('tenants') || '[]')
      this.startExpiryWatch()
    },

    /** 启动定时器，每分钟检查一次 token 是否过期 */
    startExpiryWatch() {
      this.stopExpiryWatch()
      this._expiryTimer = setInterval(async () => {
        if (!this.token) return
        const exp = getTokenExpiry(this.token)
        if (exp && Date.now() / 1000 >= exp) {
          this.logout()
          const { Message } = await import('@arco-design/web-vue')
          Message.warning('登录已过期，请重新登录')
          window.location.href = '/login'
        }
      }, 60 * 1000)
    },

    stopExpiryWatch() {
      if (this._expiryTimer) {
        clearInterval(this._expiryTimer)
        this._expiryTimer = null
      }
    },

    async fetchTenants() {
      try {
        const data = await request.get<TenantItem[]>('/v1/auth/tenants')
        this.tenants = data
        localStorage.setItem('tenants', JSON.stringify(data))
      } catch {
        // 静默处理，可能是权限问题
      }
    },

    async switchTenant(tenantId: string) {
      const { Message } = await import('@arco-design/web-vue')
      try {
        const data = await request.post<{ accessToken: string; tenantId: string }>(
          '/v1/auth/switch-tenant',
          { tenantId },
        )
        this.token = data.accessToken
        this.tenantId = data.tenantId
        localStorage.setItem('token', data.accessToken)
        localStorage.setItem('tenantId', data.tenantId)
        window.location.reload()
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : '切换租户失败'
        Message.error(msg)
      }
    },
  },
})
