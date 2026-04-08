/** 临时前端模拟数据（后端恢复后改回调用接口） */

export type PurchaseMockRecord = {
  regional_manager: string
  warehouse_name: string
  prediction_date: string
  /** 完成时间（日期），不早于 prediction_date */
  completion_date: string
  contract_no: string
  smelter_company: '金利' | '豫光'
  delivery_date: string
  truck_count: number
  created_at: string
  data_long: number
}

const MANAGERS = [
  '叶恒奇',
  '姜志伟',
  '李浩',
  '陆召阳',
  '张贺萌',
  '钟一鸣',
  '李明雨',
  '于娇娇',
  '王菲',
] as const

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!
}

function formatYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDaysYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00`)
  d.setDate(d.getDate() + days)
  return formatYmd(d)
}

function buildDateList(start: string, end: string): string[] {
  if (!start || !end || start > end) return []
  const list: string[] = []
  let cur = new Date(`${start}T00:00:00`)
  const last = new Date(`${end}T00:00:00`)
  while (cur <= last) {
    list.push(
      `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`,
    )
    cur.setDate(cur.getDate() + 1)
  }
  return list
}

/** 仅展示预测条件中的起止日期（不根据数据再扩展列） */
export function dateColumnsForMockQuery(filterStart: string, filterEnd: string): string[] {
  return buildDateList(filterStart, filterEnd)
}

/** 当年 3 月 15 日 ～ 今天（含）之间随机一天 */
function randomPredictionYmd(): string {
  const now = new Date()
  const y = now.getFullYear()
  const start = new Date(y, 2, 15)
  const end = new Date(y, now.getMonth(), now.getDate())
  if (end < start) return formatYmd(end)
  const diffDays = Math.round((end.getTime() - start.getTime()) / 86400000)
  const d = new Date(start)
  d.setDate(d.getDate() + Math.floor(Math.random() * (diffDays + 1)))
  return formatYmd(d)
}

/**
 * 合同号：金利 JL + 月日(如325) + 三位序号；豫光 YG + 月日 + 三位序号
 * 月日：月份不补零 + 日期两位，与 prediction_date 一致
 */
function buildContractNo(
  company: '金利' | '豫光',
  predictionYmd: string,
  seqCounters: Map<string, number>,
): string {
  const prefix = company === '金利' ? 'JL' : 'YG'
  const d = new Date(`${predictionYmd}T12:00:00`)
  const month = d.getMonth() + 1
  const day = d.getDate()
  const md = `${month}${String(day).padStart(2, '0')}`
  const key = `${prefix}-${predictionYmd}`
  const next = (seqCounters.get(key) ?? 0) + 1
  seqCounters.set(key, next)
  return `${prefix}${md}${String(next).padStart(3, '0')}`
}

/** 生成指定条数的模拟记录（每条 truck_count ∈ [1,20]，data_long < truck_count） */
export function generatePurchaseMockRecords(count: number): PurchaseMockRecord[] {
  const seqCounters = new Map<string, number>()
  const created = formatYmd(new Date())
  const out: PurchaseMockRecord[] = []

  for (let i = 0; i < count; i++) {
    const smelter_company = Math.random() < 0.5 ? '金利' : '豫光'
    const prediction_date = randomPredictionYmd()
    const truck_count = 1 + Math.floor(Math.random() * 20)
    const data_long = Math.floor(Math.random() * truck_count)
    const regional_manager = pick(MANAGERS)
    const warehouse_name = pick(MANAGERS)
    const contract_no = buildContractNo(smelter_company, prediction_date, seqCounters)
    const delivery_date = addDaysYmd(prediction_date, 2)
    const completeAfter = 1 + Math.floor(Math.random() * 14)
    const completion_date = addDaysYmd(prediction_date, completeAfter)

    out.push({
      regional_manager,
      warehouse_name,
      prediction_date,
      completion_date,
      contract_no,
      smelter_company,
      delivery_date,
      truck_count,
      created_at: created,
      data_long,
    })
  }

  return out
}

export type MockTableCell = { text: string; isPlaceholder?: boolean }

/** 是否在可见日期列中至少有一天分配车数 > 0（用于隐藏区间内全无车数的行） */
export function rowHasTruckInColumns(row: { cells: MockTableCell[] }): boolean {
  return row.cells.some((c) => {
    if (c.isPlaceholder) return false
    const n = Number(String(c.text).trim())
    return !Number.isNaN(n) && n > 0
  })
}

export type MockTableRow = {
  regional_manager: string
  smelter: string
  contract_no: string
  completion_date: string
  /** 用于调试/对齐 */
  prediction_date: string
  cells: MockTableCell[]
}

/** 将车数 total 均分为 n 份（整数，总和为 total） */
function splitIntegerEvenly(total: number, n: number): number[] {
  if (n <= 0) return []
  if (total <= 0) return Array.from({ length: n }, () => 0)
  const base = Math.floor(total / n)
  const rem = total % n
  return Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0))
}

/**
 * 以该条记录的 prediction_date 为第 1 天，到 completion_date（含）为止，将 truck_count 均分到每一天；
 * 再按 dateColumns 输出对应列（无关日期为 —）。
 */
function cellsForDistributedTrucks(
  dateColumns: string[],
  predictionDate: string,
  completionDate: string,
  truckCount: number,
): MockTableCell[] {
  let start = predictionDate
  let end = completionDate
  if (end < start) {
    end = start
  }
  const distDays = buildDateList(start, end)
  const n = distDays.length
  if (n === 0) {
    return dateColumns.map(() => ({ text: '—', isPlaceholder: true }))
  }
  const parts = splitIntegerEvenly(truckCount, n)
  const valueByDate = new Map<string, number>()
  distDays.forEach((d, i) => valueByDate.set(d, parts[i] ?? 0))

  return dateColumns.map((d) => {
    const v = valueByDate.get(d)
    if (v === undefined || v === 0) return { text: '—', isPlaceholder: true }
    return { text: String(v) }
  })
}

export function mockRecordsToTableRows(
  records: PurchaseMockRecord[],
  dateColumns: string[],
): MockTableRow[] {
  return records.map((r) => ({
    regional_manager: r.regional_manager,
    smelter: r.smelter_company,
    contract_no: r.contract_no,
    completion_date: r.completion_date,
    prediction_date: r.prediction_date,
    cells: cellsForDistributedTrucks(
      dateColumns,
      r.prediction_date,
      r.completion_date,
      r.truck_count,
    ),
  }))
}
