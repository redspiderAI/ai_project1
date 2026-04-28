<template>
  <div class="wdc-page">
    <div class="wdc-head">
      <h2>库房距离监测配置</h2>
      <p>单向绑定：源库房 -> 目标库房。支持查询、绑定、解绑与批量操作。</p>
    </div>

    <section class="wdc-card wdc-form">
      <div class="wdc-row">
        <label>源库房（A）</label>
        <select v-model.number="sourceWarehouseId">
          <option :value="0">请选择源库房</option>
          <option v-for="w in warehouseOptions" :key="w.id" :value="w.id">{{ w.name }}（{{ w.id }}）</option>
        </select>
      </div>
      <div class="wdc-actions">
        <button type="button" class="btn btn-primary" :disabled="!sourceWarehouseId || busy" @click="queryForSource">
          查询 A 的绑定
        </button>
        <button type="button" class="btn btn-outline-secondary" :disabled="busy" @click="refreshAllList()">
          刷新全部绑定
        </button>
      </div>
      <p v-if="message" class="wdc-msg">{{ message }}</p>
      <p v-if="error" class="wdc-err">{{ error }}</p>
    </section>

    <section class="wdc-card wdc-form">
      <h3>绑定 / 批量绑定</h3>
      <div class="wdc-row">
        <label>目标库房（B）</label>
        <select v-model.number="targetWarehouseId">
          <option :value="0">请选择目标库房</option>
          <option v-for="w in targetCandidates" :key="w.id" :value="w.id">{{ w.name }}（{{ w.id }}）</option>
        </select>
      </div>
      <div class="wdc-actions">
        <button
          type="button"
          class="btn btn-primary"
          :disabled="!sourceWarehouseId || !targetWarehouseId || busy"
          @click="bindSingle"
        >
          绑定 A -> B
        </button>
      </div>

      <div class="wdc-batch">
        <label>批量绑定目标（可多选）</label>
        <div class="wdc-chips">
          <label v-for="w in targetCandidates" :key="`bind-${w.id}`" class="wdc-chip">
            <input v-model="batchBindTargetIds" type="checkbox" :value="w.id" />
            <span>{{ w.name }}（{{ w.id }}）</span>
          </label>
        </div>
        <button
          type="button"
          class="btn btn-outline-primary"
          :disabled="!sourceWarehouseId || batchBindTargetIds.length === 0 || busy"
          @click="bindBatch"
        >
          批量绑定
        </button>
      </div>
    </section>

    <section class="wdc-card">
      <h3>出边（A -> ?）</h3>
      <table class="wdc-table">
        <thead>
          <tr>
            <th>源库房</th>
            <th>目标库房</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="outboundRows.length === 0">
            <td colspan="3">暂无数据</td>
          </tr>
          <tr v-for="r in outboundRows" :key="`out-${r.fromId}-${r.toId}`">
            <td>{{ r.fromName }}（{{ r.fromId }}）</td>
            <td>{{ r.toName }}（{{ r.toId }}）</td>
            <td>
              <label class="wdc-inline-check">
                <input v-model="batchUnbindTargetIds" type="checkbox" :value="r.toId" />
                批量选中
              </label>
              <button type="button" class="btn btn-sm btn-outline-danger" :disabled="busy" @click="unbindSingle(r)">
                解绑
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <div class="wdc-actions mt">
        <button
          type="button"
          class="btn btn-outline-danger"
          :disabled="!sourceWarehouseId || batchUnbindTargetIds.length === 0 || busy"
          @click="unbindBatch"
        >
          批量解绑选中出边
        </button>
      </div>
    </section>

    <section class="wdc-card">
      <h3>入边（? -> A）</h3>
      <table class="wdc-table">
        <thead>
          <tr>
            <th>源库房</th>
            <th>目标库房</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="inboundRows.length === 0">
            <td colspan="2">暂无数据</td>
          </tr>
          <tr v-for="r in inboundRows" :key="`in-${r.fromId}-${r.toId}`">
            <td>{{ r.fromName }}（{{ r.fromId }}）</td>
            <td>{{ r.toName }}（{{ r.toId }}）</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="wdc-card">
      <h3>全部绑定列表</h3>
      <table class="wdc-table">
        <thead>
          <tr>
            <th>源库房</th>
            <th>目标库房</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="allRows.length === 0">
            <td colspan="2">暂无数据</td>
          </tr>
          <tr v-for="r in allRows" :key="`all-${r.fromId}-${r.toId}`">
            <td>{{ r.fromName }}（{{ r.fromId }}）</td>
            <td>{{ r.toName }}（{{ r.toId }}）</td>
          </tr>
        </tbody>
      </table>
      <div class="wdc-pager">
        <button type="button" class="btn btn-sm btn-outline-secondary" :disabled="allPage <= 1 || busy" @click="gotoAllPage(allPage - 1)">
          上一页
        </button>
        <span>第 {{ allPage }} / {{ allTotalPages }} 页（共 {{ allTotal }} 条）</span>
        <button
          type="button"
          class="btn btn-sm btn-outline-secondary"
          :disabled="allPage >= allTotalPages || busy"
          @click="gotoAllPage(allPage + 1)"
        >
          下一页
        </button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  deleteTlUnbindWarehouseLink,
  fetchTlWarehouseLinksInbound,
  fetchTlWarehouseLinksList,
  fetchTlWarehouseLinksOutbound,
  fetchTlWarehousesAll,
  postTlBatchBindWarehouseLinks,
  postTlBatchUnbindWarehouseLinks,
  postTlBindWarehouseLink,
} from '../api/tlApi'

type WarehouseOption = { id: number; name: string }
type LinkRow = { fromId: number; toId: number; fromName: string; toName: string }

const warehouseOptions = ref<WarehouseOption[]>([])
const sourceWarehouseId = ref(0)
const targetWarehouseId = ref(0)
const batchBindTargetIds = ref<number[]>([])
const batchUnbindTargetIds = ref<number[]>([])

const outboundRows = ref<LinkRow[]>([])
const inboundRows = ref<LinkRow[]>([])
const allRows = ref<LinkRow[]>([])

const allPage = ref(1)
const allSize = ref(50)
const allTotal = ref(0)
const allTotalPages = computed(() => Math.max(1, Math.ceil(allTotal.value / allSize.value)))

const busy = ref(false)
const message = ref('')
const error = ref('')

function pickNum(row: Record<string, unknown>, keys: string[]): number {
  for (const k of keys) {
    const v = row[k]
    if (typeof v === 'number' && Number.isFinite(v)) return v
    if (typeof v === 'string' && v.trim() !== '') {
      const n = Number(v)
      if (Number.isFinite(n)) return n
    }
  }
  return 0
}

function pickStr(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = row[k]
    if (v == null) continue
    const s = String(v).trim()
    if (s) return s
  }
  return ''
}

function warehouseNameById(id: number): string {
  return warehouseOptions.value.find((w) => w.id === id)?.name || `库房#${id}`
}

function toLinkRow(row: Record<string, unknown>): LinkRow {
  const fromId = pickNum(row, ['from_warehouse_id', '源库房id', 'source_warehouse_id', 'from_id'])
  const toId = pickNum(row, ['to_warehouse_id', '目标库房id', 'target_warehouse_id', 'to_id'])
  const fromName =
    pickStr(row, ['from_warehouse_name', '源库房名', 'source_warehouse_name']) || warehouseNameById(fromId)
  const toName =
    pickStr(row, ['to_warehouse_name', '目标库房名', 'target_warehouse_name']) || warehouseNameById(toId)
  return { fromId, toId, fromName, toName }
}

const targetCandidates = computed(() =>
  warehouseOptions.value.filter((w) => w.id !== sourceWarehouseId.value),
)

async function loadWarehouses() {
  const rows = await fetchTlWarehousesAll()
  warehouseOptions.value = rows
    .map((r) => {
      const id = pickNum(r, ['仓库id', 'warehouse_id', 'id'])
      const name = pickStr(r, ['仓库名', 'warehouse_name', 'name']) || `库房#${id}`
      return { id, name }
    })
    .filter((x) => x.id > 0)
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
}

async function refreshAllList(page = allPage.value) {
  const r = await fetchTlWarehouseLinksList({ page, size: allSize.value })
  allRows.value = r.rows.map(toLinkRow)
  allTotal.value = r.total
  allPage.value = page
}

async function queryForSource() {
  if (!sourceWarehouseId.value) return
  outboundRows.value = (await fetchTlWarehouseLinksOutbound(sourceWarehouseId.value)).map(toLinkRow)
  inboundRows.value = (await fetchTlWarehouseLinksInbound(sourceWarehouseId.value)).map(toLinkRow)
  batchUnbindTargetIds.value = []
}

async function runAction(fn: () => Promise<void>, okText: string) {
  busy.value = true
  error.value = ''
  message.value = ''
  try {
    await fn()
    message.value = okText
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}

async function bindSingle() {
  if (!sourceWarehouseId.value || !targetWarehouseId.value) return
  await runAction(async () => {
    await postTlBindWarehouseLink(sourceWarehouseId.value, targetWarehouseId.value)
    await queryForSource()
    await refreshAllList()
    targetWarehouseId.value = 0
  }, '绑定成功')
}

async function bindBatch() {
  if (!sourceWarehouseId.value || batchBindTargetIds.value.length === 0) return
  await runAction(async () => {
    await postTlBatchBindWarehouseLinks(sourceWarehouseId.value, [...new Set(batchBindTargetIds.value)])
    await queryForSource()
    await refreshAllList()
    batchBindTargetIds.value = []
  }, '批量绑定成功')
}

async function unbindSingle(row: LinkRow) {
  await runAction(async () => {
    await deleteTlUnbindWarehouseLink(row.fromId, row.toId)
    await queryForSource()
    await refreshAllList()
  }, '解绑成功')
}

async function unbindBatch() {
  if (!sourceWarehouseId.value || batchUnbindTargetIds.value.length === 0) return
  await runAction(async () => {
    await postTlBatchUnbindWarehouseLinks(
      sourceWarehouseId.value,
      [...new Set(batchUnbindTargetIds.value)],
    )
    await queryForSource()
    await refreshAllList()
    batchUnbindTargetIds.value = []
  }, '批量解绑成功')
}

async function gotoAllPage(page: number) {
  if (page < 1 || page > allTotalPages.value) return
  await runAction(async () => {
    await refreshAllList(page)
  }, '')
}

onMounted(async () => {
  await runAction(async () => {
    await loadWarehouses()
    await refreshAllList(1)
  }, '初始化完成')
  message.value = ''
})
</script>

<style scoped>
.wdc-page {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.wdc-head h2 {
  margin: 0;
  font-size: 22px;
  color: #111827;
}

.wdc-head p {
  margin: 6px 0 0;
  color: #64748b;
  font-size: 13px;
}

.wdc-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 14px;
}

.wdc-card h3 {
  margin: 0 0 10px;
  font-size: 16px;
}

.wdc-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.wdc-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-width: 520px;
}

.wdc-row label {
  font-size: 13px;
  font-weight: 600;
  color: #334155;
}

.wdc-row select {
  height: 38px;
  border-radius: 8px;
  border: 1px solid #d1d5db;
  padding: 0 10px;
  background: #fff;
}

.wdc-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.wdc-msg {
  margin: 0;
  color: #0f766e;
  font-size: 13px;
}

.wdc-err {
  margin: 0;
  color: #b91c1c;
  font-size: 13px;
  white-space: pre-wrap;
}

.wdc-batch {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.wdc-chips {
  max-height: 200px;
  overflow: auto;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px 8px;
}

.wdc-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  padding: 2px 6px;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  background: #f8fafc;
}

.wdc-table {
  width: 100%;
  border-collapse: collapse;
}

.wdc-table th,
.wdc-table td {
  border: 1px solid #e5e7eb;
  padding: 8px;
  font-size: 13px;
  text-align: left;
  vertical-align: top;
}

.wdc-inline-check {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-right: 8px;
  font-size: 12px;
}

.wdc-pager {
  margin-top: 10px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.mt {
  margin-top: 10px;
}
</style>
