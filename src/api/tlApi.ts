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
      `${path} 返回 ${res.status}（${detail}）。开发环境请检查 Vite 代理目标 VITE_TL_TARGET / VITE_API_TARGET 对应服务是否正常；502 多为上游网关或服务不可用。`,
    )
  }
  return data
}

export async function fetchTlWarehouses(): Promise<Record<string, unknown>[]> {
  const raw = await tlGetJson('/tl/get_warehouses')
  return unwrapList(raw)
}

/** TL 列表类接口：校验业务 code（与 /tl 返回体一致） */
function assertTlBizCode200(raw: unknown, ctx: string): void {
  if (raw != null && typeof raw === 'object' && !Array.isArray(raw)) {
    const o = raw as { code?: number; message?: string }
    if (o.code != null && o.code !== 200) {
      const msg = o.message ? String(o.message) : `code ${o.code}`
      throw new Error(`${ctx}：${msg}`)
    }
  }
}

/**
 * 从 get_warehouses / get_smelters 等响应中取出本页行。
 * 分页时 `data` 常见 `{ list|items|records, total|count|totalCount }`；也可能直接为数组。
 */
function pickTotalFromPayload(d: Record<string, unknown>): number | undefined {
  const keys = ['total', 'count', 'totalCount', 'total_count', 'Total']
  for (const k of keys) {
    const v = d[k]
    if (typeof v === 'number' && Number.isFinite(v)) return v
    if (typeof v === 'string' && v.trim() !== '') {
      const n = Number(v)
      if (Number.isFinite(n)) return n
    }
  }
  return undefined
}

function extractTlListPayload(raw: unknown): { rows: Record<string, unknown>[]; total?: number } {
  const data = unwrapData(raw)
  if (Array.isArray(data)) {
    return {
      rows: data.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object'),
    }
  }
  if (data != null && typeof data === 'object' && !Array.isArray(data)) {
    const d = data as Record<string, unknown>
    const listRaw = d.list ?? d.items ?? d.records
    if (Array.isArray(listRaw)) {
      const rows = listRaw.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
      return { rows, total: pickTotalFromPayload(d) }
    }
  }
  return { rows: unwrapList(raw) }
}

/** 库房/冶炼厂分页：每页条数（你方要求 200；若后端限制 size，可改为 100） */
const TL_LIST_PAGE_SIZE = 200

/**
 * 拉齐列表全部分页后再返回（地图等场景一次性打点）。
 * 从第 1 页起固定带 `page`、`size`，避免服务端默认 pageSize 小于本常量时只拉到第一页。
 */
async function fetchTlListAll(
  pathNoQuery: string,
  ctx: string,
): Promise<Record<string, unknown>[]> {
  const pageSize = TL_LIST_PAGE_SIZE
  const sep = pathNoQuery.includes('?') ? '&' : '?'

  const raw0 = await tlGetJson(`${pathNoQuery}${sep}page=1&size=${pageSize}`)
  assertTlBizCode200(raw0, ctx)
  const data0 = unwrapData(raw0)
  if (Array.isArray(data0)) {
    return data0.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
  }

  const first = extractTlListPayload(raw0)
  const all: Record<string, unknown>[] = [...first.rows]
  let total = first.total
  let page = 2

  if (first.rows.length === 0) {
    return all
  }
  if (total != null && all.length >= total) {
    return all
  }
  if (first.rows.length < pageSize) {
    return all
  }

  while (page <= 500) {
    const raw = await tlGetJson(`${pathNoQuery}${sep}page=${page}&size=${pageSize}`)
    assertTlBizCode200(raw, ctx)
    const dataLoop = unwrapData(raw)
    if (Array.isArray(dataLoop)) {
      all.push(
        ...dataLoop.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object'),
      )
      break
    }
    const { rows, total: t2 } = extractTlListPayload(raw)
    if (t2 != null) total = t2
    all.push(...rows)
    if (rows.length === 0) break
    if (total != null && all.length >= total) break
    if (rows.length < pageSize) break
    page += 1
  }

  return all
}

/** 仓库全量（分页拉齐，地图打点）。GET /tl/get_warehouses；与单页 `fetchTlWarehouses` 同源。 */
export async function fetchTlWarehousesAll(): Promise<Record<string, unknown>[]> {
  return fetchTlListAll('/tl/get_warehouses', '仓库列表')
}

/** 冶炼厂全量（地图打点）；逻辑同仓库：先无参，再 page/size 直至取完 */
export async function fetchTlSmeltersAll(): Promise<Record<string, unknown>[]> {
  return fetchTlListAll('/tl/get_smelters', '冶炼厂列表')
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

/** POST /tl/get_comparison，请求体字段为英文 snake_case（与后端约定一致） */
export async function fetchTlComparison(
  body: Record<string, unknown>,
): Promise<Record<string, unknown>[]> {
  const raw = await tlPostJson('/tl/get_comparison', body)
  return unwrapList(unwrapData(raw))
}

/**
 * 智能比价完整响应（含 `冶炼厂利润排行`、`最优价排序口径` 等），与嵌入页 `price_system` 一致校验 `code===200`。
 */
export async function postTlGetComparison(
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const raw = await tlPostJson('/tl/get_comparison', body)
  if (raw != null && typeof raw === 'object' && !Array.isArray(raw)) {
    const o = raw as { code?: number; message?: string }
    if (o.code != null && o.code !== 200) {
      const msg = o.message ? String(o.message) : `业务码 ${o.code}`
      throw new Error(`比价失败：${msg}`)
    }
    return raw as Record<string, unknown>
  }
  return { data: raw }
}

/** 从比价响应中取出明细行（`data` / `list` 等，与 unwrapList 一致） */
export function tlUnwrapComparisonDetails(raw: Record<string, unknown>): Record<string, unknown>[] {
  return unwrapList(unwrapData(raw))
}

/** 品类列表（GET /tl/get_categories）；兼容后端英文字段与历史中文字段 */
export type TlCategoryRow = {
  id: number
  name: string
}

export async function fetchTlCategories(): Promise<TlCategoryRow[]> {
  const raw = await tlGetJson('/tl/get_categories')
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
      const id = row['category_id'] ?? row['品类id'] ?? row['id']
      const name = row['category_name'] ?? row['品类名'] ?? row['name'] ?? row['品类名称']
      const nid = id != null && id !== '' ? Number(id) : NaN
      const nname = name != null ? String(name).trim() : ''
      return { id: nid, name: nname }
    })
    .filter((x) => !Number.isNaN(x.id) && x.name !== '')
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
  const path = `/forecast/details${query ? `?${query}` : ''}`
  const raw = await tlGetJson(path)
  const data = unwrapData(raw)
  if (data && typeof data === 'object' && Array.isArray((data as { items?: unknown[] }).items)) {
    return ((data as { items: unknown[] }).items || []).filter(
      (x): x is Record<string, unknown> => !!x && typeof x === 'object',
    )
  }
  return unwrapList(data)
}
