<template>
  <div class="page-container">
    <a-card :bordered="false" style="margin-bottom: 16px">
      <a-space wrap>
        <a-select v-model="query.equipmentId" :placeholder="$t('eam.strategy.index.设备')" allow-clear style="width: 160px">
          <a-option value="">{{ $t('common.all') }}</a-option>
        </a-select>
        <a-select v-model="query.strategyType" :placeholder="$t('eam.strategy.index.策略类型')" allow-clear style="width: 140px">
          <a-option value="PERIODIC">{{ $t('eam.strategy.type.periodic') }}</a-option>
          <a-option value="PREDICTIVE">{{ $t('eam.strategy.type.predictive') }}</a-option>
          <a-option value="CORRECTIVE">{{ $t('eam.strategy.type.corrective') }}</a-option>
        </a-select>
        <a-button type="primary" @click="loadData">{{ $t('common.search') }}</a-button>
        <a-button @click="resetQuery">{{ $t('common.reset') }}</a-button>
      </a-space>
      <template #extra><a-button type="primary" @click="openDrawer(null)">{{ $t('eam.strategy.lbl1138') }}</a-button></template>
    </a-card>
    <a-card :bordered="false">
      <MTable :columns="columns" :data="tableData" :loading="loading" :total="total" :page-size="20" @change="onTableChange">
        <template #status="{ record }">
          <a-tag :color="record.isActive ? 'green' : 'gray'">{{ record.isActive ? $t('eam.strategy.enable') : $t('eam.strategy.disable') }}</a-tag>
        </template>
        <template #action="{ record }">
          <a-link @click="openDrawer(record as unknown as MaintenanceStrategy)">{{ $t('common.edit') }}</a-link>
        </template>
      </MTable>
    </a-card>
    <a-drawer v-model:visible="drawerVisible" :title="editing ? $t('eam.strategy.action.edit') : $t('eam.strategy.action.create')" :width="520" @cancel="drawerVisible = false">
      <MForm :schema="formSchema" v-model="formData" :loading="saving" :submit-text="$t('eam.strategy.index.保存')" @submit="handleSave" @cancel="drawerVisible = false" />
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
import { eamApi, type MaintenanceStrategy } from '@/api/eam'
const loading = ref(false); const tableData = ref<any[]>([]); const total = ref(0)
const query = reactive({ equipmentId: '', strategyType: '', page: 1, pageSize: 20 })
const columns: MTableColumn[] = [
  { key: 'equipmentName', title: t('eam.strategy.index.设备名称'), dataIndex: 'equipmentName', width: 150 },
  { key: 'name', title: t('eam.strategy.index.策略名称'), dataIndex: 'name', width: 160 },
  { key: 'strategyType', title: t('eam.strategy.index.策略类型'), dataIndex: 'strategyType', width: 120 },
  { key: 'triggerType', title: t('eam.strategy.index.触发方式'), dataIndex: 'triggerType', width: 100 },
  { key: 'triggerValue', title: t('eam.strategy.index.触发值'), dataIndex: 'triggerValue', width: 90 },
  { key: 'status', title: t('eam.strategy.index.状态'), slotName: 'status', width: 90 },
  { key: 'action', title: t('eam.strategy.index.操作'), slotName: 'action', width: 80 },
]
const formSchema: MFormField[] = [
  { field: 'equipmentId', label: t('eam.strategy.lbl1139'), type: 'select', required: true, placeholder: t('eam.strategy.r33015') },
  { field: 'name', label: t('eam.strategy.lbl1140'), type: 'input', required: true },
  { field: 'strategyType', label: t('eam.strategy.lbl1141'), type: 'select', required: true, options: [
    { label: t('eam.strategy.lbl1142'), value: 'PERIODIC' }, { label: t('eam.strategy.lbl1143'), value: 'PREDICTIVE' }, { label: t('eam.strategy.lbl1144'), value: 'CORRECTIVE' },
  ]},
  { field: 'triggerType', label: t('eam.strategy.lbl1145'), type: 'select', required: true, options: [
    { label: t('eam.strategy.lbl1146'), value: 'DAYS' }, { label: t('eam.strategy.lbl1147'), value: 'HOURS' },
  ]},
  { field: 'triggerValue', label: t('eam.strategy.lbl1148'), type: 'number', required: true, props: { min: 1 } },
  { field: 'content', label: t('eam.strategy.lbl1149'), type: 'textarea', props: { autoSize: { minRows: 2 } } },
  { field: 'isActive', label: t('eam.strategy.status'), type: 'select', options: [{ label: t('eam.strategy.enable'), value: 'true' as const }, { label: t('eam.strategy.disable'), value: 'false' as const }] },
]
async function loadData() {
  loading.value = true
  try { const res = await eamApi.getStrategies(query); tableData.value = (res.list ?? []) as any[]; total.value = res.total ?? 0 }
  catch { tableData.value = [] } finally { loading.value = false }
}
function resetQuery() { query.equipmentId = ''; query.strategyType = ''; query.page = 1; loadData() }
function onTableChange(e: { page: number; pageSize: number }) { query.page = e.page; query.pageSize = e.pageSize; loadData() }
const drawerVisible = ref(false); const saving = ref(false); const editing = ref<MaintenanceStrategy | null>(null); const formData = ref<Record<string, unknown>>({})
function openDrawer(item: MaintenanceStrategy | null) { editing.value = item; formData.value = item ? { ...item } : { status: 'ACTIVE' }; drawerVisible.value = true }
async function handleSave(data: Record<string, unknown>) {
  saving.value = true
  try {
    if (editing.value) { await eamApi.updateStrategy(editing.value.id, data); Message.success(t('eam.更新成功')) }
    else { await eamApi.createStrategy(data); Message.success(t('eam.创建成功')) }
    drawerVisible.value = false; loadData()
  } catch { /* handled */ } finally { saving.value = false }
}
onMounted(loadData)
</script>
<style scoped>.page-container { padding: 16px; }</style>
