<template>
  <div class="purchase-page">
    <section class="page-section">
      <div class="page-head">
        <h1 class="page-title">AI预测报货数量</h1>
      </div>
      <div class="card shadow-sm">
        <div class="card-header bg-white fw-bold">
          <i class="bi bi-table me-2"></i>表格数据
        </div>
        <div class="card-body">
          <div class="result-content">
            <div class="result-label">预测条件</div>
            <div class="query-row mb-3">
              <div class="query-item query-date">
                <input v-model="filters.startDate" type="date" class="form-control form-control-sm" />
              </div>
              <div class="query-item query-date">
                <input v-model="filters.endDate" type="date" class="form-control form-control-sm" />
              </div>
              <div class="query-item query-manager">
                <select v-model="filters.regionalManager" class="form-select form-select-sm">
                  <option value="">大区经理（仓库）：全部</option>
                  <option v-for="name in managerOptions" :key="name" :value="name">{{ name }}</option>
                </select>
              </div>
              <div class="query-item query-contract">
                <input v-model.trim="filters.contractNo" class="form-control form-control-sm" placeholder="合同编号" />
              </div>
              <div class="query-item query-smelter">
                <select v-model="filters.smelter" class="form-select form-select-sm">
                  <option value="">冶炼厂：全部</option>
                  <option v-for="name in smelterOptions" :key="name" :value="name">{{ name }}</option>
                </select>
              </div>
              <div class="query-actions">
                <button type="button" class="btn btn-success btn-sm" :disabled="tableLoading" @click="queryTableData">
                  {{ tableLoading ? '查询中...' : '查询' }}
                </button>
                <button type="button" class="btn btn-outline-secondary btn-sm" @click="resetFilters">重置</button>
              </div>
            </div>

            <div v-if="errorMessage" class="alert alert-danger py-2">{{ errorMessage }}</div>

            <div class="result-label result-label-row">
              <span>有效合同明细（共 {{ filteredRows.length }} 条）</span>
              <span class="unit-hint">表中数量为车数</span>
            </div>
            <div class="table-scroll">
              <table class="result-table">
                <thead>
                  <tr>
                    <th>大区经理</th>
                    <th>冶炼厂</th>
                    <th>合同编号</th>
                    <th v-for="date in tableDateColumns" :key="date">{{ date }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, idx) in displayRowsWithMerge" :key="`r-${idx}`">
                    <td v-if="row.showManager" :rowspan="row.managerRowspan">{{ row.regional_manager }}</td>
                    <td>{{ row.smelter }}</td>
                    <td>{{ row.contract_no }}</td>
                    <td v-for="(cell, i) in row.cells" :key="`${row.contract_no}-${i}`">
                      <span :class="{ 'cell-dash': cell.isPlaceholder }">{{ cell.text }}</span>
                    </td>
                  </tr>
                  <tr v-if="!displayRowsWithMerge.length">
                    <td :colspan="3 + tableDateColumns.length" class="empty-hint">暂无符合筛选条件的数据</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="table-pager">
              <button type="button" class="pager-btn" :disabled="currentPage === 1" @click="prevPage">上一页</button>
              <span>第 {{ currentPage }} / {{ totalPages }} 页</span>
              <button type="button" class="pager-btn" :disabled="currentPage === totalPages" @click="nextPage">
                下一页
              </button>
            </div>

          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  dateColumnsForMockQuery,
  generatePurchaseMockRecords,
  mockRecordsToTableRows,
  rowHasTruckInColumns,
  type PurchaseMockRecord,
} from '@/data/purchaseMockData'

/** 临时：本地 100 条；恢复后端时改回接口请求 */
const ALL_MOCK_RECORDS: PurchaseMockRecord[] = (() => {
  const raw = generatePurchaseMockRecords(100)
  if (raw.length <= 2) return raw
  const a = Math.floor(Math.random() * raw.length)
  let b = Math.floor(Math.random() * raw.length)
  while (b === a) b = Math.floor(Math.random() * raw.length)
  return raw.filter((_, idx) => idx !== a && idx !== b)
})()
const FIXED_SMELTER_OPTIONS = ['金利', '豫光']

const tableLoading = ref(false)
const errorMessage = ref('')

const todayStr = new Date().toISOString().slice(0, 10)
function plusDays(dateText: string, days: number) {
  const d = new Date(`${dateText}T00:00:00`)
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const filters = ref({
  startDate: todayStr,
  endDate: plusDays(todayStr, 5),
  regionalManager: '',
  contractNo: '',
  smelter: '',
})

/** 冶炼厂下拉：优先接口 smelter_options；未返回时从当前表格行去重生成 */
const smelters = ref<string[]>([])
const rows = ref<TableRow[]>([])
/** 大区经理下拉：仅使用首次进入页面查询得到的列表，后续查询不再改动 */
const initialManagers = ref<string[]>([])
/** 与每行 cells 列一一对应的日期表头（查询时与 mock 数据对齐） */
const tableDateColumns = ref<string[]>([])
const currentPage = ref(1)
const pageSize = 10

type CellDisplay = { text: string; isPlaceholder?: boolean }

type TableRow = {
  regional_manager: string
  smelter: string
  contract_no: string
  completion_date: string
  prediction_date?: string
  cells: CellDisplay[]
}

/** 大区经理筛选选项：直接用已加载数据里的大区经理列去重 */
const managerOptions = computed(() => {
  return initialManagers.value
})

/** 冶炼厂筛选选项：有 smelter_options 用接口；否则用已加载数据里的冶炼厂列去重 */
const smelterOptions = computed(() => {
  const fromApi = (smelters.value || []).map((s) => String(s).trim()).filter(Boolean)
  if (fromApi.length > 0) {
    return [...new Set(fromApi)].sort((a, b) => a.localeCompare(b, 'zh-CN'))
  }
  const fromRows = [
    ...new Set(rows.value.map((r) => String(r.smelter).trim()).filter(Boolean)),
  ]
  return fromRows.sort((a, b) => a.localeCompare(b, 'zh-CN'))
})

const filteredRows = computed(() => {
  const list = rows.value.filter((row) => {
    const byManager =
      !filters.value.regionalManager || String(row.regional_manager) === String(filters.value.regionalManager)
    const byContract = !filters.value.contractNo || String(row.contract_no).includes(filters.value.contractNo)
    const bySmelter =
      !filters.value.smelter || String(row.smelter) === String(filters.value.smelter)
    return byManager && byContract && bySmelter
  })
  return [...list].sort((a, b) => {
    const m = String(a.regional_manager).localeCompare(String(b.regional_manager), 'zh-CN')
    if (m !== 0) return m
    const s = String(a.smelter).localeCompare(String(b.smelter), 'zh-CN')
    if (s !== 0) return s
    return String(a.contract_no).localeCompare(String(b.contract_no), 'zh-CN')
  })
})

type MergedRow = TableRow & { showManager: boolean; managerRowspan: number }

/** 仅合并「相邻且大区经理相同」的行 */
const totalPages = computed(() => Math.max(1, Math.ceil(filteredRows.value.length / pageSize)))
const pagedRows = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return filteredRows.value.slice(start, start + pageSize)
})

watch(
  [
    filteredRows,
    () => filters.value.startDate,
    () => filters.value.endDate,
    () => filters.value.regionalManager,
    () => filters.value.contractNo,
    () => filters.value.smelter,
  ],
  () => {
    currentPage.value = 1
  },
)

const displayRowsWithMerge = computed((): MergedRow[] => {
  const list = pagedRows.value
  return list.map((row, idx) => {
    const prev = idx > 0 ? list[idx - 1] : null
    const isFirstInGroup = !prev || prev.regional_manager !== row.regional_manager
    let rowspan = 1
    if (isFirstInGroup) {
      for (let j = idx + 1; j < list.length; j++) {
        if (list[j].regional_manager === row.regional_manager) rowspan++
        else break
      }
    }
    return {
      ...row,
      showManager: isFirstInGroup,
      managerRowspan: isFirstInGroup ? rowspan : 0,
    }
  })
})

function prevPage() {
  if (currentPage.value > 1) currentPage.value -= 1
}

function nextPage() {
  if (currentPage.value < totalPages.value) currentPage.value += 1
}

async function queryTableData() {
  tableLoading.value = true
  errorMessage.value = ''
  try {
    await Promise.resolve()
    const { startDate, endDate, regionalManager, contractNo, smelter } = filters.value
    const rm = regionalManager.trim()
    const cn = contractNo.trim()
    const sm = smelter.trim()

    const filtered = ALL_MOCK_RECORDS.filter((r) => {
      if (rm && r.regional_manager !== rm) return false
      if (cn && !r.contract_no.includes(cn)) return false
      if (sm && r.smelter_company !== sm) return false
      return true
    })

    smelters.value = [...FIXED_SMELTER_OPTIONS]
    const cols = dateColumnsForMockQuery(startDate, endDate)
    tableDateColumns.value = cols
    const built = mockRecordsToTableRows(filtered, cols) as TableRow[]
    const nextRows = built.filter((r) => rowHasTruckInColumns(r))
    rows.value = nextRows

    if (initialManagers.value.length === 0) {
      const pool =
        nextRows.length > 0
          ? nextRows.map((r) => String(r.regional_manager).trim())
          : ALL_MOCK_RECORDS.map((r) => String(r.regional_manager).trim())
      initialManagers.value = [...new Set(pool.filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, 'zh-CN'),
      )
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '查询失败'
    rows.value = []
    tableDateColumns.value = []
  } finally {
    tableLoading.value = false
  }
}

function resetFilters() {
  filters.value = {
    startDate: todayStr,
    endDate: plusDays(todayStr, 5),
    regionalManager: '',
    contractNo: '',
    smelter: '',
  }
  errorMessage.value = ''
}

onMounted(() => {
  void queryTableData()
})
</script>

<style scoped>
.purchase-page {
  padding: 16px;
  max-width: 100%;
  box-sizing: border-box;
}

.page-head {
  margin-bottom: 16px;
}

.page-title {
  font-size: 1.35rem;
  font-weight: 600;
  color: #166534;
  margin: 0;
  text-align: left;
}

.page-section {
  text-align: left;
}

.result-content {
  background: #f8fafc;
  border-radius: 12px;
  padding: 16px;
}

.result-label {
  font-size: 14px;
  font-weight: 600;
  color: #2e7d32;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e2e8f0;
}

.result-label-row {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 10px;
}

.unit-hint {
  font-size: 13px;
  font-weight: 500;
  color: #64748b;
}

.table-scroll {
  overflow-x: auto;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  background: #fff;
}

.result-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.result-table th,
.result-table td {
  padding: 10px 14px;
  text-align: center;
  border-bottom: 1px solid #e2e8f0;
  white-space: nowrap;
  line-height: 20px;
}

.result-table tbody tr {
  height: 40px;
}

.result-table th {
  background: #f0f4f8;
  font-weight: 600;
  color: #2c3e50;
}

.empty-hint {
  text-align: center;
  color: #94a3b8;
  padding: 18px 12px;
}

.cell-dash {
  color: #94a3b8;
  font-weight: normal;
}

.table-pager {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  width: 100%;
  box-sizing: border-box;
  margin-top: 10px;
  font-size: 13px;
  color: #475569;
}

.pager-btn {
  border: 1px solid #16a34a;
  background: #fff;
  color: #166534;
  border-radius: 6px;
  padding: 2px 10px;
}

.pager-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.query-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px 20px;
  width: 100%;
  box-sizing: border-box;
}

.query-item {
  min-width: 0;
}

.query-item .form-control,
.query-item .form-select {
  width: 100%;
}

.query-date {
  flex: 1 1 150px;
  max-width: 220px;
}

.query-manager {
  flex: 2 1 220px;
}

.query-contract {
  flex: 2 1 200px;
}

.query-smelter {
  flex: 1 1 150px;
  max-width: 200px;
}

.query-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
  margin-left: auto;
}
</style>
