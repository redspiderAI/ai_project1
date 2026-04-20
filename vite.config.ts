import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import type { ProxyOptions } from 'vite'
import vue from '@vitejs/plugin-vue'

/** 与 `src/api/config.ts` 中 `API_ORIGIN` 保持一致，供开发代理使用 */
const DEFAULT_API_ORIGIN = 'https://redspiderbc.cn'

function proxySecureFlag(env: Record<string, string>): boolean {
  return env.VITE_API_PROXY_INSECURE !== '1' && env.VITE_API_PROXY_INSECURE !== 'true'
}

function buildApiProxy(env: Record<string, string>): Record<string, ProxyOptions> {
  const raw = (env.VITE_API_TARGET || DEFAULT_API_ORIGIN).trim()
  const target = raw.replace(/\/+$/, '')
  const secure = proxySecureFlag(env)

  return {
    '/api/v1': {
      target,
      changeOrigin: true,
      secure,
    },
  }
}

/** 高德 REST 地理编码：开发时走同源代理，避免浏览器直连 restapi 被 CORS 拦截 */
function buildAmapGeocodeProxy(): Record<string, ProxyOptions> {
  return {
    '/amap-api-proxy': {
      target: 'https://restapi.amap.com',
      changeOrigin: true,
      secure: true,
    },
  }
}

/** 嵌套「AI 比价」页请求 `/tl/*`、`/auth/*`；与 AI 预测同源走代理，避免浏览器直连 IP:8002 触发 CORS */
function buildTlAuthProxy(env: Record<string, string>): Record<string, ProxyOptions> {
  const raw = (env.VITE_TL_TARGET || env.VITE_API_TARGET || DEFAULT_API_ORIGIN).trim()
  const target = raw.replace(/\/+$/, '')
  const secure = proxySecureFlag(env)
  const common = { target, changeOrigin: true, secure } satisfies ProxyOptions
  return {
    '/tl': common,
    '/auth': common,
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiProxy = { ...buildApiProxy(env), ...buildTlAuthProxy(env), ...buildAmapGeocodeProxy() }
  const isProd = mode === 'production'

  return {
    // 开发环境使用根路径，生产部署到 /project2/ 子路径。
    base: isProd ? '/project2/' : '/',
    plugins: [vue()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      proxy: apiProxy,
    },
    preview: {
      proxy: apiProxy,
    },
  }
})
