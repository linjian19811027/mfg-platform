import type { Router } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

declare module 'vue-router' {
  interface RouteMeta {
    public?: boolean
    permission?: string
    title?: string
  }
}

export function setupRouterGuard(router: Router) {
  router.beforeEach((to, _from, next) => {
    const authStore = useAuthStore()

    // 1. 公开页面直接放行
    if (to.meta.public) {
      // 已登录访问 /login → 跳转 /dashboard
      if (to.path === '/login' && authStore.isLoggedIn) {
        return next('/dashboard')
      }
      return next()
    }

    // 2. 未登录 → 跳转登录页，携带 redirect
    if (!authStore.isLoggedIn) {
      return next({ path: '/login', query: { redirect: to.fullPath } })
    }

    // 3. 检查权限（ADMIN 角色跳过权限检查）
    if (to.meta.permission) {
      const isAdmin = authStore.roles.some(r => r === 'ADMIN' || r === 'admin' || r === 'SUPER_ADMIN')
      if (!isAdmin && !authStore.permissions.includes(to.meta.permission)) {
        return next('/403')
      }
    }

    // 4. 放行
    next()
  })
}
