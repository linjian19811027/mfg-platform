<template>
  <div class="page-container">
    <a-card :bordered="false" style="margin-bottom: 16px">
      <a-space wrap>
        <a-select v-model="query.status" :placeholder="$t('common.status')" allow-clear style="width: 140px">
          <a-option value="DRAFT">草稿</a-option>
          <a-option value="IN_PROGRESS">盘点中</a-option>
          <a-option value="PENDING_APPROVAL">待审批</a-option>
          <a-option value="COMPLETED">已完成</a-option>
        </a-select>
        <a-button type="primary" @click="loadData">{{ $t('common.search') }}</a-button>
        <a-button @click="resetQuery">{{ $t('common.reset') }}</a-button>
      </a-space>
      <template #extra>
        <a-button type="primary" @click="openCreateDrawer">新建盘点单</a-button>
      </template>
    </a-card>

    <a-card :bordered="false">
      <MTable :columns="columns" :data="tableData" :loading="loading" :total="total" :page-size="20" @change="onTableChange">
        <template #status="{ record }">
          <a-tag :color="statusColor(record.status as string)">{{ statusLabel(record.status as string) }}</a-tag>
        </template>
        <template #action="{ record }">
          <a-space>
            <a-link @click="openDetailDrawer(record as unknown as StockTake)">录入/查看</a-link>
            <a-link v-if="record.status === 'DRAFT'" @click="handleStart(record.id as string)">开始盘点</a-link>
            <a-popconfirm v-if="record.status === 'PENDING_APPROVAL'" :content="$t('wms.inventory-count.index.确认审批通过并调整库存')" @ok="handleApprove(record.id as string)">
              <a-link>审批</a-link>
            </a-popconfirm>
          </a-space>
        </template>
      </MTable>
    </a-card>

    <!-- 新建抽屉 -->
    <a-drawer v-model:visible="createDrawerVisible" :title="$t('wms.inventory-count.index.新建盘点单')" :width="480" @cancel="createDrawerVisible = false">
      <MForm :schema="createSchema" v-model="createForm" :loading="creating" :submit-text="$t('wms.inventory-count.index.创建')" @submit="handleCreate" @cancel="createDrawerVisible = false" />
    </a-drawer>

    <!-- 盘点明细抽屉 -->
    <a-drawer v-model:visible="detailDrawerVisible" :title="`盘点明细 - ${currentTake?.code ?? ''}`" :width="800" @cancel="detailDrawerVisible = false">
      <div style="margin-bottom: 12px; display: flex; gap: 8px; justify-content: flex-end">
        <a-button v-if="currentTake?.status === 'IN_PROGRESS'" type="primary" size="small" @click="submitForApproval">提交审批</a-button>
      </div>
      <a-table :columns="lineColumns" :data="diffLines" :loading="diffLoading" :pagination="false" row-key="id">
        <template #countQty="{ record }">
          <a-input-number
            v-if="currentTake?.status === 'IN_PROGRESS'"
            :model-value="record.countQty as number"
            :min="0"
            :precision="4"
            style="width: 100px"
            @change="(v: number) => updateCountQty(record.id as string, v)"
          />
          <span v-else>{{ record.countQty ?? '-' }}</span>
        </template>
        <template #diffQty="{ record }">
          <span :style="{ color: (record.diffQty as number) > 0 ? '#00b578' : (record.diffQty as number) < 0 ? '#f53f3f' : '#e6edf3' }">
            {{ record.diffQty != null ? (record.diffQty as number > 0 ? '+' : '') + record.diffQty : '-' }}
          </span>
        </template>
      </a-table>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
import { useI18n } from 'vue-i18n'
import { ref, reactive, onMounted } from 'vue'
import { Message } from '@arco-design/web-vue'
import MTable from '@/components/MTable/index.vue'
import MForm from '@/components/MForm/index.vue'
import type { MTableColumn } from '@/components/MTable/index.vue'
import type { MFormField } from '@/components/MForm/index.vue'
import { wmsApi, type StockTake, type StockTakeLine } from '@/api/wms'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const loading = ref(false)
const tableData = ref<any[]>([])
const total = ref(0)
const query = reactive({ status: '', page: 1, pageSize: 20 })

const columns: MTableColumn[] = [
  { key: 'stNo', title: t('wms.inventory-count.index.盘点单号'), dataIndex: 'stNo', width: 140 },
  { key: 'warehouseName', title: t('wms.inventory-count.index.仓库'), dataIndex: 'warehouseName', width: 130 },
  { key: 'status', title: t('wms.inventory-count.index.状态'), slotName: 'status', width: 110 },
  { key: 'createdAt', title: t('wms.inventory-count.index.创建时间'), dataIndex: 'createdAt', width: 160 },
  { key: 'action', title: t('wms.inventory-count.index.操作'), slotName: 'action', width: 200 },
]

const lineColumns = [
  { title: t('wms.inventory-count.index.物料编码'), dataIndex: 'materialCode', width: 130 },
  { title: t('wms.inventory-count.index.物料名称'), dataIndex: 'materialName', width: 160 },
  { title: t('wms.inventory-count.index.账面数量'), dataIndex: 'bookQty', width: 100 },
  { title: t('wms.inventory-count.index.实盘数量'), slotName: 'countQty', width: 130 },
  { title: t('wms.inventory-count.index.差异'), slotName: 'diffQty', width: 100 },
  { title: t('wms.inventory-count.index.单位'), dataIndex: 'uomCode', width: 80 },
]

function statusColor(s: string) {
  if (s === 'COMPLETED') return 'green'
  if (s === 'IN_PROGRESS') return 'orange'
  if (s === 'PENDING_APPROVAL') return 'blue'
  return 'gray'
}
function statusLabel(s: string) {
  const m: Record<string, string> = { DRAFT: '草稿', IN_PROGRESS: '盘点中', PENDING_APPROVAL: '待审批', COMPLETED: '已完成' }
  return m[s] ?? s
}

async function loadData() {
  loading.value = true
  try {
    const res = await wmsApi.getStockTakes(query)
    tableData.value = (res.list ?? []) as any[]
    total.value = res.total ?? 0
  } catch { tableData.value = [] } finally { loading.value = false }
}

function resetQuery() { query.status = ''; query.page = 1; loadData() }
function onTableChange(e: { page: number; pageSize: number }) { query.page = e.page; query.pageSize = e.pageSize; loadData() }

// 新建
const createDrawerVisible = ref(false)
const creating = ref(false)
const createForm = ref<Record<string, unknown>>({})
const createSchema: MFormField[] = [
  { field: 'warehouseId', label: '仓库ID', type: 'input', required: true },
  { field: 'description', label: '备注', type: 'textarea' },
]
function openCreateDrawer() { createForm.value = {}; createDrawerVisible.value = true }
async function handleCreate(data: Record<string, unknown>) {
  creating.value = true
  try {
    await wmsApi.createStockTake(data)
    Message.success('创建成功')
    createDrawerVisible.value = false
    loadData()
  } catch { /* handled */ } finally { creating.value = false }
}

// 开始盘点
async function handleStart(id: string) {
  try {
    await wmsApi.startStockTake(id)
    Message.success('盘点已开始')
    loadData()
  } catch { /* handled */ }
}

// 审批
async function handleApprove(id: string) {
  try {
    await wmsApi.approveStockTake(id, authStore.userId ?? 'system')
    Message.success('审批通过，库存已调整')
    loadData()
  } catch { /* handled */ }
}

// 明细抽屉
const detailDrawerVisible = ref(false)
const currentTake = ref<StockTake | null>(null)
const diffLines = ref<StockTakeLine[]>([])
const diffLoading = ref(false)

async function openDetailDrawer(take: StockTake) {
  currentTake.value = take
  detailDrawerVisible.value = true
  diffLoading.value = true
  try {
    const res = await wmsApi.getStockTakeDiff(take.id)
    diffLines.value = res.lines ?? []
  } catch { diffLines.value = [] } finally { diffLoading.value = false }
}

async function updateCountQty(lineId: string, qty: number) {
  try {
    await wmsApi.countLine(lineId, qty, authStore.userId ?? 'system')
    // 更新本地数据
    const line = diffLines.value.find(l => l.id === lineId)
    if (line) { line.countQty = qty; line.diffQty = qty - line.bookQty }
  } catch { /* handled */ }
}

async function submitForApproval() {
  if (!currentTake.value) return
  // 通过 patch status 提交审批（后端暂无独立接口，用 approve 代替）
  Message.info('请在列表页点击"审批"按钮完成审批')
  detailDrawerVisible.value = false
  loadData()
}

onMounted(loadData)
</script>

<style scoped>
.page-container { padding: 16px; }
</style>
