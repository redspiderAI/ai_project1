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

function unwrapData(data: unknown): unknown {
  if (data == null || typeof data !== 'object') return data
  const o = data as Record<string, unknown>
  if ('data' in o) return o.data
  return data
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

export async function fetchTlComparison(
  body: Record<string, unknown>,
): Promise<Record<string, unknown>[]> {
  const raw = await tlPostJson('/tl/get_comparison', body)
  return unwrapList(unwrapData(raw))
}

/** 品类列表（Swagger: GET /t1/get_categories） */
export type T1CategoryRow = {
  品类id: number
  品类名: string
}

export async function fetchT1Categories(): Promise<T1CategoryRow[]> {
  const raw = await tlGetJson('/t1/get_categories')
  if (raw != null && typeof raw === 'object' && !Array.isArray(raw)) {
    const o = raw as { code?: number; message?: string }
    if (o.code != null && o.code !== 200) {
      const msg = o.message ? String(o.message) : `code ${o.code}`
      throw new Error(`获取品类列表失败：${msg}`)
    }
  }
  const list = unwrapList(raw)
  return list
    .map((row) => {
      const id = row['品类id'] ?? row['category_id'] ?? row['id']
      const name = row['品类名'] ?? row['name'] ?? row['品类名称']
      const 品类id = id != null && id !== '' ? Number(id) : NaN
      const 品类名 = name != null ? String(name).trim() : ''
      return { 品类id, 品类名 }
    })
    .filter((x) => !Number.isNaN(x.品类id) && x.品类名 !== '')
}

export async function fetchForecastDetail(
  params: Record<string, string | number | Array<string | number>>,
): Promise<Record<string, unknown>[]> {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value == null) continue
    if (Array.isArray(value)) {
      for (const item of value) search.append(key, String(item))
      continue
    }
    search.append(key, String(value))
  }
  const query = search.toString()
  const path = `/forecast/明细${query ? `?${query}` : ''}`
  const raw = await tlGetJson(path)
  const data = unwrapData(raw)
  if (data && typeof data === 'object' && Array.isArray((data as { items?: unknown[] }).items)) {
    return ((data as { items: unknown[] }).items || []).filter(
      (x): x is Record<string, unknown> => !!x && typeof x === 'object',
    )
  }
  return unwrapList(data)
}
