import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import type { ProxyOptions } from 'vite'
import vue from '@vitejs/plugin-vue'

/** 与 `src/api/config.ts` 中 `API_ORIGIN` 保持一致，供开发代理使用 */
const DEFAULT_API_ORIGIN = 'https://redspiderbc.cn'

function buildApiProxy(env: Record<string, string>): Record<string, ProxyOptions> {
  const raw = (env.VITE_API_TARGET || DEFAULT_API_ORIGIN).trim()
  const target = raw.replace(/\/+$/, '')
  const secure = env.VITE_API_PROXY_INSECURE !== '1' && env.VITE_API_PROXY_INSECURE !== 'true'

  return {
    '/api/v1': {
      target,
      changeOrigin: true,
      secure,
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiProxy = buildApiProxy(env)

  return {
    // 部署在 http://<host>/project2/ 子路径时需与服务器 location 一致（改部署路径时同步改此处）
    base: '/project2/',
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
