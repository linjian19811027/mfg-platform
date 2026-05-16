/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const component: DefineComponent<object, object, any>
  export default component
}

interface ImportMetaEnv {
  /** API 代理前缀 */
  readonly VITE_API_BASE: string
  /** 应用标题 */
  readonly VITE_APP_TITLE: string
  /** OSS 文件存储域名 */
  readonly VITE_OSS_DOMAIN: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
