<template>
  <div class="page-container">
    <a-card>
      <div class="search-bar">
        <a-input v-model="query.equipmentId" :placeholder="$t('eam.fault.index.设备ID')" allow-clear style="width:160px" />
        <a-select v-model="query.status" :placeholder="$t('common.status')" allow-clear style="width:130px">
          <a-option v-for="s in statusOptions" :key="s.value" :value="s.value">{{ s.label }}</a-option>
        </a-select>
        <a-button type="primary" @click="loadData">{{ $t('common.search') }}</a-button>
        <a-button style="margin-left:auto" type="primary" @click="openReport">{{ $t('eam.fault.lbl1094') }}</a-button>
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
  { label: t('eam.fault.lbl1095'), value: 'reported' }, { label: t('eam.fault.lbl1096'), value: 'responding' },
  { label: t('eam.fault.lbl1097'), value: 'diagnosing' }, { label: t('eam.fault.lbl1098'), value: 'repairing' }, { label: t('eam.fault.closed'), value: 'closed' },
]
const severityColorMap: Record<string, string> = { critical: 'red', high: 'orange', medium: 'blue', low: 'gray' }
const severityLabelMap: Record<string, string> = { critical: t('eam.fault.lbl1099'), high: t('eam.fault.lbl1100'), medium: t('eam.fault.lbl1101'), low: t('eam.fault.lbl1102') }
const statusColorMap: Record<string, string> = { reported: 'blue', responding: 'orange', diagnosing: 'orange', repairing: 'orange', closed: 'green' }
const statusLabelMap: Record<string, string> = { reported: t('eam.fault.lbl1103'), responding: t('eam.fault.lbl1104'), diagnosing: t('eam.fault.lbl1105'), repairing: t('eam.fault.lbl1106'), closed: t('eam.fault.closed') }

const columns: MTableColumn[] = [
  { key: 'equipmentName', title: t('eam.fault.index.设备名称') },
  { key: 'faultType', title: t('eam.fault.index.故障类型'), width: 110 },
  { key: 'severity', title: t('eam.fault.index.严重程度'), width: 90, slotName: 'severity' },
  { key: 'status', title: t('eam.fault.index.状态'), width: 90, slotName: 'status' },
  { key: 'reportedAt', title: t('eam.fault.index.上报时间'), width: 160 },
  { key: 'description', title: t('eam.fault.index.描述'), ellipsis: true },
]

const reportSchema: MFormField[] = [
  { field: 'equipmentId', label: t('eam.fault.lbl1107'), type: 'input', required: true },
  { field: 'faultType', label: t('eam.fault.lbl1108'), type: 'input', required: true },
  { field: 'severity', label: t('eam.fault.lbl1109'), type: 'select', required: true,
    options: [{ label: t('eam.fault.lbl1110'), value: 'critical' }, { label: t('eam.fault.lbl1111'), value: 'high' }, { label: t('eam.fault.lbl1112'), value: 'medium' }, { label: t('eam.fault.lbl1113'), value: 'low' }] },
  { field: 'description', label: t('eam.fault.description'), type: 'textarea' },
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
    Message.success(t('eam.上报成功'))
    reportVisible.value = false
    loadData()
  } catch { Message.error(t('eam.上报失败')) }
  finally { submitting.value = false }
}

loadData()
</script>

<style scoped>
.page-container { padding: 16px; }
.search-bar { display: flex; gap: 8px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
</style>
