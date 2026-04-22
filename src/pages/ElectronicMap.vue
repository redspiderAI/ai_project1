<template>
  <div class="emap-shell">
    <div class="emap-toolbar card shadow-sm">
      <div v-if="toolbarCollapsed" class="emap-toolbar-collapsed">
        <button
          type="button"
          class="btn btn-sm btn-outline-secondary"
          title="展开比价类型、品类吨数等设置"
          @click="toggleToolbarCollapse"
        >
          <i class="bi bi-chevron-down" aria-hidden="true"></i>
          展开设置
        </button>
        <span class="emap-title emap-title--compact">
          <i class="bi bi-map"></i>
          库房 / 冶炼厂分布
        </span>
        <button type="button" class="btn btn-sm btn-primary ms-auto" :disabled="loading" @click="loadAndPlot">
          <span v-if="loading" class="spinner-border spinner-border-sm me-1" role="status" />
          {{ loading ? '加载中…' : '刷新数据' }}
        </button>
      </div>
      <template v-else>
        <div class="emap-toolbar-row">
          <div class="emap-toolbar-main">
            <div class="emap-toolbar-heading">
              <button
                type="button"
                class="btn btn-sm btn-outline-secondary emap-toolbar-collapse-btn"
                title="收起筛选区，扩大地图可视区域"
                @click="toggleToolbarCollapse"
              >
                <i class="bi bi-chevron-up" aria-hidden="true"></i>
                收起
              </button>
              <div class="emap-toolbar-heading-text">
                <span class="emap-title">
                  <i class="bi bi-map"></i>
                  库房 / 冶炼厂分布
                </span>
                <span class="emap-toolbar-hint text-muted small"
                  >库房与冶炼厂均由接口加载。请先在下方选择<strong>比价类型</strong>并为品类填写<strong>吨数</strong>（至少一项
                  &gt; 0），再点击库房进行比价并绘制流向箭头。</span
                >
              </div>
            </div>
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
            <div v-if="categories.length">
              <div class="emap-cat-toolbar-list">
                <label v-for="c in categories" :key="c.id" class="emap-cat-pill">
                  <input v-model="categoryPrefs[c.id].selected" type="checkbox" class="form-check-input" />
                  <span class="emap-cat-name">{{ toCanonicalCategoryName(c.name) }}</span>
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
              <div class="emap-cat-toolbar-actions">
                <button
                  type="button"
                  class="btn btn-sm btn-success"
                  :disabled="categoriesLoading || compareLoading || loading"
                  @click="confirmComparisonConditions"
                >
                  确定
                </button>
              </div>
            </div>
            <div v-else-if="!categoriesLoading && !categoriesError" class="text-muted small">
              暂无品类，请稍后刷新或检查接口。
            </div>
          </div>
        </div>
      </template>
    </div>
    <div ref="mapWrapRef" class="emap-map-wrap">
      <div ref="mapElRef" class="emap-map" />
      <button
        v-if="mapToolsCollapsed"
        type="button"
        class="emap-map-tools-tab"
        @click="mapToolsCollapsed = false"
      >
        地图工具
      </button>
      <transition name="emap-tools-slide">
        <div v-if="!mapToolsCollapsed" class="emap-map-tools">
          <div class="emap-map-tools-head">
            <div class="emap-map-tools-title">地图工具</div>
          </div>
          <label class="emap-tool-check">
            <input v-model="enableCoordPick" type="checkbox" class="form-check-input" />
            <span>点击坐标</span>
          </label>
          <label class="emap-tool-check">
            <input v-model="enableAutoZoomOnPointClick" type="checkbox" class="form-check-input" />
            <span>点击点位是否放大</span>
          </label>
          <div v-if="lastClickedCoordText" class="emap-tool-coord text-muted">
            {{ lastClickedCoordText }}
          </div>
          <button
            type="button"
            class="emap-map-tools-arrow"
            title="收起工具栏"
            @click="mapToolsCollapsed = true"
          >
            ▶
          </button>
        </div>
      </transition>
      <div v-if="selectedWarehouse" class="emap-floating-actions">
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
        <button
          v-if="comparisonRanks.length"
          type="button"
          class="btn btn-sm btn-outline-dark"
          @click="openComparisonModal"
        >
          查看比价结果
        </button>
      </div>
      <div v-if="comparisonModalVisible" class="emap-cmp-panel" :class="{ 'emap-cmp-panel--collapsed': comparisonPanelCollapsed }">
        <div class="emap-cmp-panel-head">
          <h4 class="emap-cmp-panel-title">{{ comparisonModalTitle }}</h4>
          <div class="emap-cmp-panel-head-actions">
            <button
              type="button"
              class="emap-cmp-panel-toggle"
              :title="comparisonPanelCollapsed ? '展开' : '收起'"
              @click="comparisonPanelCollapsed = !comparisonPanelCollapsed"
            >
              {{ comparisonPanelCollapsed ? '展开' : '收起' }}
            </button>
            <button type="button" class="emap-cmp-panel-close" @click="closeComparisonModal">&times;</button>
          </div>
        </div>
        <div v-if="!comparisonPanelCollapsed" class="emap-cmp-summary">
          <div class="emap-cmp-summary-card">
            <div class="emap-cmp-summary-label">最优方案</div>
            <div class="emap-cmp-summary-value">{{ comparisonSummary.bestSmelter || '-' }}</div>
          </div>
          <div class="emap-cmp-summary-card">
            <div class="emap-cmp-summary-label">单价</div>
            <div class="emap-cmp-summary-value">¥ {{ formatNum(comparisonSummary.bestUnitPrice) }}</div>
          </div>
          <div class="emap-cmp-summary-card">
            <div class="emap-cmp-summary-label">总利润</div>
            <div class="emap-cmp-summary-value">¥ {{ formatNum(comparisonSummary.bestProfit) }}</div>
          </div>
          <div class="emap-cmp-summary-card">
            <div class="emap-cmp-summary-label">较第二名多赚</div>
            <div class="emap-cmp-summary-value">¥ {{ formatNum(comparisonSummary.marginToSecond) }}</div>
          </div>
        </div>
        <div v-if="!comparisonPanelCollapsed" class="emap-cmp-table-wrap">
          <table class="table table-sm table-striped align-middle mb-0">
            <thead>
              <tr>
                <th>排名</th>
                <th>冶炼厂名称</th>
                <th>单价</th>
                <th>总回收价</th>
                <th>估算运费</th>
                <th>利润</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!comparisonRanks.length">
                <td colspan="6" class="text-center text-muted py-3">暂无比价明细（接口已返回成功）</td>
              </tr>
              <tr v-for="row in comparisonRanks" :key="`${row.rank}-${row.smelter}`">
                <td>{{ row.rank }}</td>
                <td>{{ row.smelter }}</td>
                <td>¥ {{ formatNum(row.unitPrice) }}</td>
                <td>¥ {{ formatNum(row.totalRecovery) }}</td>
                <td>¥ {{ formatNum(row.freightPerTon) }}</td>
                <td class="text-success fw-semibold">¥ {{ formatNum(row.netProfit) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
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

    <!-- 与「送货量预测」页一致的趋势弹窗：折线图 + 仓库 / 大区经理 / 品类 / 冶炼厂 -->
    <div v-if="forecastModalVisible" class="emap-fc-modal" @click.self="closeForecastModal">
      <div class="emap-fc-modal-content emap-fc-modal-chart">
        <div class="emap-fc-modal-header">
          <h3>{{ forecastModalTitle }}</h3>
          <button type="button" class="emap-fc-close-btn" @click="closeForecastModal">&times;</button>
        </div>
        <div class="emap-fc-modal-body">
          <div class="emap-fc-chart-wrap">
            <canvas v-if="forecastModalDates.length" ref="forecastTrendCanvasRef"></canvas>
            <p v-else class="emap-fc-chart-empty text-muted mb-0">当前库房暂无可用预测明细。</p>
          </div>
          <div class="emap-fc-chart-meta">
            <p><strong>仓库：</strong>{{ forecastModalMeta?.warehouse }}</p>
            <p><strong>大区经理：</strong>{{ forecastModalMeta?.regional_manager }}</p>
            <p><strong>品类：</strong>{{ forecastModalMeta?.product_variety }}</p>
            <p v-if="forecastModalMeta?.smelter"><strong>冶炼厂：</strong>{{ forecastModalMeta.smelter }}</p>
          </div>
          <div class="emap-fc-chart-actions">
            <button type="button" class="btn btn-sm btn-secondary" @click="exportForecastTrendCsv">导出趋势CSV</button>
          </div>
        </div>
        <div class="emap-fc-modal-footer">
          <button type="button" class="btn btn-secondary" @click="closeForecastModal">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'
import axios from 'axios'
import { ApiPaths } from '../api/paths'
import {
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
  unitPrice: number
  netProfit: number
  totalRecovery: number
  freightPerTon: number
  qtySum: number
}

/** 与「送货量预测」折线图弹窗下方展示一致 */
type ForecastChartMeta = {
  warehouse: string
  regional_manager: string
  product_variety: string
  smelter?: string
}

const GAODE_TILE =
  'https://webrd01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}'

const DEFAULT_WAREHOUSE_COLOR = '#2563eb'
const MAX_MAP_FLOW_TARGETS = 30
const EMAP_TOOLBAR_COLLAPSED_KEY = 'emap.toolbar.collapsed'

function readToolbarCollapsed(): boolean {
  try {
    return sessionStorage.getItem(EMAP_TOOLBAR_COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

const toolbarCollapsed = ref(readToolbarCollapsed())

function toggleToolbarCollapse() {
  toolbarCollapsed.value = !toolbarCollapsed.value
  try {
    sessionStorage.setItem(EMAP_TOOLBAR_COLLAPSED_KEY, toolbarCollapsed.value ? '1' : '0')
  } catch {
    /* 隐私模式等 */
  }
}

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

function normalizeCategoryDisplayName(name: string): string {
  const raw = String(name || '').trim()
  if (!raw) return ''
  // 地图筛选仅展示品种本名：常见别名分隔符后内容不展示
  const first = raw.split(/[，,、/|；;]+/)[0] || raw
  return first.trim()
}

function toCanonicalCategoryName(name: string): string {
  const base = normalizeCategoryDisplayName(name)
  const aliasMap: Record<string, string> = {
    黑皮: '黑皮电瓶',
    黑皮电池: '黑皮电瓶',
    大白: '大白电池',
    电信电池: '电信电瓶',
    电动车: '电动车电池',
    电动车电瓶: '电动车电池',
  }
  return aliasMap[base] ?? base
}

function ensureCategoryPrefsForList(list: TlCategoryRow[]) {
  for (const c of list) {
    if (categoryPrefs[c.id] === undefined) {
      categoryPrefs[c.id] = { selected: false, tons: '0' }
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

watch(toolbarCollapsed, async () => {
  await nextTick()
  mapRef.value?.invalidateSize()
})
const compareLoading = ref(false)
const forecastLoading = ref(false)
const compareError = ref('')
const forecastError = ref('')
const forecastModalVisible = ref(false)
const forecastModalTitle = ref('')
const forecastModalMeta = ref<ForecastChartMeta | null>(null)
const forecastModalDates = ref<string[]>([])
const forecastModalValues = ref<number[]>([])
const comparisonModalVisible = ref(false)
const comparisonModalTitle = ref('比价结果')
const comparisonPanelCollapsed = ref(false)
const forecastTrendCanvasRef = ref<HTMLCanvasElement | null>(null)
const enableCoordPick = ref(false)
const enableAutoZoomOnPointClick = ref(false)
const lastClickedCoordText = ref('')
const mapToolsCollapsed = ref(false)
const selectedWarehouse = ref<MapPoint | null>(null)
const comparisonType = ref<'base' | 'tax3'>('base')
/** 与品类 id 对应：默认全选、吨数默认 1（与智能比价一致可改） */
const categoryPrefs = reactive<Record<number, { selected: boolean; tons: string }>>({})
const confirmedCategoryIds = ref<number[]>([])
const confirmedTotalTons = ref(0)
const confirmedPriceMode = ref<'base' | 'tax3'>('base')
const comparisonRanks = ref<ComparisonRankItem[]>([])
const lastComparisonSortKey = ref('')
const allWarehousePoints = ref<MapPoint[]>([])
const allSmelterPoints = ref<MapPoint[]>([])

let resizeObs: ResizeObserver | null = null
let forecastTrendResizeHandler: (() => void) | null = null
const flowAnimTimerIds: number[] = []

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
    // 需要 SVG 才能让虚线 dashoffset 动画生效
    preferCanvas: false,
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

  map.on('click', (evt: L.LeafletMouseEvent) => {
    if (!enableCoordPick.value) return
    const lat = evt.latlng.lat.toFixed(6)
    const lng = evt.latlng.lng.toFixed(6)
    lastClickedCoordText.value = `坐标：${lat}, ${lng}`
  })
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
        forecastError.value = ''
        closeForecastModal()
        if (enableAutoZoomOnPointClick.value) {
          const zoom = Math.max(map.getZoom(), 9)
          map.setView([p.lat, p.lng], zoom, { animate: true })
        }
        void runComparisonForWarehouse(p)
      })
    } else {
      marker.on('click', () => {
        if (!enableAutoZoomOnPointClick.value) return
        const zoom = Math.max(map.getZoom(), 9)
        map.setView([p.lat, p.lng], zoom, { animate: true })
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
  stopFlowAnimations()
  flowLayerRef.value?.clearLayers()
  topTipLayerRef.value?.clearLayers()
  comparisonRanks.value = []
  lastComparisonSortKey.value = ''
  compareError.value = ''
  comparisonModalVisible.value = false
}

function stopFlowAnimations() {
  while (flowAnimTimerIds.length) {
    const id = flowAnimTimerIds.pop()
    if (id != null) window.clearInterval(id)
  }
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

function confirmComparisonConditions() {
  compareError.value = ''
  const { ids, totalTons } = getSelectedCategoryPayload()
  if (!ids.length || totalTons <= 0) {
    compareError.value = '请至少勾选一个品类并填写大于 0 的吨数（单位：吨）'
    return
  }
  confirmedCategoryIds.value = [...ids]
  confirmedTotalTons.value = totalTons
  confirmedPriceMode.value = comparisonType.value
  toolbarCollapsed.value = true
  try {
    sessionStorage.setItem(EMAP_TOOLBAR_COLLAPSED_KEY, '1')
  } catch {
    /* 隐私模式等 */
  }
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
      pickNumber(row, [
        '总回收价',
        '回收额',
        'totalRecovery',
        'materialSum',
        '物料总价',
        'total_recovery',
      ]) ?? 0
    const freightPerTon =
      pickNumber(row, [
        '估算运费',
        '运费',
        '运费单价',
        'freightPerTon',
        'freight_per_ton',
        '运费每吨',
      ]) ?? 0
    const qtySum = pickNumber(row, ['吨数', 'quantity', 'qtySum', 'qty', '需求吨数']) ?? 0
    const unitPriceRaw = pickNumber(row, [
      '单价',
      '回收单价',
      'unit_price',
      '最优价',
      'price',
      '基准价',
      '3%含税价',
    ])
    const unitPrice = unitPriceRaw != null ? unitPriceRaw : qtySum > 0 ? totalRecovery / qtySum : 0
    out.push({
      rank,
      smelter,
      unitPrice: toDisplayNum(unitPrice),
      netProfit: toDisplayNum(netProfit),
      totalRecovery: toDisplayNum(totalRecovery),
      freightPerTon: toDisplayNum(freightPerTon),
      qtySum: toDisplayNum(qtySum),
    })
  }
  return out.sort((a, b) => a.rank - b.rank)
}

function pickComparisonPayload(raw: Record<string, unknown>): Record<string, unknown> | null {
  const data = raw['data']
  if (data != null && typeof data === 'object' && !Array.isArray(data)) {
    return data as Record<string, unknown>
  }
  return null
}

function walkObjectArraysDeep(input: unknown, depth = 0): Record<string, unknown>[][] {
  if (depth > 4 || input == null) return []
  const out: Record<string, unknown>[][] = []
  if (Array.isArray(input)) {
    const rows = input.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
    if (rows.length) out.push(rows)
    return out
  }
  if (typeof input !== 'object') return out
  const obj = input as Record<string, unknown>
  for (const v of Object.values(obj)) {
    if (Array.isArray(v)) {
      const rows = v.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
      if (rows.length) out.push(rows)
      continue
    }
    if (v && typeof v === 'object') out.push(...walkObjectArraysDeep(v, depth + 1))
  }
  return out
}

function parseRankRowsLoose(rows: Record<string, unknown>[]): ComparisonRankItem[] {
  const out: ComparisonRankItem[] = []
  let fallback = 0
  for (const row of rows) {
    const smelter = pickStr(row, [
      '冶炼厂名称',
      '冶炼厂',
      '冶炼厂名',
      'smelter_name',
      'smelter',
      'factory_name',
      'name',
    ])
    const hasProfitLike =
      pickNumber(row, ['利润', '净收益', '净利润', 'profit', 'net_profit', '总利润']) != null
    if (!smelter || !hasProfitLike) continue
    fallback += 1
    const rank = pickNumber(row, ['排名', '排行', '排序', 'rank', '名次']) ?? fallback
    const netProfit =
      pickNumber(row, ['利润', '净收益', '净利润', 'profit', 'net_profit', '总利润']) ?? 0
    const totalRecovery =
      pickNumber(row, ['总回收价', '回收额', '物料总价', 'total_recovery', 'material_sum']) ?? 0
    const freightPerTon =
      pickNumber(row, ['估算运费', '运费单价', '运费/吨', 'freight_per_ton', 'freight']) ?? 0
    const qtySum = pickNumber(row, ['吨数', 'quantity', 'qty', '需求吨数']) ?? 0
    const unitPriceRaw = pickNumber(row, [
      '单价',
      '回收单价',
      'unit_price',
      '最优价',
      'price',
      '基准价',
      '3%含税价',
    ])
    const unitPrice = unitPriceRaw != null ? unitPriceRaw : qtySum > 0 ? totalRecovery / qtySum : 0
    out.push({
      rank,
      smelter,
      unitPrice: toDisplayNum(unitPrice),
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
  const payload = pickComparisonPayload(raw)
  const fromApi = parseSmelterProfitRankArray(
    raw['冶炼厂利润排行'] ?? payload?.['冶炼厂利润排行'] ?? payload?.['smelter_profit_rank'],
  )
  if (fromApi.length) return rerankSequentially(fromApi)
  for (const rows of walkObjectArraysDeep(payload ?? raw)) {
    const parsed = parseRankRowsLoose(rows)
    if (parsed.length) return rerankSequentially(parsed)
  }
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
      const unitPrice = g.qtySum > 0 ? g.materialSum / g.qtySum : 0
      return {
        smelter: g.smelter,
        unitPrice: toDisplayNum(unitPrice),
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
  stopFlowAnimations()
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
        weight: 5,
        opacity: 0.95,
        dashArray: '14 10',
        className: 'emap-flow-line',
      },
    ).addTo(flowLayer)
    const br = bearingDeg(warehouse.lat, warehouse.lng, smelter.lat, smelter.lng)
    const movingArrow = L.marker(
      pointAlongFrac(warehouse.lat, warehouse.lng, smelter.lat, smelter.lng, 0.08),
      {
        icon: L.divIcon({
          className: 'emap-flow-arrow-wrap',
          html: `<div class="emap-flow-arrow emap-flow-arrow--3d" style="color:${color};transform:rotate(${br - 90}deg)">➤</div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        }),
        interactive: false,
      },
    ).addTo(flowLayer)

    let frac = 0.08
    const speed = 0.014 + (i % 3) * 0.002
    const timer = window.setInterval(() => {
      frac += speed
      if (frac > 0.92) frac = 0.08
      movingArrow.setLatLng(
        pointAlongFrac(warehouse.lat, warehouse.lng, smelter.lat, smelter.lng, frac),
      )
    }, 60)
    flowAnimTimerIds.push(timer)

    L.marker(pointAlongFrac(warehouse.lat, warehouse.lng, smelter.lat, smelter.lng, 0.82), {
      icon: L.divIcon({
        className: 'emap-flow-arrow-wrap',
        html: `<div class="emap-flow-arrow" style="color:${color};transform:rotate(${br - 90}deg);opacity:.55">▶</div>`,
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

    if (!confirmedCategoryIds.value.length || confirmedTotalTons.value <= 0) {
      throw new Error('请先在上方选择品类吨数后点击“确定”，再点击仓库比价')
    }

    const body = buildSmartComparisonBody(
      whId,
      smelterIds,
      confirmedCategoryIds.value,
      confirmedTotalTons.value,
      confirmedPriceMode.value,
    )
    const raw = await postTlGetComparison(body)
    const payload = pickComparisonPayload(raw)
    const sortKey = raw['最优价排序口径'] ?? payload?.['最优价排序口径']
    lastComparisonSortKey.value =
      sortKey != null && String(sortKey).trim() !== '' ? String(sortKey).trim() : ''
    const detailRows = tlUnwrapComparisonDetails(raw)
    const ranks = rankingsFromComparisonResponse(raw, detailRows)
    comparisonRanks.value = ranks
    if (ranks.length) {
      renderComparisonOverlay(warehouse, ranks)
    } else {
      flowLayerRef.value?.clearLayers()
      topTipLayerRef.value?.clearLayers()
    }
    openComparisonModal()
  } catch (err) {
    clearComparisonOverlays()
    compareError.value = err instanceof Error ? err.message : String(err)
  } finally {
    compareLoading.value = false
  }
}

function uniqSortedJoinZh(values: string[]): string {
  const u = [...new Set(values.map((s) => s.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'zh-CN'),
  )
  return u.length ? u.join('、') : '—'
}

function uniqSortedJoinZhOptional(values: string[]): string | undefined {
  const u = [...new Set(values.map((s) => s.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'zh-CN'),
  )
  return u.length ? u.join('、') : undefined
}

function parseForecastDetailError(e: unknown): string {
  const err = e as { response?: { data?: { message?: string; detail?: string } }; message?: string }
  const data = err.response?.data
  return (
    (typeof data?.message === 'string' && data.message) ||
    (typeof data?.detail === 'string' && data.detail) ||
    (typeof err.message === 'string' && err.message) ||
    '获取预测明细失败'
  )
}

/** 与 PurchaseQuantity.fetchDetailData 相同的分页请求方式 */
async function fetchForecastDetailPaged(warehouses: string[]): Promise<Record<string, unknown>[]> {
  const page_size = 500
  const all: Record<string, unknown>[] = []
  let page = 1
  while (page <= 50) {
    const response = await axios.get(ApiPaths.forecastDetail, {
      params: { warehouses, page, page_size },
    })
    const data = response.data as { items?: Record<string, unknown>[]; total?: number }
    const items = data.items ?? []
    all.push(...items)
    if (items.length === 0) break
    if (items.length < page_size) break
    if (typeof data.total === 'number' && all.length >= data.total) break
    page++
  }
  return all
}

function closeForecastModal() {
  forecastModalVisible.value = false
  forecastModalMeta.value = null
  forecastModalDates.value = []
  forecastModalValues.value = []
  forecastModalTitle.value = ''
}

const comparisonSummary = computed(() => {
  const sorted = [...comparisonRanks.value].sort((a, b) => a.rank - b.rank)
  const first = sorted[0]
  const second = sorted[1]
  const bestUnitPrice = first?.unitPrice ?? 0
  const bestProfit = first?.netProfit ?? 0
  const marginToSecond = first && second ? bestProfit - second.netProfit : 0
  return {
    bestSmelter: first?.smelter ?? '',
    bestUnitPrice: toDisplayNum(bestUnitPrice),
    bestProfit: toDisplayNum(bestProfit),
    marginToSecond: toDisplayNum(marginToSecond),
  }
})

function openComparisonModal() {
  const wh = selectedWarehouse.value?.title?.trim()
  comparisonModalTitle.value = wh ? `比价结果：${wh}` : '比价结果'
  comparisonPanelCollapsed.value = false
  comparisonModalVisible.value = true
}

function closeComparisonModal() {
  comparisonModalVisible.value = false
  comparisonPanelCollapsed.value = false
}

function drawForecastTrendChart() {
  const canvas = forecastTrendCanvasRef.value
  if (!canvas) return
  const dates = forecastModalDates.value
  const values = forecastModalValues.value
  if (dates.length === 0) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const wrap = canvas.parentElement
  const width = Math.max((wrap?.clientWidth ?? 560) - 8, 320)
  const height = 300
  canvas.width = width
  canvas.height = height

  const margin = { t: 20, r: 16, b: 44, l: 52 }
  const W = width - margin.l - margin.r
  const H = height - margin.t - margin.b
  const n = dates.length

  const maxV = Math.max(...values, 0)
  const maxY = maxV <= 0 ? 1 : maxV * 1.08

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)

  ctx.strokeStyle = '#d1d5db'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(margin.l, margin.t)
  ctx.lineTo(margin.l, margin.t + H)
  ctx.lineTo(margin.l + W, margin.t + H)
  ctx.stroke()

  const ySteps = 5
  ctx.font = '11px system-ui, sans-serif'
  ctx.fillStyle = '#64748b'
  for (let i = 0; i <= ySteps; i++) {
    const y = margin.t + H - (i / ySteps) * H
    const val = (i / ySteps) * maxY
    ctx.strokeStyle = '#f1f5f9'
    ctx.beginPath()
    ctx.moveTo(margin.l, y)
    ctx.lineTo(margin.l + W, y)
    ctx.stroke()
    ctx.fillText(val.toFixed(2), 4, y + 4)
  }

  const xStep = n <= 1 ? W / 2 : W / (n - 1)

  ctx.strokeStyle = '#1476db'
  ctx.lineWidth = 2
  ctx.beginPath()
  values.forEach((v, i) => {
    const x = margin.l + i * xStep
    const y = margin.t + H - (v / maxY) * H
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  ctx.stroke()

  ctx.fillStyle = '#1476db'
  values.forEach((v, i) => {
    const x = margin.l + i * xStep
    const y = margin.t + H - (v / maxY) * H
    ctx.beginPath()
    ctx.arc(x, y, 4, 0, Math.PI * 2)
    ctx.fill()
  })

  const maxLabs = Math.max(2, Math.floor(W / 56))
  const labStep = Math.max(1, Math.ceil(n / maxLabs))
  ctx.fillStyle = '#64748b'
  dates.forEach((d, i) => {
    if (i % labStep !== 0 && i !== n - 1) return
    const x = margin.l + i * xStep
    const label = d.length >= 10 ? d.slice(5) : d
    ctx.fillText(label, x - 16, margin.t + H + 28)
  })

  ctx.save()
  ctx.translate(14, margin.t + H / 2)
  ctx.rotate(-Math.PI / 2)
  ctx.fillStyle = '#475569'
  ctx.font = '12px system-ui, sans-serif'
  ctx.fillText('预测重量(吨)', -36, 0)
  ctx.restore()

  ctx.fillStyle = '#475569'
  ctx.font = '12px system-ui, sans-serif'
  ctx.fillText('预测日期', margin.l + W / 2 - 28, height - 8)
}

function escapeForecastCsvCell(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function exportForecastTrendCsv() {
  const dates = forecastModalDates.value
  const values = forecastModalValues.value
  if (dates.length === 0) {
    window.alert('没有可导出的数据')
    return
  }
  const m = forecastModalMeta.value
  const metaLines = m
    ? [
        ['字段', '值'].join(','),
        ['仓库', m.warehouse].map(escapeForecastCsvCell).join(','),
        ['大区经理', m.regional_manager].map(escapeForecastCsvCell).join(','),
        ...(m.smelter ? [['冶炼厂', m.smelter].map(escapeForecastCsvCell).join(',')] : []),
        ['品类', m.product_variety].map(escapeForecastCsvCell).join(','),
      ]
    : []
  const headers = ['预测日期', '预测重量(吨)']
  const rowsData = dates.map((d, i) => [d, values[i]?.toFixed(2) ?? '0.00'].map(escapeForecastCsvCell))
  const csvContent = [...metaLines, '', headers.join(','), ...rowsData.map((r) => r.join(','))].join('\n')
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)
  link.href = URL.createObjectURL(blob)
  link.download = `预测趋势_${timestamp}.csv`
  link.click()
  URL.revokeObjectURL(link.href)
}

watch(forecastModalVisible, (v) => {
  if (v) {
    nextTick(() => {
      drawForecastTrendChart()
      forecastTrendResizeHandler = () => drawForecastTrendChart()
      window.addEventListener('resize', forecastTrendResizeHandler)
    })
  } else if (forecastTrendResizeHandler) {
    window.removeEventListener('resize', forecastTrendResizeHandler)
    forecastTrendResizeHandler = null
  }
})

watch([forecastModalDates, forecastModalValues], () => {
  if (forecastModalVisible.value && forecastModalDates.value.length > 0) {
    nextTick(() => drawForecastTrendChart())
  }
})

async function runForecastForWarehouse(warehouse: MapPoint) {
  forecastLoading.value = true
  forecastError.value = ''
  try {
    const whTitle = warehouse.title.trim()
    const rawItems = await fetchForecastDetailPaged([whTitle])
    const itemsFiltered = rawItems.filter((row) => {
      const w = pickStr(row, ['warehouse', '仓库', 'warehouse_name', '仓库名'])
      if (!w) return true
      return w === whTitle || w.includes(whTitle) || whTitle.includes(w)
    })
    const working = itemsFiltered.length ? itemsFiltered : rawItems

    const byDate = new Map<string, number>()
    for (const row of working) {
      const d = pickStr(row, ['target_date', '预测日期', 'date'])
      if (!d) continue
      const w = pickNumber(row, ['predicted_weight', '预测重量', 'weight']) ?? 0
      byDate.set(d, (byDate.get(d) || 0) + w)
    }
    const sorted = [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0], 'zh-CN'))
    const dates = sorted.map(([d]) => d)
    const vals = sorted.map(([, weight]) => weight)

    const rms = working.map((r) => pickStr(r, ['regional_manager', '大区经理', '经理']))
    const vars = working.map((r) => pickStr(r, ['product_variety', '品类', '品种', '产品品种']))
    const sms = working.map((r) => pickStr(r, ['smelter', '冶炼厂', 'smelter_name', '冶炼厂名']))

    forecastModalMeta.value = {
      warehouse: whTitle,
      regional_manager: uniqSortedJoinZh(rms),
      product_variety: uniqSortedJoinZh(vars),
      smelter: uniqSortedJoinZhOptional(sms),
    }
    forecastModalTitle.value = `预测趋势：${whTitle}`
    forecastModalDates.value = dates
    forecastModalValues.value = vals
    forecastModalVisible.value = true
  } catch (e) {
    closeForecastModal()
    forecastError.value = parseForecastDetailError(e)
  } finally {
    forecastLoading.value = false
  }
}

async function loadCategories() {
  categoriesError.value = ''
  categoriesLoading.value = true
  try {
    const mapped = (await fetchTlCategories()).map((c) => ({
      ...c,
      name: toCanonicalCategoryName(c.name) || c.name,
    }))
    const dedup = new Map<string, TlCategoryRow>()
    for (const row of mapped) {
      if (!dedup.has(row.name)) dedup.set(row.name, row)
    }
    categories.value = [...dedup.values()]
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
  stopFlowAnimations()
  if (forecastTrendResizeHandler) {
    window.removeEventListener('resize', forecastTrendResizeHandler)
    forecastTrendResizeHandler = null
  }
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
  background:
    radial-gradient(circle at 12% 14%, rgba(59, 130, 246, 0.14), transparent 28%),
    radial-gradient(circle at 86% 12%, rgba(20, 184, 166, 0.12), transparent 26%),
    linear-gradient(180deg, #f6f8fc 0%, #eef2f9 100%);
}

.emap-toolbar {
  margin: 12px 16px 0;
  padding: 14px 16px;
  border: 1px solid rgba(255, 255, 255, 0.75);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.76);
  backdrop-filter: blur(10px);
  box-shadow: 0 10px 26px rgba(15, 23, 42, 0.1);
}

.emap-toolbar-collapsed {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.emap-title--compact {
  flex: 1;
  min-width: 0;
  margin-bottom: 0;
}

.emap-toolbar-heading {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 0;
}

.emap-toolbar-collapse-btn {
  flex-shrink: 0;
  margin-top: 2px;
}

.emap-toolbar-heading-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
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
  color: #475569;
  margin: 0;
  letter-spacing: 0.2px;
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
  padding: 6px 2px;
}

.emap-cat-toolbar-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 10px;
}

.emap-cat-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  padding: 5px 9px;
  border-radius: 999px;
  background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
  border: 1px solid #dbe7fb;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.emap-cat-pill:hover {
  border-color: #93c5fd;
  box-shadow: 0 4px 10px rgba(37, 99, 235, 0.14);
  transform: translateY(-1px);
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
  font-weight: 700;
  font-size: 16px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #0f172a;
}

.emap-map-wrap {
  position: relative;
  flex: 1;
  min-height: 0;
  margin: 12px 16px 16px;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.8);
  box-shadow: 0 14px 36px rgba(15, 23, 42, 0.14);
}

.emap-map {
  width: 100%;
  height: 100%;
  background: #dfe7ef;
}

.emap-floating-actions {
  position: absolute;
  left: 12px;
  bottom: 12px;
  z-index: 1000;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  padding: 9px;
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.16);
}

.emap-map-tools {
  position: absolute;
  top: 50%;
  right: 12px;
  transform: translateY(-50%);
  z-index: 1000;
  min-width: 190px;
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(255, 255, 255, 0.9);
  border-radius: 12px;
  padding: 8px 10px;
  backdrop-filter: blur(10px);
  box-shadow: 0 8px 22px rgba(15, 23, 42, 0.16);
  font-size: 12px;
  overflow: visible;
}

.emap-map-tools-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.emap-map-tools-title {
  font-weight: 700;
  color: #0f172a;
}

.emap-map-tools-tab {
  position: absolute;
  top: 50%;
  right: 0;
  transform: translateY(-50%);
  z-index: 1000;
  border: 1px solid #d1d5db;
  border-right: none;
  background: rgba(255, 255, 255, 0.88);
  color: #0f172a;
  padding: 10px 10px;
  border-radius: 8px 0 0 8px;
  backdrop-filter: blur(10px);
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.16);
  writing-mode: vertical-rl;
  text-orientation: mixed;
  font-size: 12px;
  font-weight: 600;
}

.emap-map-tools-tab:hover {
  background: #f8fafc;
}

.emap-tools-slide-enter-active,
.emap-tools-slide-leave-active {
  transition: transform 0.22s ease, opacity 0.22s ease;
  transform-origin: right center;
}

.emap-tools-slide-enter-from,
.emap-tools-slide-leave-to {
  transform: translate(110%, -50%);
  opacity: 0;
}

.emap-tools-slide-enter-to,
.emap-tools-slide-leave-from {
  transform: translate(0, -50%);
  opacity: 1;
}

.emap-tool-check {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 6px;
  color: #374151;
}

.emap-tool-check .form-check-input {
  margin: 0;
}

.emap-tool-coord {
  font-size: 11px;
  line-height: 1.35;
  word-break: break-all;
}

.emap-map-tools-arrow {
  position: absolute;
  top: 50%;
  right: -14px;
  transform: translateY(-50%);
  width: 20px;
  height: 44px;
  border: 1px solid #d1d5db;
  border-left: none;
  border-radius: 0 8px 8px 0;
  background: rgba(255, 255, 255, 0.96);
  color: #1f2937;
  font-size: 11px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.12);
}

.emap-map-tools-arrow:hover {
  background: #f8fafc;
}

.emap-cmp-panel {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 1000;
  width: min(560px, calc(100% - 24px));
  max-height: calc(100% - 24px);
  background: rgba(255, 255, 255, 0.84);
  border: 1px solid rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(12px);
  border-radius: 14px;
  box-shadow: 0 14px 34px rgba(15, 23, 42, 0.2);
  padding: 10px 12px;
  overflow: auto;
}

.emap-cmp-panel--collapsed {
  width: min(420px, calc(100% - 24px));
  max-height: none;
  overflow: hidden;
}

.emap-cmp-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.emap-cmp-panel--collapsed .emap-cmp-panel-head {
  margin-bottom: 0;
}

.emap-cmp-panel-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #111827;
}

.emap-cmp-panel-head-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.emap-cmp-panel-toggle {
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #f8fafc;
  color: #334155;
  font-size: 12px;
  line-height: 1;
  padding: 6px 8px;
  cursor: pointer;
}

.emap-cmp-panel-toggle:hover {
  background: #f1f5f9;
}

.emap-cmp-panel-close {
  border: none;
  background: transparent;
  color: #6b7280;
  font-size: 26px;
  line-height: 1;
  padding: 0 4px;
  cursor: pointer;
}

.emap-cmp-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}

.emap-cmp-summary-card {
  background: linear-gradient(180deg, #ffffff 0%, #f7fbff 100%);
  border: 1px solid #dbe7fb;
  border-radius: 10px;
  padding: 10px 12px;
}

.emap-cmp-summary-label {
  font-size: 12px;
  color: #64748b;
  margin-bottom: 4px;
}

.emap-cmp-summary-value {
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
}

.emap-cmp-table-wrap {
  max-height: 360px;
  overflow: auto;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
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

.emap-fc-modal {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.emap-fc-modal-content {
  background: #fff;
  border-radius: 8px;
  width: min(720px, 96vw);
  max-width: 96%;
  max-height: 90vh;
  overflow: auto;
  box-shadow: 0 12px 40px rgba(15, 23, 42, 0.2);
}

.emap-fc-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e9f2;
}

.emap-fc-modal-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: #1f2d3d;
  margin: 0;
}

.emap-fc-close-btn {
  background: none;
  border: none;
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
  color: #909399;
  padding: 0 4px;
}

.emap-fc-close-btn:hover {
  color: #606266;
}

.emap-fc-modal-body {
  padding: 20px;
}

.emap-fc-chart-wrap {
  width: 100%;
  min-height: 300px;
  margin-bottom: 16px;
}

.emap-fc-chart-wrap canvas {
  display: block;
  width: 100%;
  height: auto;
}

.emap-fc-chart-empty {
  padding: 48px 16px;
  text-align: center;
  font-size: 14px;
}

.emap-fc-chart-meta {
  background: #f8fafc;
  border-radius: 8px;
  padding: 14px 16px;
  margin-bottom: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.emap-fc-chart-meta p {
  margin: 0;
  font-size: 13px;
  color: #334155;
  line-height: 1.5;
}

.emap-fc-chart-meta strong {
  color: #0f172a;
  margin-right: 6px;
}

.emap-fc-chart-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.emap-fc-modal-footer {
  padding: 16px 20px;
  border-top: 1px solid #e5e9f2;
  text-align: right;
}

.emap-legend {
  position: absolute;
  right: 12px;
  bottom: 12px;
  z-index: 1000;
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(8px);
  border-radius: 10px;
  padding: 8px 12px;
  font-size: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.14);
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
  stroke-dasharray: 14 10;
  animation: emap-flow 0.85s linear infinite;
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

.emap-flow-arrow--3d {
  font-size: 14px;
  font-weight: 800;
  text-shadow:
    0 1px 0 rgba(255, 255, 255, 0.95),
    0 3px 6px rgba(0, 0, 0, 0.45),
    0 0 10px rgba(37, 99, 235, 0.35);
  filter: saturate(1.15);
  animation: emap-arrow-float 0.9s ease-in-out infinite;
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
    stroke-dashoffset: 24;
  }
  100% {
    stroke-dashoffset: 0;
  }
}

@keyframes emap-arrow-float {
  0%,
  100% {
    transform: translateY(0) scale(1);
  }
  50% {
    transform: translateY(-1px) scale(1.04);
  }
}
</style>
