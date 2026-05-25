<template>
  <div class="page-container">
    <a-card :bordered="false" style="margin-bottom: 16px">
      <a-space wrap>
        <a-select v-model="query.type" :placeholder="$t('aps.resource.index.类型')" allow-clear style="width: 130px">
          <a-option value="MACHINE">{{ $t('aps.resource.type.machine') }}</a-option>
          <a-option value="LABOR">{{ $t('aps.resource.type.labor') }}</a-option>
          <a-option value="WORKCENTER">{{ $t('aps.resource.type.workcenter') }}</a-option>
        </a-select>
        <a-select v-model="query.status" :placeholder="$t('common.status')" allow-clear style="width: 120px">
          <a-option value="AVAILABLE">{{ $t('aps.resource.status.available') }}</a-option>
          <a-option value="MAINTENANCE">{{ $t('aps.resource.status.maintenance') }}</a-option>
          <a-option value="REPAIR">{{ $t('aps.resource.status.repair') }}</a-option>
          <a-option value="BREAKDOWN">{{ $t('aps.resource.status.breakdown') }}</a-option>
        </a-select>
        <a-button type="primary" @click="loadData">{{ $t('common.search') }}</a-button>
        <a-button @click="resetQuery">{{ $t('common.reset') }}</a-button>
      </a-space>
      <template #extra><a-button type="primary" @click="openDrawer(null)">{{ $t('aps.resource.action.create') }}</a-button></template>
    </a-card>
    <a-card :bordered="false">
      <MTable :columns="columns" :data="tableData" :loading="loading" :total="total" :page-size="20" @change="onTableChange">
        <template #status="{ record }">
          <a-tag :color="resourceStatusColor(record.status as string)">{{ resourceStatusLabel(record.status as string) }}</a-tag>
        </template>
        <template #action="{ record }">
          <a-space>
            <a-link @click="openDrawer(record as unknown as ApsResource)">{{ $t('common.edit') }}</a-link>
            <a-select
              :model-value="record.status as string"
              size="mini"
              style="width: 100px"
              @change="(v: string | number | boolean | Record<string, any> | (string | number | boolean | Record<string, any>)[]) => handleStatusChange(record.id as string, v as string)"
            >
              <a-option value="AVAILABLE">{{ $t('aps.resource.status.available') }}</a-option>
              <a-option value="MAINTENANCE">{{ $t('aps.resource.status.maintenance') }}</a-option>
              <a-option value="REPAIR">{{ $t('aps.resource.status.repair') }}</a-option>
              <a-option value="BREAKDOWN">{{ $t('aps.resource.status.breakdown') }}</a-option>
            </a-select>
          </a-space>
        </template>
      </MTable>
    </a-card>
    <a-drawer v-model:visible="drawerVisible" :title="editing ? $t('aps.resource.action.edit') : $t('aps.resource.action.create')" :width="520" @cancel="drawerVisible = false">
      <MForm :schema="formSchema" v-model="formData" :loading="saving" :submit-text="$t('aps.resource.index.保存')" @submit="handleSave" @cancel="drawerVisible = false" />
    </a-drawer>
  </div>
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { ref, reactive, onMounted } from 'vue'
import { Message } from '@arco-design/web-vue'
import MTable from '@/components/MTable/index.vue'
import MForm from '@/components/MForm/index.vue'
import type { MTableColumn } from '@/components/MTable/index.vue'
import type { MFormField } from '@/components/MForm/index.vue'
import { apsApi, type ApsResource } from '@/api/aps'
const loading = ref(false); const tableData = ref<any[]>([]); const total = ref(0)
const query = reactive({ type: '', status: '', page: 1, pageSize: 20 })
const columns: MTableColumn[] = [
  { key: 'code', title: t('aps.resource.index.编码'), dataIndex: 'code', width: 120 },
  { key: 'name', title: t('aps.resource.index.名称'), dataIndex: 'name', width: 160 },
  { key: 'type', title: t('aps.resource.index.类型'), dataIndex: 'type', width: 110 },
  { key: 'capacity', title: t('aps.resource.index.产能'), dataIndex: 'capacity', width: 90 },
  { key: 'efficiency', title: t('aps.resource.index.效率系数'), dataIndex: 'efficiency', width: 100 },
  { key: 'status', title: t('aps.resource.index.状态'), slotName: 'status', width: 100 },
  { key: 'action', title: t('aps.resource.index.操作'), slotName: 'action', width: 180 },
]
const formSchema: MFormField[] = [
  { field: 'code', label: t('aps.resource.index.编码'), type: 'input', required: true },
  { field: 'name', label: t('aps.resource.index.名称'), type: 'input', required: true },
  { field: 'type', label: t('aps.resource.index.类型'), type: 'select', required: true, options: [
    { label: t('aps.resource.type.machine'), value: 'MACHINE' }, { label: t('aps.resource.type.labor'), value: 'LABOR' }, { label: t('aps.resource.type.workcenter'), value: 'WORKCENTER' },
  ]},
  { field: 'capacity', label: t('aps.resource.index.产能'), type: 'number', props: { min: 0, precision: 2 } },
  { field: 'efficiency', label: t('aps.resource.index.效率系数'), type: 'number', props: { min: 0, max: 1, precision: 2 } },
  { field: 'status', label: t('aps.resource.index.状态'), type: 'select', options: [
    { label: t('aps.resource.status.available'), value: 'AVAILABLE' },
    { label: t('aps.resource.status.maintenance'), value: 'MAINTENANCE' },
    { label: t('aps.resource.status.repair'), value: 'REPAIR' },
    { label: t('aps.resource.status.breakdown'), value: 'BREAKDOWN' },
  ]},
]
const resourceStatusColor = (status: string): string => {
    const map: Record<string, string> = {
      AVAILABLE: 'green',
      MAINTENANCE: 'orange',
      REPAIR: 'red',
      BREAKDOWN: 'red',
    }
    return map[status] ?? 'gray'
  }
const resourceStatusLabel = (status: string): string => {
    const map: Record<string, string> = {
      AVAILABLE: t('aps.resource.status.available'),
      MAINTENANCE: t('aps.resource.status.maintenance'),
      REPAIR: t('aps.resource.status.repair'),
      BREAKDOWN: t('aps.resource.status.breakdown'),
    }
    return map[status] ?? status
  }
async function loadData() {
  loading.value = true
  try { const res = await apsApi.getResources(query); tableData.value = (res.list ?? []) as any[]; total.value = res.total ?? 0 }
  catch { tableData.value = [] } finally { loading.value = false }
}
function resetQuery() { query.type = ''; query.status = ''; query.page = 1; loadData() }
function onTableChange(e: { page: number; pageSize: number }) { query.page = e.page; query.pageSize = e.pageSize; loadData() }
const drawerVisible = ref(false); const saving = ref(false); const editing = ref<ApsResource | null>(null); const formData = ref<Record<string, unknown>>({})
function openDrawer(item: ApsResource | null) { editing.value = item; formData.value = item ? { ...item } : { status: 'AVAILABLE', efficiency: 1 }; drawerVisible.value = true }
async function handleSave(data: Record<string, unknown>) {
  saving.value = true
  try {
    if (editing.value) { await apsApi.updateResource(editing.value.id, data); Message.success(t('common.success')) }
    else { await apsApi.createResource(data); Message.success(t('common.success')) }
    drawerVisible.value = false; loadData()
  } catch { /* handled */ } finally { saving.value = false }
}
async function handleStatusChange(id: string, status: string) {
  try { await apsApi.updateResourceStatus(id, status); Message.success(t('common.success')); loadData() }
  catch { /* handled */ }
}
onMounted(loadData)
</script>
<style scoped>.page-container { padding: 16px; }</style>
