<template>
  <div class="page-container">
    <a-card :bordered="false" style="margin-bottom: 16px">
      <a-space wrap>
        <a-select v-model="query.status" :placeholder="$t('common.status')" allow-clear style="width: 130px">
          <a-option value="DRAFT">草稿</a-option>
          <a-option value="SENT">已发送</a-option>
          <a-option value="QUOTED">已报价</a-option>
          <a-option value="CLOSED">已关闭</a-option>
        </a-select>
        <a-button type="primary" @click="loadData">{{ $t('common.search') }}</a-button>
        <a-button @click="resetQuery">{{ $t('common.reset') }}</a-button>
      </a-space>
      <template #extra>
        <a-button type="primary" @click="openDrawer">新建询价单</a-button>
      </template>
    </a-card>

    <a-card :bordered="false">
      <MTable :columns="columns" :data="tableData" :loading="loading" :total="total" :page-size="20" @change="onTableChange">
        <template #status="{ record }">
          <a-tag :color="statusColor(record.status as string)">{{ statusLabel(record.status as string) }}</a-tag>
        </template>
        <template #action="{ record }">
          <a-space>
            <a-popconfirm v-if="record.status === 'DRAFT'" :content="$t('scm.rfq.index.确认发送询价')" @ok="handleSend(record.id as string)">
              <a-link>发送</a-link>
            </a-popconfirm>
            <a-link v-if="record.status === 'SENT' || record.status === 'QUOTED'" @click="openCompareDrawer(record.id as string)">比价</a-link>
          </a-space>
        </template>
      </MTable>
    </a-card>

    <!-- 新建抽屉 -->
    <a-drawer v-model:visible="drawerVisible" :title="$t('scm.rfq.index.新建询价单')" :width="480" @cancel="drawerVisible = false">
      <MForm :schema="formSchema" v-model="formData" :loading="saving" :submit-text="$t('scm.rfq.index.创建')" @submit="handleCreate" @cancel="drawerVisible = false" />
    </a-drawer>

    <!-- 比价抽屉 -->
    <a-drawer v-model:visible="compareDrawerVisible" :title="$t('scm.rfq.index.供应商报价比较')" :width="720" @cancel="compareDrawerVisible = false">
      <a-table :columns="compareColumns" :data="compareLines" :loading="compareLoading" :pagination="false" row-key="id">
        <template #action="{ record }">
          <a-popconfirm :content="$t('scm.rfq.index.确认选择该供应商')" @ok="handleSelectSupplier(record.supplierId as string)">
            <a-button type="primary" size="mini">选择</a-button>
          </a-popconfirm>
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
import { scmApi } from '@/api/scm'

const loading = ref(false)
const tableData = ref<any[]>([])
const total = ref(0)
const query = reactive({ status: '', page: 1, pageSize: 20 })

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  DRAFT: { label: '草稿', color: 'gray' }, SENT: { label: '已发送', color: 'blue' },
  QUOTED: { label: '已报价', color: 'orange' }, CLOSED: { label: '已关闭', color: 'green' },
}

const columns: MTableColumn[] = [
  { key: 'code', title: t('scm.rfq.index.询价单号'), dataIndex: 'code', width: 130 },
  { key: 'materialName', title: t('scm.rfq.index.物料名称'), dataIndex: 'materialName', width: 160 },
  { key: 'qty', title: t('scm.rfq.index.询价数量'), dataIndex: 'qty', width: 100 },
  { key: 'status', title: t('scm.rfq.index.状态'), slotName: 'status', width: 100 },
  { key: 'createdAt', title: t('scm.rfq.index.创建时间'), dataIndex: 'createdAt', width: 160 },
  { key: 'action', title: t('scm.rfq.index.操作'), slotName: 'action', width: 140 },
]

const compareColumns = [
  { title: t('scm.rfq.index.供应商'), dataIndex: 'supplierName', width: 150 },
  { title: t('scm.rfq.index.单价'), dataIndex: 'unitPrice', width: 100 },
  { title: t('scm.rfq.index.币种'), dataIndex: 'currency', width: 80 },
  { title: t('scm.rfq.index.交期天'), dataIndex: 'leadDays', width: 90 },
  { title: t('scm.rfq.index.有效期'), dataIndex: 'validUntil', width: 120 },
  { title: t('scm.rfq.index.操作'), slotName: 'action', width: 90 },
]

const formSchema: MFormField[] = [
  { field: 'materialId', label: '物料ID', type: 'input', required: true },
  { field: 'qty', label: '询价数量', type: 'number', required: true, props: { min: 0.001 } },
]

function statusColor(s: string) { return STATUS_MAP[s]?.color ?? 'gray' }
function statusLabel(s: string) { return STATUS_MAP[s]?.label ?? s }

async function loadData() {
  loading.value = true
  try {
    const params: Record<string, unknown> = { page: query.page, pageSize: query.pageSize }
    if (query.status) params.status = query.status
    const res = await scmApi.getRfqs(params)
    tableData.value = (res.list ?? []) as any[]
    total.value = res.total ?? 0
  } catch { tableData.value = [] } finally { loading.value = false }
}

function resetQuery() { query.status = ''; query.page = 1; loadData() }
function onTableChange(e: { page: number; pageSize: number }) { query.page = e.page; query.pageSize = e.pageSize; loadData() }

const drawerVisible = ref(false)
const saving = ref(false)
const formData = ref<Record<string, unknown>>({})
function openDrawer() { formData.value = {}; drawerVisible.value = true }
async function handleCreate(data: Record<string, unknown>) {
  saving.value = true
  try { await scmApi.createRfq(data); Message.success('创建成功'); drawerVisible.value = false; loadData() }
  catch { /* handled */ } finally { saving.value = false }
}

async function handleSend(id: string) {
  try { await scmApi.sendRfq(id); Message.success('询价已发送'); loadData() }
  catch { /* handled */ }
}

const compareDrawerVisible = ref(false)
const compareLoading = ref(false)
const compareLines = ref<any[]>([])
const currentRfqId = ref('')

async function openCompareDrawer(id: string) {
  currentRfqId.value = id
  compareDrawerVisible.value = true
  compareLoading.value = true
  try {
    const res = await scmApi.getRfqComparison(id)
    compareLines.value = (res.lines ?? []) as any[]
  } catch { compareLines.value = [] } finally { compareLoading.value = false }
}

async function handleSelectSupplier(supplierId: string) {
  try {
    await scmApi.selectSupplier(currentRfqId.value, supplierId)
    Message.success('供应商已选定')
    compareDrawerVisible.value = false
    loadData()
  } catch { /* handled */ }
}

onMounted(loadData)
</script>

<style scoped>
.page-container { padding: 16px; }
</style>
