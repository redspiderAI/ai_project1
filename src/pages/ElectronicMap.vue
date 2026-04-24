<template>
  <div ref="emapShellRef" class="emap-shell emap-shell--dashboard">
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
        <button
          type="button"
          class="btn btn-sm btn-primary ms-auto"
          :disabled="loading"
          title="从服务器拉取最新库房与冶炼厂并更新本地缓存"
          @click="loadAndPlot"
        >
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
            <button
              type="button"
              class="btn btn-sm btn-primary"
              :disabled="loading"
              title="从服务器拉取最新库房与冶炼厂并更新本地缓存"
              @click="loadAndPlot"
            >
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
      <div
        ref="mapToolsFloatRef"
        class="emap-map-tools-float"
        :class="{ 'emap-map-tools-float--default': mapToolsFloatTopPx == null }"
        :style="mapToolsFloatStyle"
      >
        <div
          v-if="mapToolsCollapsed"
          class="emap-map-tools-bubble"
          @pointerdown="onBubbleDragPointerDown"
        >
          <span class="emap-map-tools-drag-hint" aria-hidden="true" title="上下拖动">
            <i class="bi bi-grip-vertical" aria-hidden="true"></i>
          </span>
          <button type="button" class="emap-map-tools-tab" @click="mapToolsCollapsed = false">
            地图工具
          </button>
        </div>
        <transition name="emap-tools-slide">
          <div v-if="!mapToolsCollapsed" class="emap-map-tools">
            <div class="emap-map-tools-head" @pointerdown="onMapToolsHeadPointerDown">
              <span class="emap-map-tools-drag-hint" aria-hidden="true" title="按住标题栏上下拖动">
                <i class="bi bi-grip-vertical" aria-hidden="true"></i>
              </span>
              <div class="emap-map-tools-title">地图工具</div>
              <button
                type="button"
                class="emap-map-tools-collapse"
                title="收起工具栏"
                aria-label="收起地图工具"
                @pointerdown.stop
                @click.stop="mapToolsCollapsed = true"
              >
                <i class="bi bi-chevron-right" aria-hidden="true"></i>
              </button>
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
          <div class="emap-tool-block">
            <span class="emap-tool-block-label">搜索库房 / 冶炼厂</span>
            <div class="emap-tool-search-wrap">
              <div class="emap-tool-search-row">
                <input
                  v-model="emapMapSearchText"
                  type="search"
                  class="form-control form-control-sm"
                  placeholder="输入名称，列表中选点"
                  autocomplete="off"
                  aria-autocomplete="list"
                  :aria-expanded="emapPointSearchOpen"
                  aria-controls="emap-point-search-list"
                  @focus="onEmapPointSearchFocus"
                  @blur="onEmapPointSearchBlur"
                  @input="onEmapPointSearchInput"
                  @keydown.enter.prevent="runEmapPointSearch"
                  @keydown.down.prevent="onEmapPointSearchKeyArrow('down')"
                  @keydown.up.prevent="onEmapPointSearchKeyArrow('up')"
                  @keydown.escape.prevent="emapPointSearchOpen = false"
                />
                <button
                  type="button"
                  class="btn btn-sm btn-outline-secondary flex-shrink-0"
                  title="定位到当前高亮项（或第一项）"
                  @mousedown.prevent
                  @click="runEmapPointSearch"
                >
                  定位
                </button>
              </div>
              <div
                v-show="emapPointSearchOpen && emapMapSearchText.trim()"
                id="emap-point-search-list"
                class="emap-point-search-dropdown"
                role="listbox"
                aria-label="名称匹配结果"
              >
                <template v-if="emapPointSearchCandidates.length">
                  <button
                    v-for="(p, idx) in emapPointSearchCandidates"
                    :id="'emap-point-search-' + idx"
                    :key="p.kind + '-' + p.id"
                    type="button"
                    class="emap-point-search-item"
                    :class="{ 'emap-point-search-item--active': idx === emapPointSearchActiveIdx }"
                    role="option"
                    :aria-selected="idx === emapPointSearchActiveIdx"
                    @mousedown.prevent="focusMapPointFromSearch(p)"
                    @mouseenter="emapPointSearchActiveIdx = idx"
                  >
                    <span class="emap-point-search-item-title">{{ p.title }}</span>
                    <span class="emap-point-search-item-meta">
                      <span class="emap-point-search-item-kind">{{
                        p.kind === 'warehouse' ? '库房' : '冶炼厂'
                      }}</span>
                      <span v-if="p.subtitle" class="emap-point-search-item-sub">{{ p.subtitle }}</span>
                    </span>
                  </button>
                </template>
                <div v-else class="emap-point-search-empty">无匹配名称，请修改关键词</div>
              </div>
            </div>
            <p v-if="emapSearchFeedback" class="emap-tool-hint text-muted mb-0">{{ emapSearchFeedback }}</p>
          </div>
          <div class="emap-tool-block">
            <label class="emap-tool-block-label" for="emap-province-filter">按省筛选</label>
            <select
              id="emap-province-filter"
              v-model="emapProvinceFilter"
              class="form-select form-select-sm"
              title="34 个省级行政区；地图绘制省界红线，并筛选库房/冶炼厂"
            >
              <option value="">全部（不筛选）</option>
              <option v-for="it in EMAP_CHINA_REGION_OPTIONS" :key="it.value" :value="it.value">
                {{ it.label }}
              </option>
            </select>
            <p class="emap-tool-hint text-muted mb-0">
              外省标记变淡；鼠标移到外省点上可临时恢复样式。选中省后在地图上用红线标出省界（需联网加载边界数据）。
            </p>
          </div>
          <div v-if="lastClickedCoordText" class="emap-tool-coord text-muted">
            {{ lastClickedCoordText }}
          </div>
          </div>
        </transition>
      </div>
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
                <th class="emap-cmp-col-cats">各品种单价</th>
                <th class="emap-cmp-col-money">总回收价</th>
                <th class="emap-cmp-col-money">总运费</th>
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
                <td class="emap-cmp-col-cats" v-html="formatComparisonCategoryPricesHtml(row)"></td>
                <td class="emap-cmp-col-money text-end">{{ formatComparisonTotalRecoveryCell(row.totalRecovery) }}</td>
                <td class="emap-cmp-col-money text-end">{{ formatComparisonFreightCell(row.totalFreight) }}</td>
                <td class="emap-cmp-col-money text-end text-success fw-semibold">
                  ¥ {{ toDisplayNum(row.netProfit).toLocaleString('zh-CN') }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="emap-map-corner">
        <div class="emap-legend">
          <span class="emap-legend-item"
            ><span class="emap-legend-dot emap-legend-dot--wh"></span> 库房（随类型颜色）</span
          >
          <span class="emap-legend-item"
            ><span class="emap-legend-tri"></span> 冶炼厂（接口）</span
          >
          <div v-if="warehouseTypeStats.length" class="emap-legend-stats">
            <div class="emap-legend-stats-title">
              库房类型数量
              <span class="emap-legend-stats-total">（共 {{ allWarehousePoints.length }}）</span>
            </div>
            <div
              v-for="row in warehouseTypeStats"
              :key="row.label"
              class="emap-legend-stat-row"
              :title="row.label"
            >
              <span
                class="emap-legend-stat-dot"
                :style="{ background: row.color, boxShadow: `0 0 6px ${row.color}88` }"
              />
              <span class="emap-legend-stat-label">{{ row.label }}</span>
              <span class="emap-legend-stat-count">{{ row.count }}</span>
            </div>
          </div>
        </div>
        <button
          type="button"
          class="btn btn-sm emap-fs-btn"
          :title="emapFullscreen ? '退出全屏 (Esc)' : '全屏查看地图'"
          @click="toggleEmapFullscreen"
        >
          <i class="bi" :class="emapFullscreen ? 'bi-fullscreen-exit' : 'bi-fullscreen'" aria-hidden="true" />
          {{ emapFullscreen ? '退出全屏' : '全屏' }}
        </button>
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
  /** 后端「总运费」；无明细时由旧逻辑推算 */
  totalFreight: number
  qtySum: number
  /** 与嵌入页「智能比价」各品种单价列一致：品类名 → 单价 */
  categoryPrices?: Record<string, number | null>
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
/** 回收品类勾选与吨数：跨页面/刷新保留 */
const EMAP_CATEGORY_PREFS_KEY = 'emap.categoryPrefs.v1'
/** 库房/冶炼厂打点数据：离开页面再进入时沿用缓存，仅「刷新数据」重新拉取 */
const EMAP_MARKERS_CACHE_KEY = 'emap.markersPayload.v1'

/** 地图「按省筛选」：34 个省级行政区（含省/自治区/直辖市/特别行政区），与国家统计口径一致 */
type EmapChinaRegionItem = { value: string; label: string }
type EmapChinaRegionGroup = { group: string; items: EmapChinaRegionItem[] }

const EMAP_CHINA_REGION_GROUPS: EmapChinaRegionGroup[] = [
  {
    group: '23个省',
    items: [
      { value: '河北', label: '河北省' },
      { value: '山西', label: '山西省' },
      { value: '辽宁', label: '辽宁省' },
      { value: '吉林', label: '吉林省' },
      { value: '黑龙江', label: '黑龙江省' },
      { value: '江苏', label: '江苏省' },
      { value: '浙江', label: '浙江省' },
      { value: '安徽', label: '安徽省' },
      { value: '福建', label: '福建省' },
      { value: '江西', label: '江西省' },
      { value: '山东', label: '山东省' },
      { value: '河南', label: '河南省' },
      { value: '湖北', label: '湖北省' },
      { value: '湖南', label: '湖南省' },
      { value: '广东', label: '广东省' },
      { value: '海南', label: '海南省' },
      { value: '四川', label: '四川省' },
      { value: '贵州', label: '贵州省' },
      { value: '云南', label: '云南省' },
      { value: '陕西', label: '陕西省' },
      { value: '甘肃', label: '甘肃省' },
      { value: '青海', label: '青海省' },
      { value: '台湾', label: '台湾省' },
    ],
  },
  {
    group: '5个自治区',
    items: [
      { value: '内蒙古', label: '内蒙古自治区' },
      { value: '广西', label: '广西壮族自治区' },
      { value: '西藏', label: '西藏自治区' },
      { value: '宁夏', label: '宁夏回族自治区' },
      { value: '新疆', label: '新疆维吾尔自治区' },
    ],
  },
  {
    group: '4个直辖市',
    items: [
      { value: '北京', label: '北京市' },
      { value: '天津', label: '天津市' },
      { value: '上海', label: '上海市' },
      { value: '重庆', label: '重庆市' },
    ],
  },
  {
    group: '2个特别行政区',
    items: [
      { value: '香港', label: '香港特别行政区' },
      { value: '澳门', label: '澳门特别行政区' },
    ],
  },
]

const EMAP_CHINA_REGION_OPTIONS: EmapChinaRegionItem[] = EMAP_CHINA_REGION_GROUPS.flatMap((g) => g.items)

/** 筛选值（简称）→ 行政区划代码，用于拉取省界 GeoJSON（阿里云 DataV areas_v3） */
const EMAP_FILTER_TO_ADCODE: Record<string, string> = {
  北京: '110000',
  天津: '120000',
  上海: '310000',
  重庆: '500000',
  河北: '130000',
  山西: '140000',
  辽宁: '210000',
  吉林: '220000',
  黑龙江: '230000',
  江苏: '320000',
  浙江: '330000',
  安徽: '340000',
  福建: '350000',
  江西: '360000',
  山东: '370000',
  河南: '410000',
  湖北: '420000',
  湖南: '430000',
  广东: '440000',
  海南: '460000',
  四川: '510000',
  贵州: '520000',
  云南: '530000',
  陕西: '610000',
  甘肃: '620000',
  青海: '630000',
  台湾: '710000',
  内蒙古: '150000',
  广西: '450000',
  西藏: '540000',
  宁夏: '640000',
  新疆: '650000',
  香港: '810000',
  澳门: '820000',
}

function emapProvinceFilterToAdcode(sel: string): string | null {
  const t = sel.trim().replace(/\s+/g, '')
  if (EMAP_FILTER_TO_ADCODE[t]) return EMAP_FILTER_TO_ADCODE[t]
  const stripped = t
    .replace(/特别行政区$/u, '')
    .replace(/壮族自治区|维吾尔自治区|回族自治区|自治区$/u, '')
    .replace(/省$/u, '')
    .replace(/市$/u, '')
  return EMAP_FILTER_TO_ADCODE[stripped] ?? null
}

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

const emapShellRef = ref<HTMLElement | null>(null)
const emapFullscreen = ref(false)
const mapWrapRef = ref<HTMLElement | null>(null)
const mapElRef = ref<HTMLElement | null>(null)
const mapRef = shallowRef<L.Map | null>(null)
const markerLayerRef = shallowRef<L.LayerGroup | null>(null)
const flowLayerRef = shallowRef<L.LayerGroup | null>(null)
const topTipLayerRef = shallowRef<L.LayerGroup | null>(null)
/** 按省筛选时绘制的行政区红线轮廓（GeoJSON） */
const provinceOutlineLayerRef = shallowRef<L.GeoJSON | null>(null)
/** 比价流向折线统一走 SVG，虚线 dash 动画与双层描边更稳定 */
const flowPathSvgRendererRef = shallowRef<L.SVG | null>(null)
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
const mapToolsCollapsed = ref(true)

watch(mapToolsCollapsed, async (collapsed) => {
  if (!collapsed) {
    await nextTick()
    clampMapToolsFloatInWrap()
    mapRef.value?.invalidateSize()
  }
})

const mapToolsFloatRef = ref<HTMLElement | null>(null)
/** 贴右侧时相对地图容器顶边的 top（px）；null 表示垂直居中（50% + translateY） */
const mapToolsFloatTopPx = ref<number | null>(null)

const mapToolsFloatStyle = computed(() => {
  if (mapToolsFloatTopPx.value == null) return {}
  return {
    top: `${mapToolsFloatTopPx.value}px`,
    right: '0',
    left: 'auto',
    transform: 'none',
  } as Record<string, string>
})

let mapToolsDragPid: number | null = null
let mapToolsDragSY = 0
let mapToolsDragOY = 0
let mapToolsDragSession = false
const mapToolsPointerMoveOpts: AddEventListenerOptions = { passive: false }

function onBubbleDragPointerDown(e: PointerEvent) {
  const t = e.target as HTMLElement
  if (t.closest('.emap-map-tools-tab')) return
  onMapToolsDragDown(e)
}

function onMapToolsHeadPointerDown(e: PointerEvent) {
  const t = e.target as HTMLElement
  if (t.closest('.emap-map-tools-collapse')) return
  onMapToolsDragDown(e)
}

function onMapToolsDragMove(e: PointerEvent) {
  if (!mapToolsDragSession) return
  if (mapToolsDragPid != null && e.pointerId !== mapToolsDragPid) return
  e.preventDefault()
  const wrap = mapWrapRef.value
  const dock = mapToolsFloatRef.value
  if (!wrap || !dock || mapToolsFloatTopPx.value == null) return
  const wih = wrap.clientHeight
  const dh = dock.offsetHeight
  const pad = 8
  let ny = mapToolsDragOY + (e.clientY - mapToolsDragSY)
  const maxY = Math.max(pad, wih - dh - pad)
  ny = Math.min(Math.max(pad, ny), maxY)
  mapToolsFloatTopPx.value = ny
}

function endMapToolsDrag(e: PointerEvent) {
  if (!mapToolsDragSession) return
  if (mapToolsDragPid != null && e.pointerId !== mapToolsDragPid) return
  mapToolsDragSession = false
  mapToolsDragPid = null
  window.removeEventListener('pointermove', onMapToolsDragMove, mapToolsPointerMoveOpts)
  window.removeEventListener('pointerup', endMapToolsDrag, true)
  window.removeEventListener('pointercancel', endMapToolsDrag, true)
  try {
    mapToolsFloatRef.value?.releasePointerCapture(e.pointerId)
  } catch {
    /* 已释放 */
  }
  void nextTick(() => {
    clampMapToolsFloatInWrap()
    mapRef.value?.invalidateSize()
  })
}

function onMapToolsDragDown(e: PointerEvent) {
  if (mapToolsDragSession) return
  if (e.button !== 0) return
  e.preventDefault()
  e.stopPropagation()
  const wrap = mapWrapRef.value
  const dock = mapToolsFloatRef.value
  if (!wrap || !dock) return
  const wr = wrap.getBoundingClientRect()
  const dr = dock.getBoundingClientRect()
  if (mapToolsFloatTopPx.value == null) {
    mapToolsFloatTopPx.value = dr.top - wr.top
  }
  mapToolsDragOY = mapToolsFloatTopPx.value
  mapToolsDragSY = e.clientY
  mapToolsDragPid = e.pointerId
  mapToolsDragSession = true
  try {
    dock.setPointerCapture(e.pointerId)
  } catch {
    /* 部分环境下 capture 不可用，仍依赖 window 上的 pointermove */
  }
  window.addEventListener('pointermove', onMapToolsDragMove, mapToolsPointerMoveOpts)
  window.addEventListener('pointerup', endMapToolsDrag, true)
  window.addEventListener('pointercancel', endMapToolsDrag, true)
}

function teardownMapToolsDragListeners() {
  window.removeEventListener('pointermove', onMapToolsDragMove, mapToolsPointerMoveOpts)
  window.removeEventListener('pointerup', endMapToolsDrag, true)
  window.removeEventListener('pointercancel', endMapToolsDrag, true)
  mapToolsDragSession = false
  mapToolsDragPid = null
}

/** 右侧上下拖动：仅钳制垂直方向，保证完整落在地图容器内 */
function clampMapToolsFloatInWrap() {
  const wrap = mapWrapRef.value
  const dock = mapToolsFloatRef.value
  if (!wrap || !dock) return
  const pad = 8
  const wih = wrap.clientHeight
  const dh = dock.offsetHeight
  if (dh <= 0) return
  if (mapToolsFloatTopPx.value != null) {
    const maxY = Math.max(pad, wih - dh - pad)
    const y = Math.min(Math.max(pad, mapToolsFloatTopPx.value), maxY)
    if (y !== mapToolsFloatTopPx.value) mapToolsFloatTopPx.value = y
  }
}
const nearestWarehouseBusy = ref(false)
const geoNearestToastVisible = ref(false)
const geoNearestToastMessage = ref('')
const comparisonPrereqToastVisible = ref(false)
const comparisonPrereqToastMessage = ref('')
const selectedWarehouse = ref<MapPoint | null>(null)
const comparisonType = ref<'base' | 'tax3'>('base')
/** 与品类 id 对应：默认全选、吨数默认 1（与智能比价一致可改） */
const categoryPrefs = reactive<Record<number, { selected: boolean; tons: string }>>({})
let categoryPrefsHydrating = false

function ensureCategoryPrefsForList(list: TlCategoryRow[]) {
  for (const c of list) {
    if (categoryPrefs[c.id] === undefined) {
      categoryPrefs[c.id] = { selected: false, tons: '0' }
    }
  }
}

function persistCategoryPrefsSnapshot() {
  const list = categories.value
  if (!list.length) return
  const snap: Record<string, { selected: boolean; tons: string }> = {}
  for (const c of list) {
    const pref = categoryPrefs[c.id]
    if (pref) {
      snap[String(c.id)] = { selected: !!pref.selected, tons: String(pref.tons ?? '0') }
    }
  }
  try {
    localStorage.setItem(EMAP_CATEGORY_PREFS_KEY, JSON.stringify(snap))
  } catch {
    /* 隐私模式 / 配额 */
  }
}

function applyCategoryPrefsFromStorage(list: TlCategoryRow[]) {
  if (!list.length) return
  let raw: unknown
  try {
    raw = JSON.parse(localStorage.getItem(EMAP_CATEGORY_PREFS_KEY) || 'null')
  } catch {
    return
  }
  if (!raw || typeof raw !== 'object') return
  const obj = raw as Record<string, unknown>
  for (const c of list) {
    const entry = obj[String(c.id)]
    if (!entry || typeof entry !== 'object') continue
    const e = entry as Record<string, unknown>
    const tonsRaw = e.tons
    const tons = tonsRaw != null && tonsRaw !== '' ? String(tonsRaw) : '0'
    categoryPrefs[c.id] = { selected: e.selected === true, tons }
  }
}

watch(
  categories,
  (list) => {
    categoryPrefsHydrating = true
    try {
      ensureCategoryPrefsForList(list)
      applyCategoryPrefsFromStorage(list)
    } finally {
      categoryPrefsHydrating = false
    }
    persistCategoryPrefsSnapshot()
  },
  { deep: true, immediate: true },
)

watch(categoryPrefs, () => {
  if (categoryPrefsHydrating) return
  persistCategoryPrefsSnapshot()
}, { deep: true })

const confirmedCategoryIds = ref<number[]>([])
const confirmedTotalTons = ref(0)
const confirmedPriceMode = ref<'base' | 'tax3'>('base')
const comparisonRanks = ref<ComparisonRankItem[]>([])
const lastComparisonSortKey = ref('')
const allWarehousePoints = ref<MapPoint[]>([])

type WarehouseTypeStatRow = { label: string; count: number; color: string }

const warehouseTypeStats = computed((): WarehouseTypeStatRow[] => {
  const by = new Map<string, { count: number; color: string }>()
  for (const p of allWarehousePoints.value) {
    const row = p.raw
    const label =
      pickStr(row, ['类型', 'type', 'warehouse_type_name', '类型名']).trim() || '未分类'
    const color = p.pinColor ?? DEFAULT_WAREHOUSE_COLOR
    const cur = by.get(label)
    if (!cur) by.set(label, { count: 1, color })
    else cur.count += 1
  }
  return [...by.entries()]
    .map(([label, { count, color }]) => ({ label, count, color }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'zh-CN'))
})

function syncEmapFullscreenFlag() {
  const shell = emapShellRef.value
  const fs =
    document.fullscreenElement ??
    (document as Document & { webkitFullscreenElement?: Element | null }).webkitFullscreenElement ??
    null
  emapFullscreen.value = !!(shell && fs === shell)
}

async function toggleEmapFullscreen() {
  const el = emapShellRef.value
  if (!el) return
  try {
    if (
      document.fullscreenElement === el ||
      (document as Document & { webkitFullscreenElement?: Element | null }).webkitFullscreenElement === el
    ) {
      if (document.exitFullscreen) await document.exitFullscreen()
      else
        await (
          document as Document & { webkitExitFullscreen?: () => Promise<void> }
        ).webkitExitFullscreen?.()
    } else {
      if (el.requestFullscreen) await el.requestFullscreen()
      else
        await (
          el as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> }
        ).webkitRequestFullscreen?.()
    }
  } catch {
    /* 用户拒绝或浏览器不支持 */
  } finally {
    await nextTick()
    mapRef.value?.invalidateSize()
  }
}

function onEmapFullscreenChange() {
  syncEmapFullscreenFlag()
  void nextTick(() => mapRef.value?.invalidateSize())
}
const allSmelterPoints = ref<MapPoint[]>([])

/** 库房 id → 标记，用于选中时把其余库房变浅 */
const warehouseMarkerById = new Map<string, L.Marker>()
/** 冶炼厂 id → 标记（省筛选、悬停恢复样式） */
const smelterMarkerById = new Map<string, L.Marker>()
/** 选择省份后，鼠标悬停的外省点 id，该点临时取消变淡 */
const hoverProvinceLiftId = ref<string | null>(null)
const emapProvinceFilter = ref('')
const emapMapSearchText = ref('')
const emapSearchFeedback = ref('')

/** 与高德类似：按点位名称匹配，下拉选择 */
const EMAP_POINT_SEARCH_MAX_RESULTS = 50
const emapPointSearchOpen = ref(false)
const emapPointSearchActiveIdx = ref(0)
let emapPointSearchBlurTimer: ReturnType<typeof setTimeout> | null = null

function scoreEmapPointTitleMatch(title: string, qLower: string): number {
  const t = title.trim().toLowerCase()
  if (!qLower || !t) return 0
  if (t === qLower) return 1000
  if (t.startsWith(qLower)) return 800
  if (t.includes(qLower)) return 400
  return 0
}

const emapPointSearchCandidates = computed(() => {
  const q = emapMapSearchText.value.trim().toLowerCase()
  if (!q) return []
  const pool = [...allWarehousePoints.value, ...allSmelterPoints.value]
  return pool
    .map((p) => ({ p, s: scoreEmapPointTitleMatch(p.title, q) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.p.title.localeCompare(b.p.title, 'zh-CN'))
    .slice(0, EMAP_POINT_SEARCH_MAX_RESULTS)
    .map((x) => x.p)
})

let resizeObs: ResizeObserver | null = null
let forecastTrendResizeHandler: (() => void) | null = null
let geoNearestToastTimer: ReturnType<typeof setTimeout> | null = null
let comparisonPrereqToastTimer: ReturnType<typeof setTimeout> | null = null
const flowAnimTimerIds: number[] = []
const flowOverlayCleanups: Array<() => void> = []

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

/** 从记录中解析省级名称，供筛选与统计（与地址解析规则尽量宽松） */
function provinceFromRow(row: Record<string, unknown>): string {
  const direct = pickStr(row, ['省', '省份', 'province', 'Province'])
  if (direct) return direct
  const blob = [addressText(row), pickStr(row, ['省市区', 'region'])].find((x) => String(x).trim() !== '')
  if (!blob) return ''
  const k = String(blob).replace(/\s+/g, '')
  const muni = k.match(/^(北京市|上海市|天津市|重庆市)/)
  if (muni) return muni[1]
  const p = k.match(/^(.*?(?:省|自治区|特别行政区))/)
  if (p) return p[1]
  return ''
}

/** 省级是否视为同一省（山东 / 山东省、前缀包含等） */
function provincesRoughlyEqual(rowProv: string, filterProv: string): boolean {
  const a = rowProv.trim().replace(/\s+/g, '')
  const b = filterProv.trim().replace(/\s+/g, '')
  if (!a || !b) return false
  if (a === b) return true
  if (a.startsWith(b) || b.startsWith(a)) return true
  const strip = (s: string) =>
    s
      .replace(/特别行政区$/g, '')
      .replace(/壮族自治区|维吾尔自治区|回族自治区|自治区$/g, '')
      .replace(/省$/g, '')
      .replace(/市$/g, '')
  const sa = strip(a)
  const sb = strip(b)
  return sa.length >= 2 && sb.length >= 2 && sa === sb
}

function bindMarkerProvinceHover(marker: L.Marker, p: MapPoint) {
  marker.on('mouseover', () => {
    if (!emapProvinceFilter.value.trim()) return
    const pv = provinceFromRow(p.raw)
    if (!provincesRoughlyEqual(pv, emapProvinceFilter.value)) {
      hoverProvinceLiftId.value = p.id
      refreshAllMarkerVisualState()
    }
  })
  marker.on('mouseout', () => {
    if (hoverProvinceLiftId.value === p.id) {
      hoverProvinceLiftId.value = null
      refreshAllMarkerVisualState()
    }
  })
}

function scrollEmapPointSearchActiveIntoView() {
  const idx = emapPointSearchActiveIdx.value
  document.getElementById(`emap-point-search-${idx}`)?.scrollIntoView({ block: 'nearest' })
}

function onEmapPointSearchFocus() {
  if (emapPointSearchBlurTimer != null) {
    clearTimeout(emapPointSearchBlurTimer)
    emapPointSearchBlurTimer = null
  }
  if (emapMapSearchText.value.trim()) {
    emapPointSearchOpen.value = true
    emapPointSearchActiveIdx.value = 0
  }
}

function onEmapPointSearchBlur() {
  emapPointSearchBlurTimer = setTimeout(() => {
    emapPointSearchOpen.value = false
    emapPointSearchBlurTimer = null
  }, 180)
}

function onEmapPointSearchInput() {
  const q = emapMapSearchText.value.trim()
  emapPointSearchActiveIdx.value = 0
  if (q) emapPointSearchOpen.value = true
  else emapPointSearchOpen.value = false
}

function onEmapPointSearchKeyArrow(dir: 'up' | 'down') {
  if (!emapPointSearchOpen.value || !emapMapSearchText.value.trim()) return
  const list = emapPointSearchCandidates.value
  if (!list.length) return
  let i = emapPointSearchActiveIdx.value
  if (i < 0 || i >= list.length) i = 0
  if (dir === 'down') i = Math.min(list.length - 1, i + 1)
  else i = Math.max(0, i - 1)
  emapPointSearchActiveIdx.value = i
  void nextTick(() => scrollEmapPointSearchActiveIntoView())
}

function focusMapPointFromSearch(p: MapPoint) {
  const map = mapRef.value
  if (!map) {
    emapSearchFeedback.value = '地图尚未就绪'
    return
  }
  const nMatch = emapPointSearchCandidates.value.length
  const zoom = Math.max(map.getZoom(), 11)
  map.setView([p.lat, p.lng], zoom, { animate: true })
  openMarkerPopupNear(p.lat, p.lng)
  if (p.kind === 'warehouse') {
    selectedWarehouse.value = p
    forecastError.value = ''
    closeForecastModal()
    void runComparisonForWarehouse(p)
  }
  emapSearchFeedback.value =
    nMatch > 1 ? `已选择：${p.title}（${nMatch} 处名称匹配，可继续输入缩小）` : `已定位：${p.title}`
  if (emapPointSearchBlurTimer != null) {
    clearTimeout(emapPointSearchBlurTimer)
    emapPointSearchBlurTimer = null
  }
  emapPointSearchOpen.value = false
  emapPointSearchActiveIdx.value = 0
}

function runEmapPointSearch() {
  const map = mapRef.value
  const q = emapMapSearchText.value.trim()
  emapSearchFeedback.value = ''
  if (!map) {
    emapSearchFeedback.value = '地图尚未就绪'
    return
  }
  if (!q) {
    emapSearchFeedback.value = '请输入名称'
    return
  }
  const list = emapPointSearchCandidates.value
  if (!list.length) {
    emapSearchFeedback.value = '未匹配到库房或冶炼厂'
    emapPointSearchOpen.value = true
    return
  }
  let i = emapPointSearchActiveIdx.value
  if (i < 0 || i >= list.length) i = 0
  focusMapPointFromSearch(list[i]!)
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
  flowPathSvgRendererRef.value = L.svg({ padding: 0.5 })

  if (mapWrapRef.value) {
    resizeObs = new ResizeObserver(() => {
      map.invalidateSize()
      clampMapToolsFloatInWrap()
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

function refreshAllMarkerVisualState() {
  const sel = selectedWarehouse.value
  const selId = sel?.kind === 'warehouse' ? sel.id : null
  const validSelId = selId && warehouseMarkerById.has(selId) ? selId : null
  const filterOn = Boolean(emapProvinceFilter.value.trim())
  const selMatchesProvinceFilter =
    sel?.kind === 'warehouse' &&
    filterOn &&
    provincesRoughlyEqual(provinceFromRow(sel.raw), emapProvinceFilter.value)

  for (const p of allWarehousePoints.value) {
    const m = warehouseMarkerById.get(p.id)
    if (!m) continue
    let dimmed = false
    if (hoverProvinceLiftId.value === p.id) dimmed = false
    else {
      if (filterOn) {
        const ok = provincesRoughlyEqual(provinceFromRow(p.raw), emapProvinceFilter.value)
        if (!ok) dimmed = true
      }
      // 按省筛选时：点击省外仓库不再把省内其它仓库压暗（省外仍按筛选规则变淡）
      if (!dimmed && validSelId && validSelId !== p.id) {
        const pInFilterProvince =
          filterOn && provincesRoughlyEqual(provinceFromRow(p.raw), emapProvinceFilter.value)
        if (!(pInFilterProvince && !selMatchesProvinceFilter)) dimmed = true
      }
    }
    m.setIcon(warehouseIcon(p.pinColor ?? DEFAULT_WAREHOUSE_COLOR, dimmed))
  }

  for (const p of allSmelterPoints.value) {
    const m = smelterMarkerById.get(p.id)
    if (!m) continue
    let dimmed = false
    if (hoverProvinceLiftId.value === p.id) dimmed = false
    else if (filterOn) {
      dimmed = !provincesRoughlyEqual(provinceFromRow(p.raw), emapProvinceFilter.value)
    }
    m.setIcon(smelterIcon(dimmed))
  }
}

watch(selectedWarehouse, () => {
  refreshAllMarkerVisualState()
})

/** 从阿里云 DataV 加载省界并绘制红色轮廓 */
async function refreshProvinceOutlineLayer() {
  const map = mapRef.value
  if (provinceOutlineLayerRef.value && map) {
    map.removeLayer(provinceOutlineLayerRef.value)
    provinceOutlineLayerRef.value = null
  }
  const pr = emapProvinceFilter.value.trim()
  if (!map || !pr) return
  const adcode = emapProvinceFilterToAdcode(pr)
  if (!adcode) return
  const url = `https://geo.datav.aliyun.com/areas_v3/bound/${adcode}_full.json`
  try {
    const { data } = await axios.get(url, { timeout: 22000 })
    const layer = L.geoJSON(data as never, {
      style: {
        color: '#dc2626',
        weight: 3,
        opacity: 0.95,
        fillColor: '#dc2626',
        fillOpacity: 0.06,
      },
      interactive: false,
    })
    layer.addTo(map)
    provinceOutlineLayerRef.value = layer
  } catch (e) {
    console.warn('[emap] 省界轮廓加载失败（需可访问 geo.datav.aliyun.com）', pr, e)
  }
}

/** 省界轮廓 ∪ 该省点位，一起 fitBounds */
function fitViewToProvinceFilter() {
  const map = mapRef.value
  const pr = emapProvinceFilter.value.trim()
  if (!map || !pr) return
  const bounds = L.latLngBounds([])
  const outline = provinceOutlineLayerRef.value
  if (outline) {
    const ob = outline.getBounds()
    if (ob.isValid()) bounds.extend(ob)
  }
  for (const p of allWarehousePoints.value) {
    if (provincesRoughlyEqual(provinceFromRow(p.raw), pr)) bounds.extend([p.lat, p.lng])
  }
  for (const p of allSmelterPoints.value) {
    if (provincesRoughlyEqual(provinceFromRow(p.raw), pr)) bounds.extend([p.lat, p.lng])
  }
  if (!bounds.isValid()) return
  const maxZoom = outline ? 10 : 14
  map.fitBounds(bounds.pad(0.12), { maxZoom, animate: true })
}

watch(emapProvinceFilter, () => {
  hoverProvinceLiftId.value = null
  refreshAllMarkerVisualState()
  void (async () => {
    await refreshProvinceOutlineLayer()
    await nextTick()
    fitViewToProvinceFilter()
    void nextTick(() => clampMapToolsFloatInWrap())
  })()
})

function smelterIcon(dimmed = false): L.DivIcon {
  const cls = dimmed ? 'emap-smelter-tri emap-smelter-tri--dimmed' : 'emap-smelter-tri'
  return L.divIcon({
    className: 'emap-marker emap-marker--smelter',
    html: `<div class="${cls}" aria-hidden="true"></div>`,
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
  smelterMarkerById.clear()
  hoverProvinceLiftId.value = null

  allWarehousePoints.value = points.filter((p) => p.kind === 'warehouse')
  allSmelterPoints.value = points.filter((p) => p.kind === 'smelter')
  for (const p of points) {
    const icon =
      p.kind === 'warehouse'
        ? warehouseIcon(p.pinColor ?? DEFAULT_WAREHOUSE_COLOR, false)
        : smelterIcon(false)
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
    bindMarkerProvinceHover(marker, p)
    if (p.kind === 'warehouse') warehouseMarkerById.set(p.id, marker)
    else smelterMarkerById.set(p.id, marker)
  }

  refreshAllMarkerVisualState()

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

/** 与嵌入页 Ut() 一致：明细行取价口径 */
function pickDetailUnitPrice(row: Record<string, unknown>, priceMode: 'base' | 'tax3'): number | null {
  if (priceMode === 'tax3') {
    return pickNumber(row, [
      '含3%税价',
      '3%含税价',
      '含税价',
      '单价',
      '基准价',
      '报价',
      'unit_price',
      '最优价',
      '3pct_price',
    ])
  }
  return pickNumber(row, [
    '单价',
    '基准价',
    '报价',
    'unit_price',
    '最优价',
    '不含税价',
    'base_price',
  ])
}

function formatComparisonCategoryPricesHtml(row: ComparisonRankItem): string {
  const raw = row.categoryPrices
  const entries = raw ? Object.entries(raw) : []
  if (!entries.length) {
    if (row.unitPrice > 0) {
      return `${escapeHtml('均价')}: ¥${Number(toDisplayNum(row.unitPrice)).toLocaleString('zh-CN')}`
    }
    return '—'
  }
  return entries
    .map(([cat, v]) => {
      const label = escapeHtml(String(cat || '').trim() || '—')
      if (v == null || !Number.isFinite(v)) return `${label}: —`
      return `${label}: ¥${Number(v).toLocaleString('zh-CN')}`
    })
    .join('<br>')
}

/** 与嵌入页：总回收价为 0 或无效时显示 — */
function formatComparisonTotalRecoveryCell(n: number): string {
  const i = Number(n)
  if (!Number.isFinite(i) || i === 0) return '—'
  return `¥${i.toLocaleString('zh-CN')}`
}

/** 与嵌入页：总运费保留两位小数 */
function formatComparisonFreightCell(n: number): string {
  return `¥${Number(n || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function clearComparisonOverlays() {
  cancelFlowOverlayAnimations()
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

function cancelFlowOverlayAnimations() {
  for (const fn of flowOverlayCleanups) {
    try {
      fn()
    } catch {
      /* noop */
    }
  }
  flowOverlayCleanups.length = 0
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

/** 二次贝塞尔曲线点列（控制点垂直于弦，略鼓起的弧线） */
function quadraticBezierLatLng(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  segments: number,
  bend: number,
): L.LatLngTuple[] {
  const midLat = (lat1 + lat2) / 2
  const midLng = (lng1 + lng2) / 2
  const dx = lat2 - lat1
  const dy = lng2 - lng1
  const len = Math.sqrt(dx * dx + dy * dy) || 1
  const nx = (-dy / len) * bend * len * 0.25
  const ny = (dx / len) * bend * len * 0.25
  const cx = midLat + nx
  const cy = midLng + ny
  const out: L.LatLngTuple[] = []
  const n = Math.max(8, Math.floor(segments))
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const omt = 1 - t
    const lat = omt * omt * lat1 + 2 * omt * t * cx + t * t * lat2
    const lng = omt * omt * lng1 + 2 * omt * t * cy + t * t * lng2
    out.push([lat, lng])
  }
  return out
}

type ComparisonFlowPalette = {
  base: string
  main: string
  baseClass: string
  lineClass: string
  moverInnerClass: string
}

function comparisonFlowPalette(rank: number): ComparisonFlowPalette {
  if (rank <= 1) {
    return {
      base: 'rgba(5, 150, 105, 0.34)',
      main: '#059669',
      baseClass: 'emap-flow-line-base emap-flow-line-base--best',
      lineClass: 'emap-flow-line emap-flow-line--best',
      moverInnerClass: 'emap-flow-mover emap-flow-mover--best',
    }
  }
  if (rank === 2) {
    return {
      base: 'rgba(234, 88, 12, 0.34)',
      main: '#ea580c',
      baseClass: 'emap-flow-line-base emap-flow-line-base--orange',
      lineClass: 'emap-flow-line emap-flow-line--orange',
      moverInnerClass: 'emap-flow-mover emap-flow-mover--orange',
    }
  }
  return {
    base: 'rgba(220, 38, 38, 0.34)',
    main: '#dc2626',
    baseClass: 'emap-flow-line-base emap-flow-line-base--red',
    lineClass: 'emap-flow-line emap-flow-line--red',
    moverInnerClass: 'emap-flow-mover emap-flow-mover--red',
  }
}

/** 沿折线移动的箭头组（▶▶▶），随路径切线转向 */
function attachFlowMoverAlongCurve(
  flowLayer: L.LayerGroup,
  curve: L.LatLngTuple[],
  durationMs: number,
  moverInnerClass: string,
): void {
  if (curve.length < 2) return
  const state = { cancelled: false, raf: 0 }
  const marker = L.marker(curve[0], {
    icon: L.divIcon({
      className: 'emap-flow-mover-wrap',
      html: `<div class="${moverInnerClass}" aria-hidden="true"><span class="emap-flow-arrow-triple"><span>▶</span><span>▶</span><span>▶</span></span></div>`,
      iconSize: [36, 20],
      iconAnchor: [18, 10],
    }),
    interactive: false,
  }).addTo(flowLayer)
  let start = performance.now()
  const step = () => {
    if (state.cancelled) return
    const now = performance.now()
    const u = ((now - start) % durationMs) / durationMs
    const f = u * (curve.length - 1)
    const idx = Math.min(Math.floor(f), curve.length - 2)
    const localT = f - idx
    const p0 = curve[idx]!
    const p1 = curve[idx + 1]!
    const lat = p0[0] + (p1[0] - p0[0]) * localT
    const lng = p0[1] + (p1[1] - p0[1]) * localT
    marker.setLatLng([lat, lng])
    const br = bearingDeg(p0[0], p0[1], p1[0], p1[1])
    const tri = marker.getElement()?.querySelector('.emap-flow-arrow-triple') as HTMLElement | null
    /* translateY：三角字形视觉重心略低于几何中心，与粗线对齐 */
    if (tri) tri.style.transform = `translateY(-1.5px) rotate(${br - 90}deg)`
    state.raf = requestAnimationFrame(step)
  }
  state.raf = requestAnimationFrame(step)
  flowOverlayCleanups.push(() => {
    state.cancelled = true
    cancelAnimationFrame(state.raf)
    try {
      flowLayer.removeLayer(marker)
    } catch {
      /* 可能已被 clearLayers */
    }
  })
}

/** 冶炼厂利润排行：按比价类型取后端已算好的利润 */
function pickProfitFromSmelterRankRow(
  row: Record<string, unknown>,
  priceMode: 'base' | 'tax3',
): number {
  const nested = row['最优价口径合计']
  const nestObj =
    nested && typeof nested === 'object' && !Array.isArray(nested)
      ? (nested as Record<string, unknown>)
      : null
  if (priceMode === 'tax3') {
    const n =
      pickNumber(row, ['利润_含3%合计', '利润_含3%']) ??
      (nestObj ? pickNumber(nestObj, ['3pct', 'tax3']) : null) ??
      pickNumber(row, ['利润'])
    return n ?? 0
  }
  const n =
    pickNumber(row, ['利润_基准合计', '利润_基准']) ??
    (nestObj ? pickNumber(nestObj, ['base']) : null) ??
    pickNumber(row, ['利润'])
  return n ?? 0
}

function parseSmelterProfitRankArray(
  arr: unknown,
  priceMode: 'base' | 'tax3',
): ComparisonRankItem[] {
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
    const netProfit = pickProfitFromSmelterRankRow(row, priceMode)
    const totalRecovery =
      pickNumber(row, [
        '总价合计',
        '总回收价',
        '回收额',
        'totalRecovery',
        'materialSum',
        '物料总价',
        'total_recovery',
      ]) ?? 0
    const totalFreight =
      pickNumber(row, ['总运费合计', '总运费', '估算运费', '运费合计']) ?? 0
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
      totalFreight: toDisplayNum(totalFreight),
      qtySum: toDisplayNum(qtySum),
    })
  }
  return out.sort((a, b) => a.rank - b.rank)
}

/** 用接口 data 明细行的单价/总价/总运费按冶炼厂合并到排行行 */
function mergeComparisonRanksWithDetailRows(
  ranks: ComparisonRankItem[],
  detailRows: Record<string, unknown>[],
  priceMode: 'base' | 'tax3',
): ComparisonRankItem[] {
  if (!detailRows.length) return ranks
  return ranks.map((r) => {
    const rows = detailRows.filter((row) => {
      const name = pickStr(row, [
        '冶炼厂',
        'smelter',
        'smelter_name',
        '冶炼厂名',
        'factory_name',
        'name',
      ])
      if (!name) return false
      return name === r.smelter || name.includes(r.smelter) || r.smelter.includes(name)
    })
    if (!rows.length) return r
    const categoryPrices: Record<string, number | null> = {}
    let totalRecovery = 0
    let totalFreight = 0
    let qtySum = 0
    let unitNum = 0
    let unitDen = 0
    for (const row of rows) {
      const cat = pickStr(row, ['品类', 'category', '品种', '产品品种', 'category_name']) || '—'
      const upDetail = pickDetailUnitPrice(row, priceMode)
      categoryPrices[cat] = upDetail != null && Number.isFinite(upDetail) ? upDetail : null
      const qty = pickNumber(row, ['吨数', 'quantity', 'qty', '需求吨数', 'weight']) ?? 0
      const up = pickNumber(row, ['单价', '基准价', '含3%税价', '报价', 'unit_price', '最优价'])
      const tot = pickNumber(row, ['总价', '报价金额', '物料总价', 'total_recovery', 'material_sum'])
      const tf = pickNumber(row, ['总运费', '运费合计'])
      if (tot != null && Number.isFinite(tot)) totalRecovery += tot
      else if (up != null && qty > 0) totalRecovery += up * qty
      if (tf != null && Number.isFinite(tf)) totalFreight += tf
      qtySum += Math.max(0, qty)
      if (up != null && qty > 0) {
        unitNum += up * qty
        unitDen += qty
      }
    }
    const unitPrice =
      unitDen > 0 ? unitNum / unitDen : (pickNumber(rows[0]!, ['单价', '基准价', '报价']) ?? 0)
    return {
      ...r,
      categoryPrices,
      unitPrice: toDisplayNum(unitPrice),
      totalRecovery: toDisplayNum(totalRecovery),
      totalFreight: toDisplayNum(totalFreight),
      qtySum: toDisplayNum(qtySum),
    }
  })
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

function parseRankRowsLoose(
  rows: Record<string, unknown>[],
  priceMode: 'base' | 'tax3',
): ComparisonRankItem[] {
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
    const netProfitRaw =
      priceMode === 'tax3'
        ? (pickNumber(row, ['利润_含3%', '利润']) ?? 0)
        : (pickNumber(row, ['利润_基准', '利润']) ?? 0)
    const hasProfitLike = pickNumber(row, [
      '利润',
      '利润_基准',
      '利润_含3%',
      '净收益',
      'profit',
    ]) != null
    if (!smelter || !hasProfitLike) continue
    fallback += 1
    const rank = pickNumber(row, ['排名', '排行', '排序', 'rank', '名次']) ?? fallback
    const netProfit = netProfitRaw
    const totalRecovery =
      pickNumber(row, ['总价', '总回收价', '回收额', '物料总价', 'total_recovery', 'material_sum']) ?? 0
    const totalFreight =
      pickNumber(row, ['总运费', '运费合计', '估算运费', '运费单价', '运费/吨', 'freight_per_ton', 'freight']) ??
      0
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
      totalFreight: toDisplayNum(totalFreight),
      qtySum: toDisplayNum(qtySum),
    })
  }
  return out.sort((a, b) => a.rank - b.rank)
}

function rankingsFromComparisonResponse(
  raw: Record<string, unknown>,
  detailRows: Record<string, unknown>[],
  priceMode: 'base' | 'tax3',
): ComparisonRankItem[] {
  const payload = pickComparisonPayload(raw)
  const fromApi = parseSmelterProfitRankArray(
    raw['冶炼厂利润排行'] ?? payload?.['冶炼厂利润排行'] ?? payload?.['smelter_profit_rank'],
    priceMode,
  )
  if (fromApi.length) {
    return rerankSequentially(mergeComparisonRanksWithDetailRows(fromApi, detailRows, priceMode))
  }
  for (const rows of walkObjectArraysDeep(payload ?? raw)) {
    const parsed = parseRankRowsLoose(rows, priceMode)
    if (parsed.length) {
      return rerankSequentially(mergeComparisonRanksWithDetailRows(parsed, detailRows, priceMode))
    }
  }
  return aggregateComparisonRows(detailRows, priceMode)
}

/** 后端若已带 rank，仍按排序重编号，避免间断 */
function rerankSequentially(items: ComparisonRankItem[]): ComparisonRankItem[] {
  const sorted = [...items].sort((a, b) => a.rank - b.rank || b.netProfit - a.netProfit)
  return sorted.map((x, i) => ({ ...x, rank: i + 1 }))
}

function aggregateComparisonRows(
  rows: Record<string, unknown>[],
  priceMode: 'base' | 'tax3',
): ComparisonRankItem[] {
  const grouped = new Map<
    string,
    {
      smelter: string
      materialSum: number
      freightSum: number
      freightCount: number
      totalFreightSum: number
      qtySum: number
      categoryPrices: Record<string, number | null>
    }
  >()
  for (const row of rows) {
    const smelter =
      pickStr(row, ['smelter_name', '冶炼厂', '冶炼厂名', 'smelter', 'factory_name']) || '未知冶炼厂'
    const unitPrice =
      pickNumber(row, ['unit_price', '单价', '最优价', '价格', 'price', 'base_price', '不含税价', '3pct_price']) ??
      0
    const freight =
      pickNumber(row, ['freight_per_ton', '运费单价', 'freight', '运费每吨']) ?? 0
    const lineTotalFreight = pickNumber(row, ['总运费', '运费合计'])
    const qty = pickNumber(row, ['quantity', '吨数', '数量', 'qty', 'weight', '需求吨数']) ?? 1
    const key = smelter
    if (!grouped.has(key)) {
      grouped.set(key, {
        smelter,
        materialSum: 0,
        freightSum: 0,
        freightCount: 0,
        totalFreightSum: 0,
        qtySum: 0,
        categoryPrices: {},
      })
    }
    const g = grouped.get(key)!
    const cat = pickStr(row, ['品类', 'category', '品种', '产品品种', 'category_name']) || '—'
    const upLine = pickDetailUnitPrice(row, priceMode)
    g.categoryPrices[cat] = upLine != null && Number.isFinite(upLine) ? upLine : null
    g.materialSum += unitPrice * Math.max(0, qty)
    g.freightSum += freight
    g.freightCount += 1
    if (lineTotalFreight != null && Number.isFinite(lineTotalFreight)) g.totalFreightSum += lineTotalFreight
    g.qtySum += Math.max(0, qty)
  }
  return [...grouped.values()]
    .map((g) => {
      const avgFreightPerTon = g.freightCount > 0 ? g.freightSum / g.freightCount : 0
      const totalFreightFromLine =
        g.totalFreightSum > 0 ? g.totalFreightSum : avgFreightPerTon * g.qtySum
      let netProfit = g.materialSum - totalFreightFromLine
      const sample = rows.find(
        (r) =>
          (pickStr(r, ['smelter_name', '冶炼厂', '冶炼厂名', 'smelter', 'factory_name']) || '未知冶炼厂') ===
          g.smelter,
      )
      if (sample) {
        const backendProfit =
          priceMode === 'tax3'
            ? pickNumber(sample, ['利润_含3%', '利润'])
            : pickNumber(sample, ['利润_基准', '利润'])
        if (backendProfit != null && Number.isFinite(backendProfit)) netProfit = backendProfit
      }
      const unitPrice = g.qtySum > 0 ? g.materialSum / g.qtySum : 0
      return {
        smelter: g.smelter,
        unitPrice: toDisplayNum(unitPrice),
        netProfit: toDisplayNum(netProfit),
        totalRecovery: toDisplayNum(g.materialSum),
        totalFreight: toDisplayNum(totalFreightFromLine),
        qtySum: toDisplayNum(g.qtySum),
        categoryPrices: g.categoryPrices,
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
  cancelFlowOverlayAnimations()
  stopFlowAnimations()
  const flowLayer = flowLayerRef.value
  const tipLayer = topTipLayerRef.value
  const flowRenderer = flowPathSvgRendererRef.value
  if (!flowLayer || !tipLayer) return
  flowLayer.clearLayers()
  tipLayer.clearLayers()
  const list = ranks.slice(0, MAX_MAP_FLOW_TARGETS)
  for (let i = 0; i < list.length; i++) {
    const row = list[i]!
    const smelter = findSmelterPoint(row.smelter)
    if (!smelter) continue
    const curve = quadraticBezierLatLng(
      warehouse.lat,
      warehouse.lng,
      smelter.lat,
      smelter.lng,
      56,
      0.44 + (i % 5) * 0.02,
    )
    const palette = comparisonFlowPalette(row.rank)
    const staggerClass = `emap-flow-stagger-${i % 6}`
    const rendererOpt = flowRenderer ? { renderer: flowRenderer } : {}
    const baseOpts = {
      color: palette.base,
      weight: 5,
      opacity: 1,
      lineCap: 'round' as const,
      lineJoin: 'round' as const,
      className: palette.baseClass,
      interactive: false,
      ...rendererOpt,
    }
    const dashOpts = {
      color: palette.main,
      weight: 3.2,
      opacity: 1,
      lineCap: 'round' as const,
      lineJoin: 'round' as const,
      dashArray: '12 38',
      className: `${palette.lineClass} ${staggerClass}`,
      interactive: false,
      ...rendererOpt,
    }
    L.polyline(curve, baseOpts).addTo(flowLayer)
    L.polyline(curve, dashOpts).addTo(flowLayer)
    attachFlowMoverAlongCurve(flowLayer, curve, 2200 + (i % 4) * 280, palette.moverInnerClass)
    L.tooltip({
      permanent: true,
      direction: 'top',
      offset: [0, -8],
      className: 'emap-rank-tip',
    })
      .setLatLng([smelter.lat, smelter.lng])
      .setContent(
        `#${row.rank} ${escapeHtml(row.smelter)}<br/>利润: ${formatNum(row.netProfit)}<br/>总价: ${formatNum(row.totalRecovery)}<br/>总运费: ${formatNum(row.totalFreight)}`,
      )
      .addTo(tipLayer)
  }
}

type RunComparisonOptions = {
  /** 仅「重新比价」按钮为 true；地图点仓库缺条件时静默，不挡操作 */
  announceMissingPrereq?: boolean
}

async function runComparisonForWarehouse(warehouse: MapPoint, options?: RunComparisonOptions) {
  const { ids: categoryIds, totalTons } = getSelectedCategoryPayload()
  if (!categoryIds.length || totalTons <= 0) {
    if (options?.announceMissingPrereq) {
      showComparisonPrereqToast(
        '请先在上方「回收品类」中勾选品类并填写大于 0 的吨数，再进行比价。',
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
      categoryIds,
      totalTons,
      comparisonType.value,
    )
    const raw = await postTlGetComparison(body)
    const payload = pickComparisonPayload(raw)
    const sortKey = raw['最优价排序口径'] ?? payload?.['最优价排序口径']
    lastComparisonSortKey.value =
      sortKey != null && String(sortKey).trim() !== '' ? String(sortKey).trim() : ''
    const detailRows = tlUnwrapComparisonDetails(raw)
    const ranks = rankingsFromComparisonResponse(raw, detailRows, comparisonType.value)
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

function reviveMapPointFromCache(p: unknown): MapPoint | null {
  if (!p || typeof p !== 'object') return null
  const o = p as Record<string, unknown>
  if (o.kind !== 'warehouse' && o.kind !== 'smelter') return null
  if (typeof o.id !== 'string' || !o.id.trim()) return null
  const lat = Number(o.lat)
  const lng = Number(o.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  const raw =
    o.raw != null && typeof o.raw === 'object' && !Array.isArray(o.raw)
      ? (o.raw as Record<string, unknown>)
      : {}
  const title = typeof o.title === 'string' ? o.title : String(o.title ?? '')
  const subtitle = typeof o.subtitle === 'string' ? o.subtitle : String(o.subtitle ?? '')
  if (o.kind === 'warehouse') {
    const pinColor = typeof o.pinColor === 'string' && o.pinColor.trim() ? o.pinColor : undefined
    return { kind: 'warehouse', id: o.id, title, subtitle, lat, lng, pinColor, raw }
  }
  return { kind: 'smelter', id: o.id, title, subtitle, lat, lng, raw }
}

function readEmapMarkersCache(): MapPoint[] | null {
  try {
    if (typeof localStorage === 'undefined') return null
    const raw = localStorage.getItem(EMAP_MARKERS_CACHE_KEY)
    if (raw == null) return null
    const parsed = JSON.parse(raw) as { v?: unknown; points?: unknown }
    if (parsed.v !== 1 || !Array.isArray(parsed.points)) return null
    const points: MapPoint[] = []
    for (const x of parsed.points) {
      const pt = reviveMapPointFromCache(x)
      if (pt) points.push(pt)
    }
    if (points.length !== parsed.points.length) return null
    return points
  } catch {
    return null
  }
}

function writeEmapMarkersCache(points: MapPoint[]) {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(EMAP_MARKERS_CACHE_KEY, JSON.stringify({ v: 1, points, ts: Date.now() }))
  } catch {
    /* 存储配额或无痕模式 */
  }
}

function restoreEmapMarkersFromCache(): boolean {
  const points = readEmapMarkersCache()
  if (points === null) return false
  if (!points.length) {
    loadError.value =
      '接口未返回可打点的库房或冶炼厂经纬度，请在业务系统补全坐标后刷新。'
  } else {
    loadError.value = ''
  }
  renderMarkers(points)
  return true
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
    writeEmapMarkersCache(points)
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  document.addEventListener('fullscreenchange', onEmapFullscreenChange)
  document.addEventListener('webkitfullscreenchange', onEmapFullscreenChange)
  await nextTick()
  initMap()
  const restored = restoreEmapMarkersFromCache()
  if (!restored) {
    await loadAndPlot()
  } else {
    void loadCategories()
    void nextTick(() => {
      mapRef.value?.invalidateSize()
      clampMapToolsFloatInWrap()
    })
  }
})

onBeforeUnmount(() => {
  if (emapPointSearchBlurTimer != null) {
    clearTimeout(emapPointSearchBlurTimer)
    emapPointSearchBlurTimer = null
  }
  teardownMapToolsDragListeners()
  document.removeEventListener('fullscreenchange', onEmapFullscreenChange)
  document.removeEventListener('webkitfullscreenchange', onEmapFullscreenChange)
  dismissGeoNearestToast()
  dismissComparisonPrereqToast()
  cancelFlowOverlayAnimations()
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
  smelterMarkerById.clear()
  markerLayerRef.value = null
  flowLayerRef.value = null
  topTipLayerRef.value = null
  flowPathSvgRendererRef.value = null
})
</script>

<style scoped>
.emap-shell {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 72px);
  min-height: 420px;
}

.emap-shell.emap-shell--dashboard:fullscreen {
  height: 100vh;
  min-height: 100vh;
  max-height: 100vh;
}

.emap-shell.emap-shell--dashboard:-webkit-full-screen {
  height: 100vh;
  min-height: 100vh;
  max-height: 100vh;
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

.emap-map-tools-float {
  position: absolute;
  /* 高于 Leaflet 控件层 (约 1000)，避免事件被地图挡住 */
  z-index: 10050;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0;
  pointer-events: auto;
  touch-action: none;
  max-width: calc(100% - 10px);
  box-sizing: border-box;
}

.emap-map-tools-float--default {
  right: 0;
  top: 50%;
  transform: translateY(-50%);
}

.emap-map-tools-bubble {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 8px 6px 10px;
  border-radius: 999px;
  background: rgba(6, 18, 40, 0.94);
  border: 1px solid rgba(34, 211, 238, 0.4);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(12px);
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.emap-map-tools-bubble:active {
  cursor: grabbing;
}

.emap-map-tools-drag-hint {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed rgba(34, 211, 238, 0.45);
  border-radius: 50%;
  color: #7dd3fc;
  font-size: 1rem;
  line-height: 1;
  opacity: 0.92;
  pointer-events: none;
}

.emap-map-tools {
  position: relative;
  width: min(268px, 100%);
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
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
  justify-content: flex-start;
  gap: 8px;
  margin: -4px -4px 6px;
  padding: 4px 6px;
  border-radius: 8px;
  cursor: grab;
  touch-action: none;
  user-select: none;
  border: 1px dashed rgba(34, 211, 238, 0.28);
}

.emap-map-tools-head:active {
  cursor: grabbing;
}

.emap-map-tools-title {
  flex: 1;
  min-width: 0;
  font-weight: 700;
  color: #f1f5f9;
}

.emap-map-tools-collapse {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  margin: -2px -6px -2px 6px;
  padding: 0;
  border: 1px solid rgba(34, 211, 238, 0.5);
  border-radius: 8px;
  background: rgba(8, 26, 52, 0.9);
  color: #7dd3fc;
  font-size: 1.15rem;
  line-height: 1;
  cursor: pointer;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
}

.emap-map-tools-collapse:hover {
  background: rgba(34, 211, 238, 0.2);
  color: #f8fafc;
  border-color: rgba(34, 211, 238, 0.65);
}

.emap-map-tools-tab {
  position: relative;
  border: 1px solid rgba(34, 211, 238, 0.35);
  background: rgba(8, 26, 52, 0.92);
  color: #e2e8f0;
  padding: 10px 8px;
  border-radius: 999px;
  backdrop-filter: blur(12px);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
  writing-mode: vertical-rl;
  text-orientation: mixed;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.emap-map-tools-tab:hover {
  background: rgba(12, 36, 68, 0.95);
}

.emap-tools-slide-enter-active,
.emap-tools-slide-leave-active {
  transition: transform 0.22s ease, opacity 0.22s ease;
}

.emap-tools-slide-enter-from,
.emap-tools-slide-leave-to {
  transform: translateX(14px);
  opacity: 0;
}

.emap-tools-slide-enter-to,
.emap-tools-slide-leave-from {
  transform: translateX(0);
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

.emap-tool-block {
  margin: 8px 0 0;
  padding-top: 8px;
  border-top: 1px solid rgba(34, 211, 238, 0.18);
}

.emap-tool-block-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  color: #94a3b8;
  margin-bottom: 4px;
}

.emap-tool-search-wrap {
  position: relative;
  z-index: 2;
}

.emap-tool-search-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.emap-tool-search-row .form-control {
  min-width: 0;
}

.emap-point-search-dropdown {
  position: absolute;
  left: 0;
  right: 0;
  top: 100%;
  margin-top: 4px;
  max-height: 240px;
  overflow-y: auto;
  background: rgba(6, 18, 40, 0.98);
  border: 1px solid rgba(34, 211, 238, 0.35);
  border-radius: 8px;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.5);
  z-index: 4;
}

.emap-point-search-item {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  width: 100%;
  text-align: left;
  padding: 8px 10px;
  border: none;
  border-bottom: 1px solid rgba(34, 211, 238, 0.12);
  background: transparent;
  color: #e2e8f0;
  cursor: pointer;
  font-size: 12px;
  line-height: 1.35;
}

.emap-point-search-item:last-child {
  border-bottom: none;
}

.emap-point-search-item:hover,
.emap-point-search-item--active {
  background: rgba(59, 130, 246, 0.35);
}

.emap-point-search-item-title {
  font-weight: 600;
  color: #f1f5f9;
}

.emap-point-search-item-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 3px;
  font-size: 10px;
  color: #94a3b8;
}

.emap-point-search-item-kind {
  flex-shrink: 0;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(34, 211, 238, 0.15);
  color: #7dd3fc;
}

.emap-point-search-item-sub {
  min-width: 0;
  word-break: break-all;
}

.emap-point-search-empty {
  padding: 10px;
  font-size: 11px;
  color: #94a3b8;
}

.emap-tool-hint {
  font-size: 10px;
  line-height: 1.35;
  margin-top: 4px !important;
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
  overflow-y: auto;
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
  width: 22%;
  max-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.emap-cmp-table .emap-cmp-col-cats {
  width: 28%;
  white-space: normal;
  line-height: 1.45;
  word-break: break-word;
  vertical-align: top;
  padding-top: 8px;
  padding-bottom: 8px;
}

.emap-cmp-table .emap-cmp-col-money {
  width: 14.5%;
  white-space: nowrap;
}

.emap-cmp-table td.emap-cmp-table-empty {
  white-space: normal;
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

.emap-map-corner {
  position: absolute;
  right: 12px;
  bottom: 12px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  max-width: min(280px, calc(100vw - 24px));
}

.emap-legend {
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
  width: 100%;
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

.emap-legend-stats {
  margin-top: 4px;
  padding-top: 8px;
  border-top: 1px solid rgba(34, 211, 238, 0.2);
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: min(200px, 32vh);
  overflow-y: auto;
}

.emap-legend-stats-title {
  font-size: 11px;
  font-weight: 600;
  color: #7dd3fc;
  letter-spacing: 0.02em;
}

.emap-legend-stats-total {
  font-weight: 500;
  color: #94a3b8;
}

.emap-legend-stat-row {
  display: grid;
  grid-template-columns: 14px 1fr auto;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  line-height: 1.35;
  color: #cbd5e1;
}

.emap-legend-stat-dot {
  width: 10px;
  height: 10px;
  border-radius: 50% 50% 50% 0;
  transform: rotate(-45deg);
  border: 1px solid rgba(255, 255, 255, 0.35);
  flex-shrink: 0;
}

.emap-legend-stat-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.emap-legend-stat-count {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  color: #f1f5f9;
}

.emap-fs-btn {
  flex-shrink: 0;
  border: 1px solid rgba(34, 211, 238, 0.45);
  background: rgba(8, 26, 52, 0.95);
  color: #e0f2fe;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.4);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.emap-fs-btn:hover {
  background: rgba(14, 116, 144, 0.55);
  border-color: #22d3ee;
  color: #f0f9ff;
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

.emap-marker--smelter .emap-smelter-tri--dimmed {
  opacity: 0.4;
  filter: saturate(0.48) brightness(1.2) drop-shadow(0 1px 3px rgba(0, 0, 0, 0.12));
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
  stroke-dasharray: 12 38;
  animation: emap-flow 0.85s linear infinite;
}

/* 比价流向：折线不参与命中，避免挡住仓库/冶炼厂图钉 */
.leaflet-container svg path[class*='emap-flow-line'] {
  pointer-events: none !important;
}

.leaflet-container svg path.emap-flow-line-base--best {
  filter: drop-shadow(0 0 4px rgba(5, 150, 105, 0.85));
}
.leaflet-container svg path.emap-flow-line-base--orange {
  filter: drop-shadow(0 0 3px rgba(234, 88, 12, 0.75));
}
.leaflet-container svg path.emap-flow-line-base--red {
  filter: drop-shadow(0 0 3px rgba(220, 38, 38, 0.78));
}

.leaflet-container .leaflet-marker:has(.emap-flow-mover-wrap) {
  pointer-events: none !important;
}

/* 流向箭头：与 iconAnchor 对齐，内容在 iconSize 框内几何居中 */
.leaflet-div-icon.emap-flow-mover-wrap {
  border: none !important;
  background: transparent !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  box-sizing: border-box;
}

.leaflet-div-icon.emap-flow-mover-wrap > div {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  line-height: 0;
  margin: 0;
  padding: 0;
}

.emap-flow-stagger-1 {
  animation-delay: -0.12s;
}
.emap-flow-stagger-2 {
  animation-delay: -0.24s;
}
.emap-flow-stagger-3 {
  animation-delay: -0.36s;
}
.emap-flow-stagger-4 {
  animation-delay: -0.48s;
}
.emap-flow-stagger-5 {
  animation-delay: -0.6s;
}

.emap-flow-arrow-triple {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: -3px;
  line-height: 0;
  transform-origin: center center;
}

.emap-flow-arrow-triple > span {
  display: block;
  line-height: 1;
}

.emap-flow-mover--best {
  color: #059669;
  text-shadow:
    0 1px 0 rgba(255, 255, 255, 0.85),
    0 2px 6px rgba(0, 0, 0, 0.35);
}
.emap-flow-mover--orange {
  color: #ea580c;
  text-shadow:
    0 1px 0 rgba(255, 255, 255, 0.85),
    0 2px 6px rgba(0, 0, 0, 0.35);
}
.emap-flow-mover--red {
  color: #dc2626;
  text-shadow:
    0 1px 0 rgba(255, 255, 255, 0.85),
    0 2px 6px rgba(0, 0, 0, 0.35);
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
    stroke-dashoffset: 50;
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
