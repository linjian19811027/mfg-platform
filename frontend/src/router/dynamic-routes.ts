import type { Router, RouteRecordRaw } from 'vue-router'
import type { MenuNode } from '@/stores/auth'

// 预加载所有 views 下的 index.vue，Vite 可以静态分析并按需拆分
const viewModules = import.meta.glob('@/views/**/index.vue')

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
        const componentPath = inferComponentPath(node.path)
        if (componentPath && viewModules[componentPath]) {
          const route: RouteRecordRaw = {
            path: node.path,
            name: pathToName(node.path),
            component: viewModules[componentPath] as () => Promise<any>,
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
  const cleanPath = path.replace(/^\//, '')
  return `/src/views/${cleanPath}/index.vue`
}

function pathToName(path: string): string {
  return path
    .replace(/^\//, '')
    .split('/')
    .map(s => s.charAt(0).toUpperCase() + s.slice(1))
    .join('')
}
