import { defineStore } from 'pinia'
import { request } from '@/utils/request'
import router from '@/router'
import { registerDynamicRoutes } from '@/router/dynamic-routes'

interface TenantItem {
  id: string
  name: string
}

export interface MenuNode {
  key: string
  title: string
  icon?: string
  path?: string
  sortOrder?: number
  children?: MenuNode[]
}

interface AuthState {
  token: string | null
  userId: string | null
  username: string | null
  tenantId: string | null
  roles: string[]
  permissions: string[]
  enabledModules: string[]
  menus: MenuNode[]
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
  refreshToken?: string
  user: {
    id: string
    username: string
    tenantId: string
    roles: string[]
    permissions: string[]
    enabledModules?: string[]
  }
  menus?: MenuNode[]
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    token: null,
    userId: null,
    username: null,
    tenantId: null,
    roles: [],
    permissions: [],
    enabledModules: [],
    menus: [],
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
      this.enabledModules = data.user.enabledModules ?? []
      this.menus = data.menus ?? []

      // 注册动态路由
      registerDynamicRoutes(router, this.menus)

      localStorage.setItem('token', data.accessToken)
      localStorage.setItem('userId', data.user.id)
      localStorage.setItem('username', data.user.username)
      localStorage.setItem('tenantId', data.user.tenantId)
      localStorage.setItem('roles', JSON.stringify(data.user.roles))
      localStorage.setItem('permissions', JSON.stringify(data.user.permissions))
      localStorage.setItem('enabledModules', JSON.stringify(data.user.enabledModules ?? []))
      localStorage.setItem('menus', JSON.stringify(data.menus ?? []))
      if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken)

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
      this.enabledModules = []
      this.menus = []
      this.tenants = []

      localStorage.removeItem('token')
      localStorage.removeItem('userId')
      localStorage.removeItem('username')
      localStorage.removeItem('tenantId')
      localStorage.removeItem('roles')
      localStorage.removeItem('permissions')
      localStorage.removeItem('enabledModules')
      localStorage.removeItem('menus')
      localStorage.removeItem('refreshToken')
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
      this.enabledModules = JSON.parse(localStorage.getItem('enabledModules') || '[]')
      this.menus = JSON.parse(localStorage.getItem('menus') || '[]')
      this.tenants = JSON.parse(localStorage.getItem('tenants') || '[]')
      // 注册动态路由
      if (this.menus.length) registerDynamicRoutes(router, this.menus)
      this.startExpiryWatch()
    },

    /** 启动定时器，每分钟检查 token 是否过期，过期前 2 分钟尝试静默续期 */
    startExpiryWatch() {
      this.stopExpiryWatch()
      this._expiryTimer = setInterval(async () => {
        if (!this.token) return
        const exp = getTokenExpiry(this.token)
        if (!exp) return
        const remainingSec = exp - Date.now() / 1000
        if (remainingSec > 120) return // 还有 2 分钟以上，不续期

        // 尝试用 refreshToken 续期
        const refreshToken = localStorage.getItem('refreshToken')
        if (refreshToken) {
          try {
            const res = await request.post<{ accessToken: string }>('/v1/auth/refresh', { refreshToken })
            this.token = res.accessToken
            localStorage.setItem('token', res.accessToken)
            return // 续期成功
          } catch { /* 续期失败，继续登出 */ }
        }

        this.logout()
        const { Message } = await import('@arco-design/web-vue')
        Message.warning('登录已过期，请重新登录')
        window.location.href = '/login'
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
        const data = await request.post<{ accessToken: string; refreshToken?: string; tenantId: string }>(
          '/v1/auth/switch-tenant',
          { tenantId },
        )
        this.token = data.accessToken
        this.tenantId = data.tenantId
        localStorage.setItem('token', data.accessToken)
        localStorage.setItem('tenantId', data.tenantId)
        if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken)
        window.location.reload()
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : '切换租户失败'
        Message.error(msg)
      }
    },
  },
})
