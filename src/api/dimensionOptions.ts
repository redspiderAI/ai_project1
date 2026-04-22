import axios from 'axios'
import { ApiPaths } from './paths'

export type DimensionOptions = {
  regional_managers: string[]
  warehouses: string[]
  smelters: string[]
  /** 部分接口可能返回品种；无则为空数组 */
  product_varieties: string[]
}

function asSortedUniqueStrings(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  const seen = new Set<string>()
  for (const x of v) {
    if (x == null) continue
    const s = String(x).trim()
    if (s) seen.add(s)
  }
  return [...seen].sort((a, b) => a.localeCompare(b, 'zh-CN'))
}

function pickLists(obj: Record<string, unknown>): DimensionOptions {
  const rm =
    obj.regional_managers ??
    obj.regionalManagers ??
    obj.managers ??
    obj.regional_manager_list
  const wh = obj.warehouses ?? obj.warehouse_list ?? obj.warehouse
  const sm = obj.smelters ?? obj.smelter_list ?? obj.smelter
  const pv =
    obj.product_varieties ??
    obj.productVarieties ??
    obj.varieties ??
    obj.variety_list ??
    obj.product_variety_list
  return {
    regional_managers: asSortedUniqueStrings(rm),
    warehouses: asSortedUniqueStrings(wh),
    smelters: asSortedUniqueStrings(sm),
    product_varieties: asSortedUniqueStrings(pv),
  }
}

export function parseDimensionOptionsResponse(data: unknown): DimensionOptions {
  if (data && typeof data === 'object') {
    const o = data as Record<string, unknown>
    const inner = o.data
    if (inner && typeof inner === 'object') return pickLists(inner as Record<string, unknown>)
    return pickLists(o)
  }
  return { regional_managers: [], warehouses: [], smelters: [], product_varieties: [] }
}

export async function fetchDeliveryHistoryDimensionOptions(): Promise<DimensionOptions> {
  const { data } = await axios.get(ApiPaths.deliveryHistoryDimensionOptions)
  return parseDimensionOptionsResponse(data)
}

export async function fetchForecastDimensionOptions(): Promise<DimensionOptions> {
  const { data } = await axios.get(ApiPaths.forecastDimensionOptions)
  return parseDimensionOptionsResponse(data)
}

/** 已落库智能预测明细的维度（当前页面未使用时可作后续接入） */
export async function fetchPredictDimensionOptions(): Promise<DimensionOptions> {
  const { data } = await axios.get(ApiPaths.predictDimensionOptions)
  return parseDimensionOptionsResponse(data)
}
