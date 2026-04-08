/**
 * 接口基址 `getApiBase()`（通常以 `/api/v1` 结尾）。
 *
 * - 开发（npm run dev）与 preview：浏览器请求同源 `/api/v1`，由 Vite 代理到 `VITE_API_TARGET`
 * - 生产部署在 `http(s)://<域名>/project2/`：默认仍用同源 `/api/v1`，由 Nginx 反代到后端，避免
 *   「页面 :80、接口 :8001」被浏览器视为跨域而导致 fetch 报 Failed to fetch（需后端 CORS 或同源反代）
 * - 用 `VITE_API_BASE` 覆盖：完整 URL（直连某台 API）或相对路径（如 `/api/v1`）
 */
export const API_ORIGIN = 'http://111.229.25.160:8001'

export function getApiBase(): string {
  const fromEnv = import.meta.env.VITE_API_BASE?.trim()
  if (fromEnv) {
    if (fromEnv.startsWith('http://') || fromEnv.startsWith('https://'))
      return fromEnv.replace(/\/$/, '')
    if (fromEnv.startsWith('/'))
      return fromEnv.replace(/\/$/, '') || '/api/v1'
  }

  const origin = API_ORIGIN.replace(/\/$/, '')
  const directApiV1 = `${origin}/api/v1`

  if (typeof window !== 'undefined' && window.location.protocol === 'file:')
    return directApiV1

  if (import.meta.env.DEV)
    return '/api/v1'

  // 生产：默认同源，与页面同主机同端口，无 CORS；服务器需 location /api/v1/ → 反代到本机 8001
  return '/api/v1'
}
