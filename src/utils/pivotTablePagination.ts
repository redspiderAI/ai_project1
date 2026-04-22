/**
 * 透视表分页：每页固定数量的「分组键」（如大区经理、仓库），
 * 同一组下的多行（如不同冶炼厂）全部留在同一页。
 */
export const PIVOT_GROUPS_PER_PAGE = 10

export function paginatePivotRowsByGroup<T>(
  rows: T[],
  page: number,
  groupKey: (row: T) => string,
  sort: (a: T, b: T) => number,
): T[] {
  if (rows.length === 0) return []
  const sorted = [...rows].sort(sort)
  const keys: string[] = []
  for (const r of sorted) {
    const k = groupKey(r)
    if (keys[keys.length - 1] !== k) keys.push(k)
  }
  const start = (page - 1) * PIVOT_GROUPS_PER_PAGE
  const allowed = new Set(keys.slice(start, start + PIVOT_GROUPS_PER_PAGE))
  return sorted.filter((r) => allowed.has(groupKey(r)))
}

export function pivotGroupTotalPages<T>(
  rows: T[],
  groupKey: (row: T) => string,
  sort: (a: T, b: T) => number,
): number {
  if (rows.length === 0) return 1
  const sorted = [...rows].sort(sort)
  let n = 0
  let prev = '\0'
  for (const r of sorted) {
    const k = groupKey(r)
    if (k !== prev) {
      n++
      prev = k
    }
  }
  return Math.max(1, Math.ceil(n / PIVOT_GROUPS_PER_PAGE))
}
