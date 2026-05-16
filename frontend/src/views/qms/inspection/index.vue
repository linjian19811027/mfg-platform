<template>
  <div class="page-container">
    <a-card>
      <!-- 搜索栏 -->
      <div class="search-bar">
        <a-select v-model="query.inspectionType" :placeholder="$t('qms.inspection.index.检验类型')" allow-clear style="width:140px">
          <a-option v-for="t in inspectionTypes" :key="t.value" :value="t.value">{{ t.label }}</a-option>
        </a-select>
        <a-select v-model="query.result" :placeholder="$t('qms.inspection.index.检验结果')" allow-clear style="width:120px">
          <a-option v-for="s in statusOptions" :key="s.value" :value="s.value">{{ s.label }}</a-option>
        </a-select>
        <a-button type="primary" @click="loadData">{{ $t('common.search') }}</a-button>
        <a-button style="margin-left:auto" type="primary" @click="openCreate">{{ $t('qms.inspection.lbl1495') }}</a-button>
      </div>

      <MTable :columns="columns" :data="list" :loading="loading" :total="total" @change="onTableChange">
        <template #status="{ record }">
          <a-tag :color="statusColor(record.status as string)">{{ statusLabel(record.status as string) }}</a-tag>
        </template>
        <template #action="{ record }">
          <a-button type="text" size="small" @click="openResult(record as InspectionRecord)">{{ $t('qms.inspection.lbl1496') }}</a-button>
        </template>
      </MTable>
    </a-card>

    <!-- 新建检验抽屉 -->
    <a-drawer v-model:visible="createVisible" :title="$t('qms.inspection.index.新建检验')" :width="480" @cancel="createVisible=false">
      <MForm :schema="createSchema" v-model="createForm" :loading="submitting" @submit="handleCreate" @cancel="createVisible=false" />
    </a-drawer>

    <!-- 录入结果抽屉 -->
    <a-drawer v-model:visible="resultVisible" :title="$t('qms.inspection.index.录入检验结果')" :width="480" @cancel="resultVisible=false">
      <MForm :schema="resultSchema" v-model="resultForm" :loading="submitting" @submit="handleResult" @cancel="resultVisible=false" />
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
import { qmsApi, type InspectionRecord } from '@/api/qms'

const inspectionTypes = [
  { label: 'IQC', value: 'IQC' }, { label: 'IPQC', value: 'IPQC' },
  { label: 'FQC', value: 'FQC' }, { label: 'OQC', value: 'OQC' }, { label: 'FIRST', value: 'FIRST' },
]
const statusOptions = [
  { label: t('qms.inspection.qualified'), value: 'PASSED' }, { label: t('qms.inspection.unqualified'), value: 'FAILED' },
  { label: t('qms.inspection.lbl1497'), value: 'CONCESSION' },
]

const statusColorMap: Record<string, string> = { PASSED: 'green', FAILED: 'red', CONCESSION: 'orange' }
const statusLabelMap: Record<string, string> = { PASSED: t('qms.inspection.qualified'), FAILED: t('qms.inspection.unqualified'), CONCESSION: t('qms.inspection.lbl1498') }
const statusColor = (s: string) => statusColorMap[s] ?? 'gray'
const statusLabel = (s: string) => statusLabelMap[s] ?? s

const columns: MTableColumn[] = [
  { key: 'irNo', title: t('qms.inspection.index.检验单号'), dataIndex: 'irNo', width: 140 },
  { key: 'materialName', title: t('qms.inspection.index.物料名称'), dataIndex: 'materialName' },
  { key: 'batchId', title: t('qms.inspection.index.批次号'), dataIndex: 'batchId', width: 120 },
  { key: 'inspectionType', title: t('qms.inspection.index.检验类型'), dataIndex: 'inspectionType', width: 100 },
  { key: 'result', title: t('qms.inspection.index.结果'), slotName: 'status', width: 90 },
  { key: 'createdAt', title: t('qms.inspection.index.创建时间'), dataIndex: 'createdAt', width: 160 },
  { key: 'action', title: t('qms.inspection.index.操作'), width: 90, slotName: 'action' },
]

const createSchema: MFormField[] = [
  { field: 'materialId', label: t('qms.inspection.material'), type: 'material-select', required: true },
  { field: 'batchId', label: t('qms.inspection.lbl1499'), type: 'input' },
  { field: 'inspectionType', label: t('qms.inspection.lbl1500'), type: 'select', required: true, options: inspectionTypes },
  { field: 'standardId', label: t('qms.inspection.lbl1501'), type: 'input' },
]

const resultSchema: MFormField[] = [
  { field: 'result', label: t('qms.inspection.lbl1502'), type: 'radio', required: true,
    options: [{ label: t('qms.inspection.lbl1503'), value: 'PASS' }, { label: t('qms.inspection.lbl1504'), value: 'FAIL' }] },
]

const query = reactive({ inspectionType: '', result: '' })
const list = ref<InspectionRecord[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const pageSize = ref(20)

const createVisible = ref(false)
const resultVisible = ref(false)
const submitting = ref(false)
const createForm = ref<Record<string, unknown>>({})
const resultForm = ref<Record<string, unknown>>({})
const currentId = ref('')

async function loadData() {
  loading.value = true
  try {
    const res = await qmsApi.getInspections({ ...query, page: page.value, pageSize: pageSize.value })
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
function openResult(record: InspectionRecord) { currentId.value = record.id; resultForm.value = {}; resultVisible.value = true }

async function handleCreate(data: Record<string, unknown>) {
  submitting.value = true
  try {
    await qmsApi.createInspection(data as Parameters<typeof qmsApi.createInspection>[0])
    Message.success(t('qms.创建成功'))
    createVisible.value = false
    loadData()
  } catch { Message.error(t('qms.创建失败')) }
  finally { submitting.value = false }
}

async function handleResult(data: Record<string, unknown>) {
  submitting.value = true
  try {
    await qmsApi.submitResult(currentId.value, data as { result: 'PASS' | 'FAIL' })
    Message.success(t('qms.录入成功'))
    resultVisible.value = false
    loadData()
  } catch { Message.error(t('qms.录入失败')) }
  finally { submitting.value = false }
}

loadData()
</script>

<style scoped>
.page-container { padding: 16px; }
.search-bar { display: flex; gap: 8px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
</style>
