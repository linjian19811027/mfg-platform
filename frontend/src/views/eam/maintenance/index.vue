<template>
  <div class="page-container">
    <a-card>
      <div class="search-bar">
        <a-input v-model="query.equipmentId" :placeholder="$t('eam.maintenance.index.设备ID')" allow-clear style="width:160px" />
        <a-select v-model="query.status" :placeholder="$t('common.status')" allow-clear style="width:130px">
          <a-option v-for="s in statusOptions" :key="s.value" :value="s.value">{{ s.label }}</a-option>
        </a-select>
        <a-button type="primary" @click="loadData">{{ $t('common.search') }}</a-button>
      </div>

      <MTable :columns="columns" :data="list" :loading="loading" :total="total" @change="onTableChange">
        <template #status="{ record }">
          <a-tag :color="statusColorMap[record.status as string] ?? 'gray'">{{ statusLabelMap[record.status as string] ?? record.status }}</a-tag>
        </template>
      </MTable>
    </a-card>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
import { useI18n } from 'vue-i18n'
import { ref, reactive } from 'vue'
import MTable from '@/components/MTable/index.vue'
import type { MTableColumn } from '@/components/MTable/index.vue'
import { eamApi, type MaintenancePlan } from '@/api/eam'

const statusOptions = [
  { label: '待执行', value: 'pending' }, { label: '进行中', value: 'in_progress' },
  { label: '已完成', value: 'completed' }, { label: '已取消', value: 'cancelled' },
]
const statusColorMap: Record<string, string> = { pending: 'gray', in_progress: 'orange', completed: 'green', cancelled: 'red' }
const statusLabelMap: Record<string, string> = { pending: '待执行', in_progress: '进行中', completed: '已完成', cancelled: '已取消' }

const columns: MTableColumn[] = [
  { key: 'equipmentName', title: t('eam.maintenance.index.设备名称') },
  { key: 'planType', title: t('eam.maintenance.index.计划类型'), width: 110 },
  { key: 'status', title: t('eam.maintenance.index.状态'), width: 90, slotName: 'status' },
  { key: 'scheduledDate', title: t('eam.maintenance.index.计划日期'), width: 130 },
  { key: 'completedDate', title: t('eam.maintenance.index.完成日期'), width: 130 },
  { key: 'description', title: t('eam.maintenance.index.描述'), ellipsis: true },
]

const query = reactive({ equipmentId: '', status: '' })
const list = ref<MaintenancePlan[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const pageSize = ref(20)

async function loadData() {
  loading.value = true
  try {
    const res = await eamApi.getMaintenancePlans({ ...query, page: page.value, pageSize: pageSize.value })
    list.value = res.list
    total.value = res.total
  } finally { loading.value = false }
}

function onTableChange(e: { page: number; pageSize: number }) {
  page.value = e.page; pageSize.value = e.pageSize; loadData()
}

loadData()
</script>

<style scoped>
.page-container { padding: 16px; }
.search-bar { display: flex; gap: 8px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
</style>
