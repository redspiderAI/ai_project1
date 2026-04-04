/** 无登录场景下的 JSON 请求（不附加 Authorization） */
export async function fetchJson(
  url: string,
  options: RequestInit = {},
): Promise<{ res: Response; data: unknown }> {
  const res = await fetch(url, {
    credentials: 'include',
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
