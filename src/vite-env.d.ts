/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 可选，完整 API 基址；不设置则生产环境使用 config.ts 的 API_ORIGIN + /api/v1 */
  readonly VITE_API_BASE?: string
  /** 开发时 Vite 代理目标，与 API_ORIGIN 一致 */
  readonly VITE_API_TARGET?: string
  /** 开发时「AI 比价」/tl、/auth 代理目标；不填则沿用 VITE_API_TARGET */
  readonly VITE_TL_TARGET?: string
  /** 高德 REST 地理编码 Key（电子地图页无经纬度时按地址打点）；https://console.amap.com/ */
  readonly VITE_AMAP_REST_KEY?: string
  /** 设为 1 时地理编码走同源 /amap-api-proxy（生产需在 Nginx 配置反代） */
  readonly VITE_AMAP_USE_PROXY?: string
  /** 设为 1 时：地理编码成功后自动把经纬度 POST 到 /tl/update_warehouse、/tl/update_smelter（依赖后端接受纬度/经度字段） */
  readonly VITE_AMAP_AUTO_PERSIST?: string
  /** 开发代理访问 HTTPS 目标时跳过证书校验（设为 1 或 true，仅本机调试用） */
  readonly VITE_API_PROXY_INSECURE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
