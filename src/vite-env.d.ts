/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 可选，完整 API 基址；不设置则生产环境使用 config.ts 的 API_ORIGIN + /api/v1 */
  readonly VITE_API_BASE?: string
  /** 开发时 Vite 代理目标，与 API_ORIGIN 一致 */
  readonly VITE_API_TARGET?: string
  /** 开发代理访问 HTTPS 目标时跳过证书校验（设为 1 或 true，仅本机调试用） */
  readonly VITE_API_PROXY_INSECURE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
