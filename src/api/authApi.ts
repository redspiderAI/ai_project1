import { fetchJson } from './userApi'

export type UserRow = {
  id: number
  username: string
  real_name: string
  role: string
  phone?: string
  email?: string
  is_active?: boolean
}

type ApiResp<T> = {
  code?: number
  message?: string
  detail?: string
  data?: T
}

type FastApiValidationItem = {
  loc?: unknown
  msg?: unknown
}

const TOKEN_KEY = 'api_token'

function readMsg(data: unknown): string {
  if (!data || typeof data !== 'object') return ''
  const o = data as Record<string, unknown>
  if (typeof o.message === 'string') return o.message
  if (typeof o.detail === 'string') return o.detail
  if (Array.isArray(o.detail)) {
    const lines = (o.detail as FastApiValidationItem[])
      .map((it) => {
        const msg = typeof it?.msg === 'string' ? it.msg : ''
        const loc =
          Array.isArray(it?.loc) && it.loc.length
            ? String(it.loc[it.loc.length - 1] ?? '')
            : ''
        if (!msg) return ''
        return loc ? `${loc}：${msg}` : msg
      })
      .filter((x) => x !== '')
    if (lines.length) return lines.join('；')
  }
  return ''
}

function authHeaders(): HeadersInit {
  const token = getToken()
  if (!token) return {}
  return { Authorization: `Bearer ${token}` }
}

export function getToken(): string {
  if (typeof localStorage === 'undefined') return ''
  return localStorage.getItem(TOKEN_KEY) || ''
}

export function setToken(token: string) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(TOKEN_KEY)
}

export async function login(username: string, password: string): Promise<string> {
  const { res, data } = await fetchJson('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) throw new Error(readMsg(data) || `登录失败（HTTP ${res.status}）`)

  const obj = (data || {}) as Record<string, unknown>
  const token =
    (typeof obj.access_token === 'string' && obj.access_token) ||
    (typeof obj.token === 'string' && obj.token) ||
    (obj.data && typeof obj.data === 'object'
      ? ((obj.data as Record<string, unknown>).access_token as string) ||
        ((obj.data as Record<string, unknown>).token as string)
      : '') ||
    ''
  if (!token) throw new Error('登录成功但未返回 token')
  setToken(token)
  return token
}

export async function fetchUsers(params: {
  keyword?: string
  role?: string
  page: number
  page_size: number
}): Promise<{ items: UserRow[]; total: number }> {
  const q = new URLSearchParams()
  if (params.keyword) q.set('keyword', params.keyword)
  if (params.role) q.set('role', params.role)
  q.set('page', String(params.page))
  q.set('page_size', String(params.page_size))

  const { res, data } = await fetchJson(`/auth/users?${q.toString()}`, {
    method: 'GET',
    headers: { ...authHeaders() },
  })
  if (!res.ok) throw new Error(readMsg(data) || `获取用户列表失败（HTTP ${res.status}）`)

  const payload = (data || {}) as ApiResp<{ items?: UserRow[]; total?: number }>
  const inner = (payload.data || {}) as Record<string, unknown>
  const list =
    (Array.isArray(inner.items) ? inner.items : null) ||
    (Array.isArray(inner.list) ? inner.list : null) ||
    (Array.isArray(inner.records) ? inner.records : null) ||
    []
  return {
    items: list as UserRow[],
    total: typeof inner.total === 'number' ? inner.total : list.length,
  }
}

export async function createUser(body: {
  username: string
  real_name: string
  password: string
  role: string
  phone?: string
  email?: string
}) {
  const { res, data } = await fetchJson('/auth/users', {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(readMsg(data) || `新增用户失败（HTTP ${res.status}）`)
}

export async function updateUserRole(id: number, role: string) {
  const { res, data } = await fetchJson('/auth/update_role', {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id, role }),
  })
  if (!res.ok) throw new Error(readMsg(data) || `修改角色失败（HTTP ${res.status}）`)
}

export async function changeUserPassword(id: number, admin_key: string, new_password: string) {
  const { res, data } = await fetchJson('/auth/change_password', {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id, admin_key, new_password }),
  })
  if (!res.ok) throw new Error(readMsg(data) || `修改密码失败（HTTP ${res.status}）`)
}

export async function deleteUser(id: number) {
  const { res, data } = await fetchJson('/auth/delete_user', {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id }),
  })
  if (!res.ok) throw new Error(readMsg(data) || `删除用户失败（HTTP ${res.status}）`)
}
