import { fetchJson } from './userApi'

function unwrapList(data: unknown): Record<string, unknown>[] {
  if (data == null) return []
  if (Array.isArray(data)) return data as Record<string, unknown>[]
  if (typeof data !== 'object') return []
  const o = data as Record<string, unknown>
  if (Array.isArray(o.data)) return o.data as Record<string, unknown>[]
  if (Array.isArray(o.list)) return o.list as Record<string, unknown>[]
  if (Array.isArray(o.items)) return o.items as Record<string, unknown>[]
  if (Array.isArray(o.records)) return o.records as Record<string, unknown>[]
  if (o.data != null && typeof o.data === 'object') return unwrapList(o.data)
  return []
}

function authHeaders(): HeadersInit {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('api_token') : null
  if (!token) return {}
  return { Authorization: `Bearer ${token}` }
}

/** TL 通用 POST JSON（库房/冶炼厂更新等） */
export async function tlPostJson(path: string, body: Record<string, unknown>): Promise<unknown> {
  const url = path.startsWith('/') ? path : `/${path}`
  const { res, data } = await fetchJson(url, {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
    } as HeadersInit,
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const bodyMsg =
      typeof data === 'object' && data && 'message' in data
        ? String((data as { message?: unknown }).message)
        : ''
    const detail = [bodyMsg, res.statusText].filter(Boolean).join(' — ') || `HTTP ${res.status}`
    throw new Error(`${path} 返回 ${res.status}（${detail}）`)
  }
  return data
}

export async function tlGetJson(path: string): Promise<unknown> {
  const url = path.startsWith('/') ? path : `/${path}`
  const { res, data } = await fetchJson(url, {
    method: 'GET',
    headers: { ...authHeaders() },
  })
  if (!res.ok) {
    const bodyMsg =
      typeof data === 'object' && data && 'message' in data
        ? String((data as { message?: unknown }).message)
        : ''
    const detail = [bodyMsg, res.statusText].filter(Boolean).join(' — ') || `HTTP ${res.status}`
    throw new Error(
      `${path} 返回 ${res.status}（${detail}）。开发环境请检查 Vite 代理目标 VITE_TL_TARGET / VITE_API_TARGET 对应服务是否正常；502 多为上游网关或后端不可用。`,
    )
  }
  return data
}

export async function fetchTlWarehouses(): Promise<Record<string, unknown>[]> {
  const raw = await tlGetJson('/tl/get_warehouses')
  return unwrapList(raw)
}

export async function fetchTlSmelters(): Promise<Record<string, unknown>[]> {
  const raw = await tlGetJson('/tl/get_smelters')
  return unwrapList(raw)
}

/** 用于库房列表「颜色」与地图打点配色（类型 id → 颜色配置） */
export async function fetchTlWarehouseTypes(includeInactive = false): Promise<Record<string, unknown>[]> {
  const q = includeInactive ? 'true' : 'false'
  const raw = await tlGetJson(`/tl/get_warehouse_types?include_inactive=${q}`)
  return unwrapList(raw)
}
