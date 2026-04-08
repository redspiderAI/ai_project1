/** 无登录场景下的 JSON 请求（不附加 Authorization） */
export async function fetchJson(
  url: string,
  options: RequestInit = {},
): Promise<{ res: Response; data: unknown }> {
  // 跨域时不能用 credentials:'include' 且服务端仍返回 Allow-Origin:*，浏览器会拦截 POST。
  // 无 Cookie/登录场景用 omit，与 * 或常规 CORS 兼容。
  const res = await fetch(url, {
    credentials: 'omit',
    ...options,
    headers: {
      ...(options.headers as Record<string, string> | undefined),
    },
  })
  const text = await res.text()
  let data: unknown = {}
  try {
    if (text) data = JSON.parse(text) as unknown
  } catch {
    /* ignore */
  }
  return { res, data }
}
