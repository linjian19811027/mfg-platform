<template>
  <div class="page-container">
    <a-card>
      <div class="search-bar">
        <a-input v-model="query.equipmentId" :placeholder="$t('eam.fault.index.设备ID')" allow-clear style="width:160px" />
        <a-select v-model="query.status" :placeholder="$t('common.status')" allow-clear style="width:130px">
          <a-option v-for="s in statusOptions" :key="s.value" :value="s.value">{{ s.label }}</a-option>
        </a-select>
        <a-button type="primary" @click="loadData">{{ $t('common.search') }}</a-button>
        <a-button style="margin-left:auto" type="primary" @click="openReport">上报故障</a-button>
      </div>

      <MTable :columns="columns" :data="list" :loading="loading" :total="total" @change="onTableChange">
        <template #severity="{ record }">
          <a-tag :color="severityColorMap[record.severity as string] ?? 'gray'">{{ severityLabelMap[record.severity as string] ?? record.severity }}</a-tag>
        </template>
        <template #status="{ record }">
          <a-tag :color="statusColorMap[record.status as string] ?? 'gray'">{{ statusLabelMap[record.status as string] ?? record.status }}</a-tag>
        </template>
      </MTable>
    </a-card>

    <!-- 上报故障 -->
    <a-drawer v-model:visible="reportVisible" :title="$t('eam.fault.index.上报故障')" :width="480" @cancel="reportVisible=false">
      <MForm :schema="reportSchema" v-model="reportForm" :loading="submitting" @submit="handleReport" @cancel="reportVisible=false" />
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
import { eamApi, type FaultRecord } from '@/api/eam'

const statusOptions = [
  { label: '已上报', value: 'reported' }, { label: '响应中', value: 'responding' },
  { label: '诊断中', value: 'diagnosing' }, { label: '维修中', value: 'repairing' }, { label: '已关闭', value: 'closed' },
]
const severityColorMap: Record<string, string> = { critical: 'red', high: 'orange', medium: 'blue', low: 'gray' }
const severityLabelMap: Record<string, string> = { critical: '严重', high: '高', medium: '中', low: '低' }
const statusColorMap: Record<string, string> = { reported: 'blue', responding: 'orange', diagnosing: 'orange', repairing: 'orange', closed: 'green' }
const statusLabelMap: Record<string, string> = { reported: '已上报', responding: '响应中', diagnosing: '诊断中', repairing: '维修中', closed: '已关闭' }

const columns: MTableColumn[] = [
  { key: 'equipmentName', title: t('eam.fault.index.设备名称') },
  { key: 'faultType', title: t('eam.fault.index.故障类型'), width: 110 },
  { key: 'severity', title: t('eam.fault.index.严重程度'), width: 90, slotName: 'severity' },
  { key: 'status', title: t('eam.fault.index.状态'), width: 90, slotName: 'status' },
  { key: 'reportedAt', title: t('eam.fault.index.上报时间'), width: 160 },
  { key: 'description', title: t('eam.fault.index.描述'), ellipsis: true },
]

const reportSchema: MFormField[] = [
  { field: 'equipmentId', label: '设备ID', type: 'input', required: true },
  { field: 'faultType', label: '故障类型', type: 'input', required: true },
  { field: 'severity', label: '严重程度', type: 'select', required: true,
    options: [{ label: '严重', value: 'critical' }, { label: '高', value: 'high' }, { label: '中', value: 'medium' }, { label: '低', value: 'low' }] },
  { field: 'description', label: '描述', type: 'textarea' },
]

const query = reactive({ equipmentId: '', status: '' })
const list = ref<FaultRecord[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const pageSize = ref(20)
const reportVisible = ref(false)
const submitting = ref(false)
const reportForm = ref<Record<string, unknown>>({})

async function loadData() {
  loading.value = true
  try {
    const res = await eamApi.getFaults({ ...query, page: page.value, pageSize: pageSize.value })
    list.value = res.list
    total.value = res.total
  } finally { loading.value = false }
}

function onTableChange(e: { page: number; pageSize: number }) {
  page.value = e.page; pageSize.value = e.pageSize; loadData()
}

function openReport() { reportForm.value = {}; reportVisible.value = true }

async function handleReport(data: Record<string, unknown>) {
  submitting.value = true
  try {
    await eamApi.reportFault(data as Parameters<typeof eamApi.reportFault>[0])
    Message.success('上报成功')
    reportVisible.value = false
    loadData()
  } finally { submitting.value = false }
}

loadData()
</script>

<style scoped>
.page-container { padding: 16px; }
.search-bar { display: flex; gap: 8px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
</style>
