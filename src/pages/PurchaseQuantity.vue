<template>
  <div class="forecast-page">
    <!-- 筛选区 -->
    <div class="card">
      <div class="filter-row">
        <!-- 大区经理多选 -->
        <div class="filter-item multi-select-item">
          <label>大区经理</label>
          <div class="multi-select-container">
            <div class="selected-tags" @click="focusManagerInput">
              <span v-for="item in selectedManagers" :key="item" class="tag">
                {{ item }}
                <button type="button" class="tag-remove" @click.stop="removeManager(item)">×</button>
              </span>
              <input 
                ref="managerInputRef"
                v-model="managerSearchText"
                type="text"
                class="multi-input"
                placeholder="搜索并选择"
                @input="filterManagerOptions"
                @focus="managerDropdownVisible = true"
                @blur="closeManagerDropdown"
                @keydown.enter="handleManagerKeydown"
              />
            </div>
            <div v-show="managerDropdownVisible && filteredManagerOptions.length > 0" class="dropdown-list">
              <div 
                v-for="item in filteredManagerOptions" 
                :key="item"
                class="dropdown-item"
                @click="addManager(item)"
              >
                {{ item }}
              </div>
            </div>
          </div>
        </div>

        <!-- 仓库多选 -->
        <div class="filter-item multi-select-item">
          <label>仓库</label>
          <div class="multi-select-container">
            <div class="selected-tags" @click="focusWarehouseInput">
              <span v-for="item in selectedWarehouses" :key="item" class="tag">
                {{ item }}
                <button type="button" class="tag-remove" @click.stop="removeWarehouse(item)">×</button>
              </span>
              <input 
                ref="warehouseInputRef"
                v-model="warehouseSearchText"
                type="text"
                class="multi-input"
                placeholder="搜索并选择"
                @input="filterWarehouseOptions"
                @focus="warehouseDropdownVisible = true"
                @blur="closeWarehouseDropdown"
                @keydown.enter="handleWarehouseKeydown"
              />
            </div>
            <div v-show="warehouseDropdownVisible && filteredWarehouseOptions.length > 0" class="dropdown-list">
              <div 
                v-for="item in filteredWarehouseOptions" 
                :key="item"
                class="dropdown-item"
                @click="addWarehouse(item)"
              >
                {{ item }}
              </div>
            </div>
          </div>
        </div>

        <!-- 品种多选 -->
        <div class="filter-item multi-select-item">
          <label>品种</label>
          <div class="multi-select-container">
            <div class="selected-tags" @click="focusVarietyInput">
              <span v-for="item in selectedVarieties" :key="item" class="tag">
                {{ item }}
                <button type="button" class="tag-remove" @click.stop="removeVariety(item)">×</button>
              </span>
              <input 
                ref="varietyInputRef"
                v-model="varietySearchText"
                type="text"
                class="multi-input"
                placeholder="搜索并选择"
                @input="filterVarietyOptions"
                @focus="varietyDropdownVisible = true"
                @blur="closeVarietyDropdown"
                @keydown.enter="handleVarietyKeydown"
              />
            </div>
            <div v-show="varietyDropdownVisible && filteredVarietyOptions.length > 0" class="dropdown-list">
              <div 
                v-for="item in filteredVarietyOptions" 
                :key="item"
                class="dropdown-item"
                @click="addVariety(item)"
              >
                {{ item }}
              </div>
            </div>
          </div>
        </div>

        <!-- 日期范围 -->
        <div class="filter-item date-range-item">
          <label>预测日期范围 <span class="date-hint">(最多15天)</span></label>
          <div class="date-range">
            <input type="date" v-model="filters.startDate" class="filter-input" @change="validateDateRange" />
            <span>至</span>
            <input type="date" v-model="filters.endDate" class="filter-input" @change="validateDateRange" />
          </div>
        </div>

        <div class="filter-actions">
          <button class="btn btn-primary" @click="handleQuery" :disabled="loading">
            {{ loading ? '预测中...' : '查询' }}
          </button>
          <button class="btn btn-secondary" @click="handleReset">重置</button>
        </div>
      </div>
    </div>

    <!-- 图表区 -->
    <div class="card">
      <div class="section-title">未来送货量预测趋势</div>
      <div class="chart-container" v-if="!loading && chartDates.length > 0">
        <div class="chart-legend">
          <span class="legend-tip">👆 点击图例可显示/隐藏对应曲线</span>
          <div class="legend-items">
            <div 
              class="legend-item"
              @click="toggleTotalWeight"
              title="点击显示/隐藏总重量"
            >
              <span 
                class="legend-color" 
                :style="{ backgroundColor: totalWeightVisible ? '#333' : '#ccc' }"
              ></span>
              <span 
                class="legend-name"
                :style="{ textDecoration: totalWeightVisible ? 'none' : 'line-through' }"
              >📊 总重量</span>
            </div>
            <div 
              v-for="(series, idx) in chartSeriesList" 
              :key="series.name"
              class="legend-item"
              @click="toggleSeries(series.name)"
              :title="`点击${series.visible ? '隐藏' : '显示'}${series.name}趋势线`"
            >
              <span 
                class="legend-color" 
                :style="{ backgroundColor: series.visible ? colors[idx % colors.length] : '#ccc' }"
              ></span>
              <span 
                class="legend-name"
                :style="{ textDecoration: series.visible ? 'none' : 'line-through' }"
              >{{ series.name }}</span>
            </div>
          </div>
        </div>
        <div class="chart-wrapper">
          <canvas ref="chartCanvas"></canvas>
        </div>
      </div>
      <div v-else-if="loading" class="loading-placeholder">预测计算中...</div>
      <div v-else class="loading-placeholder">暂无数据，请点击查询</div>
    </div>

    <!-- 明细数据区 -->
    <div class="card">
      <div class="table-header">
        <div class="section-title">预测明细数据</div>
        <button class="btn btn-secondary" @click="exportExcel" :disabled="loading">导出Excel</button>
      </div>

      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>预测日期</th>
              <th>大区经理</th>
              <th>仓库</th>
              <th>品种</th>
              <th>预测重量(吨)</th>
              <th width="80">查看</th>
            </tr>
          </thead>
      <tbody>
  <tr v-for="row in paginatedData" :key="row.id">
    <td>{{ row.target_date }}</td>
    <td>{{ row.regional_manager || '-' }}</td>
    <td>{{ row.warehouse || '-' }}</td>
    <td>{{ row.product_variety || '-' }}</td>
    <td>{{ parseFloat(row.predicted_weight).toFixed(2) }}</td>
    <td><button class="btn-view" @click="openDetailModal(row)">查看</button></td>
  </tr>
  <tr v-if="paginatedData.length === 0">
    <td :colspan="6" class="empty-data">暂无数据</td>
  </tr>
</tbody>
</table>
      </div>

      <!-- 分页 -->
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

    <!-- 详情弹窗 -->
    <div v-if="modalVisible" class="modal" @click.self="closeModal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>{{ modalTitle }}</h3>
          <button class="close-btn" @click="closeModal">&times;</button>
        </div>
        <div class="modal-body">
          <div class="modal-info">
            <p><strong>预测日期：</strong>{{ modalData?.target_date }}</p>
            <p><strong>大区经理：</strong>{{ modalData?.regional_manager }}</p>
            <p><strong>仓库：</strong>{{ modalData?.warehouse }}</p>
            <p><strong>品种：</strong>{{ modalData?.product_variety }}</p>
            <p><strong>预测重量：</strong>{{ parseFloat(modalData?.predicted_weight || '0').toFixed(2) }} 吨</p>
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import axios from 'axios'

// ==================== 配置 ====================
const API_BASE_URL = 'http://111.229.25.160:8001'

// ==================== 类型定义 ====================
interface PredictResult {
  id?: number
  target_date: string
  regional_manager: string
  warehouse: string
  product_variety: string
  predicted_weight: string
}

interface DetailResponse {
  total: number
  page: number
  page_size: number
  items: PredictResult[]
}

// ==================== 颜色常量 ====================
const colors = ['#1F77B4', '#FF7F0E', '#2CA02C', '#D62728', '#9467BD', '#8C564B', '#E377C2', '#7F7F7F']

// ==================== 状态 ====================
const loading = ref(false)
const detailData = ref<PredictResult[]>([])
const detailTotal = ref(0)
const chartCanvas = ref<HTMLCanvasElement>()

// 图例开关
const seriesVisibility = ref<Map<string, boolean>>(new Map())
const totalWeightVisible = ref(true)

// 错误弹窗
const errorModalVisible = ref(false)
const errorModalMessage = ref('')
const errorModalDetails = ref<string[]>([])

// 筛选条件
const todayStr = new Date().toISOString().slice(0, 10)
const getFutureDate = (days: number) => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

const filters = ref({
  startDate: todayStr,
  endDate: getFutureDate(14)
})

// 大区经理多选
const selectedManagers = ref<string[]>([])
const managerSearchText = ref('')
const managerDropdownVisible = ref(false)
const managerInputRef = ref<HTMLInputElement>()
const allManagerOptions = ref<string[]>([])
const filteredManagerOptions = ref<string[]>([])

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

// 分页
const currentPage = ref(1)
const pageSize = ref(10)
const totalPages = computed(() => Math.max(1, Math.ceil(detailTotal.value / pageSize.value)))
const paginatedData = computed(() => detailData.value)

// 弹窗
const modalVisible = ref(false)
const modalData = ref<PredictResult | null>(null)
const modalTitle = ref('')

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

// ==================== 验证日期范围 ====================
function validateDateRange() {
  const start = new Date(filters.value.startDate)
  const end = new Date(filters.value.endDate)
  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  
  if (days > 14) {
    showError('日期范围最多可选15天（含当天）', [])
    filters.value.endDate = getFutureDate(14)
  }
  if (start > end) {
    showError('开始日期不能晚于结束日期', [])
    filters.value.startDate = todayStr
    filters.value.endDate = getFutureDate(14)
  }
}

// ==================== 获取下拉选项 ====================
async function fetchOptions() {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/v1/送货历史`, {
      params: { page: 1, page_size: 200 }
    })
    const data = response.data as { items: any[] }
    const items = data.items || []
    
    allManagerOptions.value = [...new Set(items.map((item: any) => item.regional_manager))].filter(Boolean)
    allWarehouseOptions.value = [...new Set(items.map((item: any) => item.warehouse))].filter(Boolean)
    allVarietyOptions.value = [...new Set(items.map((item: any) => item.product_variety))].filter(Boolean)
    
    filteredManagerOptions.value = [...allManagerOptions.value]
    filteredWarehouseOptions.value = [...allWarehouseOptions.value]
    filteredVarietyOptions.value = [...allVarietyOptions.value]
  } catch (error) {
    console.error('获取选项失败', error)
    // 使用模拟数据作为后备
    allManagerOptions.value = ['张建国', '李明华', '王德发']
    allWarehouseOptions.value = ['北京仓库', '上海仓库', '广州仓库']
    allVarietyOptions.value = ['电解铜', '铝锭', '锌锭']
    filteredManagerOptions.value = [...allManagerOptions.value]
    filteredWarehouseOptions.value = [...allWarehouseOptions.value]
    filteredVarietyOptions.value = [...allVarietyOptions.value]
  }
}

// ==================== 大区经理多选逻辑 ====================
const filterManagerOptions = () => {
  const search = managerSearchText.value.toLowerCase()
  if (search) {
    filteredManagerOptions.value = allManagerOptions.value.filter(opt => opt.toLowerCase().includes(search))
  } else {
    filteredManagerOptions.value = [...allManagerOptions.value]
  }
  managerDropdownVisible.value = filteredManagerOptions.value.length > 0
}

const addManager = (item: string) => {
  if (!selectedManagers.value.includes(item)) {
    selectedManagers.value.push(item)
  }
  managerSearchText.value = ''
  filterManagerOptions()
}

const removeManager = (item: string) => {
  selectedManagers.value = selectedManagers.value.filter(i => i !== item)
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

const focusManagerInput = () => {
  managerInputRef.value?.focus()
}

// ==================== 仓库多选逻辑 ====================
const filterWarehouseOptions = () => {
  const search = warehouseSearchText.value.toLowerCase()
  if (search) {
    filteredWarehouseOptions.value = allWarehouseOptions.value.filter(opt => opt.toLowerCase().includes(search))
  } else {
    filteredWarehouseOptions.value = [...allWarehouseOptions.value]
  }
  warehouseDropdownVisible.value = filteredWarehouseOptions.value.length > 0
}

const addWarehouse = (item: string) => {
  if (!selectedWarehouses.value.includes(item)) {
    selectedWarehouses.value.push(item)
  }
  warehouseSearchText.value = ''
  filterWarehouseOptions()
}

const removeWarehouse = (item: string) => {
  selectedWarehouses.value = selectedWarehouses.value.filter(i => i !== item)
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

const focusWarehouseInput = () => {
  warehouseInputRef.value?.focus()
}

// ==================== 品种多选逻辑 ====================
const filterVarietyOptions = () => {
  const search = varietySearchText.value.toLowerCase()
  if (search) {
    filteredVarietyOptions.value = allVarietyOptions.value.filter(opt => opt.toLowerCase().includes(search))
  } else {
    filteredVarietyOptions.value = [...allVarietyOptions.value]
  }
  varietyDropdownVisible.value = filteredVarietyOptions.value.length > 0
}

const addVariety = (item: string) => {
  if (!selectedVarieties.value.includes(item)) {
    selectedVarieties.value.push(item)
  }
  varietySearchText.value = ''
  filterVarietyOptions()
}

const removeVariety = (item: string) => {
  selectedVarieties.value = selectedVarieties.value.filter(i => i !== item)
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

const focusVarietyInput = () => {
  varietyInputRef.value?.focus()
}

// ==================== 触发预测 ====================
// ==================== 触发预测 ====================
async function triggerPredict() {
  loading.value = true
  try {
    const items = []
    
    // 如果有选中的仓库和品种
    if (selectedWarehouses.value.length > 0 && selectedVarieties.value.length > 0) {
      for (const warehouse of selectedWarehouses.value) {
        for (const variety of selectedVarieties.value) {
          items.push({
            warehouse: warehouse,
            productVariety: variety,
            horizon_days: 15,
            prediction_start_date: filters.value.startDate,
            use_cache: true
          })
        }
      }
    } 
    // 只有仓库
    else if (selectedWarehouses.value.length > 0) {
      for (const warehouse of selectedWarehouses.value) {
        items.push({
          warehouse: warehouse,
          horizon_days: 15,
          prediction_start_date: filters.value.startDate,
          use_cache: true
        })
      }
    }
    // 只有品种
    else if (selectedVarieties.value.length > 0) {
      for (const variety of selectedVarieties.value) {
        items.push({
          productVariety: variety,
          horizon_days: 15,
          prediction_start_date: filters.value.startDate,
          use_cache: true
        })
      }
    }
    // 没有选择时，使用默认值（修改这里！）
    else {
      items.push({
        warehouse: '北京仓库',
        productVariety: '电解铜',
        horizon_days: 15,
        prediction_start_date: filters.value.startDate,
        use_cache: true
      })
    }
    
    console.log('预测请求参数:', JSON.stringify({ items }, null, 2))
    
    await axios.post(`${API_BASE_URL}/api/v1/预测`, { items })
    await new Promise(resolve => setTimeout(resolve, 1500))
    
  } catch (error: any) {
    console.error('预测失败', error)
    const errorMsg = error.response?.data?.message || error.message || '预测失败'
    showError(errorMsg, ['请检查请求参数是否正确'])
  } finally {
    loading.value = false
  }
}

// ==================== 获取明细数据 ====================
async function fetchDetailData() {
  try {
    const params: Record<string, any> = {
      page: currentPage.value,
      page_size: pageSize.value,
      date_from: filters.value.startDate,
      date_to: filters.value.endDate
    }
    
    if (selectedManagers.value.length > 0) {
      params.regional_managers = selectedManagers.value
    }
    if (selectedWarehouses.value.length > 0) {
      params.warehouses = selectedWarehouses.value
    }
    if (selectedVarieties.value.length > 0) {
      params.product_varieties = selectedVarieties.value
    }
    
    const response = await axios.get(`${API_BASE_URL}/api/v1/送货量预测/明细`, { params })
    const data = response.data as DetailResponse
    
    if (data) {
      detailData.value = data.items || []
      detailTotal.value = data.total || 0
    }
  } catch (error: any) {
    console.error('获取明细失败', error)
    detailData.value = []
    detailTotal.value = 0
  }
}

// ==================== 查询 ====================
async function handleQuery() {
  currentPage.value = 1
  await triggerPredict()
  await fetchDetailData()
  setTimeout(() => drawChart(), 100)
}

function handleReset() {
  filters.value = {
    startDate: todayStr,
    endDate: getFutureDate(14)
  }
  selectedManagers.value = []
  selectedWarehouses.value = []
  selectedVarieties.value = []
  managerSearchText.value = ''
  warehouseSearchText.value = ''
  varietySearchText.value = ''
  handleQuery()
}

// ==================== 分页 ====================
function prevPage() { 
  if (currentPage.value > 1) { 
    currentPage.value-- 
    fetchDetailData()
  } 
}
function nextPage() { 
  if (currentPage.value < totalPages.value) { 
    currentPage.value++ 
    fetchDetailData()
  } 
}

// ==================== 图表数据 ====================
const chartDates = computed(() => {
  const dates = [...new Set(detailData.value.map(item => item.target_date))].sort()
  return dates
})

const chartSeriesList = computed(() => {
  const varieties = [...new Set(detailData.value.map(item => item.product_variety))].filter(Boolean)
  const dates = chartDates.value
  
  varieties.forEach(variety => {
    if (!seriesVisibility.value.has(variety)) {
      seriesVisibility.value.set(variety, true)
    }
  })
  
  return varieties.map(variety => ({
    name: variety,
    visible: seriesVisibility.value.get(variety) ?? true,
    data: dates.map(date => {
      const items = detailData.value.filter(item => 
        item.target_date === date && item.product_variety === variety
      )
      return items.reduce((sum, item) => sum + parseFloat(item.predicted_weight), 0)
    })
  }))
})

const totalWeightData = computed(() => {
  const dates = chartDates.value
  return dates.map(date => {
    const items = detailData.value.filter(item => item.target_date === date)
    return items.reduce((sum, item) => sum + parseFloat(item.predicted_weight), 0)
  })
})

// ==================== 图例开关 ====================
function toggleSeries(seriesName: string) {
  const current = seriesVisibility.value.get(seriesName) ?? true
  seriesVisibility.value.set(seriesName, !current)
  drawChart()
}

function toggleTotalWeight() {
  totalWeightVisible.value = !totalWeightVisible.value
  drawChart()
}

// ==================== 绘制图表 ====================
function drawChart() {
  if (!chartCanvas.value) return
  
  const ctx = chartCanvas.value.getContext('2d')
  if (!ctx) return
  
  const dates = chartDates.value
  const series = chartSeriesList.value.filter(s => s.visible)
  const showTotal = totalWeightVisible.value
  const totalData = totalWeightData.value
  
  if (dates.length === 0) return
  if (series.length === 0 && !showTotal) return
  
  const container = chartCanvas.value.parentElement
  const containerWidth = container?.clientWidth || 800
  const width = Math.max(containerWidth, 600)
  const height = 400
  
  chartCanvas.value.width = width
  chartCanvas.value.height = height
  
  let maxValue = 0
  series.forEach(s => {
    const max = Math.max(...s.data, 0)
    maxValue = Math.max(maxValue, max)
  })
  if (showTotal) {
    const maxTotal = Math.max(...totalData, 0)
    maxValue = Math.max(maxValue, maxTotal)
  }
  maxValue = Math.ceil(maxValue * 1.1) || 100
  
  const margin = { top: 20, right: 80, bottom: 50, left: 60 }
  const chartWidth = width - margin.left - margin.right
  const chartHeight = height - margin.top - margin.bottom
  
  ctx.clearRect(0, 0, width, height)
  ctx.save()
  ctx.translate(margin.left, margin.top)
  
  // 坐标轴
  ctx.beginPath()
  ctx.strokeStyle = '#ccc'
  ctx.moveTo(0, 0)
  ctx.lineTo(0, chartHeight)
  ctx.lineTo(chartWidth, chartHeight)
  ctx.stroke()
  
  // Y轴刻度
  const ySteps = 5
  for (let i = 0; i <= ySteps; i++) {
    const y = chartHeight - (i / ySteps) * chartHeight
    const value = (i / ySteps) * maxValue
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(chartWidth, y)
    ctx.strokeStyle = '#eee'
    ctx.stroke()
    ctx.fillStyle = '#666'
    ctx.font = '11px Arial'
    ctx.fillText(Math.round(value).toString(), -35, y + 3)
  }
  
  // X轴
  const xStep = dates.length > 1 ? chartWidth / (dates.length - 1) : chartWidth
  const maxLabels = Math.floor(chartWidth / 70)
  const labelStep = Math.max(1, Math.ceil(dates.length / maxLabels))
  
  dates.forEach((date, i) => {
    const x = i * xStep
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, chartHeight)
    ctx.strokeStyle = '#f0f0f0'
    ctx.stroke()
    
    if (i % labelStep === 0 || i === dates.length - 1) {
      ctx.fillStyle = '#666'
      ctx.font = '11px Arial'
      ctx.fillText(date.slice(5), x - 20, chartHeight + 20)
    }
  })
  
  // 总重量
  if (showTotal && totalData.length > 0) {
    ctx.beginPath()
    let first = true
    totalData.forEach((value, i) => {
      const x = i * xStep
      const y = chartHeight - (value / maxValue) * chartHeight
      if (first) {
        ctx.moveTo(x, y)
        first = false
      } else {
        ctx.lineTo(x, y)
      }
    })
    ctx.strokeStyle = '#333'
    ctx.lineWidth = 3
    ctx.stroke()
    
    totalData.forEach((value, i) => {
      const x = i * xStep
      const y = chartHeight - (value / maxValue) * chartHeight
      ctx.beginPath()
      ctx.fillStyle = '#333'
      ctx.arc(x, y, 4, 0, 2 * Math.PI)
      ctx.fill()
    })
  }
  
  // 品种折线
  series.forEach((s, idx) => {
    const color = colors[idx % colors.length]
    ctx.beginPath()
    
    let first = true
    s.data.forEach((value, i) => {
      const x = i * xStep
      const y = chartHeight - (value / maxValue) * chartHeight
      if (first) {
        ctx.moveTo(x, y)
        first = false
      } else {
        ctx.lineTo(x, y)
      }
    })
    
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.stroke()
    
    s.data.forEach((value, i) => {
      const x = i * xStep
      const y = chartHeight - (value / maxValue) * chartHeight
      ctx.beginPath()
      ctx.fillStyle = color
      ctx.arc(x, y, 3, 0, 2 * Math.PI)
      ctx.fill()
    })
  })
  
  // 标签
  ctx.save()
  ctx.translate(-40, chartHeight / 2)
  ctx.rotate(-Math.PI / 2)
  ctx.fillStyle = '#666'
  ctx.font = '12px Arial'
  ctx.fillText('重量(吨)', -20, 5)
  ctx.restore()
  
  ctx.fillStyle = '#666'
  ctx.font = '12px Arial'
  ctx.fillText('日期', chartWidth / 2 - 20, chartHeight + 40)
  
  ctx.restore()
}

// ==================== 查看弹窗 ====================
function openDetailModal(row: PredictResult) {
  modalData.value = row
  modalTitle.value = `${row.target_date} - ${row.regional_manager} - ${row.warehouse} - ${row.product_variety} 预测明细`
  modalVisible.value = true
}

function closeModal() {
  modalVisible.value = false
  modalData.value = null
}

// ==================== 导出 ====================
async function exportExcel() {
  try {
    const params: Record<string, any> = {
      date_from: filters.value.startDate,
      date_to: filters.value.endDate
    }
    
    if (selectedManagers.value.length > 0) {
      params.regional_managers = selectedManagers.value
    }
    if (selectedWarehouses.value.length > 0) {
      params.warehouses = selectedWarehouses.value
    }
    if (selectedVarieties.value.length > 0) {
      params.product_varieties = selectedVarieties.value
    }
    
    const response = await axios.get(`${API_BASE_URL}/api/v1/送货量预测/导出`, {
      params,
      responseType: 'blob'
    })
    
    const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const link = document.createElement('a')
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)
    link.href = URL.createObjectURL(blob)
    link.download = `送货量预测_${timestamp}.xlsx`
    link.click()
    URL.revokeObjectURL(link.href)
  } catch (error) {
    console.error('导出失败', error)
    showError('导出失败', ['请稍后重试'])
  }
}

// ==================== 监听 ====================
watch(() => detailData.value, () => {
  setTimeout(drawChart, 100)
})

const handleResize = () => {
  setTimeout(drawChart, 100)
}

onMounted(() => {
  fetchOptions()
  handleQuery()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})
</script>

<style scoped>
.forecast-page { width: 100%; }
.card { background: white; border-radius: 8px; padding: 16px 20px; margin-bottom: 16px; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05); }

.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: flex-end;
}

.filter-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.filter-item label {
  font-size: 13px;
  font-weight: 500;
  color: #606266;
  white-space: nowrap;
}

.date-range-item {
  min-width: 280px;
}

.date-hint {
  font-size: 11px;
  color: #909399;
  font-weight: normal;
}

.date-range {
  display: flex;
  gap: 8px;
  align-items: center;
}

.filter-input {
  padding: 6px 10px;
  border: 1px solid #E5E9F2;
  border-radius: 4px;
  font-size: 13px;
  width: 130px;
}

.filter-actions {
  display: flex;
  gap: 10px;
  flex-shrink: 0;
  margin-left: auto;
}

.multi-select-item {
  min-width: 200px;
}

.multi-select-container {
  position: relative;
  width: 220px;
}

.selected-tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  padding: 4px 6px;
  border: 1px solid #E5E9F2;
  border-radius: 4px;
  background: white;
  min-height: 32px;
  cursor: text;
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
}

.tag-remove {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  color: #909399;
  padding: 0 2px;
}

.tag-remove:hover {
  color: #f56c6c;
}

.multi-input {
  flex: 1;
  min-width: 60px;
  border: none;
  outline: none;
  padding: 4px 6px;
  font-size: 13px;
  background: transparent;
}

.multi-input::placeholder {
  color: #c0c4cc;
}

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
}

.dropdown-item:hover {
  background-color: #F5F7FA;
  color: #4A7A9C;
}

.btn {
  padding: 6px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-primary {
  background-color: #4A7A9C;
  color: white;
}
.btn-primary:hover { background-color: #5a8aac; }

.btn-secondary {
  background-color: #F5F7FA;
  color: #606266;
  border: 1px solid #E5E9F2;
}
.btn-secondary:hover { background-color: #E5E9F2; }

.btn-view {
  background: none;
  border: 1px solid #4A7A9C;
  color: #4A7A9C;
  padding: 4px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}
.btn-view:hover {
  background-color: #4A7A9C;
  color: white;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: #1F2D3D;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #E5E9F2;
}

.chart-container { min-height: 450px; }
.chart-wrapper { width: 100%; overflow-x: auto; }
.chart-wrapper canvas { min-width: 600px; width: 100%; height: auto; }

.chart-legend { 
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  flex-wrap: wrap;
  margin-bottom: 16px; 
  padding-bottom: 12px; 
  border-bottom: 1px solid #E5E9F2;
}

.legend-tip {
  font-size: 12px;
  color: #909399;
  background: #F5F7FA;
  padding: 4px 12px;
  border-radius: 16px;
}

.legend-items {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background-color 0.2s;
}
.legend-item:hover { background-color: #F5F7FA; }

.legend-color { width: 16px; height: 16px; border-radius: 3px; }
.legend-name { color: #333; }

.loading-placeholder {
  min-height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #909399;
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.table-wrapper {
  overflow-x: auto;
  border: 1px solid #E5E9F2;
  border-radius: 4px;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.data-table th,
.data-table td {
  padding: 10px 12px;
  text-align: center;
  border-bottom: 1px solid #E5E9F2;
  white-space: nowrap;
}

.data-table th {
  background-color: #E8F0F8;
  font-weight: 600;
  color: #2c3e50;
}

.data-table tbody tr:hover {
  background-color: #F5F7FA;
}

.empty-data {
  text-align: center;
  padding: 40px;
  color: #909399;
}

.pagination {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
}

.pagination button {
  padding: 4px 12px;
  border: 1px solid #E5E9F2;
  background: white;
  border-radius: 4px;
  cursor: pointer;
}

.pagination button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pagination select {
  padding: 4px 8px;
  border: 1px solid #E5E9F2;
  border-radius: 4px;
}

.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  width: 550px;
  max-width: 90%;
  max-height: 80%;
  overflow: auto;
}

.modal-small {
  width: 450px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #E5E9F2;
}

.modal-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: #1F2D3D;
  margin: 0;
}

.error-header {
  background-color: #ffebee;
  border-bottom-color: #ef9a9a;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #909399;
}

.close-btn:hover {
  color: #606266;
}

.modal-body {
  padding: 20px;
}

.modal-info {
  background: #F5F7FA;
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 16px;
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.modal-info p {
  margin: 0;
  font-size: 13px;
  color: #606266;
}

.modal-info strong {
  color: #1F2D3D;
}

.modal-message {
  font-size: 14px;
  color: #606266;
  margin-bottom: 12px;
}

.modal-details {
  background-color: #f5f7fa;
  padding: 12px;
  border-radius: 4px;
  margin-top: 12px;
}

.modal-details ul {
  margin: 0;
  padding-left: 20px;
  font-size: 13px;
  color: #909399;
}

.modal-details li {
  margin: 4px 0;
}

.modal-footer {
  padding: 16px 20px;
  border-top: 1px solid #E5E9F2;
  text-align: right;
}
</style>