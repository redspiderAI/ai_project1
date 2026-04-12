<template>
  <div class="history-manage-page">
    <!-- 内页菜单 -->
    <div class="card">
      <div class="inner-menu">
        <div 
          class="menu-item"
          :class="{ active: activeTab === 'import' }"
          @click="activeTab = 'import'"
        >
          数据导入
        </div>
        <div 
          class="menu-item"
          :class="{ active: activeTab === 'list' }"
          @click="activeTab = 'list'"
        >
          数据列表
        </div>
      </div>
    </div>

    <!-- ==================== 数据导入标签页 ==================== -->
    <div v-if="activeTab === 'import'" class="import-tab">
      <div class="card">
        <div class="action-bar">
          <div class="action-left">
            <button class="btn btn-primary" @click="triggerImport" :disabled="importLoading">
              {{ importLoading ? '导入中...' : '导入数据' }}
            </button>
            <button class="btn btn-secondary" @click="downloadTemplate">下载模板</button>
          </div>
        </div>
      </div>

      <!-- 文件预览区域 -->
      <div v-if="previewData.length > 0" class="card preview-card">
        <div class="preview-header">
          <span class="preview-title">预览数据（前10行）</span>
          <span class="preview-count">共 {{ previewTotalRows }} 行，已选 {{ selectedPreviewRows.length }} 行</span>
        </div>
        <div class="table-wrapper">
          <table class="data-table preview-table">
            <thead>
              <tr>
                <th width="40"><input type="checkbox" :checked="isAllPreviewSelected" @change="toggleSelectAllPreview" /></th>
                <th>大区经理</th>
                <th>冶炼厂</th>
                <th>仓库</th>
                <th>送货日期</th>
                <th>品种</th>
                <th>重量</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, idx) in previewData" :key="idx">
                <td><input type="checkbox" v-model="selectedPreviewRows" :value="idx" /></td>
                <td>{{ row.regionalManager || '-' }}</td>
                <td>{{ row.smelter || '-' }}</td>
                <td>{{ row.warehouse || '-' }}</td>
                <td>{{ row.deliveryDate || '-' }}</td>
                <td>{{ row.variety || '-' }}</td>
                <td>{{ row.weight || '-' }}</td>
              </tr>
              <tr v-if="previewData.length === 0">
                <td :colspan="7" class="empty-data">暂无数据</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="preview-actions">
          <button class="btn btn-primary" @click="confirmImport" :disabled="importLoading || selectedPreviewRows.length === 0">
            {{ importLoading ? '导入中...' : `确认导入 (${selectedPreviewRows.length}条)` }}
          </button>
          <button class="btn btn-secondary" @click="clearPreview">取消</button>
        </div>
      </div>

      <div v-else class="card placeholder">
        <div class="placeholder-content">
          <p>📥 请点击"导入数据"按钮，选择符合模板的Excel文件</p>
          <p class="placeholder-tip">模板表头：大区经理、冶炼厂、仓库、送货日期、品种、重量</p>
        </div>
      </div>
    </div>

    <!-- ==================== 数据列表标签页 ==================== -->
    <div v-if="activeTab === 'list'" class="list-tab">
      <!-- 筛选区 -->
      <div class="card">
        <div class="filter-row">
          <div class="filter-item date-item">
            <label>送货日期</label>
            <div class="date-range">
              <input type="date" v-model="filters.startDate" class="filter-input date-input" />
              <span>至</span>
              <input type="date" v-model="filters.endDate" class="filter-input date-input" />
            </div>
          </div>

          <!-- 大区经理多选（与历史数据查询一致：已选项仍在列表中置灰，单行标签 +「+N」） -->
          <div class="filter-item multi-select-item">
            <label>大区经理</label>
            <div class="multi-select-container">
              <div class="selected-tags" @click="focusManagerInput">
                <span v-for="item in managersTagsPreview" :key="item" class="tag tag-shrink">
                  {{ item }}
                  <button type="button" class="tag-remove" @click.stop="removeManager(item)">×</button>
                </span>
                <span
                  v-if="managersTagsMore > 0"
                  class="tag tag-more tag-shrink"
                  :title="'还有：' + managersTagsRest.join('、')"
                >+{{ managersTagsMore }}</span>
                <input
                  ref="managerInputRef"
                  v-model="managerSearchText"
                  type="text"
                  class="multi-input"
                  placeholder="搜索并选择"
                  @input="onManagerSearchInput"
                  @focus="onManagerFocus"
                  @blur="closeManagerDropdown"
                  @keydown.enter="handleManagerKeydown"
                />
              </div>
              <div v-show="managerDropdownVisible && filteredManagerOptions.length > 0" class="dropdown-list">
                <div
                  v-for="item in filteredManagerOptions"
                  :key="item"
                  class="dropdown-item"
                  :class="{ 'dropdown-item--selected': selectedManagers.includes(item) }"
                  @click="onManagerDropdownPick(item)"
                >
                  {{ item }}<span v-if="selectedManagers.includes(item)" class="dropdown-item-badge">已选</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 冶炼厂多选 -->
          <div class="filter-item multi-select-item">
            <label>冶炼厂</label>
            <div class="multi-select-container">
              <div class="selected-tags" @click="focusSmelterInput">
                <span v-for="item in smeltersTagsPreview" :key="item" class="tag tag-shrink">
                  {{ item }}
                  <button type="button" class="tag-remove" @click.stop="removeSmelter(item)">×</button>
                </span>
                <span
                  v-if="smeltersTagsMore > 0"
                  class="tag tag-more tag-shrink"
                  :title="'还有：' + smeltersTagsRest.join('、')"
                >+{{ smeltersTagsMore }}</span>
                <input
                  ref="smelterInputRef"
                  v-model="smelterSearchText"
                  type="text"
                  class="multi-input"
                  placeholder="搜索并选择"
                  @input="onSmelterSearchInput"
                  @focus="onSmelterFocus"
                  @blur="closeSmelterDropdown"
                  @keydown.enter="handleSmelterKeydown"
                />
              </div>
              <div v-show="smelterDropdownVisible && filteredSmelterOptions.length > 0" class="dropdown-list">
                <div
                  v-for="item in filteredSmelterOptions"
                  :key="item"
                  class="dropdown-item"
                  :class="{ 'dropdown-item--selected': selectedSmelters.includes(item) }"
                  @click="onSmelterDropdownPick(item)"
                >
                  {{ item }}<span v-if="selectedSmelters.includes(item)" class="dropdown-item-badge">已选</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 仓库多选 -->
          <div class="filter-item multi-select-item">
            <label>仓库</label>
            <div class="multi-select-container">
              <div class="selected-tags" @click="focusWarehouseInput">
                <span v-for="item in warehousesTagsPreview" :key="item" class="tag tag-shrink">
                  {{ item }}
                  <button type="button" class="tag-remove" @click.stop="removeWarehouse(item)">×</button>
                </span>
                <span
                  v-if="warehousesTagsMore > 0"
                  class="tag tag-more tag-shrink"
                  :title="'还有：' + warehousesTagsRest.join('、')"
                >+{{ warehousesTagsMore }}</span>
                <input
                  ref="warehouseInputRef"
                  v-model="warehouseSearchText"
                  type="text"
                  class="multi-input"
                  placeholder="搜索并选择"
                  @input="onWarehouseSearchInput"
                  @focus="onWarehouseFocus"
                  @blur="closeWarehouseDropdown"
                  @keydown.enter="handleWarehouseKeydown"
                />
              </div>
              <div v-show="warehouseDropdownVisible && filteredWarehouseOptions.length > 0" class="dropdown-list">
                <div
                  v-for="item in filteredWarehouseOptions"
                  :key="item"
                  class="dropdown-item"
                  :class="{ 'dropdown-item--selected': selectedWarehouses.includes(item) }"
                  @click="onWarehouseDropdownPick(item)"
                >
                  {{ item }}<span v-if="selectedWarehouses.includes(item)" class="dropdown-item-badge">已选</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 品种多选 -->
          <div class="filter-item multi-select-item">
            <label>品种</label>
            <div class="multi-select-container">
              <div class="selected-tags" @click="focusVarietyInput">
                <span v-for="item in varietiesTagsPreview" :key="item" class="tag tag-shrink">
                  {{ item }}
                  <button type="button" class="tag-remove" @click.stop="removeVariety(item)">×</button>
                </span>
                <span
                  v-if="varietiesTagsMore > 0"
                  class="tag tag-more tag-shrink"
                  :title="'还有：' + varietiesTagsRest.join('、')"
                >+{{ varietiesTagsMore }}</span>
                <input
                  ref="varietyInputRef"
                  v-model="varietySearchText"
                  type="text"
                  class="multi-input"
                  placeholder="搜索并选择"
                  @input="onVarietySearchInput"
                  @focus="onVarietyFocus"
                  @blur="closeVarietyDropdown"
                  @keydown.enter="handleVarietyKeydown"
                />
              </div>
              <div v-show="varietyDropdownVisible && filteredVarietyOptions.length > 0" class="dropdown-list">
                <div
                  v-for="item in filteredVarietyOptions"
                  :key="item"
                  class="dropdown-item"
                  :class="{ 'dropdown-item--selected': selectedVarieties.includes(item) }"
                  @click="onVarietyDropdownPick(item)"
                >
                  {{ item }}<span v-if="selectedVarieties.includes(item)" class="dropdown-item-badge">已选</span>
                </div>
              </div>
            </div>
          </div>

          <div class="filter-actions">
            <button class="btn btn-primary" @click="handleQuery" :disabled="tableLoading">查询</button>
            <button class="btn btn-secondary" @click="handleReset">重置</button>
            <button class="btn btn-secondary" @click="exportFilteredData" :disabled="tableLoading">导出Excel</button>
          </div>
        </div>
      </div>

      <!-- 批量删除按钮 -->
      <div class="card batch-card">
        <div class="batch-bar">
          <button class="btn btn-danger" :disabled="selectedRows.length === 0" @click="handleBatchDelete">
            批量删除 ({{ selectedRows.length }})
          </button>
        </div>
      </div>

      <!-- 数据表格 -->
      <div class="card">
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th width="40"><input type="checkbox" :checked="isAllSelected" @change="toggleSelectAll" /></th>
                <th>送货日期</th>
                <th>大区经理</th>
                <th>冶炼厂</th>
                <th>仓库</th>
                <th>品种</th>
                <th>重量(吨)</th>
                <th width="70">查看</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in paginatedData" :key="row.id">
                <td><input type="checkbox" v-model="selectedRows" :value="row.id" /></td>
                <td>{{ row.delivery_date }}</td>
                <td>{{ row.regional_manager }}</td>
                <td>{{ row.smelter || '-' }}</td>
                <td>{{ row.warehouse }}</td>
                <td>{{ row.product_variety }}</td>
                <td>{{ parseFloat(row.weight).toFixed(2) }}</td>
                <td><button class="btn-view" @click="openDetailModal(row)">查看</button></td>
              </tr>
              <tr v-if="paginatedData.length === 0">
                <td :colspan="8" class="empty-data">暂无数据</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="pagination">
          <button @click="prevPage" :disabled="currentPage === 1">上一页</button>
          <span>第 {{ currentPage }} / {{ totalPages }} 页</span>
          <button @click="nextPage" :disabled="currentPage === totalPages">下一页</button>
          <select v-model="pageSize" @change="currentPage = 1">
            <option :value="10">10条/页</option>
            <option :value="20">20条/页</option>
            <option :value="50">50条/页</option>
          </select>
        </div>
      </div>
    </div>

    <!-- 详情弹窗 -->
    <div v-if="modalVisible" class="modal" @click.self="closeModal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>{{ modalTitle }}</h3>
          <button class="close-btn" @click="closeModal">&times;</button>
        </div>
        <div class="modal-body">
          <div class="modal-info">
            <p><strong>送货日期：</strong>{{ modalData?.delivery_date || '-' }}</p>
            <p><strong>大区经理：</strong>{{ modalData?.regional_manager || '-' }}</p>
            <p><strong>冶炼厂：</strong>{{ modalData?.smelter || '-' }}</p>
            <p><strong>仓库：</strong>{{ modalData?.warehouse || '-' }}</p>
            <p><strong>品种：</strong>{{ modalData?.product_variety || '-' }}</p>
            <p><strong>重量：</strong>{{ modalData?.weight ? parseFloat(modalData.weight).toFixed(2) : '-' }} 吨</p>
          </div>
          <div class="modal-table-header">
            <span class="modal-result-label">品种明细</span>
            <button class="btn btn-sm btn-secondary" @click="exportModalExcel">导出Excel</button>
          </div>
          <div class="table-wrapper">
            <table class="data-table modal-table">
              <thead>
                <tr>
                  <th>品种</th>
                  <th>冶炼厂</th>
                  <th>重量(吨)</th>
                  <th width="100">筛选状态</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in modalVarietyData" :key="item.variety" :class="{ 'row-selected': isVarietySelected(item.variety) }">
                  <td>{{ item.variety }}</td>
                  <td>{{ item.smelter || '-' }}</td>
                  <td>{{ item.weight.toFixed(2) }}</td>
                  <td>
                    <span v-if="isVarietySelected(item.variety)" class="status-selected">✅ 已选择</span>
                    <span v-else class="status-none">—</span>
                  </td>
                </tr>
                <tr v-if="modalVarietyData.length === 0">
                  <td :colspan="4" class="empty-data">暂无数据</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="closeModal">关闭</button>
        </div>
      </div>
    </div>

    <!-- 错误提示弹窗 -->
    <div v-if="errorModalVisible" class="modal" @click.self="closeErrorModal">
      <div class="modal-content modal-small">
        <div class="modal-header error-header">
          <h3>提示</h3>
          <button class="close-btn" @click="closeErrorModal">&times;</button>
        </div>
        <div class="modal-body">
          <p class="modal-message">{{ errorModalMessage }}</p>
          <div v-if="errorModalDetails.length > 0" class="modal-details">
            <ul>
              <li v-for="detail in errorModalDetails" :key="detail">{{ detail }}</li>
            </ul>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary" @click="closeErrorModal">确定</button>
        </div>
      </div>
    </div>

    <input ref="fileInput" type="file" accept=".xlsx,.xls,.csv" style="display: none" @change="handleFileSelect" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, onBeforeUnmount, nextTick } from 'vue'
import axios from 'axios'
import { ApiPaths } from '../api/paths'
import * as XLSX from 'xlsx'

// ==================== 类型定义 ====================
interface HistoryRecord {
  id: number
  delivery_date: string
  regional_manager: string
  warehouse: string
  product_variety: string
  smelter?: string
  weight: string
  created_at: string
}

interface PreviewRow {
  regionalManager: string
  smelter: string
  warehouse: string
  deliveryDate: string
  variety: string
  weight: string
  originalIndex: number
}

interface ApiResponse {
  items: HistoryRecord[]
  total: number
  page: number
  page_size: number
}

// ==================== 状态 ====================
const activeTab = ref('import')
const tableLoading = ref(false)
const importLoading = ref(false)
const fileInput = ref<HTMLInputElement>()

// 数据
const allData = ref<HistoryRecord[]>([])
const total = ref(0)
const selectedRows = ref<number[]>([])

// 预览数据
const previewData = ref<PreviewRow[]>([])
const selectedPreviewRows = ref<number[]>([])
const previewTotalRows = ref(0)
const previewRawData = ref<PreviewRow[]>([])

// 错误弹窗
const errorModalVisible = ref(false)
const errorModalMessage = ref('')
const errorModalDetails = ref<string[]>([])

// 筛选条件
const filters = ref({
  startDate: '',
  endDate: ''
})

// 大区经理多选
const selectedManagers = ref<string[]>([])
const managerSearchText = ref('')
const managerDropdownVisible = ref(false)
const managerInputRef = ref<HTMLInputElement>()
const allManagerOptions = ref<string[]>([])
const filteredManagerOptions = ref<string[]>([])

// 冶炼厂多选
const selectedSmelters = ref<string[]>([])
const smelterSearchText = ref('')
const smelterDropdownVisible = ref(false)
const smelterInputRef = ref<HTMLInputElement>()
const allSmelterOptions = ref<string[]>([])
const filteredSmelterOptions = ref<string[]>([])

// 仓库多选
const selectedWarehouses = ref<string[]>([])
const warehouseSearchText = ref('')
const warehouseDropdownVisible = ref(false)
const warehouseInputRef = ref<HTMLInputElement>()
const allWarehouseOptions = ref<string[]>([])
const filteredWarehouseOptions = ref<string[]>([])

// 品种多选
const selectedVarieties = ref<string[]>([])
const varietySearchText = ref('')
const varietyDropdownVisible = ref(false)
const varietyInputRef = ref<HTMLInputElement>()
const allVarietyOptions = ref<string[]>([])
const filteredVarietyOptions = ref<string[]>([])

/** 与历史数据查询 / 送货量预测一致：单行展示，仅 1 个标签 +「+N」 */
const MULTI_PREVIEW_TAG_COUNT = 1
const managersTagsPreview = computed(() => selectedManagers.value.slice(0, MULTI_PREVIEW_TAG_COUNT))
const managersTagsMore = computed(() => Math.max(0, selectedManagers.value.length - MULTI_PREVIEW_TAG_COUNT))
const managersTagsRest = computed(() => selectedManagers.value.slice(MULTI_PREVIEW_TAG_COUNT))
const smeltersTagsPreview = computed(() => selectedSmelters.value.slice(0, MULTI_PREVIEW_TAG_COUNT))
const smeltersTagsMore = computed(() => Math.max(0, selectedSmelters.value.length - MULTI_PREVIEW_TAG_COUNT))
const smeltersTagsRest = computed(() => selectedSmelters.value.slice(MULTI_PREVIEW_TAG_COUNT))
const warehousesTagsPreview = computed(() => selectedWarehouses.value.slice(0, MULTI_PREVIEW_TAG_COUNT))
const warehousesTagsMore = computed(() => Math.max(0, selectedWarehouses.value.length - MULTI_PREVIEW_TAG_COUNT))
const warehousesTagsRest = computed(() => selectedWarehouses.value.slice(MULTI_PREVIEW_TAG_COUNT))
const varietiesTagsPreview = computed(() => selectedVarieties.value.slice(0, MULTI_PREVIEW_TAG_COUNT))
const varietiesTagsMore = computed(() => Math.max(0, selectedVarieties.value.length - MULTI_PREVIEW_TAG_COUNT))
const varietiesTagsRest = computed(() => selectedVarieties.value.slice(MULTI_PREVIEW_TAG_COUNT))

// 分页
const currentPage = ref(1)
const pageSize = ref(20)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const paginatedData = computed(() => allData.value)

const isAllSelected = computed(() => {
  return paginatedData.value.length > 0 && selectedRows.value.length === paginatedData.value.length
})

const isAllPreviewSelected = computed(() => {
  return previewData.value.length > 0 && selectedPreviewRows.value.length === previewData.value.length
})

// 弹窗相关
const modalVisible = ref(false)
const modalData = ref<HistoryRecord | null>(null)
const modalTitle = ref('')
const modalVarietyData = ref<{ variety: string; smelter: string; weight: number }[]>([])

// ==================== 错误弹窗 ====================
const showError = (message: string, details?: string[]) => {
  errorModalMessage.value = message
  errorModalDetails.value = details || []
  errorModalVisible.value = true
}

const closeErrorModal = () => {
  errorModalVisible.value = false
  errorModalMessage.value = ''
  errorModalDetails.value = []
}

/** 下拉按搜索过滤；已选项仍显示在列表中，用样式标灰 */
function filterOptionsBySearch(options: string[], searchLower: string) {
  if (!searchLower) return [...options]
  return options.filter((opt) => opt.toLowerCase().includes(searchLower))
}

// ==================== 大区经理逻辑 ====================
const filterManagerOptions = () => {
  const search = managerSearchText.value.toLowerCase()
  filteredManagerOptions.value = filterOptionsBySearch(allManagerOptions.value, search)
}

const addManager = (item: string) => {
  if (!selectedManagers.value.includes(item)) {
    selectedManagers.value.push(item)
  }
  managerSearchText.value = ''
  filterManagerOptions()
}

const removeManager = (item: string) => {
  selectedManagers.value = selectedManagers.value.filter((i) => i !== item)
  filterManagerOptions()
}

function onManagerDropdownPick(item: string) {
  if (selectedManagers.value.includes(item)) removeManager(item)
  else addManager(item)
}

const handleManagerKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && managerSearchText.value.trim()) {
    addManager(managerSearchText.value.trim())
    e.preventDefault()
  }
}

const closeManagerDropdown = () => {
  setTimeout(() => {
    managerDropdownVisible.value = false
  }, 200)
}

function onManagerFocus() {
  managerDropdownVisible.value = true
  filterManagerOptions()
}

function onManagerSearchInput() {
  managerDropdownVisible.value = true
  filterManagerOptions()
}

const focusManagerInput = () => {
  managerDropdownVisible.value = true
  filterManagerOptions()
  nextTick(() => managerInputRef.value?.focus())
}

// ==================== 冶炼厂逻辑 ====================
const filterSmelterOptions = () => {
  const search = smelterSearchText.value.toLowerCase()
  filteredSmelterOptions.value = filterOptionsBySearch(allSmelterOptions.value, search)
}

const addSmelter = (item: string) => {
  if (!selectedSmelters.value.includes(item)) {
    selectedSmelters.value.push(item)
  }
  smelterSearchText.value = ''
  filterSmelterOptions()
}

const removeSmelter = (item: string) => {
  selectedSmelters.value = selectedSmelters.value.filter((i) => i !== item)
  filterSmelterOptions()
}

function onSmelterDropdownPick(item: string) {
  if (selectedSmelters.value.includes(item)) removeSmelter(item)
  else addSmelter(item)
}

const handleSmelterKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && smelterSearchText.value.trim()) {
    addSmelter(smelterSearchText.value.trim())
    e.preventDefault()
  }
}

const closeSmelterDropdown = () => {
  setTimeout(() => {
    smelterDropdownVisible.value = false
  }, 200)
}

function onSmelterFocus() {
  smelterDropdownVisible.value = true
  filterSmelterOptions()
}

function onSmelterSearchInput() {
  smelterDropdownVisible.value = true
  filterSmelterOptions()
}

const focusSmelterInput = () => {
  smelterDropdownVisible.value = true
  filterSmelterOptions()
  nextTick(() => smelterInputRef.value?.focus())
}

// ==================== 仓库逻辑 ====================
const filterWarehouseOptions = () => {
  const search = warehouseSearchText.value.toLowerCase()
  filteredWarehouseOptions.value = filterOptionsBySearch(allWarehouseOptions.value, search)
}

const addWarehouse = (item: string) => {
  if (!selectedWarehouses.value.includes(item)) {
    selectedWarehouses.value.push(item)
  }
  warehouseSearchText.value = ''
  filterWarehouseOptions()
}

const removeWarehouse = (item: string) => {
  selectedWarehouses.value = selectedWarehouses.value.filter((i) => i !== item)
  filterWarehouseOptions()
}

function onWarehouseDropdownPick(item: string) {
  if (selectedWarehouses.value.includes(item)) removeWarehouse(item)
  else addWarehouse(item)
}

const handleWarehouseKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && warehouseSearchText.value.trim()) {
    addWarehouse(warehouseSearchText.value.trim())
    e.preventDefault()
  }
}

const closeWarehouseDropdown = () => {
  setTimeout(() => {
    warehouseDropdownVisible.value = false
  }, 200)
}

function onWarehouseFocus() {
  warehouseDropdownVisible.value = true
  filterWarehouseOptions()
}

function onWarehouseSearchInput() {
  warehouseDropdownVisible.value = true
  filterWarehouseOptions()
}

const focusWarehouseInput = () => {
  warehouseDropdownVisible.value = true
  filterWarehouseOptions()
  nextTick(() => warehouseInputRef.value?.focus())
}

// ==================== 品种逻辑 ====================
const filterVarietyOptions = () => {
  const search = varietySearchText.value.toLowerCase()
  filteredVarietyOptions.value = filterOptionsBySearch(allVarietyOptions.value, search)
}

const addVariety = (item: string) => {
  if (!selectedVarieties.value.includes(item)) {
    selectedVarieties.value.push(item)
  }
  varietySearchText.value = ''
  filterVarietyOptions()
}

const removeVariety = (item: string) => {
  selectedVarieties.value = selectedVarieties.value.filter((i) => i !== item)
  filterVarietyOptions()
}

function onVarietyDropdownPick(item: string) {
  if (selectedVarieties.value.includes(item)) removeVariety(item)
  else addVariety(item)
}

const handleVarietyKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && varietySearchText.value.trim()) {
    addVariety(varietySearchText.value.trim())
    e.preventDefault()
  }
}

const closeVarietyDropdown = () => {
  setTimeout(() => {
    varietyDropdownVisible.value = false
  }, 200)
}

function onVarietyFocus() {
  varietyDropdownVisible.value = true
  filterVarietyOptions()
}

function onVarietySearchInput() {
  varietyDropdownVisible.value = true
  filterVarietyOptions()
}

const focusVarietyInput = () => {
  varietyDropdownVisible.value = true
  filterVarietyOptions()
  nextTick(() => varietyInputRef.value?.focus())
}

// ==================== 获取下拉选项 ====================
const fetchOptions = async () => {
  try {
    const response = await axios.get(ApiPaths.deliveryHistory, {
      params: { page: 1, page_size: 200 }
    })
    const data = response.data as ApiResponse
    const items = data.items || []
    
    allManagerOptions.value = [...new Set(items.map((item: HistoryRecord) => item.regional_manager))].filter(Boolean)
allSmelterOptions.value = [...new Set(items.map((item: HistoryRecord) => item.smelter || '').filter(Boolean))]
    allWarehouseOptions.value = [...new Set(items.map((item: HistoryRecord) => item.warehouse))].filter(Boolean)
    allVarietyOptions.value = [...new Set(items.map((item: HistoryRecord) => item.product_variety))].filter(Boolean)
    
    filterManagerOptions()
    filterSmelterOptions()
    filterWarehouseOptions()
    filterVarietyOptions()
  } catch (error) {
    console.error('获取选项失败', error)
  }
}

// ==================== 获取数据 ====================
const fetchData = async () => {
  tableLoading.value = true
  try {
    const params: Record<string, any> = {
      page: currentPage.value,
      page_size: pageSize.value
    }
    
    if (filters.value.startDate) {
      params.date_from = filters.value.startDate
    }
    if (filters.value.endDate) {
      params.date_to = filters.value.endDate
    }
    
    if (selectedManagers.value.length > 0) {
      params.regional_managers = selectedManagers.value
    }
    if (selectedSmelters.value.length > 0) {
      params.smelters = selectedSmelters.value
    }
    if (selectedWarehouses.value.length > 0) {
      params.warehouses = selectedWarehouses.value
    }
    if (selectedVarieties.value.length > 0) {
      params.product_varieties = selectedVarieties.value
    }
    
    const response = await axios.get(ApiPaths.deliveryHistory, { params })
    const data = response.data as ApiResponse
    
    if (data && data.items) {
      allData.value = data.items
      total.value = data.total
    } else {
      allData.value = []
      total.value = 0
    }
    
  } catch (error) {
    console.error('获取数据失败', error)
    showError('获取数据失败', ['请检查网络连接或稍后重试'])
  } finally {
    tableLoading.value = false
  }
}

const handleQuery = () => {
  currentPage.value = 1
  fetchData()
}

const handleReset = () => {
  filters.value = {
    startDate: '',
    endDate: ''
  }
  selectedManagers.value = []
  selectedSmelters.value = []
  selectedWarehouses.value = []
  selectedVarieties.value = []
  managerSearchText.value = ''
  smelterSearchText.value = ''
  warehouseSearchText.value = ''
  varietySearchText.value = ''
  currentPage.value = 1
  fetchData()
}

// ==================== 分页 ====================
const prevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--
    fetchData()
  }
}

const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
    fetchData()
  }
}

// ==================== 全选/批量删除 ====================
const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedRows.value = []
  } else {
    selectedRows.value = paginatedData.value.map(row => row.id)
  }
}

const handleBatchDelete = async () => {
  if (selectedRows.value.length === 0) return
  if (!confirm(`确认删除选中的${selectedRows.value.length}条记录？此操作不可恢复。`)) return
  
  try {
    await axios.delete(ApiPaths.deliveryHistoryBatchDelete, {
      data: { ids: selectedRows.value }
    })
    showError(`成功删除${selectedRows.value.length}条数据`, [])
    selectedRows.value = []
    fetchData()
    fetchOptions()
  } catch (error: any) {
    console.error('删除失败', error)
    showError('删除失败', [error.response?.data?.message || '请稍后重试'])
  }
}

// ==================== 导出当前筛选结果 ====================
const exportFilteredData = () => {
  if (allData.value.length === 0) {
    showError('没有可导出的数据', ['请先查询数据后再导出'])
    return
  }
  
  const headers = ['送货日期', '大区经理', '冶炼厂', '仓库', '品种', '重量(吨)']
  const rowsData = allData.value.map(item => [
    item.delivery_date,
    item.regional_manager,
    item.smelter || '',
    item.warehouse,
    item.product_variety,
    parseFloat(item.weight).toFixed(2)
  ])
  
  const csvContent = [headers, ...rowsData].map(row => row.join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)
  link.href = URL.createObjectURL(blob)
  link.download = `送货历史数据_${timestamp}.csv`
  link.click()
  URL.revokeObjectURL(link.href)
}

// ==================== 判断品种是否被筛选选中 ====================
const isVarietySelected = (variety: string): boolean => {
  if (selectedVarieties.value.length === 0) return false
  return selectedVarieties.value.includes(variety)
}

// ==================== 详情弹窗 ====================
const openDetailModal = (row: HistoryRecord) => {
  modalData.value = row
  modalTitle.value = `${row.delivery_date} - ${row.regional_manager} - ${row.warehouse} 品种明细`
  
  const sameDayData = allData.value.filter(item => 
    item.delivery_date === row.delivery_date &&
    item.regional_manager === row.regional_manager &&
    item.warehouse === row.warehouse
  )
  
  const varietyMap = new Map<string, { weight: number; smelter: string }>()
  sameDayData.forEach(item => {
    const key = item.product_variety
    const existing = varietyMap.get(key)
    if (existing) {
      existing.weight += parseFloat(item.weight)
    } else {
      varietyMap.set(key, {
        weight: parseFloat(item.weight),
        smelter: item.smelter || ''
      })
    }
  })
  
  modalVarietyData.value = Array.from(varietyMap.entries()).map(([variety, data]) => ({
    variety,
    smelter: data.smelter,
    weight: data.weight
  }))
  
  modalVisible.value = true
}

const closeModal = () => {
  modalVisible.value = false
  modalData.value = null
  modalVarietyData.value = []
}

// ==================== 导出弹窗Excel ====================
const exportModalExcel = () => {
  if (modalVarietyData.value.length === 0) {
    showError('没有可导出的数据', [])
    return
  }
  
  const headers = ['品种', '冶炼厂', '重量(吨)', '筛选状态']
  const rowsData = modalVarietyData.value.map(item => [
    item.variety,
    item.smelter,
    item.weight.toFixed(2),
    isVarietySelected(item.variety) ? '已选择' : '未选择'
  ])
  
  const csvContent = [headers, ...rowsData].map(row => row.join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)
  link.href = URL.createObjectURL(blob)
  link.download = `${modalTitle.value}_${timestamp}.csv`
  link.click()
  URL.revokeObjectURL(link.href)
}

// ==================== 导入功能 ====================
const downloadTemplate = async () => {
  try {
    const response = await axios.get(ApiPaths.deliveryHistoryTemplate, {
      responseType: 'blob'
    })
    const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = '送货数据导入模板.xlsx'
    link.click()
    URL.revokeObjectURL(link.href)
  } catch (error) {
    console.error('下载模板失败', error)
    showError('下载模板失败', ['请检查网络连接或稍后重试'])
  }
}

const triggerImport = () => {
  fileInput.value?.click()
}

// 解析文件并显示预览
const handleFileSelect = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const validExtensions = ['.xlsx', '.xls', '.csv']
  const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()
  if (!validExtensions.includes(fileExt)) {
    showError('不支持的文件格式', [`请上传 Excel 文件（.xlsx, .xls）或 CSV 文件（.csv），当前文件：${file.name}`])
    input.value = ''
    return
  }

  try {
    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const data: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' })
    
    const expectedHeaders = ['大区经理', '冶炼厂', '仓库', '送货日期', '品种', '重量']
    
    if (data.length === 0 || !data[0]) {
      showError('文件为空', ['文件没有数据行'])
      input.value = ''
      return
    }
    
    const actualHeaders = data[0].map((cell: any) => String(cell || '').trim())
    const headerValid = expectedHeaders.every((h, idx) => h === actualHeaders[idx])
    
    if (!headerValid) {
      showError('表头格式不正确', [
        `期望表头：${expectedHeaders.join('、')}`,
        `实际表头：${actualHeaders.join('、') || '空'}`,
        '请使用下载的模板文件'
      ])
      input.value = ''
      return
    }
    
    const previewRows: PreviewRow[] = []
    const errors: string[] = []
    const validRows: PreviewRow[] = []
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i]
      const rowNum = i + 1
      
      if (!row || row.length === 0 || row.every(cell => !cell || String(cell).trim() === '')) {
        continue
      }
      
      const getCellValue = (index: number): string => {
        const cell = row[index]
        if (cell === undefined || cell === null) return ''
        if (typeof cell === 'number') return cell.toString()
        if (cell instanceof Date) {
          const year = cell.getFullYear()
          const month = String(cell.getMonth() + 1).padStart(2, '0')
          const day = String(cell.getDate()).padStart(2, '0')
          return `${year}-${month}-${day}`
        }
        return String(cell).trim()
      }
      
      const regionalManager = getCellValue(0)
      const smelter = getCellValue(1)
      const warehouse = getCellValue(2)
      let deliveryDate = getCellValue(3)
      const variety = getCellValue(4)
      const weight = getCellValue(5)
      
      const emptyFields = []
      if (!regionalManager) emptyFields.push('大区经理')
      if (!smelter) emptyFields.push('冶炼厂')
      if (!warehouse) emptyFields.push('仓库')
      if (!deliveryDate) emptyFields.push('送货日期')
      if (!variety) emptyFields.push('品种')
      if (!weight) emptyFields.push('重量')
      
      if (emptyFields.length > 0) {
        errors.push(`第${rowNum}行：以下字段为空：${emptyFields.join('、')}`)
        continue
      }
      
      try {
        let date: Date
        if (deliveryDate.includes('-')) {
          date = new Date(deliveryDate)
        } else if (deliveryDate.includes('/')) {
          const parts = deliveryDate.split('/')
          date = new Date(`${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`)
        } else {
          date = new Date(deliveryDate)
        }
        
        if (isNaN(date.getTime())) {
          errors.push(`第${rowNum}行：送货日期格式错误（应为YYYY-MM-DD），当前值：${deliveryDate}`)
          continue
        }
        deliveryDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      } catch (e) {
        errors.push(`第${rowNum}行：送货日期格式错误（应为YYYY-MM-DD），当前值：${deliveryDate}`)
        continue
      }
      
      const weightNum = parseFloat(weight)
      if (isNaN(weightNum) || weightNum <= 0) {
        errors.push(`第${rowNum}行：重量必须为正数，当前值：${weight}`)
        continue
      }
      
      const previewRow: PreviewRow = {
        regionalManager,
        smelter,
        warehouse,
        deliveryDate,
        variety,
        weight: weightNum.toString(),
        originalIndex: i
      }
      
      if (previewRows.length < 10) {
        previewRows.push(previewRow)
      }
      validRows.push(previewRow)
    }
    
    if (errors.length > 0) {
      showError(`文件解析发现 ${errors.length} 个问题`, errors.slice(0, 10))
      input.value = ''
      return
    }
    
    if (previewRows.length === 0) {
      showError('没有有效数据', ['文件中没有符合格式的数据行'])
      input.value = ''
      return
    }
    
    previewTotalRows.value = validRows.length
    previewData.value = previewRows
    selectedPreviewRows.value = previewRows.map((_, idx) => idx)
    previewRawData.value = validRows
    
  } catch (error) {
    console.error('解析文件失败', error)
    showError('解析文件失败', ['请检查文件格式是否正确，确保是有效的 Excel 文件'])
    input.value = ''
  }
}

const toggleSelectAllPreview = () => {
  if (isAllPreviewSelected.value) {
    selectedPreviewRows.value = []
  } else {
    selectedPreviewRows.value = previewData.value.map((_, idx) => idx)
  }
}

const clearPreview = () => {
  previewData.value = []
  selectedPreviewRows.value = []
  previewTotalRows.value = 0
  previewRawData.value = []
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

const confirmImport = async () => {
  if (selectedPreviewRows.value.length === 0) {
    showError('请至少选择一条数据', [])
    return
  }
  
  importLoading.value = true
  
  try {
    const selectedIndices = selectedPreviewRows.value
    const selectedFullData = previewRawData.value.filter((_, idx) => selectedIndices.includes(idx))
    
    const headers = ['大区经理', '冶炼厂', '仓库', '送货日期', '品种', '重量']
    const rowsData = selectedFullData.map(row => [
      row.regionalManager,
      row.smelter,
      row.warehouse,
      row.deliveryDate,
      row.variety,
      row.weight
    ])
    
    const csvLines = [headers, ...rowsData].map(row => row.join(','))
    const csvContent = '\uFEFF' + csvLines.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const file = new File([blob], 'import_data.csv', { type: 'text/csv' })
    
    const formData = new FormData()
    formData.append('file', file)
    
    const response = await axios.post(ApiPaths.deliveryHistoryImport, formData)
    
    console.log('导入响应:', response.data)
    
    if (response.data) {
      const inserted = response.data.inserted || 0
      const errors = response.data.errors || []
      
      if (inserted > 0) {
        showError(`导入成功：成功导入 ${inserted} 条数据`, errors)
        clearPreview()
        fetchData()
        fetchOptions()
        activeTab.value = 'list'
      } else if (errors.length > 0) {
        showError('导入失败', errors)
      } else {
        showError('导入失败', ['请检查数据格式'])
      }
    } else {
      showError('导入失败', ['服务器返回空响应'])
    }
  } catch (error: any) {
    console.error('导入失败', error)
    
    const errorDetails: string[] = []
    
    if (error.response?.data?.message) {
      errorDetails.push(error.response.data.message)
    }
    if (error.response?.data?.detail) {
      errorDetails.push(error.response.data.detail)
    }
    if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
      errorDetails.push(...error.response.data.errors)
    }
    
    if (errorDetails.length === 0) {
      errorDetails.push('请检查网络连接')
      errorDetails.push('确认数据格式是否正确')
      errorDetails.push('表头必须为：大区经理、冶炼厂、仓库、送货日期、品种、重量')
    }
    
    showError('导入失败', errorDetails)
  } finally {
    importLoading.value = false
  }
}

// ==================== 数据列表筛选本地记忆 ====================
const HISTORY_MANAGE_LIST_STORAGE_KEY = 'historyManage.listFilters.v1'

interface HistoryManageListPersisted {
  activeTab: string
  filters: { startDate: string; endDate: string }
  selectedManagers: string[]
  selectedSmelters: string[]
  selectedWarehouses: string[]
  selectedVarieties: string[]
}

function loadPersistedListFilters() {
  try {
    const raw = localStorage.getItem(HISTORY_MANAGE_LIST_STORAGE_KEY)
    if (!raw) return
    const s = JSON.parse(raw) as Partial<HistoryManageListPersisted>
    if (s.activeTab === 'import' || s.activeTab === 'list') activeTab.value = s.activeTab
    if (s.filters) {
      filters.value = {
        startDate: typeof s.filters.startDate === 'string' ? s.filters.startDate : '',
        endDate: typeof s.filters.endDate === 'string' ? s.filters.endDate : ''
      }
    }
    if (Array.isArray(s.selectedManagers)) selectedManagers.value = [...s.selectedManagers]
    if (Array.isArray(s.selectedSmelters)) selectedSmelters.value = [...s.selectedSmelters]
    if (Array.isArray(s.selectedWarehouses)) selectedWarehouses.value = [...s.selectedWarehouses]
    if (Array.isArray(s.selectedVarieties)) selectedVarieties.value = [...s.selectedVarieties]
  } catch {
    /* ignore */
  }
}

function savePersistedListFilters() {
  try {
    const payload: HistoryManageListPersisted = {
      activeTab: activeTab.value,
      filters: { ...filters.value },
      selectedManagers: [...selectedManagers.value],
      selectedSmelters: [...selectedSmelters.value],
      selectedWarehouses: [...selectedWarehouses.value],
      selectedVarieties: [...selectedVarieties.value]
    }
    localStorage.setItem(HISTORY_MANAGE_LIST_STORAGE_KEY, JSON.stringify(payload))
  } catch {
    /* ignore */
  }
}

let listFiltersPersistDebounce: ReturnType<typeof setTimeout> | null = null
function schedulePersistListFilters() {
  if (listFiltersPersistDebounce) clearTimeout(listFiltersPersistDebounce)
  listFiltersPersistDebounce = setTimeout(() => {
    listFiltersPersistDebounce = null
    savePersistedListFilters()
  }, 400)
}

watch(
  [activeTab, filters, selectedManagers, selectedSmelters, selectedWarehouses, selectedVarieties],
  schedulePersistListFilters,
  { deep: true }
)

onMounted(() => {
  loadPersistedListFilters()
  fetchOptions().then(() => {
    filterManagerOptions()
    filterSmelterOptions()
    filterWarehouseOptions()
    filterVarietyOptions()
  })
  fetchData()
})

onBeforeUnmount(() => {
  if (listFiltersPersistDebounce) clearTimeout(listFiltersPersistDebounce)
  savePersistedListFilters()
})
</script>

<style scoped>
.history-manage-page { width: 100%; }
.card { background: white; border-radius: 8px; padding: 16px 20px; margin-bottom: 16px; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05); }
.inner-menu { display: flex; gap: 8px; background: #F5F7FA; border-radius: 8px; padding: 4px; }
.menu-item { padding: 8px 24px; cursor: pointer; font-size: 14px; font-weight: 500; border-radius: 6px; color: #606266; }
.menu-item:hover { background-color: rgba(74, 122, 156, 0.1); }
.menu-item.active { background-color: #4A7A9C; color: white; }
.filter-row { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end; }
.filter-item { display: flex; flex-direction: column; gap: 4px; }
.filter-item label { font-size: 12px; font-weight: 500; color: #606266; white-space: nowrap; }
.date-range { display: flex; gap: 6px; align-items: center; }
.filter-input { padding: 6px 10px; border: 1px solid #E5E9F2; border-radius: 4px; font-size: 13px; background: white; }
.date-input { width: 120px; }
.filter-actions { display: flex; gap: 8px; margin-left: auto; }
/* 多选（与历史数据查询一致：单行固定高度 + 首标签 +「+N」） */
.multi-select-item { min-width: 200px; max-width: 280px; }
.multi-select-container { position: relative; width: 100%; max-width: 280px; }
.selected-tags {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border: 1px solid #E5E9F2;
  border-radius: 4px;
  background: white;
  height: 32px;
  min-height: 32px;
  max-height: 32px;
  overflow: hidden;
  cursor: text;
  box-sizing: border-box;
}
.tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  background-color: #E8F0F8;
  border-radius: 3px;
  font-size: 12px;
  color: #2c3e50;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 118px;
}
.tag-shrink { flex-shrink: 0; }
.tag-more {
  max-width: none;
  overflow: visible;
  text-overflow: clip;
  background-color: #f0f2f5;
  color: #606266;
  cursor: default;
  flex-shrink: 0;
}
.tag-remove { background: none; border: none; cursor: pointer; font-size: 14px; color: #909399; padding: 0 2px; }
.tag-remove:hover { color: #f56c6c; }
.multi-input {
  flex: 1 1 48px;
  min-width: 48px;
  width: 0;
  border: none;
  outline: none;
  padding: 2px 4px;
  font-size: 13px;
  background: transparent;
}
.multi-input::placeholder { color: #c0c4cc; }
.dropdown-list {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  max-height: 200px;
  overflow-y: auto;
  background: white;
  border: 1px solid #E5E9F2;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  z-index: 100;
  margin-top: 2px;
}
.dropdown-item {
  padding: 8px 12px;
  cursor: pointer;
  font-size: 13px;
  color: #606266;
  text-align: left;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.dropdown-item:hover { background-color: #F5F7FA; color: #4A7A9C; }
.dropdown-item--selected {
  color: #a8abb2;
  background-color: #f5f7fa;
}
.dropdown-item--selected:hover {
  background-color: #ebeef5;
  color: #909399;
}
.dropdown-item-badge {
  font-size: 11px;
  color: #c0c4cc;
  flex-shrink: 0;
}
.batch-card { padding: 12px 20px; }
.batch-bar { display: flex; justify-content: flex-start; }
.btn { padding: 6px 16px; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: 500; transition: all 0.2s; }
.btn-primary { background-color: #4A7A9C; color: white; }
.btn-primary:hover { background-color: #5a8aac; }
.btn-secondary { background-color: #F5F7FA; color: #606266; border: 1px solid #E5E9F2; }
.btn-secondary:hover { background-color: #E5E9F2; }
.btn-sm { padding: 4px 12px; font-size: 12px; }
.btn-danger { background-color: #f56c6c; color: white; }
.btn-danger:hover:not(:disabled) { background-color: #f78989; }
.btn-danger:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-view { background: none; border: 1px solid #4A7A9C; color: #4A7A9C; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; }
.btn-view:hover { background-color: #4A7A9C; color: white; }
.table-wrapper { overflow-x: auto; border: 1px solid #E5E9F2; border-radius: 4px; }
.data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.data-table th, .data-table td { padding: 10px 12px; text-align: center; border-bottom: 1px solid #E5E9F2; white-space: nowrap; }
.data-table th { background-color: #E8F0F8; font-weight: 600; color: #2c3e50; }
.data-table tbody tr:hover { background-color: #F5F7FA; }
.empty-data { text-align: center; padding: 40px; color: #909399; }
.pagination { display: flex; justify-content: flex-end; align-items: center; gap: 12px; margin-top: 16px; }
.pagination button { padding: 4px 12px; border: 1px solid #E5E9F2; background: white; border-radius: 4px; cursor: pointer; }
.pagination button:disabled { opacity: 0.5; cursor: not-allowed; }
.pagination select { padding: 4px 8px; border: 1px solid #E5E9F2; border-radius: 4px; }
.action-bar { display: flex; justify-content: flex-start; align-items: center; }
.action-left { display: flex; gap: 12px; }

/* 预览区域样式 */
.preview-card { background-color: #F5F7FA; }
.preview-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #E5E9F2; }
.preview-title { font-size: 14px; font-weight: 600; color: #2e7d32; }
.preview-count { font-size: 12px; color: #909399; }
.preview-table { font-size: 12px; }
.preview-table th, .preview-table td { padding: 6px 10px; }
.preview-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 16px; padding-top: 12px; border-top: 1px solid #E5E9F2; }

.placeholder { min-height: 300px; display: flex; align-items: center; justify-content: center; }
.placeholder-content { text-align: center; color: #909399; font-size: 14px; }
.placeholder-tip { font-size: 12px; margin-top: 8px; color: #b0b3b8; }

/* 弹窗样式 */
.modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 2000; }
.modal-content { background: white; border-radius: 8px; width: 600px; max-width: 90%; max-height: 80%; overflow: auto; }
.modal-small { width: 450px; }
.modal-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid #E5E9F2; }
.modal-header h3 { font-size: 16px; font-weight: 600; color: #1F2D3D; margin: 0; }
.error-header { background-color: #ffebee; border-bottom-color: #ef9a9a; }
.close-btn { background: none; border: none; font-size: 24px; cursor: pointer; color: #909399; }
.close-btn:hover { color: #606266; }
.modal-body { padding: 20px; }
.modal-message { font-size: 14px; color: #606266; margin-bottom: 12px; }
.modal-details { background-color: #f5f7fa; padding: 12px; border-radius: 4px; margin-top: 12px; }
.modal-details ul { margin: 0; padding-left: 20px; font-size: 13px; color: #909399; }
.modal-details li { margin: 4px 0; }
.modal-footer { padding: 16px 20px; border-top: 1px solid #E5E9F2; text-align: right; }

/* 详情弹窗内样式 */
.modal-info { background: #F5F7FA; padding: 12px; border-radius: 6px; margin-bottom: 16px; display: flex; flex-wrap: wrap; gap: 16px; }
.modal-info p { margin: 0; font-size: 13px; color: #606266; }
.modal-info strong { color: #1F2D3D; }
.modal-table-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.modal-result-label { font-size: 14px; font-weight: 600; color: #2e7d32; }
.modal-table { width: 100%; }
.row-selected { background-color: #e8f5e9 !important; }
.status-selected { color: #2e7d32; font-weight: 500; }
.status-none { color: #c0c4cc; }
</style>