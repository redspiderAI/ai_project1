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
            >红色圆点为演示：10 处公开可查地址（5 冶炼厂 + 5 交割库），任意缩放均可见；点击可查看详情并放大。</span
          >
        </div>
        <button type="button" class="btn btn-sm btn-primary" :disabled="loading" @click="loadAndPlot">
          <span v-if="loading" class="spinner-border spinner-border-sm me-1" role="status" />
          {{ loading ? '加载中…' : '刷新数据' }}
        </button>
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
          <div v-if="comparisonTop3.length" class="emap-side-block">
            <div class="emap-side-subtitle">比价 Top3 冶炼厂</div>
            <div v-for="item in comparisonTop3" :key="`${item.rank}-${item.smelter}`" class="emap-rank-item">
              <span>#{{ item.rank }} {{ item.smelter }}</span>
              <span class="text-success">净收益 {{ formatNum(item.netProfit) }}</span>
            </div>
          </div>
          <div v-if="forecastText" class="emap-side-block">
            <div class="emap-side-subtitle">预测结果</div>
            <div>{{ forecastText }}</div>
          </div>
        </template>
        <div v-else class="text-muted">点击任意库房点位，自动执行比价并展示前 3 连线。</div>
        <div v-if="compareError" class="emap-side-error">{{ compareError }}</div>
      </div>
      <div class="emap-legend">
        <span class="emap-legend-item"
          ><span class="emap-legend-dot emap-legend-dot--wh"></span> 库房（随类型颜色）</span
        >
        <span class="emap-legend-item"
          ><span class="emap-legend-tri"></span> 冶炼厂（接口）</span
        >
        <span class="emap-legend-item"
          ><span class="emap-legend-dot emap-legend-dot--demo"></span> 演示（红圆点 · 固定大小）</span
        >
      </div>
      <div class="emap-categories-card" aria-label="品类列表">
        <div class="emap-categories-head">
          <span class="emap-categories-title">回收品类</span>
          <span v-if="categoriesLoading" class="emap-categories-status text-muted small">加载中…</span>
        </div>
        <div class="emap-categories-body">
          <div v-if="categoriesError" class="emap-categories-error small">{{ categoriesError }}</div>
          <ul v-else-if="categories.length" class="emap-categories-list list-unstyled mb-0">
            <li v-for="row in categories" :key="row.品类id" class="emap-categories-item">
              <span class="emap-categories-id">{{ row.品类id }}</span>
              <span class="emap-categories-name">{{ row.品类名 }}</span>
            </li>
          </ul>
          <div v-else class="text-muted small">暂无数据</div>
        </div>
      </div>
    </div>
    <div v-if="loadError" class="alert alert-warning m-3 mb-0" role="alert">{{ loadError }}</div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'
import {
  fetchForecastDetail,
  fetchT1Categories,
  fetchTlComparison,
  fetchTlSmelters,
  fetchTlWarehouses,
  fetchTlWarehouseTypes,
  type T1CategoryRow,
} from '../api/tlApi'
import { mapDemonstrationPoints } from '../data/mapDemonstrationPoints'

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

const mapWrapRef = ref<HTMLElement | null>(null)
const mapElRef = ref<HTMLElement | null>(null)
const mapRef = shallowRef<L.Map | null>(null)
const markerLayerRef = shallowRef<L.LayerGroup | null>(null)
const flowLayerRef = shallowRef<L.LayerGroup | null>(null)
const topTipLayerRef = shallowRef<L.LayerGroup | null>(null)
const demoCircleLayerRef = shallowRef<L.LayerGroup | null>(null)

const loading = ref(false)
const loadError = ref('')
const categories = ref<T1CategoryRow[]>([])
const categoriesLoading = ref(false)
const categoriesError = ref('')
const compareLoading = ref(false)
const forecastLoading = ref(false)
const compareError = ref('')
const forecastText = ref('')
const selectedWarehouse = ref<MapPoint | null>(null)
const comparisonTop3 = ref<ComparisonRankItem[]>([])
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

/** 与比价「库房列表」一致：优先库房自带颜色字段，否则按类型 id 查类型表 */
function resolveWarehousePinColor(
  row: Record<string, unknown>,
  typeColorById: Map<number, string>,
): string {
  const own = pickStr(row, ['颜色配置', '仓库颜色配置', '库房类型颜色配置', 'color', '颜色', 'color_config'])
  if (own) return safeCssColor(own, DEFAULT_WAREHOUSE_COLOR)
  const tid = pickNumber(row, ['仓库类型id', 'warehouse_type_id', 'type_id', '类型id'])
  if (tid != null && typeColorById.has(tid)) return typeColorById.get(tid)!
  return DEFAULT_WAREHOUSE_COLOR
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
  const demoCircleLayer = L.layerGroup().addTo(map)
  mapRef.value = map
  markerLayerRef.value = markerLayer
  flowLayerRef.value = flowLayer
  topTipLayerRef.value = topTipLayer
  demoCircleLayerRef.value = demoCircleLayer

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

function renderDemoCircleMarkers() {
  const map = mapRef.value
  const demoLayer = demoCircleLayerRef.value
  if (!map || !demoLayer) return
  demoLayer.clearLayers()

  for (const d of mapDemonstrationPoints) {
    const kindLabel = d.kind === 'smelter' ? '冶炼厂（演示）' : '仓库（演示）'
    const srcHtml = d.sourceUrl
      ? `<a href="${escapeHtml(d.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(
          d.sourceLabel,
        )}</a>`
      : escapeHtml(d.sourceLabel)

    const cm = L.circleMarker([d.lat, d.lng], {
      radius: 6,
      weight: 2,
      color: '#ffffff',
      fillColor: '#dc2626',
      fillOpacity: 0.95,
      pane: 'markerPane',
    })

    cm.bindPopup(
      `<div class="emap-popup emap-popup--demo"><strong>${escapeHtml(d.title)}</strong><br/>
      <span class="emap-popup-kind">${escapeHtml(kindLabel)}</span><br/>
      <div class="emap-popup-addr">${escapeHtml(d.address)}</div>
      <p class="emap-popup-note small mb-1">${escapeHtml(d.note)}</p>
      <div class="small text-muted">数据来源：${srcHtml}</div></div>`,
      { maxWidth: 300 },
    )

    cm.bindTooltip(escapeHtml(d.title), {
      direction: 'top',
      offset: [0, -10],
      className: 'emap-demo-tooltip',
    })

    cm.on('click', () => {
      const targetZoom = Math.max(map.getZoom(), 14)
      map.flyTo([d.lat, d.lng], targetZoom, { duration: 0.45 })
      window.setTimeout(() => cm.openPopup(), 480)
    })

    cm.addTo(demoLayer)
  }
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
    marker.bindPopup(
      `<div class="emap-popup"><strong>${escapeHtml(p.title)}</strong><br/><span class="text-muted small">${escapeHtml(
        p.subtitle,
      )}</span></div>`,
    )
    if (p.kind === 'warehouse') {
      marker.on('click', () => {
        selectedWarehouse.value = p
        forecastText.value = ''
        void runComparisonForWarehouse(p)
      })
    }
    marker.addTo(markerLayer)
  }

  renderDemoCircleMarkers()

  const bounds = L.latLngBounds([])
  for (const p of points) bounds.extend([p.lat, p.lng])
  for (const d of mapDemonstrationPoints) bounds.extend([d.lat, d.lng])
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
  comparisonTop3.value = []
  compareError.value = ''
}

function aggregateComparisonRows(rows: Record<string, unknown>[]): ComparisonRankItem[] {
  const grouped = new Map<
    string,
    { smelter: string; materialSum: number; freightSum: number; freightCount: number; qtySum: number }
  >()
  for (const row of rows) {
    const smelter = pickStr(row, ['冶炼厂', '冶炼厂名', 'smelter', 'factory_name']) || '未知冶炼厂'
    const unitPrice =
      pickNumber(row, ['最优价', '价格', 'price', 'base_price', '不含税价', '3pct_price']) ?? 0
    const freight =
      pickNumber(row, ['运费', '运费单价', 'freight', 'freight_per_ton', '运费每吨']) ?? 0
    const qty = pickNumber(row, ['吨数', '数量', 'qty', 'weight', '需求吨数']) ?? 1
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
    .map((g, idx) => {
      const freightPerTon = g.freightCount > 0 ? g.freightSum / g.freightCount : 0
      const netProfit = g.materialSum - freightPerTon * g.qtySum
      return {
        rank: idx + 1,
        smelter: g.smelter,
        netProfit: toDisplayNum(netProfit),
        totalRecovery: toDisplayNum(g.materialSum),
        freightPerTon: toDisplayNum(freightPerTon),
        qtySum: toDisplayNum(g.qtySum),
      }
    })
    .sort((a, b) => b.netProfit - a.netProfit)
    .slice(0, 3)
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

function renderComparisonOverlay(warehouse: MapPoint, top3: ComparisonRankItem[]) {
  const flowLayer = flowLayerRef.value
  const tipLayer = topTipLayerRef.value
  if (!flowLayer || !tipLayer) return
  flowLayer.clearLayers()
  tipLayer.clearLayers()
  for (const row of top3) {
    const smelter = findSmelterPoint(row.smelter)
    if (!smelter) continue
    L.polyline(
      [
        [warehouse.lat, warehouse.lng],
        [smelter.lat, smelter.lng],
      ],
      {
        color: '#2563eb',
        weight: 3,
        opacity: 0.9,
        dashArray: '10 10',
        className: 'emap-flow-line',
      },
    ).addTo(flowLayer)
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

    let categoryIds: number[] = []
    try {
      const categoryRaw = await fetchTlComparison({
        选中仓库id列表: [whId],
        冶炼厂id列表: smelterIds,
        品类id列表: [1],
        吨数: 1,
        运费计价方式: 'per_ton',
        每车吨数: 35,
        最优价计税口径列表: ['base'],
        最优价排序口径: 'base',
      })
      if (categoryRaw.length > 0) {
        const fromRows = [
          ...new Set(
            categoryRaw
              .map((r) => pickNumber(r, ['品类id', 'category_id', 'id']))
              .filter((x): x is number => x != null),
          ),
        ]
        categoryIds = fromRows
      }
    } catch {
      /* 兜底走固定品类 id */
    }
    if (!categoryIds.length) categoryIds = [1, 2, 3, 4, 5]

    const rows = await fetchTlComparison({
      选中仓库id列表: [whId],
      冶炼厂id列表: smelterIds,
      品类id列表: categoryIds,
      吨数: 35,
      运费计价方式: 'per_ton',
      每车吨数: 35,
      最优价计税口径列表: ['base'],
      最优价排序口径: 'base',
    })
    const top3 = aggregateComparisonRows(rows)
    comparisonTop3.value = top3
    renderComparisonOverlay(warehouse, top3)
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
    categories.value = await fetchT1Categories()
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
    const [whRows, smRows] = await Promise.all([fetchTlWarehouses(), fetchTlSmelters()])
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
      loadError.value =
        '接口未返回可打点的经纬度，已仅展示下方「红色圆点」演示数据；可在业务系统为库房/冶炼厂补全坐标后刷新。'
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
  demoCircleLayerRef.value = null
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

.emap-legend-dot--demo {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #dc2626;
  border: 2px solid #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  transform: none;
}

.emap-legend-tri {
  width: 0;
  height: 0;
  border-left: 7px solid transparent;
  border-right: 7px solid transparent;
  border-bottom: 12px solid #c2410c;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2));
}

.emap-categories-card {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 1000;
  width: 260px;
  height: 200px;
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.96);
  border-radius: 10px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.14);
  font-size: 12px;
}

.emap-categories-head {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  border-bottom: 1px solid #e5e7eb;
  background: #fafafa;
  border-radius: 10px 10px 0 0;
}

.emap-categories-title {
  font-weight: 600;
  font-size: 13px;
  color: #111827;
}

.emap-categories-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 6px 10px 8px;
}

.emap-categories-error {
  color: #b91c1c;
  line-height: 1.4;
}

.emap-categories-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.emap-categories-item {
  display: flex;
  align-items: baseline;
  gap: 8px;
  line-height: 1.35;
  padding: 2px 0;
  border-bottom: 1px dashed #f3f4f6;
}

.emap-categories-item:last-child {
  border-bottom: none;
}

.emap-categories-id {
  flex-shrink: 0;
  min-width: 2rem;
  font-variant-numeric: tabular-nums;
  color: #6b7280;
  font-size: 11px;
}

.emap-categories-name {
  color: #111827;
  word-break: break-all;
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

.emap-popup--demo .emap-popup-kind {
  display: inline-block;
  margin: 4px 0;
  padding: 2px 8px;
  border-radius: 4px;
  background: #fee2e2;
  color: #991b1b;
  font-size: 12px;
  font-weight: 600;
}

.emap-popup--demo .emap-popup-addr {
  margin: 6px 0;
  line-height: 1.45;
}

.emap-popup--demo .emap-popup-note {
  color: #4b5563;
  margin-bottom: 0;
}

.leaflet-tooltip.emap-demo-tooltip {
  padding: 6px 10px;
  font-weight: 600;
  font-size: 13px;
  color: #111827;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(220, 38, 38, 0.35);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.15);
}

.emap-flow-line {
  stroke-dasharray: 10 10;
  animation: emap-flow 1s linear infinite;
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
