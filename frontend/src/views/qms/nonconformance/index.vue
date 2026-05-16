<template>
  <div class="page-container">
    <a-card>
      <!-- 搜索栏 -->
      <div class="search-bar">
        <a-select v-model="query.status" :placeholder="$t('common.status')" allow-clear style="width:130px">
          <a-option v-for="s in statusOptions" :key="s.value" :value="s.value">{{ s.label }}</a-option>
        </a-select>
        <a-button type="primary" @click="loadData">{{ $t('common.search') }}</a-button>
        <a-button style="margin-left:auto" type="primary" @click="openCreate">{{ $t('qms.nonconformance.lbl1505') }}</a-button>
      </div>

      <MTable :columns="columns" :data="list" :loading="loading" :total="total" @change="onTableChange">
        <template #status="{ record }">
          <a-tag :color="statusColor(record.status as string)">{{ statusLabel(record.status as string) }}</a-tag>
        </template>
        <template #action="{ record }">
          <a-button type="text" size="small" @click="openDispose(record as Nonconformance)">{{ $t('qms.nonconformance.lbl1506') }}</a-button>
        </template>
      </MTable>
    </a-card>

    <!-- 新建不合格品抽屉 -->
    <a-drawer v-model:visible="createVisible" :title="$t('qms.nonconformance.index.新建不合格品')" :width="480" @cancel="createVisible=false">
      <MForm :schema="createSchema" v-model="createForm" :loading="submitting" @submit="handleCreate" @cancel="createVisible=false" />
    </a-drawer>

    <!-- 处置抽屉 -->
    <a-drawer v-model:visible="disposeVisible" :title="$t('qms.nonconformance.index.不合格品处置')" :width="480" @cancel="disposeVisible=false">
      <MForm :schema="disposeSchema" v-model="disposeForm" :loading="submitting" @submit="handleDispose" @cancel="disposeVisible=false" />
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
import { useI18n } from 'vue-i18n'
import { ref, reactive } from 'vue'
import { Message } from '@arco-design/web-vue'
import MTable from '@/components/MTable/index.vue'
import MForm from '@/components/MForm/index.vue'
import type { MTableColumn } from '@/components/MTable/index.vue'
import type { MFormField } from '@/components/MForm/index.vue'
import { qmsApi, type Nonconformance } from '@/api/qms'

const statusOptions = [
  { label: t('qms.nonconformance.pending'), value: 'OPEN' }, { label: t('qms.nonconformance.lbl1507'), value: 'IN_REVIEW' },
  { label: t('qms.nonconformance.closed'), value: 'CLOSED' },
]
const statusColorMap: Record<string, string> = {
  OPEN: 'red', IN_REVIEW: 'orange', CLOSED: 'gray',
}
const statusLabelMap: Record<string, string> = {
  OPEN: t('qms.nonconformance.pending')
}
const statusColor = (s: string) => statusColorMap[s] ?? 'gray'
const statusLabel = (s: string) => statusLabelMap[s] ?? s

const columns: MTableColumn[] = [
  { key: 'materialName', title: t('qms.nonconformance.index.物料名称') },
  { key: 'batchId', title: t('qms.nonconformance.index.批次号') },
  { key: 'defectType', title: t('qms.nonconformance.index.缺陷类型'), width: 110 },
  { key: 'quantity', title: t('qms.nonconformance.index.数量'), width: 80 },
  { key: 'status', title: t('qms.nonconformance.index.状态'), width: 90, slotName: 'status' },
  { key: 'disposition', title: t('qms.nonconformance.index.处置方式') },
  { key: 'createdAt', title: t('qms.nonconformance.index.创建时间'), width: 160 },
  { key: 'action', title: t('qms.nonconformance.index.操作'), width: 70, slotName: 'action' },
]

const createSchema: MFormField[] = [
  { field: 'materialId', label: t('qms.nonconformance.material'), type: 'material-select', required: true },
  { field: 'batchId', label: t('qms.nonconformance.lbl1508'), type: 'input' },
  { field: 'defectType', label: t('qms.nonconformance.lbl1509'), type: 'select', required: true, options: [{ label: t('qms.nonconformance.lbl1510'), value: t('qms.nonconformance.r33045') }, { label: t('qms.nonconformance.lbl1511'), value: t('qms.nonconformance.r33046') }, { label: t('qms.nonconformance.lbl1512'), value: t('qms.nonconformance.r33047') }, { label: t('qms.nonconformance.lbl1513'), value: t('qms.nonconformance.r33048') }, { label: t('qms.nonconformance.lbl1514'), value: t('qms.nonconformance.r33049') }, { label: t('qms.nonconformance.lbl1515'), value: t('qms.nonconformance.r33050') }] },
  { field: 'quantity', label: t('qms.nonconformance.quantity'), type: 'number', required: true },
  { field: 'defectDescription', label: t('qms.nonconformance.lbl1516'), type: 'textarea' },
]

const disposeSchema: MFormField[] = [
  { field: 'status', label: t('qms.nonconformance.lbl1517'), type: 'select', required: true,
    options: [{ label: t('qms.nonconformance.lbl1518'), value: 'REWORK' }, { label: t('qms.nonconformance.scrapped'), value: 'SCRAP' }, { label: t('qms.nonconformance.lbl1519'), value: 'CONCESSION' }] },
  { field: 'disposition', label: t('qms.nonconformance.lbl1520'), type: 'textarea', required: true },
]

const query = reactive({ status: '' })
const list = ref<Nonconformance[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const pageSize = ref(20)

const createVisible = ref(false)
const disposeVisible = ref(false)
const submitting = ref(false)
const createForm = ref<Record<string, unknown>>({})
const disposeForm = ref<Record<string, unknown>>({})
const currentId = ref('')

async function loadData() {
  loading.value = true
  try {
    const res = await qmsApi.getNonconformances({ ...query, page: page.value, pageSize: pageSize.value })
    list.value = res.list
    total.value = res.total
  } finally {
    loading.value = false
  }
}

function onTableChange(e: { page: number; pageSize: number }) {
  page.value = e.page
  pageSize.value = e.pageSize
  loadData()
}

function openCreate() { createForm.value = {}; createVisible.value = true }
function openDispose(record: Nonconformance) { currentId.value = record.id; disposeForm.value = {}; disposeVisible.value = true }

async function handleCreate(data: Record<string, unknown>) {
  submitting.value = true
  try {
    await qmsApi.createNonconformance(data as Parameters<typeof qmsApi.createNonconformance>[0])
    Message.success(t('qms.创建成功'))
    createVisible.value = false
    loadData()
  } catch { Message.error(t('qms.创建失败')) } finally { submitting.value = false }
}

async function handleDispose(data: Record<string, unknown>) {
  submitting.value = true
  try {
    await qmsApi.updateDisposition(currentId.value, data as { status: string; disposition: string })
    Message.success(t('qms.处置成功'))
    disposeVisible.value = false
    loadData()
  } catch { Message.error(t('qms.处置失败')) } finally { submitting.value = false }
}

loadData()
</script>

<style scoped>
.page-container { padding: 16px; }
.search-bar { display: flex; gap: 8px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
</style>
