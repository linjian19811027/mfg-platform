import type { Router, RouteRecordRaw } from 'vue-router'
import type { MenuNode } from '@/stores/auth'

/**
 * 从菜单数据动态注册路由
 * 后端返回的 menus 包含 path 和 component 信息
 * 只注册静态路由中不存在的路径
 */
export function registerDynamicRoutes(router: Router, menus: MenuNode[]) {
  const existingPaths = new Set(
    router.getRoutes().map(r => r.path)
  )

  function walk(nodes: MenuNode[]) {
    for (const node of nodes) {
      if (node.path && !existingPaths.has(node.path)) {
        // 从路径推断组件路径：/mes/workorder → /views/mes/workorder/index.vue
        const componentPath = inferComponentPath(node.path)
        if (componentPath) {
          const route: RouteRecordRaw = {
            path: node.path,
            name: pathToName(node.path),
            component: () => import(componentPath),
          }
          router.addRoute(route)
          existingPaths.add(node.path)
        }
      }
      if (node.children?.length) {
        walk(node.children)
      }
    }
  }

  walk(menus)
}

function inferComponentPath(path: string): string | null {
  // /mes/workorder → @/views/mes/workorder/index.vue
  // /sys/tenant → @/views/sys/tenant/index.vue
  // /rpt/list → @/views/rpt/list/index.vue
  const cleanPath = path.replace(/^\//, '')
  return `@/views/${cleanPath}/index.vue`
}

function pathToName(path: string): string {
  // /mes/workorder → MesWorkorder
  return path
    .replace(/^\//, '')
    .split('/')
    .map(s => s.charAt(0).toUpperCase() + s.slice(1))
    .join('')
}
