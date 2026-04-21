<template>
  <div class="emap-shell">
    <div class="emap-toolbar card shadow-sm">
      <div class="emap-toolbar-row">
        <div class="emap-toolbar-main">
          <span class="emap-title">
            <i class="bi bi-map"></i>
            库房 / 冶炼厂分布
          </span>
          <span class="emap-toolbar-hint text-muted small"
            >库房与冶炼厂均由接口加载。请先在下方选择<strong>比价类型</strong>并为品类填写<strong>吨数</strong>（至少一项
            &gt; 0），再点击库房进行比价并绘制流向箭头。</span
          >
        </div>
        <div class="emap-toolbar-actions">
          <div class="emap-field">
            <label class="emap-field-label" for="emap-comparison-type">比价类型</label>
            <select
              id="emap-comparison-type"
              v-model="comparisonType"
              class="form-select form-select-sm emap-select"
            >
              <option value="base">基准价比价</option>
              <option value="tax3">3%含税价比价</option>
            </select>
          </div>
          <button type="button" class="btn btn-sm btn-primary" :disabled="loading" @click="loadAndPlot">
            <span v-if="loading" class="spinner-border spinner-border-sm me-1" role="status" />
            {{ loading ? '加载中…' : '刷新数据' }}
          </button>
        </div>
      </div>
      <div class="emap-toolbar-row emap-toolbar-row--categories">
        <div class="emap-cat-toolbar">
          <div class="emap-cat-toolbar-head">
            <span class="emap-field-label">回收品类（吨）</span>
            <span v-if="categoriesLoading" class="text-muted small">加载中…</span>
            <span v-else-if="categoriesError" class="emap-cat-toolbar-err small">{{ categoriesError }}</span>
            <span v-else class="text-muted small">勾选品类并填写吨数，至少一项 &gt; 0</span>
          </div>
          <div v-if="categories.length" class="emap-cat-toolbar-list">
            <label v-for="c in categories" :key="c.id" class="emap-cat-pill">
              <input v-model="categoryPrefs[c.id].selected" type="checkbox" class="form-check-input" />
              <span class="emap-cat-name">{{ c.name }}</span>
              <input
                v-model="categoryPrefs[c.id].tons"
                type="number"
                min="0"
                step="0.01"
                class="form-control form-control-sm emap-cat-tons"
                placeholder="吨"
                :disabled="!categoryPrefs[c.id].selected"
              />
            </label>
          </div>
          <div v-else-if="!categoriesLoading && !categoriesError" class="text-muted small">
            暂无品类，请稍后刷新或检查接口。
          </div>
        </div>
      </div>
    </div>
    <div ref="mapWrapRef" class="emap-map-wrap">
      <div ref="mapElRef" class="emap-map" />
      <div class="emap-side-card">
        <div class="emap-side-title">地图联动</div>
        <template v-if="selectedWarehouse">
          <div class="emap-side-line"><strong>已选库房：</strong>{{ selectedWarehouse.title }}</div>
          <div class="emap-side-line text-muted">{{ selectedWarehouse.subtitle }}</div>
          <div class="emap-side-actions">
            <button
              type="button"
              class="btn btn-sm btn-outline-primary"
              :disabled="compareLoading"
              @click="runComparisonForWarehouse(selectedWarehouse)"
            >
              {{ compareLoading ? '比价中…' : '重新比价' }}
            </button>
            <button
              type="button"
              class="btn btn-sm btn-outline-success"
              :disabled="forecastLoading"
              @click="runForecastForWarehouse(selectedWarehouse)"
            >
              {{ forecastLoading ? '预测中…' : '预测送货量' }}
            </button>
          </div>
          <div v-if="comparisonRanks.length" class="emap-side-block">
            <div class="emap-side-subtitle">
              冶炼厂利润排行
              <span v-if="lastComparisonSortKey" class="text-muted fw-normal">（{{ lastComparisonSortKey }}）</span>
            </div>
            <div class="emap-rank-scroll">
              <div
                v-for="item in comparisonRanks"
                :key="`${item.rank}-${item.smelter}`"
                class="emap-rank-item"
              >
                <span>#{{ item.rank }} {{ item.smelter }}</span>
                <span class="text-success">净收益 {{ formatNum(item.netProfit) }}</span>
              </div>
            </div>
          </div>
          <div v-if="forecastText" class="emap-side-block">
            <div class="emap-side-subtitle">预测结果</div>
            <div>{{ forecastText }}</div>
          </div>
        </template>
        <div v-else class="text-muted">点击业务库房点位，将按当前比价类型与品类吨数自动比价，并绘制指向冶炼厂的箭头。</div>
        <div v-if="compareError" class="emap-side-error">{{ compareError }}</div>
      </div>
      <div class="emap-legend">
        <span class="emap-legend-item"
          ><span class="emap-legend-dot emap-legend-dot--wh"></span> 库房（随类型颜色）</span
        >
        <span class="emap-legend-item"
          ><span class="emap-legend-tri"></span> 冶炼厂（接口）</span
        >
      </div>
    </div>
    <div v-if="loadError" class="alert alert-warning m-3 mb-0" role="alert">{{ loadError }}</div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'
import {
  fetchForecastDetail,
  fetchTlCategories,
  fetchTlSmeltersAll,
  fetchTlWarehouseTypes,
  fetchTlWarehousesAll,
  postTlGetComparison,
  tlUnwrapComparisonDetails,
  type TlCategoryRow,
} from '../api/tlApi'

type MapPoint = {
  kind: 'warehouse' | 'smelter'
  id: string
  title: string
  subtitle: string
  lat: number
  lng: number
  /** 库房：与列表一致的颜色 */
  pinColor?: string
  raw: Record<string, unknown>
}

type ComparisonRankItem = {
  rank: number
  smelter: string
  netProfit: number
  totalRecovery: number
  freightPerTon: number
  qtySum: number
}

const GAODE_TILE =
  'https://webrd01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}'

const DEFAULT_WAREHOUSE_COLOR = '#2563eb'
const MAX_MAP_FLOW_TARGETS = 30

const mapWrapRef = ref<HTMLElement | null>(null)
const mapElRef = ref<HTMLElement | null>(null)
const mapRef = shallowRef<L.Map | null>(null)
const markerLayerRef = shallowRef<L.LayerGroup | null>(null)
const flowLayerRef = shallowRef<L.LayerGroup | null>(null)
const topTipLayerRef = shallowRef<L.LayerGroup | null>(null)
const loading = ref(false)
const loadError = ref('')
const categories = ref<TlCategoryRow[]>([])
const categoriesLoading = ref(false)
const categoriesError = ref('')

function ensureCategoryPrefsForList(list: TlCategoryRow[]) {
  for (const c of list) {
    if (categoryPrefs[c.id] === undefined) {
      categoryPrefs[c.id] = { selected: true, tons: '0' }
    }
  }
}

watch(
  categories,
  (list) => {
    ensureCategoryPrefsForList(list)
  },
  { deep: true, immediate: true },
)
const compareLoading = ref(false)
const forecastLoading = ref(false)
const compareError = ref('')
const forecastText = ref('')
const selectedWarehouse = ref<MapPoint | null>(null)
const comparisonType = ref<'base' | 'tax3'>('base')
/** 与品类 id 对应：默认全选、吨数默认 1（与智能比价一致可改） */
const categoryPrefs = reactive<Record<number, { selected: boolean; tons: string }>>({})
const comparisonRanks = ref<ComparisonRankItem[]>([])
const lastComparisonSortKey = ref('')
const allWarehousePoints = ref<MapPoint[]>([])
const allSmelterPoints = ref<MapPoint[]>([])

let resizeObs: ResizeObserver | null = null

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl
L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl })

function pickStr(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = row[k]
    if (v != null && String(v).trim() !== '') return String(v).trim()
  }
  return ''
}

function pickNumber(row: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const v = row[k]
    if (v == null || v === '') continue
    const n = Number(v)
    if (!Number.isNaN(n)) return n
  }
  return null
}

function pickLatLng(row: Record<string, unknown>): [number, number] | null {
  const lat =
    pickNumber(row, ['latitude', 'lat', 'gcj02_lat', 'Latitude', 'LAT', 'y']) ??
    pickNumber(row, ['纬度'])
  const lng =
    pickNumber(row, ['longitude', 'lng', 'lon', 'gcj02_lng', 'Longitude', 'LNG', 'x']) ??
    pickNumber(row, ['经度'])
  if (lat == null || lng == null) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return [lat, lng]
}

function warehouseLabel(row: Record<string, unknown>): string {
  return pickStr(row, ['仓库名', 'warehouse_name', 'name', '仓库', '库房名', 'title'])
}

function smelterLabel(row: Record<string, unknown>): string {
  return pickStr(row, ['冶炼厂名', 'factory_name', 'name', '冶炼厂', '厂名', 'title'])
}

function warehouseId(row: Record<string, unknown>): string {
  const id = pickStr(row, ['仓库id', 'warehouse_id', 'id', 'warehouseId'])
  return id || warehouseLabel(row) || newId()
}

function smelterId(row: Record<string, unknown>): string {
  const id = pickStr(row, ['冶炼厂id', 'factory_id', 'smelter_id', 'id', 'smelterId'])
  return id || smelterLabel(row) || newId()
}

function newId(): string {
  const c = globalThis.crypto as Crypto | undefined
  if (c?.randomUUID) return c.randomUUID()
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function addressText(row: Record<string, unknown>): string {
  return pickStr(row, [
    '地址',
    '库房地址',
    '仓库地址',
    'address',
    'warehouse_address',
    'WarehouseAddress',
    'detail_address',
    '详细地址',
    'addr',
    'location',
    '省市区',
    'region',
  ])
}

/** 仅允许安全子集，防止样式注入 */
function safeCssColor(raw: string, fallback: string): string {
  const s = raw.trim()
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(s)) return s
  if (/^rgba?\(\s*[\d.\s%,]+\)$/i.test(s) && s.length <= 80) return s
  if (/^hsla?\(\s*[\d.\s%,deg]+\)$/i.test(s) && s.length <= 80) return s
  return fallback
}

function buildTypeColorMap(types: Record<string, unknown>[]): Map<number, string> {
  const m = new Map<number, string>()
  for (const t of types) {
    const id = pickNumber(t, ['类型id', 'id', 'type_id', '类型ID'])
    const c = pickStr(t, ['颜色配置', '库房类型颜色配置', 'color', '颜色', 'color_config'])
    if (id == null || !c) continue
    m.set(id, safeCssColor(c, DEFAULT_WAREHOUSE_COLOR))
  }
  return m
}

/** 地图图钉颜色：优先后端「颜色配置」；不用「库房类型颜色配置」打点（该字段仅用于弹窗内「类型」文案） */
function resolveWarehousePinColor(
  row: Record<string, unknown>,
  typeColorById: Map<number, string>,
): string {
  const main = pickStr(row, ['颜色配置'])
  if (main) return safeCssColor(main, DEFAULT_WAREHOUSE_COLOR)

  const whColorObj = row['仓库颜色配置']
  if (whColorObj != null && typeof whColorObj === 'object' && !Array.isArray(whColorObj)) {
    const marker = (whColorObj as { marker?: unknown }).marker
    if (marker != null && String(marker).trim() !== '') {
      return safeCssColor(String(marker).trim(), DEFAULT_WAREHOUSE_COLOR)
    }
  }
  const own = pickStr(row, ['仓库颜色配置', 'color', '颜色', 'color_config'])
  if (own) return safeCssColor(own, DEFAULT_WAREHOUSE_COLOR)
  const tid = pickNumber(row, ['仓库类型id', 'warehouse_type_id', 'type_id', '类型id'])
  if (tid != null && typeColorById.has(tid)) return typeColorById.get(tid)!
  return DEFAULT_WAREHOUSE_COLOR
}

/** 库房弹窗 HTML：「类型」用「库房类型颜色配置」着色 */
function warehousePopupHtml(p: MapPoint): string {
  const row = p.raw
  const typeName = pickStr(row, ['类型', 'type', 'warehouse_type_name', '类型名'])
  const typeColorRaw = pickStr(row, ['库房类型颜色配置', '类型颜色配置'])
  const typeColor = typeColorRaw
    ? safeCssColor(typeColorRaw, '#4b5563')
    : '#4b5563'
  const typeBlock =
    typeName !== ''
      ? `<div class="emap-popup-type"><span class="emap-popup-type-label">类型：</span><span class="emap-popup-type-value" style="color:${escapeHtml(
          typeColor,
        )}">${escapeHtml(typeName)}</span></div>`
      : ''
  return `<div class="emap-popup emap-popup--warehouse"><strong>${escapeHtml(p.title)}</strong><br/>${typeBlock}<span class="text-muted small">${escapeHtml(
    p.subtitle,
  )}</span></div>`
}

function initMap() {
  const el = mapElRef.value
  if (!el || mapRef.value) return

  const map = L.map(el, {
    zoomControl: true,
    preferCanvas: true,
  }).setView([32.12, 118.78], 5)

  L.tileLayer(GAODE_TILE, {
    attribution: '&copy; 高德地图',
    maxZoom: 18,
    minZoom: 3,
  }).addTo(map)

  const markerLayer = L.layerGroup().addTo(map)
  const flowLayer = L.layerGroup().addTo(map)
  const topTipLayer = L.layerGroup().addTo(map)
  mapRef.value = map
  markerLayerRef.value = markerLayer
  flowLayerRef.value = flowLayer
  topTipLayerRef.value = topTipLayer

  if (mapWrapRef.value) {
    resizeObs = new ResizeObserver(() => {
      map.invalidateSize()
    })
    resizeObs.observe(mapWrapRef.value)
  }
}

function warehouseIcon(cssColor: string): L.DivIcon {
  const bg = safeCssColor(cssColor, DEFAULT_WAREHOUSE_COLOR)
  return L.divIcon({
    className: 'emap-marker emap-marker--warehouse',
    html: `<div class="emap-pin-inner" style="background:${bg};"></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
    popupAnchor: [0, -24],
  })
}

function smelterIcon(): L.DivIcon {
  return L.divIcon({
    className: 'emap-marker emap-marker--smelter',
    html: '<div class="emap-smelter-tri" aria-hidden="true"></div>',
    iconSize: [22, 20],
    iconAnchor: [11, 20],
    popupAnchor: [0, -20],
  })
}

function renderMarkers(points: MapPoint[]) {
  const map = mapRef.value
  const markerLayer = markerLayerRef.value
  if (!map || !markerLayer) return
  markerLayer.clearLayers()
  clearComparisonOverlays()

  allWarehousePoints.value = points.filter((p) => p.kind === 'warehouse')
  allSmelterPoints.value = points.filter((p) => p.kind === 'smelter')
  for (const p of points) {
    const icon =
      p.kind === 'warehouse' ? warehouseIcon(p.pinColor ?? DEFAULT_WAREHOUSE_COLOR) : smelterIcon()
    const marker = L.marker([p.lat, p.lng], { icon })
    const popupHtml =
      p.kind === 'warehouse' ? warehousePopupHtml(p) : `<div class="emap-popup"><strong>${escapeHtml(p.title)}</strong><br/><span class="text-muted small">${escapeHtml(p.subtitle)}</span></div>`
    marker.bindPopup(popupHtml)
    if (p.kind === 'warehouse') {
      marker.on('click', () => {
        selectedWarehouse.value = p
        forecastText.value = ''
        void runComparisonForWarehouse(p)
      })
    }
    marker.addTo(markerLayer)
  }

  const bounds = L.latLngBounds([])
  for (const p of points) bounds.extend([p.lat, p.lng])
  if (bounds.isValid()) {
    map.fitBounds(bounds.pad(0.12), { maxZoom: 14, animate: true })
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function activeRow(row: Record<string, unknown>): boolean {
  const st = row.status ?? row['状态']
  if (st === 0 || st === '0') return false
  const v = row.is_active ?? row.isActive ?? row.active
  if (v === false || v === 0 || v === '0') return false
  return true
}

function toDisplayNum(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

function formatNum(n: number): string {
  return toDisplayNum(n).toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}

function clearComparisonOverlays() {
  flowLayerRef.value?.clearLayers()
  topTipLayerRef.value?.clearLayers()
  comparisonRanks.value = []
  lastComparisonSortKey.value = ''
  compareError.value = ''
}

function getSelectedCategoryPayload(): { ids: number[]; totalTons: number } {
  const ids: number[] = []
  let totalTons = 0
  for (const c of categories.value) {
    const pref = categoryPrefs[c.id]
    if (!pref?.selected) continue
    const t = parseFloat(String(pref.tons ?? '').replace(/,/g, ''))
    if (Number.isFinite(t) && t > 0) {
      ids.push(c.id)
      totalTons += t
    }
  }
  return { ids, totalTons }
}

/** 与嵌入页智能比价相同字段（中文键名） */
function buildSmartComparisonBody(
  warehouseId: number,
  smelterIds: number[],
  categoryIds: number[],
  totalTons: number,
  priceMode: 'base' | 'tax3',
): Record<string, unknown> {
  const isTax3 = priceMode === 'tax3'
  return {
    选中仓库id列表: [warehouseId],
    冶炼厂id列表: smelterIds,
    品类id列表: categoryIds,
    price_type: isTax3 ? '3pct' : null,
    吨数: totalTons,
    运费计价方式: 'per_ton',
    每车吨数: 35,
    最优价计税口径列表: isTax3 ? ['3pct'] : ['base'],
    最优价排序口径: isTax3 ? '3pct' : 'base',
  }
}

function bearingDeg(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δλ = ((lng2 - lng1) * Math.PI) / 180
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  return (Math.atan2(y, x) * 180) / Math.PI
}

function pointAlongFrac(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  t: number,
): [number, number] {
  return [lat1 + (lat2 - lat1) * t, lng1 + (lng2 - lng1) * t]
}

function parseSmelterProfitRankArray(arr: unknown): ComparisonRankItem[] {
  if (!Array.isArray(arr)) return []
  const out: ComparisonRankItem[] = []
  let fallback = 0
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const smelter = pickStr(row, [
      '冶炼厂',
      'smelter',
      'smelter_name',
      '冶炼厂名',
      'factory_name',
      'name',
      '厂名',
    ])
    if (!smelter) continue
    fallback += 1
    const rank = pickNumber(row, ['rank', '名次', '排序', '排行', '排名']) ?? fallback
    const netProfit =
      pickNumber(row, ['净收益', 'profit', '净利润', '收益', 'net_profit', '总利润', '利润']) ?? 0
    const totalRecovery =
      pickNumber(row, ['回收额', 'totalRecovery', 'materialSum', '物料总价', 'total_recovery']) ?? 0
    const freightPerTon =
      pickNumber(row, ['运费单价', 'freightPerTon', 'freight_per_ton', '运费每吨']) ?? 0
    const qtySum = pickNumber(row, ['吨数', 'quantity', 'qtySum', 'qty', '需求吨数']) ?? 0
    out.push({
      rank,
      smelter,
      netProfit: toDisplayNum(netProfit),
      totalRecovery: toDisplayNum(totalRecovery),
      freightPerTon: toDisplayNum(freightPerTon),
      qtySum: toDisplayNum(qtySum),
    })
  }
  return out.sort((a, b) => a.rank - b.rank)
}

function rankingsFromComparisonResponse(
  raw: Record<string, unknown>,
  detailRows: Record<string, unknown>[],
): ComparisonRankItem[] {
  const fromApi = parseSmelterProfitRankArray(raw['冶炼厂利润排行'])
  if (fromApi.length) return rerankSequentially(fromApi)
  return aggregateComparisonRows(detailRows)
}

/** 后端若已带 rank，仍按排序重编号，避免间断 */
function rerankSequentially(items: ComparisonRankItem[]): ComparisonRankItem[] {
  const sorted = [...items].sort((a, b) => a.rank - b.rank || b.netProfit - a.netProfit)
  return sorted.map((x, i) => ({ ...x, rank: i + 1 }))
}

function aggregateComparisonRows(rows: Record<string, unknown>[]): ComparisonRankItem[] {
  const grouped = new Map<
    string,
    { smelter: string; materialSum: number; freightSum: number; freightCount: number; qtySum: number }
  >()
  for (const row of rows) {
    const smelter =
      pickStr(row, ['smelter_name', '冶炼厂', '冶炼厂名', 'smelter', 'factory_name']) || '未知冶炼厂'
    const unitPrice =
      pickNumber(row, ['unit_price', '最优价', '价格', 'price', 'base_price', '不含税价', '3pct_price']) ??
      0
    const freight =
      pickNumber(row, ['freight_per_ton', '运费', '运费单价', 'freight', '运费每吨']) ?? 0
    const qty = pickNumber(row, ['quantity', '吨数', '数量', 'qty', 'weight', '需求吨数']) ?? 1
    const key = smelter
    if (!grouped.has(key)) {
      grouped.set(key, { smelter, materialSum: 0, freightSum: 0, freightCount: 0, qtySum: 0 })
    }
    const g = grouped.get(key)!
    g.materialSum += unitPrice * Math.max(0, qty)
    g.freightSum += freight
    g.freightCount += 1
    g.qtySum += Math.max(0, qty)
  }
  return [...grouped.values()]
    .map((g) => {
      const freightPerTon = g.freightCount > 0 ? g.freightSum / g.freightCount : 0
      const netProfit = g.materialSum - freightPerTon * g.qtySum
      return {
        smelter: g.smelter,
        netProfit: toDisplayNum(netProfit),
        totalRecovery: toDisplayNum(g.materialSum),
        freightPerTon: toDisplayNum(freightPerTon),
        qtySum: toDisplayNum(g.qtySum),
      }
    })
    .sort((a, b) => b.netProfit - a.netProfit)
    .map((x, idx) => ({ ...x, rank: idx + 1 }))
}

function findSmelterPoint(name: string): MapPoint | null {
  const exact = allSmelterPoints.value.find((x) => x.title === name)
  if (exact) return exact
  const loose = allSmelterPoints.value.find(
    (x) => x.title.includes(name) || name.includes(x.title),
  )
  return loose ?? null
}

function renderComparisonOverlay(warehouse: MapPoint, ranks: ComparisonRankItem[]) {
  const flowLayer = flowLayerRef.value
  const tipLayer = topTipLayerRef.value
  if (!flowLayer || !tipLayer) return
  flowLayer.clearLayers()
  tipLayer.clearLayers()
  const palette = ['#2563eb', '#7c3aed', '#db2777', '#ea580c', '#059669', '#0ea5e9']
  const list = ranks.slice(0, MAX_MAP_FLOW_TARGETS)
  for (let i = 0; i < list.length; i++) {
    const row = list[i]!
    const smelter = findSmelterPoint(row.smelter)
    if (!smelter) continue
    const color = palette[i % palette.length]!
    L.polyline(
      [
        [warehouse.lat, warehouse.lng],
        [smelter.lat, smelter.lng],
      ],
      {
        color,
        weight: 3,
        opacity: 0.88,
        dashArray: '10 10',
        className: 'emap-flow-line',
      },
    ).addTo(flowLayer)
    const br = bearingDeg(warehouse.lat, warehouse.lng, smelter.lat, smelter.lng)
    const arrowPt = pointAlongFrac(warehouse.lat, warehouse.lng, smelter.lat, smelter.lng, 0.82)
    L.marker(arrowPt, {
      icon: L.divIcon({
        className: 'emap-flow-arrow-wrap',
        html: `<div class="emap-flow-arrow" style="color:${color};transform:rotate(${br - 90}deg)">▶</div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      }),
      interactive: false,
    }).addTo(flowLayer)
    L.tooltip({
      permanent: true,
      direction: 'top',
      offset: [0, -8],
      className: 'emap-rank-tip',
    })
      .setLatLng([smelter.lat, smelter.lng])
      .setContent(
        `#${row.rank} ${escapeHtml(row.smelter)}<br/>净收益: ${formatNum(row.netProfit)}<br/>回收额: ${formatNum(row.totalRecovery)}<br/>运费/吨: ${formatNum(row.freightPerTon)}`,
      )
      .addTo(tipLayer)
  }
}

async function runComparisonForWarehouse(warehouse: MapPoint) {
  compareLoading.value = true
  compareError.value = ''
  try {
    const whId = pickNumber(warehouse.raw, ['仓库id', 'warehouse_id', 'id'])
    if (whId == null) throw new Error('该库房缺少仓库id，无法自动比价')
    const smelterIds = allSmelterPoints.value
      .map((s) => pickNumber(s.raw, ['冶炼厂id', 'factory_id', 'smelter_id', 'id']))
      .filter((x): x is number => x != null)
    if (!smelterIds.length) throw new Error('暂无可比价的冶炼厂')

    const { ids: categoryIds, totalTons } = getSelectedCategoryPayload()
    if (!categoryIds.length || totalTons <= 0) {
      throw new Error('请至少勾选一个品类并填写大于 0 的吨数（单位：吨）')
    }

    const body = buildSmartComparisonBody(
      whId,
      smelterIds,
      categoryIds,
      totalTons,
      comparisonType.value,
    )
    const raw = await postTlGetComparison(body)
    const sortKey = raw['最优价排序口径']
    lastComparisonSortKey.value =
      sortKey != null && String(sortKey).trim() !== '' ? String(sortKey).trim() : ''
    const detailRows = tlUnwrapComparisonDetails(raw)
    const ranks = rankingsFromComparisonResponse(raw, detailRows)
    comparisonRanks.value = ranks
    renderComparisonOverlay(warehouse, ranks)
  } catch (err) {
    clearComparisonOverlays()
    compareError.value = err instanceof Error ? err.message : String(err)
  } finally {
    compareLoading.value = false
  }
}

async function runForecastForWarehouse(warehouse: MapPoint) {
  forecastLoading.value = true
  forecastText.value = ''
  try {
    const rows = await fetchForecastDetail({
      warehouses: [warehouse.title],
      page: 1,
      page_size: 200,
    })
    if (!rows.length) {
      forecastText.value = '当前库房暂无可用预测明细。'
      return
    }
    const byDate = new Map<string, number>()
    for (const row of rows) {
      const d = pickStr(row, ['target_date', '预测日期', 'date']) || '未知日期'
      const w = pickNumber(row, ['predicted_weight', '预测重量', 'weight']) ?? 0
      byDate.set(d, (byDate.get(d) || 0) + w)
    }
    const sorted = [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0], 'zh-CN'))
    const total = sorted.reduce((sum, [, weight]) => sum + weight, 0)
    const preview = sorted
      .slice(0, 3)
      .map(([d, w]) => `${d}: ${formatNum(w)}吨`)
      .join('；')
    forecastText.value = `合计预测 ${formatNum(total)} 吨（${sorted.length} 天）。${preview}`
  } catch (err) {
    forecastText.value = err instanceof Error ? err.message : String(err)
  } finally {
    forecastLoading.value = false
  }
}

async function loadCategories() {
  categoriesError.value = ''
  categoriesLoading.value = true
  try {
    categories.value = await fetchTlCategories()
    ensureCategoryPrefsForList(categories.value)
  } catch (e) {
    categories.value = []
    categoriesError.value = e instanceof Error ? e.message : String(e)
  } finally {
    categoriesLoading.value = false
  }
}

async function loadAndPlot() {
  loadError.value = ''
  loading.value = true
  void loadCategories()
  try {
    const [whRows, smRows] = await Promise.all([fetchTlWarehousesAll(), fetchTlSmeltersAll()])
    let typeRows: Record<string, unknown>[] = []
    try {
      typeRows = await fetchTlWarehouseTypes(false)
    } catch {
      /* 类型接口不可用时仍可按库房记录上的颜色字段配色 */
    }
    const typeColorById = buildTypeColorMap(typeRows)

    const points: MapPoint[] = []

    for (const row of whRows) {
      if (!activeRow(row)) continue
      const title = warehouseLabel(row) || '库房'
      const id = warehouseId(row)
      const subtitle = [addressText(row), `id: ${id}`].filter(Boolean).join(' · ')
      const pinColor = resolveWarehousePinColor(row, typeColorById)
      const coord = pickLatLng(row)

      if (coord) {
        points.push({
          kind: 'warehouse',
          id,
          title,
          subtitle,
          lat: coord[0],
          lng: coord[1],
          pinColor,
          raw: row,
        })
      }
    }

    for (const row of smRows) {
      if (!activeRow(row)) continue
      const title = smelterLabel(row) || '冶炼厂'
      const id = smelterId(row)
      const subtitle = [addressText(row), `id: ${id}`].filter(Boolean).join(' · ')
      const coord = pickLatLng(row)

      if (coord) {
        points.push({ kind: 'smelter', id, title, subtitle, lat: coord[0], lng: coord[1], raw: row })
      }
    }

    if (!points.length) {
      loadError.value = '接口未返回可打点的库房或冶炼厂经纬度，请在业务系统补全坐标后刷新。'
    }
    renderMarkers(points)
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await nextTick()
  initMap()
  await loadAndPlot()
})

onBeforeUnmount(() => {
  resizeObs?.disconnect()
  resizeObs = null
  mapRef.value?.remove()
  mapRef.value = null
  markerLayerRef.value = null
  flowLayerRef.value = null
  topTipLayerRef.value = null
})
</script>

<style scoped>
.emap-shell {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 72px);
  min-height: 420px;
  background: #f3f4f6;
}

.emap-toolbar {
  margin: 12px 16px 0;
  padding: 12px 14px;
  border: none;
}

.emap-toolbar-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.emap-toolbar-row--categories {
  align-items: flex-start;
  margin-bottom: 0;
}

.emap-toolbar-actions {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  flex-shrink: 0;
}

.emap-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 140px;
}

.emap-field-label {
  font-size: 11px;
  font-weight: 600;
  color: #374151;
  margin: 0;
}

.emap-select {
  min-width: 132px;
}

.emap-cat-toolbar {
  flex: 1;
  min-width: 0;
}

.emap-cat-toolbar-head {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.emap-cat-toolbar-err {
  color: #b91c1c;
}

.emap-cat-toolbar-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  max-height: 120px;
  overflow-y: auto;
  padding: 4px 2px;
}

.emap-cat-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  padding: 4px 8px;
  border-radius: 8px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  font-size: 12px;
  cursor: pointer;
}

.emap-cat-pill .form-check-input {
  margin: 0;
  flex-shrink: 0;
}

.emap-cat-name {
  max-width: 8rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.emap-cat-tons {
  width: 4.5rem;
  flex-shrink: 0;
}

.emap-rank-scroll {
  max-height: 220px;
  overflow-y: auto;
  padding-right: 4px;
}

.emap-toolbar-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.emap-toolbar-hint {
  line-height: 1.45;
}

.emap-title {
  font-weight: 600;
  font-size: 15px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.emap-map-wrap {
  position: relative;
  flex: 1;
  min-height: 0;
  margin: 12px 16px 16px;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 8px 28px rgba(15, 23, 42, 0.12);
}

.emap-map {
  width: 100%;
  height: 100%;
  background: #dfe7ef;
}

.emap-side-card {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 1000;
  width: 340px;
  max-width: calc(100% - 24px);
  background: rgba(255, 255, 255, 0.96);
  border-radius: 10px;
  padding: 10px 12px;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.16);
  font-size: 12px;
}

.emap-side-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 6px;
}

.emap-side-line {
  margin-bottom: 6px;
  word-break: break-all;
}

.emap-side-actions {
  display: flex;
  gap: 8px;
  margin: 8px 0;
  flex-wrap: wrap;
}

.emap-side-block {
  margin-top: 8px;
}

.emap-side-subtitle {
  font-weight: 600;
  margin-bottom: 4px;
}

.emap-rank-item {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}

.emap-side-error {
  margin-top: 8px;
  color: #b91c1c;
}

.emap-legend {
  position: absolute;
  right: 12px;
  bottom: 12px;
  z-index: 1000;
  background: rgba(255, 255, 255, 0.92);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
}

.emap-legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.emap-legend-dot {
  width: 12px;
  height: 12px;
  border-radius: 50% 50% 50% 0;
  transform: rotate(-45deg);
  border: 1px solid #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.emap-legend-dot--wh {
  background: #2563eb;
}

.emap-legend-tri {
  width: 0;
  height: 0;
  border-left: 7px solid transparent;
  border-right: 7px solid transparent;
  border-bottom: 12px solid #c2410c;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2));
}

</style>

<style>
.emap-marker {
  background: transparent;
  border: none;
}
.emap-marker--warehouse .emap-pin-inner {
  width: 22px;
  height: 22px;
  border-radius: 50% 50% 50% 0;
  transform: rotate(-45deg);
  border: 2px solid #fff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
  margin: 2px;
}
.emap-marker--smelter .emap-smelter-tri {
  width: 0;
  height: 0;
  margin: 0 auto;
  border-left: 11px solid transparent;
  border-right: 11px solid transparent;
  border-bottom: 19px solid #c2410c;
  filter: drop-shadow(0 2px 5px rgba(0, 0, 0, 0.28));
}

.emap-popup strong {
  font-size: 14px;
}

.emap-popup--warehouse .emap-popup-type {
  margin: 6px 0;
  font-size: 13px;
  line-height: 1.45;
}

.emap-popup--warehouse .emap-popup-type-label {
  color: #6b7280;
  font-weight: 500;
}

.emap-popup--warehouse .emap-popup-type-value {
  font-weight: 600;
}

.emap-flow-line {
  stroke-dasharray: 10 10;
  animation: emap-flow 1s linear infinite;
}

.emap-flow-arrow-wrap {
  background: transparent;
  border: none;
}

.emap-flow-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  font-size: 11px;
  line-height: 1;
  font-weight: 700;
  text-shadow: 0 0 2px #fff, 0 0 2px #fff;
}

.emap-rank-tip {
  background: rgba(15, 23, 42, 0.88);
  color: #fff;
  border: none;
  border-radius: 6px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.25);
  font-size: 11px;
  line-height: 1.35;
  padding: 6px 8px;
}

@keyframes emap-flow {
  0% {
    stroke-dashoffset: 20;
  }
  100% {
    stroke-dashoffset: 0;
  }
}
</style>
