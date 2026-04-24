<template>
  <div class="emap-shell emap-shell--dashboard">
    <div class="emap-toolbar">
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
          <button
            type="button"
            class="btn btn-sm btn-outline-primary w-100 emap-tool-nearest-wh"
            :disabled="nearestWarehouseBusy || allWarehousePoints.length === 0"
            title="使用浏览器定位，地图飞到直线距离最近的库房"
            @click="focusNearestWarehouseFromGeolocation"
          >
            {{ nearestWarehouseBusy ? '定位中…' : '定位最近仓库' }}
          </button>
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
          @click="runComparisonForWarehouse(selectedWarehouse, { announceMissingPrereq: true })"
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
          <table class="table table-sm table-striped align-middle mb-0 emap-cmp-table">
            <thead>
              <tr>
                <th class="emap-cmp-col-rank">排名</th>
                <th class="emap-cmp-col-smelter">冶炼厂名称</th>
                <th class="emap-cmp-col-money">单价</th>
                <th class="emap-cmp-col-money">总回收价</th>
                <th class="emap-cmp-col-money">估算运费</th>
                <th class="emap-cmp-col-money">利润</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!comparisonRanks.length">
                <td colspan="6" class="text-center text-muted py-3 emap-cmp-table-empty">
                  暂无比价明细（接口已返回成功）
                </td>
              </tr>
              <tr v-for="row in comparisonRanks" :key="`${row.rank}-${row.smelter}`">
                <td class="emap-cmp-col-rank">{{ row.rank }}</td>
                <td class="emap-cmp-col-smelter">{{ row.smelter }}</td>
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

      <!-- 定位最近仓库：地图区域右上角，可关闭，10 分钟自动关闭；再次定位只更新内容 -->
      <div v-if="geoNearestToastVisible" class="emap-geo-nearest-toast" role="status">
        <button
          type="button"
          class="emap-geo-nearest-toast-close"
          title="关闭"
          aria-label="关闭"
          @click="dismissGeoNearestToast"
        >
          ×
        </button>
        <div class="emap-geo-nearest-toast-body">{{ geoNearestToastMessage }}</div>
      </div>

      <!-- 仅「重新比价」触发：地图内顶部轻提示，不遮罩、不阻挡操作，10 秒自动关闭 -->
      <div
        v-if="comparisonPrereqToastVisible"
        class="emap-comparison-prereq-toast"
        role="status"
        aria-live="polite"
      >
        <button
          type="button"
          class="emap-comparison-prereq-toast-close"
          title="关闭"
          aria-label="关闭"
          @click="dismissComparisonPrereqToast"
        >
          ×
        </button>
        <p class="emap-comparison-prereq-toast-msg">{{ comparisonPrereqToastMessage }}</p>
      </div>
    </div>
    <div v-if="loadError" class="alert emap-alert-dashboard m-3 mb-0" role="alert">{{ loadError }}</div>

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
/** 定位最近仓库提示在右上角停留时间 */
const GEO_NEAREST_TOAST_MS = 10 * 60 * 1000
/** 未确认比价条件时中央提示自动关闭时间 */
const COMPARISON_PREREQ_TOAST_MS = 10_000
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
const nearestWarehouseBusy = ref(false)
const geoNearestToastVisible = ref(false)
const geoNearestToastMessage = ref('')
const comparisonPrereqToastVisible = ref(false)
const comparisonPrereqToastMessage = ref('')
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

/** 库房 id → 标记，用于选中时把其余库房变浅 */
const warehouseMarkerById = new Map<string, L.Marker>()

let resizeObs: ResizeObserver | null = null
let forecastTrendResizeHandler: (() => void) | null = null
let geoNearestToastTimer: ReturnType<typeof setTimeout> | null = null
let comparisonPrereqToastTimer: ReturnType<typeof setTimeout> | null = null
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

/** 球面大圆距离（米），用于「离我最近的库房」 */
function greatCircleDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function openMarkerPopupNear(lat: number, lng: number) {
  const group = markerLayerRef.value
  if (!group) return
  const eps = 1e-5
  let done = false
  group.eachLayer((ly) => {
    if (done) return
    const m = ly as L.Marker
    if (typeof m.getLatLng !== 'function' || typeof m.openPopup !== 'function') return
    const p = m.getLatLng()
    if (Math.abs(p.lat - lat) < eps && Math.abs(p.lng - lng) < eps) {
      m.openPopup()
      done = true
    }
  })
}

function dismissGeoNearestToast() {
  if (geoNearestToastTimer != null) {
    clearTimeout(geoNearestToastTimer)
    geoNearestToastTimer = null
  }
  geoNearestToastVisible.value = false
}

/** 同一条右上角提示：更新文案并重新计时 10 分钟 */
function showOrUpdateGeoNearestToast(message: string) {
  if (geoNearestToastTimer != null) {
    clearTimeout(geoNearestToastTimer)
    geoNearestToastTimer = null
  }
  geoNearestToastMessage.value = message
  geoNearestToastVisible.value = true
  geoNearestToastTimer = setTimeout(() => {
    dismissGeoNearestToast()
  }, GEO_NEAREST_TOAST_MS)
}

function dismissComparisonPrereqToast() {
  if (comparisonPrereqToastTimer != null) {
    clearTimeout(comparisonPrereqToastTimer)
    comparisonPrereqToastTimer = null
  }
  comparisonPrereqToastVisible.value = false
}

function showComparisonPrereqToast(message: string) {
  if (comparisonPrereqToastTimer != null) {
    clearTimeout(comparisonPrereqToastTimer)
    comparisonPrereqToastTimer = null
  }
  comparisonPrereqToastMessage.value = message
  comparisonPrereqToastVisible.value = true
  comparisonPrereqToastTimer = setTimeout(() => {
    dismissComparisonPrereqToast()
  }, COMPARISON_PREREQ_TOAST_MS)
}

function focusNearestWarehouseFromGeolocation() {
  const map = mapRef.value
  const list = allWarehousePoints.value
  if (!map) {
    window.alert('地图尚未就绪')
    return
  }
  if (!list.length) {
    window.alert('当前没有库房数据，请先加载地图')
    return
  }
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    window.alert('当前环境不支持浏览器定位')
    return
  }
  nearestWarehouseBusy.value = true
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      nearestWarehouseBusy.value = false
      const uLat = pos.coords.latitude
      const uLng = pos.coords.longitude
      let best: MapPoint | null = null
      let bestM = Infinity
      for (const p of list) {
        const m = greatCircleDistanceMeters(uLat, uLng, p.lat, p.lng)
        if (m < bestM) {
          bestM = m
          best = p
        }
      }
      if (!best) return
      const zoom = Math.max(map.getZoom(), 12)
      map.setView([best.lat, best.lng], zoom, { animate: true })
      openMarkerPopupNear(best.lat, best.lng)
      showOrUpdateGeoNearestToast(`已定位到最近仓库：${best.title}`)
    },
    (err) => {
      nearestWarehouseBusy.value = false
      const msg =
        err.code === 1
          ? '已拒绝定位权限，请在浏览器设置中允许本站获取位置'
          : err.code === 2
            ? '暂时无法获取位置'
            : err.code === 3
              ? '定位超时，请重试'
              : `定位失败：${err.message || '未知错误'}`
      window.alert(msg)
    },
    { enableHighAccuracy: true, maximumAge: 60_000, timeout: 20_000 },
  )
}

function warehouseIcon(cssColor: string, dimmed = false): L.DivIcon {
  const bg = safeCssColor(cssColor, DEFAULT_WAREHOUSE_COLOR)
  const dimClass = dimmed ? ' emap-pin-inner--dimmed' : ''
  return L.divIcon({
    className: 'emap-marker emap-marker--warehouse',
    html: `<div class="emap-pin-inner${dimClass}" style="background:${bg};"></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
    popupAnchor: [0, -24],
  })
}

function refreshWarehouseMarkerDimming() {
  const sel = selectedWarehouse.value
  const selId = sel?.kind === 'warehouse' ? sel.id : null
  const validSelId = selId && warehouseMarkerById.has(selId) ? selId : null
  for (const p of allWarehousePoints.value) {
    const m = warehouseMarkerById.get(p.id)
    if (!m) continue
    const dimmed = Boolean(validSelId && validSelId !== p.id)
    m.setIcon(warehouseIcon(p.pinColor ?? DEFAULT_WAREHOUSE_COLOR, dimmed))
  }
}

watch(selectedWarehouse, () => {
  refreshWarehouseMarkerDimming()
})

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
  warehouseMarkerById.clear()

  allWarehousePoints.value = points.filter((p) => p.kind === 'warehouse')
  allSmelterPoints.value = points.filter((p) => p.kind === 'smelter')
  for (const p of points) {
    const icon =
      p.kind === 'warehouse' ? warehouseIcon(p.pinColor ?? DEFAULT_WAREHOUSE_COLOR, false) : smelterIcon()
    const marker = L.marker([p.lat, p.lng], { icon })
    const popupHtml =
      p.kind === 'warehouse' ? warehousePopupHtml(p) : `<div class="emap-popup"><strong>${escapeHtml(p.title)}</strong><br/><span class="text-muted small">${escapeHtml(p.subtitle)}</span></div>`
    marker.bindPopup(popupHtml)
    marker.bindTooltip(popupHtml, {
      sticky: false,
      direction: 'top',
      opacity: 1,
      className: 'emap-marker-hover-tip',
    })
    marker.on('popupopen', () => {
      marker.closeTooltip()
    })
    marker.on('tooltipopen', () => {
      if (marker.isPopupOpen()) marker.closeTooltip()
    })
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
    if (p.kind === 'warehouse') warehouseMarkerById.set(p.id, marker)
  }

  refreshWarehouseMarkerDimming()

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
      pickNumber(row, [
        '总回收价',
        '总价',
        '报价金额',
        '回收额',
        '物料总价',
        'total_recovery',
        'material_sum',
      ]) ?? 0
    const freightPerTon =
      pickNumber(row, [
        '估算运费',
        '运费',
        '总运费',
        '运费单价',
        '运费/吨',
        'freight_per_ton',
        'freight',
      ]) ?? 0
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

/** 严格按接口 data[] 明细组装，不做二次业务推导 */
function parseFromComparisonDataRows(rows: Record<string, unknown>[]): ComparisonRankItem[] {
  if (!rows.length) return []
  const grouped = new Map<
    string,
    {
      smelter: string
      qtySum: number
      totalRecovery: number
      freightTotal: number
      netProfit: number
      unitPriceSum: number
      unitPriceCount: number
    }
  >()

  for (const row of rows) {
    const smelter =
      pickStr(row, ['冶炼厂', '冶炼厂名', 'smelter_name', 'smelter', 'factory_name']) || '未知冶炼厂'
    if (!grouped.has(smelter)) {
      grouped.set(smelter, {
        smelter,
        qtySum: 0,
        totalRecovery: 0,
        freightTotal: 0,
        netProfit: 0,
        unitPriceSum: 0,
        unitPriceCount: 0,
      })
    }
    const g = grouped.get(smelter)!
    const qty = pickNumber(row, ['吨数', 'quantity', 'qty', 'weight']) ?? 0
    const unitPrice = pickNumber(row, ['单价', '报价', '基准价', 'unit_price', 'price'])
    const totalRecovery = pickNumber(row, ['总价', '报价金额', '总回收价', 'total_recovery']) ?? 0
    const freightTotal = pickNumber(row, ['总运费', '运费', 'estimated_freight', 'freight']) ?? 0
    const netProfit = pickNumber(row, ['利润', '净利润', 'profit', 'net_profit']) ?? 0

    g.qtySum += Math.max(0, qty)
    g.totalRecovery += totalRecovery
    g.freightTotal += freightTotal
    g.netProfit += netProfit
    if (unitPrice != null) {
      g.unitPriceSum += unitPrice
      g.unitPriceCount += 1
    }
  }

  return [...grouped.values()]
    .map((g) => ({
      rank: 0,
      smelter: g.smelter,
      unitPrice: toDisplayNum(
        g.unitPriceCount > 0 ? g.unitPriceSum / g.unitPriceCount : g.qtySum > 0 ? g.totalRecovery / g.qtySum : 0,
      ),
      netProfit: toDisplayNum(g.netProfit),
      totalRecovery: toDisplayNum(g.totalRecovery),
      freightPerTon: toDisplayNum(g.freightTotal),
      qtySum: toDisplayNum(g.qtySum),
    }))
    .sort((a, b) => b.netProfit - a.netProfit)
    .map((x, i) => ({ ...x, rank: i + 1 }))
}

function rankingsFromComparisonResponse(
  raw: Record<string, unknown>,
  detailRows: Record<string, unknown>[],
): ComparisonRankItem[] {
  const payload = pickComparisonPayload(raw)
  const dataRows =
    (Array.isArray(raw['data']) ? (raw['data'] as Record<string, unknown>[]) : null) ??
    (Array.isArray(payload?.['data']) ? (payload?.['data'] as Record<string, unknown>[]) : [])
  const fromData = parseFromComparisonDataRows(dataRows)
  if (fromData.length) {
    const ranks = parseSmelterProfitRankArray(
      raw['冶炼厂利润排行'] ?? payload?.['冶炼厂利润排行'] ?? payload?.['smelter_profit_rank'],
    )
    if (!ranks.length) return fromData
    const rankBySmelter = new Map(ranks.map((r) => [r.smelter, r.rank]))
    return [...fromData]
      .map((x) => ({
        ...x,
        rank:
          rankBySmelter.get(x.smelter) ??
          ranks.find((r) => r.smelter.includes(x.smelter) || x.smelter.includes(r.smelter))?.rank ??
          x.rank,
      }))
      .sort((a, b) => a.rank - b.rank || b.netProfit - a.netProfit)
      .map((x, i) => ({ ...x, rank: i + 1 }))
  }

  const fromApi = parseSmelterProfitRankArray(
    raw['冶炼厂利润排行'] ?? payload?.['冶炼厂利润排行'] ?? payload?.['smelter_profit_rank'],
  )
  if (fromApi.length) {
    // 新接口中“冶炼厂利润排行”通常只包含利润，单价/总回收价/运费需从 data 明细补齐。
    const detailAgg = aggregateComparisonRows(detailRows)
    if (!detailAgg.length) return rerankSequentially(fromApi)
    const detailBySmelter = new Map(detailAgg.map((x) => [x.smelter, x]))
    const merged = fromApi.map((r) => {
      const d =
        detailBySmelter.get(r.smelter) ||
        detailAgg.find((x) => x.smelter.includes(r.smelter) || r.smelter.includes(x.smelter))
      if (!d) return r
      return {
        ...r,
        unitPrice: r.unitPrice > 0 ? r.unitPrice : d.unitPrice,
        totalRecovery: r.totalRecovery > 0 ? r.totalRecovery : d.totalRecovery,
        freightPerTon: r.freightPerTon > 0 ? r.freightPerTon : d.freightPerTon,
        qtySum: r.qtySum > 0 ? r.qtySum : d.qtySum,
      }
    })
    return rerankSequentially(merged)
  }
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
    {
      smelter: string
      materialSum: number
      freightSum: number
      freightCount: number
      qtySum: number
      unitPriceSum: number
      unitPriceCount: number
    }
  >()
  for (const row of rows) {
    const smelter =
      pickStr(row, ['smelter_name', '冶炼厂', '冶炼厂名', 'smelter', 'factory_name']) || '未知冶炼厂'
    const unitPrice =
      pickNumber(row, [
        '单价',
        'unit_price',
        '最优价',
        '价格',
        'price',
        'base_price',
        '不含税价',
        '3pct_price',
        '基准价',
        '报价',
      ]) ?? 0
    const totalRecoveryDirect =
      pickNumber(row, ['总回收价', '总价', '报价金额', 'total_recovery', 'material_sum']) ?? null
    const freight =
      pickNumber(row, ['总运费', '运费', '估算运费', 'freight_per_ton', '运费单价', 'freight', '运费每吨']) ??
      0
    const qty = pickNumber(row, ['quantity', '吨数', '数量', 'qty', 'weight', '需求吨数']) ?? 0
    const key = smelter
    if (!grouped.has(key)) {
      grouped.set(key, {
        smelter,
        materialSum: 0,
        freightSum: 0,
        freightCount: 0,
        qtySum: 0,
        unitPriceSum: 0,
        unitPriceCount: 0,
      })
    }
    const g = grouped.get(key)!
    g.materialSum +=
      totalRecoveryDirect != null ? Math.max(0, totalRecoveryDirect) : unitPrice * Math.max(0, qty)
    g.freightSum += freight
    g.freightCount += 1
    g.qtySum += Math.max(0, qty)
    if (unitPrice > 0) {
      g.unitPriceSum += unitPrice
      g.unitPriceCount += 1
    }
  }
  return [...grouped.values()]
    .map((g) => {
      const freightPerTon = g.freightCount > 0 ? g.freightSum / g.freightCount : 0
      const netProfit = g.materialSum - freightPerTon * g.qtySum
      const unitPrice =
        g.unitPriceCount > 0 ? g.unitPriceSum / g.unitPriceCount : g.qtySum > 0 ? g.materialSum / g.qtySum : 0
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

type RunComparisonOptions = {
  /** 仅「重新比价」按钮为 true；地图点仓库缺条件时静默，不挡操作 */
  announceMissingPrereq?: boolean
}

async function runComparisonForWarehouse(warehouse: MapPoint, options?: RunComparisonOptions) {
  if (!confirmedCategoryIds.value.length || confirmedTotalTons.value <= 0) {
    if (options?.announceMissingPrereq) {
      showComparisonPrereqToast(
        '请先在上方「回收品类」中勾选品类、填写吨数（至少一项大于 0），并点击「确定」后再进行比价。',
      )
    }
    return
  }

  compareLoading.value = true
  compareError.value = ''
  try {
    const whId = pickNumber(warehouse.raw, ['仓库id', 'warehouse_id', 'id'])
    if (whId == null) throw new Error('该库房缺少仓库id，无法自动比价')
    const smelterIds = allSmelterPoints.value
      .map((s) => pickNumber(s.raw, ['冶炼厂id', 'factory_id', 'smelter_id', 'id']))
      .filter((x): x is number => x != null)
    if (!smelterIds.length) throw new Error('暂无可比价的冶炼厂')

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

  ctx.fillStyle = '#0c1a2e'
  ctx.fillRect(0, 0, width, height)

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(margin.l, margin.t)
  ctx.lineTo(margin.l, margin.t + H)
  ctx.lineTo(margin.l + W, margin.t + H)
  ctx.stroke()

  const ySteps = 5
  ctx.font = '11px system-ui, sans-serif'
  ctx.fillStyle = '#94a3b8'
  for (let i = 0; i <= ySteps; i++) {
    const y = margin.t + H - (i / ySteps) * H
    const val = (i / ySteps) * maxY
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.08)'
    ctx.beginPath()
    ctx.moveTo(margin.l, y)
    ctx.lineTo(margin.l + W, y)
    ctx.stroke()
    ctx.fillText(val.toFixed(2), 4, y + 4)
  }

  const xStep = n <= 1 ? W / 2 : W / (n - 1)

  ctx.strokeStyle = '#22d3ee'
  ctx.lineWidth = 2
  ctx.shadowColor = 'rgba(34, 211, 238, 0.45)'
  ctx.shadowBlur = 8
  ctx.beginPath()
  values.forEach((v, i) => {
    const x = margin.l + i * xStep
    const y = margin.t + H - (v / maxY) * H
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  ctx.stroke()
  ctx.shadowBlur = 0

  ctx.fillStyle = '#38bdf8'
  values.forEach((v, i) => {
    const x = margin.l + i * xStep
    const y = margin.t + H - (v / maxY) * H
    ctx.beginPath()
    ctx.arc(x, y, 4, 0, Math.PI * 2)
    ctx.fill()
  })

  const maxLabs = Math.max(2, Math.floor(W / 56))
  const labStep = Math.max(1, Math.ceil(n / maxLabs))
  ctx.fillStyle = '#94a3b8'
  dates.forEach((d, i) => {
    if (i % labStep !== 0 && i !== n - 1) return
    const x = margin.l + i * xStep
    const label = d.length >= 10 ? d.slice(5) : d
    ctx.fillText(label, x - 16, margin.t + H + 28)
  })

  ctx.save()
  ctx.translate(14, margin.t + H / 2)
  ctx.rotate(-Math.PI / 2)
  ctx.fillStyle = '#7dd3fc'
  ctx.font = '12px system-ui, sans-serif'
  ctx.fillText('预测重量(吨)', -36, 0)
  ctx.restore()

  ctx.fillStyle = '#7dd3fc'
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
  dismissGeoNearestToast()
  dismissComparisonPrereqToast()
  stopFlowAnimations()
  if (forecastTrendResizeHandler) {
    window.removeEventListener('resize', forecastTrendResizeHandler)
    forecastTrendResizeHandler = null
  }
  resizeObs?.disconnect()
  resizeObs = null
  mapRef.value?.remove()
  mapRef.value = null
  warehouseMarkerById.clear()
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
}

.emap-shell--dashboard {
  color: #e2e8f0;
  background:
    linear-gradient(rgba(56, 189, 248, 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(56, 189, 248, 0.04) 1px, transparent 1px),
    radial-gradient(ellipse 120% 70% at 50% -15%, rgba(14, 165, 233, 0.14), transparent 55%),
    radial-gradient(ellipse 60% 50% at 100% 80%, rgba(59, 130, 246, 0.08), transparent 45%),
    linear-gradient(180deg, #050b14 0%, #0a1628 42%, #060d18 100%);
  background-size: 28px 28px, 28px 28px, auto, auto, auto;
}

.emap-toolbar {
  margin: 12px 16px 0;
  padding: 14px 16px;
  border: 1px solid rgba(34, 211, 238, 0.28);
  border-radius: 14px;
  background: rgba(6, 18, 40, 0.82);
  backdrop-filter: blur(12px);
  box-shadow:
    0 0 0 1px rgba(56, 189, 248, 0.06) inset,
    0 12px 32px rgba(0, 0, 0, 0.45);
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
  color: #7dd3fc;
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
  color: #fca5a5;
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
  background: linear-gradient(180deg, rgba(15, 40, 72, 0.95) 0%, rgba(8, 26, 52, 0.98) 100%);
  border: 1px solid rgba(56, 189, 248, 0.35);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: #e2e8f0;
}

.emap-cat-pill:hover {
  border-color: #22d3ee;
  box-shadow: 0 0 14px rgba(34, 211, 238, 0.25);
  transform: translateY(-1px);
}

.emap-cat-pill .form-check-input {
  margin: 0;
  flex-shrink: 0;
}

.emap-shell--dashboard .emap-cat-pill .emap-cat-name {
  color: #f1f5f9;
}

.emap-shell--dashboard .emap-cat-pill .form-check-input {
  border-width: 2px;
  border-color: rgba(125, 211, 252, 0.75);
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

/* 大屏下说明文字：接近参考图的白/浅灰主字，避免 text-muted 过暗 */
.emap-shell--dashboard .emap-toolbar-hint {
  color: #e2e8f0 !important;
}

.emap-shell--dashboard .emap-toolbar-hint strong {
  color: #f8fafc;
  font-weight: 700;
}

.emap-title {
  font-weight: 700;
  font-size: 16px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #f1f5f9;
  text-shadow: 0 0 24px rgba(34, 211, 238, 0.35);
}

.emap-map-wrap {
  position: relative;
  flex: 1;
  min-height: 0;
  margin: 12px 16px 16px;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid rgba(34, 211, 238, 0.32);
  box-shadow:
    0 0 0 1px rgba(56, 189, 248, 0.08) inset,
    0 16px 48px rgba(0, 0, 0, 0.5);
}

.emap-map-wrap::before,
.emap-map-wrap::after {
  content: '';
  position: absolute;
  width: 18px;
  height: 18px;
  border-color: #22d3ee;
  border-style: solid;
  z-index: 5;
  pointer-events: none;
  opacity: 0.85;
}

.emap-map-wrap::before {
  top: 10px;
  left: 10px;
  border-width: 2px 0 0 2px;
}

.emap-map-wrap::after {
  bottom: 10px;
  right: 10px;
  border-width: 0 2px 2px 0;
}

.emap-map {
  width: 100%;
  height: 100%;
  background: #0a1628;
}

.emap-floating-actions {
  position: absolute;
  left: 12px;
  bottom: 12px;
  z-index: 1000;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  background: rgba(6, 18, 40, 0.88);
  border: 1px solid rgba(34, 211, 238, 0.28);
  backdrop-filter: blur(12px);
  border-radius: 12px;
  padding: 9px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
}

.emap-map-tools {
  position: absolute;
  top: 50%;
  right: 12px;
  transform: translateY(-50%);
  z-index: 1000;
  min-width: 190px;
  max-width: 220px;
  background: rgba(6, 18, 40, 0.9);
  border: 1px solid rgba(34, 211, 238, 0.28);
  border-radius: 12px;
  padding: 8px 10px;
  backdrop-filter: blur(12px);
  box-shadow: 0 8px 26px rgba(0, 0, 0, 0.45);
  font-size: 12px;
  overflow: visible;
  color: #cbd5e1;
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
  color: #f1f5f9;
}

.emap-map-tools-tab {
  position: absolute;
  top: 50%;
  right: 0;
  transform: translateY(-50%);
  z-index: 1000;
  border: 1px solid rgba(34, 211, 238, 0.35);
  border-right: none;
  background: rgba(6, 18, 40, 0.92);
  color: #e2e8f0;
  padding: 10px 10px;
  border-radius: 8px 0 0 8px;
  backdrop-filter: blur(12px);
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.4);
  writing-mode: vertical-rl;
  text-orientation: mixed;
  font-size: 12px;
  font-weight: 600;
}

.emap-map-tools-tab:hover {
  background: rgba(12, 36, 68, 0.95);
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
  color: #cbd5e1;
}

.emap-tool-check .form-check-input {
  margin: 0;
}

.emap-tool-coord {
  font-size: 11px;
  line-height: 1.35;
  word-break: break-all;
}

.emap-geo-nearest-toast {
  position: absolute;
  top: 14px;
  right: 14px;
  z-index: 1100;
  max-width: min(360px, calc(100% - 28px));
  padding: 10px 40px 10px 12px;
  background: rgba(6, 18, 40, 0.96);
  border: 1px solid rgba(34, 211, 238, 0.35);
  border-radius: 10px;
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.5);
  font-size: 12px;
  line-height: 1.45;
  color: #e2e8f0;
  word-break: break-word;
}

.emap-geo-nearest-toast-close {
  position: absolute;
  top: 4px;
  right: 6px;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #94a3b8;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.emap-geo-nearest-toast-close:hover {
  color: #f1f5f9;
  background: rgba(34, 211, 238, 0.12);
}

.emap-geo-nearest-toast-body {
  margin: 0;
}

/* 非模态：仅占地图顶部一条，不挡点击 */
.emap-comparison-prereq-toast {
  position: absolute;
  left: 50%;
  top: 12px;
  transform: translateX(-50%);
  z-index: 1150;
  max-width: min(300px, calc(100% - 24px));
  padding: 7px 34px 7px 10px;
  background: rgba(6, 18, 40, 0.94);
  border: 1px solid rgba(34, 211, 238, 0.35);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  pointer-events: auto;
}

.emap-comparison-prereq-toast-close {
  position: absolute;
  top: 2px;
  right: 4px;
  width: 26px;
  height: 26px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #94a3b8;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.emap-comparison-prereq-toast-close:hover {
  color: #f1f5f9;
  background: rgba(34, 211, 238, 0.12);
}

.emap-comparison-prereq-toast-msg {
  margin: 0;
  font-size: 11px;
  line-height: 1.45;
  color: #e2e8f0;
  word-break: break-word;
}

.emap-map-tools-arrow {
  position: absolute;
  top: 50%;
  right: -14px;
  transform: translateY(-50%);
  width: 20px;
  height: 44px;
  border: 1px solid rgba(34, 211, 238, 0.35);
  border-left: none;
  border-radius: 0 8px 8px 0;
  background: rgba(8, 26, 52, 0.96);
  color: #e2e8f0;
  font-size: 11px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
}

.emap-map-tools-arrow:hover {
  background: rgba(12, 36, 68, 0.98);
}

.emap-cmp-panel {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 1000;
  width: min(560px, calc(100% - 24px));
  max-height: calc(100% - 24px);
  background: rgba(6, 18, 40, 0.92);
  border: 1px solid rgba(34, 211, 238, 0.3);
  backdrop-filter: blur(14px);
  border-radius: 14px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
  padding: 10px 12px;
  overflow: auto;
  color: #e2e8f0;
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
  color: #f8fafc;
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.emap-cmp-panel-head-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.emap-cmp-panel-toggle {
  border: 1px solid rgba(34, 211, 238, 0.35);
  border-radius: 6px;
  background: rgba(8, 26, 52, 0.9);
  color: #cbd5e1;
  font-size: 12px;
  line-height: 1;
  padding: 6px 8px;
  cursor: pointer;
}

.emap-cmp-panel-toggle:hover {
  background: rgba(12, 36, 68, 0.95);
  border-color: #22d3ee;
}

.emap-cmp-panel-close {
  border: none;
  background: transparent;
  color: #94a3b8;
  font-size: 26px;
  line-height: 1;
  padding: 0 4px;
  cursor: pointer;
}

.emap-cmp-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
  margin-bottom: 10px;
}

.emap-cmp-summary-card {
  background: linear-gradient(180deg, rgba(12, 36, 68, 0.95) 0%, rgba(6, 22, 48, 0.98) 100%);
  border: 1px solid rgba(56, 189, 248, 0.28);
  border-radius: 8px;
  padding: 6px 8px;
  min-width: 0;
}

.emap-cmp-summary-label {
  font-size: 10px;
  line-height: 1.25;
  color: #7dd3fc;
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.emap-cmp-summary-value {
  font-size: 12px;
  font-weight: 600;
  color: #f1f5f9;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.emap-cmp-table-wrap {
  max-height: 360px;
  overflow-x: hidden;
  overflow-y-y: auto;
  overflow-x: hidden;
  border: 1px solid rgba(34, 211, 238, 0.22);
  border-radius: 8px;
}

/* 固定列宽：厂名省略，四列金额完整单行；容器不横向滚动 */
.emap-cmp-table {
  width: 100%;
  table-layout: fixed;
  font-size: 11px;
}

.emap-cmp-table th,
.emap-cmp-table td {
  vertical-align: middle;
  padding-left: 6px;
  padding-right: 6px;
}

.emap-cmp-table .emap-cmp-col-rank {
  width: 2.75rem;
  white-space: nowrap;
}

.emap-cmp-table .emap-cmp-col-smelter {
  width: 26%;
  max-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.emap-cmp-table .emap-cmp-col-money {
  width: 18.5%;
  white-space: nowrap;
}

.emap-cmp-table td.emap-cmp-table-empty {
  white-space: normal;
  max-width: none;
}

.emap-cmp-table-wrap table th,
.emap-cmp-table-wrap table td {
  white-space: normal;
  word-break: break-word;
}

.emap-cmp-table-wrap table th:nth-child(2),
.emap-cmp-table-wrap table td:nth-child(2) {
  max-width: none;
}

.emap-side-card {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 1000;
  width: 340px;
  max-width: calc(100% - 24px);
  background: rgba(6, 18, 40, 0.92);
  border: 1px solid rgba(34, 211, 238, 0.28);
  border-radius: 10px;
  padding: 10px 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
  font-size: 12px;
  color: #e2e8f0;
}

.emap-side-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 6px;
  color: #f1f5f9;
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
  color: #fca5a5;
}

.emap-fc-modal {
  position: fixed;
  inset: 0;
  background: rgba(2, 8, 18, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  backdrop-filter: blur(4px);
}

.emap-fc-modal-content {
  background: linear-gradient(180deg, #0c1a30 0%, #081424 100%);
  border: 1px solid rgba(34, 211, 238, 0.35);
  border-radius: 12px;
  width: min(720px, 96vw);
  max-width: 96%;
  max-height: 90vh;
  overflow: auto;
  box-shadow: 0 20px 56px rgba(0, 0, 0, 0.55);
  color: #e2e8f0;
}

.emap-fc-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(34, 211, 238, 0.2);
}

.emap-fc-modal-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: #f1f5f9;
  margin: 0;
}

.emap-fc-close-btn {
  background: none;
  border: none;
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
  color: #94a3b8;
  padding: 0 4px;
}

.emap-fc-close-btn:hover {
  color: #e2e8f0;
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
  color: #94a3b8;
}

.emap-fc-chart-meta {
  background: rgba(8, 26, 52, 0.75);
  border: 1px solid rgba(34, 211, 238, 0.2);
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
  color: #cbd5e1;
  line-height: 1.5;
}

.emap-fc-chart-meta strong {
  color: #7dd3fc;
  margin-right: 6px;
}

.emap-fc-chart-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.emap-fc-modal-footer {
  padding: 16px 20px;
  border-top: 1px solid rgba(34, 211, 238, 0.2);
  text-align: right;
}

.emap-legend {
  position: absolute;
  right: 12px;
  bottom: 12px;
  z-index: 1000;
  background: rgba(6, 18, 40, 0.9);
  border: 1px solid rgba(34, 211, 238, 0.28);
  backdrop-filter: blur(12px);
  border-radius: 10px;
  padding: 8px 12px;
  font-size: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.45);
  color: #e2e8f0;
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
  border: 1px solid rgba(34, 211, 238, 0.5);
  box-shadow: 0 0 8px rgba(37, 99, 235, 0.45);
}

.emap-legend-dot--wh {
  background: #38bdf8;
}

.emap-legend-tri {
  width: 0;
  height: 0;
  border-left: 7px solid transparent;
  border-right: 7px solid transparent;
  border-bottom: 12px solid #fb923c;
  filter: drop-shadow(0 0 6px rgba(251, 146, 60, 0.55));
}

.emap-alert-dashboard {
  background: rgba(120, 53, 15, 0.35);
  border: 1px solid rgba(251, 191, 36, 0.45);
  color: #fde68a;
}

.emap-shell--dashboard :deep(.form-select),
.emap-shell--dashboard :deep(.form-control) {
  background-color: rgba(8, 22, 44, 0.92);
  border-color: rgba(56, 189, 248, 0.35);
  color: #e2e8f0;
}

.emap-shell--dashboard :deep(.form-select:focus),
.emap-shell--dashboard :deep(.form-control:focus) {
  border-color: #22d3ee;
  box-shadow: 0 0 0 0.2rem rgba(34, 211, 238, 0.2);
}

.emap-shell--dashboard :deep(.table) {
  --bs-table-bg: transparent;
  --bs-table-color: #f1f5f9;
  /* BS 5.3 斑马纹行单独用 striped-color，不设则仍为深色字 */
  --bs-table-striped-color: #f1f5f9;
  --bs-table-striped-bg: rgba(34, 211, 238, 0.08);
  --bs-table-active-color: #f8fafc;
  --bs-table-active-bg: rgba(34, 211, 238, 0.14);
  --bs-table-hover-color: #f8fafc;
  --bs-table-hover-bg: rgba(34, 211, 238, 0.12);
  border-color: rgba(34, 211, 238, 0.2);
  color: #f1f5f9;
}

.emap-shell--dashboard :deep(.table thead th) {
  color: #f8fafc;
  font-weight: 600;
}

.emap-shell--dashboard :deep(.table tbody td) {
  color: #f1f5f9;
}

.emap-shell--dashboard :deep(.table tbody td.text-success) {
  color: #4ade80 !important;
}

.emap-shell--dashboard :deep(.table > :not(caption) > * > *) {
  border-bottom-color: rgba(34, 211, 238, 0.15);
}

/* 全局说明灰字：大屏上提亮（含品类行小字、坐标、空状态等） */
.emap-shell--dashboard :deep(.text-muted) {
  color: #a8c4dc !important;
}

.emap-shell--dashboard :deep(.btn-primary) {
  background: linear-gradient(180deg, #0891b2 0%, #0e7490 100%);
  border-color: rgba(34, 211, 238, 0.55);
  color: #f0fdfa;
  box-shadow: 0 0 12px rgba(34, 211, 238, 0.25);
}

.emap-shell--dashboard :deep(.btn-primary:hover) {
  background: linear-gradient(180deg, #06b6d4 0%, #0891b2 100%);
  border-color: #22d3ee;
}

.emap-shell--dashboard :deep(.btn-secondary) {
  background: rgba(30, 41, 59, 0.9);
  border-color: rgba(148, 163, 184, 0.45);
  color: #e2e8f0;
}

.emap-shell--dashboard :deep(.btn-secondary:hover) {
  background: rgba(51, 65, 85, 0.95);
  border-color: #94a3b8;
  color: #f8fafc;
}

.emap-shell--dashboard :deep(.btn-success) {
  background: linear-gradient(180deg, #059669 0%, #047857 100%);
  border-color: rgba(52, 211, 153, 0.5);
  color: #ecfdf5;
}

.emap-shell--dashboard :deep(.btn-outline-secondary) {
  color: #cbd5e1;
  border-color: rgba(148, 163, 184, 0.45);
  background: rgba(15, 23, 42, 0.4);
}

.emap-shell--dashboard :deep(.btn-outline-secondary:hover) {
  background: rgba(51, 65, 85, 0.75);
  border-color: #94a3b8;
  color: #f8fafc;
}

.emap-shell--dashboard :deep(.btn-outline-primary) {
  color: #7dd3fc;
  border-color: rgba(56, 189, 248, 0.55);
  background: rgba(8, 26, 52, 0.5);
}

.emap-shell--dashboard :deep(.btn-outline-primary:hover) {
  background: rgba(14, 116, 144, 0.45);
  border-color: #22d3ee;
  color: #f0f9ff;
}

.emap-shell--dashboard :deep(.btn-outline-success) {
  color: #6ee7b7;
  border-color: rgba(52, 211, 153, 0.5);
  background: rgba(6, 40, 32, 0.35);
}

.emap-shell--dashboard :deep(.btn-outline-success:hover) {
  background: rgba(6, 78, 59, 0.55);
  border-color: #34d399;
  color: #ecfdf5;
}

.emap-shell--dashboard :deep(.btn-outline-dark) {
  color: #e2e8f0;
  border-color: rgba(148, 163, 184, 0.4);
  background: rgba(15, 23, 42, 0.35);
}

.emap-shell--dashboard :deep(.btn-outline-dark:hover) {
  background: rgba(51, 65, 85, 0.65);
  border-color: #cbd5e1;
  color: #fff;
}

.emap-shell--dashboard :deep(.form-check-input) {
  background-color: rgba(8, 22, 44, 0.85);
  border-color: rgba(56, 189, 248, 0.45);
}

.emap-shell--dashboard :deep(.form-check-input:checked) {
  background-color: #0891b2;
  border-color: #22d3ee;
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

.emap-marker--warehouse .emap-pin-inner--dimmed {
  opacity: 0.48;
  filter: saturate(0.52) brightness(1.18);
  border-color: rgba(255, 255, 255, 0.72);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
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
  color: #7dd3fc;
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

.emap-flow-arrow-wrap {
  background: transparent;
  border: none;
  border-radius: 6px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.25);
  font-size: 11px;
  line-height: 1.35;
  padding: 6px 8px;
  pointer-events: none !important;
}

/* 仓库/冶炼厂悬浮：与弹窗同内容，不挡下方图钉点击 */
.leaflet-tooltip.emap-marker-hover-tip {
  background: rgba(6, 18, 40, 0.96) !important;
  color: #e2e8f0 !important;
  border: 1px solid rgba(34, 211, 238, 0.35) !important;
  border-radius: 8px !important;
  padding: 8px 10px !important;
  font-size: 12px;
  line-height: 1.45;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
  max-width: min(280px, 85vw);
}

.leaflet-tooltip.emap-marker-hover-tip .leaflet-tooltip-content {
  margin: 0;
}

.emap-shell--dashboard .leaflet-tooltip.emap-marker-hover-tip .text-muted {
  color: #94a3b8 !important;
}

/* 大屏主题：压暗瓦片、与面板色调统一（仅 .emap-shell--dashboard 内） */
.emap-shell--dashboard .leaflet-container {
  background: #0a1628;
}
.emap-shell--dashboard .leaflet-tile-pane {
  filter: brightness(0.58) contrast(1.08) saturate(0.72) hue-rotate(-6deg);
}

.emap-shell--dashboard .leaflet-popup-content-wrapper {
  background: rgba(6, 18, 40, 0.96);
  color: #e2e8f0;
  border: 1px solid rgba(34, 211, 238, 0.32);
  border-radius: 10px;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.5);
}

.emap-shell--dashboard .leaflet-popup-tip {
  background: rgba(6, 18, 40, 0.96);
  border: 1px solid rgba(34, 211, 238, 0.25);
  box-shadow: none;
}

.emap-shell--dashboard .leaflet-popup-content .text-muted {
  color: #94a3b8 !important;
}

.emap-shell--dashboard .leaflet-popup-content a {
  color: #7dd3fc;
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
