<template>
  <div class="page-container">
    <a-card :bordered="false" style="margin-bottom: 16px">
      <a-space wrap>
        <a-select v-model="query.status" :placeholder="$t('common.status')" allow-clear style="width: 140px">
          <a-option value="OPEN">{{ $t('qms.complaint.lbl1462') }}</a-option>
          <a-option value="INVESTIGATING">{{ $t('qms.complaint.lbl1463') }}</a-option>
          <a-option value="RESOLVED">{{ $t('qms.complaint.lbl1464') }}</a-option>
          <a-option value="CLOSED">{{ $t('qms.complaint.closed') }}</a-option>
        </a-select>
        <a-select v-model="query.severity" :placeholder="$t('qms.complaint.index.严重程度')" allow-clear style="width: 130px">
          <a-option value="CRITICAL">{{ $t('qms.complaint.lbl1465') }}</a-option>
          <a-option value="MAJOR">{{ $t('qms.complaint.lbl1466') }}</a-option>
          <a-option value="MINOR">{{ $t('qms.complaint.lbl1467') }}</a-option>
        </a-select>
        <a-button type="primary" @click="loadData">{{ $t('common.search') }}</a-button>
        <a-button @click="resetQuery">{{ $t('common.reset') }}</a-button>
      </a-space>
      <template #extra>
        <a-button type="primary" @click="openDrawer(null)">{{ $t('qms.complaint.lbl1468') }}</a-button>
      </template>
    </a-card>

    <a-card :bordered="false">
      <MTable :columns="columns" :data="tableData" :loading="loading" :total="total" :page-size="20" @change="onTableChange">
        <template #status="{ record }">
          <a-tag :color="statusColor(record.status as string)">{{ statusLabel(record.status as string) }}</a-tag>
        </template>
        <template #severity="{ record }">
          <a-tag :color="record.severity === 'CRITICAL' ? 'red' : record.severity === 'MAJOR' ? 'orange' : 'gray'">
            {{ record.severity === 'CRITICAL' ? t('qms.complaint.r33044') : record.severity === 'MAJOR' ? $t('qms.complaint.lbl1469') : $t('qms.complaint.lbl1470') }}
          </a-tag>
        </template>
        <template #action="{ record }">
          <a-space>
            <a-link @click="openDrawer(record as unknown as CustomerComplaint)">{{ $t('qms.complaint.lbl1471') }}</a-link>
          </a-space>
        </template>
      </MTable>
    </a-card>

    <a-drawer v-model:visible="drawerVisible" :title="t('qms.complaint.lbl1472')" :width="520" @cancel="drawerVisible = false">
      <MForm :schema="formSchema" v-model="formData" :loading="saving" :submit-text="$t('qms.complaint.index.保存')" @submit="handleSave" @cancel="drawerVisible = false" />
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
import { qmsApi, type CustomerComplaint } from '@/api/qms'

const loading = ref(false)
const tableData = ref<any[]>([])
const total = ref(0)
const query = reactive({ status: '', severity: '', page: 1, pageSize: 20 })

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  OPEN: { label: t('qms.complaint.lbl1473'), color: 'red' }, INVESTIGATING: { label: t('qms.complaint.lbl1474'), color: 'orange' },
  RESOLVED: { label: t('qms.complaint.lbl1475'), color: 'blue' }, CLOSED: { label: t('qms.complaint.closed'), color: 'green' },
}

const columns: MTableColumn[] = [
  { key: 'customerName', title: t('qms.complaint.index.客户'), dataIndex: 'customerName', width: 140 },
  { key: 'description', title: t('qms.complaint.index.投诉描述'), dataIndex: 'description', width: 200, ellipsis: true },
  { key: 'severity', title: t('qms.complaint.index.严重程度'), slotName: 'severity', width: 100 },
  { key: 'status', title: t('qms.complaint.index.状态'), slotName: 'status', width: 100 },
  { key: 'createdAt', title: t('qms.complaint.index.创建时间'), dataIndex: 'createdAt', width: 160 },
  { key: 'action', title: t('qms.complaint.index.操作'), slotName: 'action', width: 80 },
]

const formSchema: MFormField[] = [
  { field: 'customerId', label: t('qms.complaint.lbl1476'), type: 'input', required: true },
  { field: 'description', label: t('qms.complaint.lbl1477'), type: 'textarea', required: true, props: { autoSize: { minRows: 3 } } },
  { field: 'severity', label: t('qms.complaint.lbl1478'), type: 'select', required: true, options: [
    { label: t('qms.complaint.lbl1479'), value: 'CRITICAL' }, { label: t('qms.complaint.lbl1480'), value: 'MAJOR' }, { label: t('qms.complaint.lbl1481'), value: 'MINOR' },
  ]},
  { field: 'status', label: t('qms.complaint.status'), type: 'select', options: [
    { label: t('qms.complaint.lbl1482'), value: 'OPEN' }, { label: t('qms.complaint.lbl1483'), value: 'INVESTIGATING' },
    { label: t('qms.complaint.lbl1484'), value: 'RESOLVED' }, { label: t('qms.complaint.closed'), value: 'CLOSED' },
  ]},
  { field: 'resolution', label: t('qms.complaint.lbl1485'), type: 'textarea', props: { autoSize: { minRows: 2 } } },
]

function statusColor(s: string) { return STATUS_MAP[s]?.color ?? 'gray' }
function statusLabel(s: string) { return STATUS_MAP[s]?.label ?? s }

async function loadData() {
  loading.value = true
  try {
    const params: Record<string, unknown> = { page: query.page, pageSize: query.pageSize }
    if (query.status) params.status = query.status
    if (query.severity) params.severity = query.severity
    const res = await qmsApi.getComplaints(params)
    tableData.value = (res.list ?? []) as any[]
    total.value = res.total ?? 0
  } catch { tableData.value = [] } finally { loading.value = false }
}

function resetQuery() { query.status = ''; query.severity = ''; query.page = 1; loadData() }
function onTableChange(e: { page: number; pageSize: number }) { query.page = e.page; query.pageSize = e.pageSize; loadData() }

const drawerVisible = ref(false)
const saving = ref(false)
const editing = ref<CustomerComplaint | null>(null)
const formData = ref<Record<string, unknown>>({})

function openDrawer(item: CustomerComplaint | null) {
  editing.value = item
  formData.value = item ? { ...item } : { status: 'OPEN', severity: 'MAJOR' }
  drawerVisible.value = true
}

async function handleSave(data: Record<string, unknown>) {
  saving.value = true
  try {
    if (editing.value) { await qmsApi.updateComplaint(editing.value.id, data); Message.success(t('qms.更新成功')) }
    else { await qmsApi.createComplaint(data); Message.success(t('qms.创建成功')) }
    drawerVisible.value = false
    loadData()
  } catch { /* handled */ } finally { saving.value = false }
}

onMounted(loadData)
</script>

<style scoped>
.page-container { padding: 16px; }
</style>
