<template>
  <div class="page-container">
    <a-card :bordered="false" style="margin-bottom: 16px">
      <a-alert v-if="allDisabled" type="warning" :content="$t('aps.priority-rule.index.警告当前没有启用的优先级规则排')" style="margin-bottom: 0" />
    </a-card>
    <a-card :bordered="false">
      <template #title>{{ $t('aps.priority-rule.index.规则管理') }}</template>
      <template #extra><a-button type="primary" @click="openDrawer(null)">{{ $t('aps.priority-rule.action.create') }}</a-button></template>
      <MTable :columns="columns" :data="tableData" :loading="loading" :total="tableData.length" :show-column-config="false">
        <template #status="{ record }">
          <a-switch
            :model-value="record.status === 'ACTIVE'"
            :loading="togglingId === record.id"
            @change="(v: any) => handleToggle(record.id as string, v)"
          />
        </template>
        <template #action="{ record }">
          <a-link @click="openDrawer(record as unknown as PriorityRule)">{{ $t('common.edit') }}</a-link>
        </template>
      </MTable>
    </a-card>
    <a-drawer v-model:visible="drawerVisible" :title="editing ? $t('aps.priority-rule.action.edit') : $t('aps.priority-rule.action.create')" :width="480" @cancel="drawerVisible = false">
      <MForm :schema="formSchema" v-model="formData" :loading="saving" :submit-text="$t('aps.priority-rule.index.保存')" @submit="handleSave" @cancel="drawerVisible = false" />
    </a-drawer>
  </div>
</template>
<script setup lang="ts">
const { t } = useI18n()
import { useI18n } from 'vue-i18n'
import { ref, computed, onMounted } from 'vue'
import { Message } from '@arco-design/web-vue'
import MTable from '@/components/MTable/index.vue'
import MForm from '@/components/MForm/index.vue'
import type { MTableColumn } from '@/components/MTable/index.vue'
import type { MFormField } from '@/components/MForm/index.vue'
import { apsApi } from '@/api/aps'
interface PriorityRule { id: string; name: string; type: string; weight: number; status: string; description?: string }
const loading = ref(false); const tableData = ref<any[]>([])
const allDisabled = computed(() => tableData.value.length > 0 && tableData.value.every(r => r.status !== 'ACTIVE'))
const columns: MTableColumn[] = [
  { key: 'name', title: t('aps.priority-rule.index.规则名称'), dataIndex: 'name', width: 160 },
  { key: 'type', title: t('aps.priority-rule.index.规则类型'), dataIndex: 'type', width: 140 },
  { key: 'weight', title: t('aps.priority-rule.index.权重系数'), dataIndex: 'weight', width: 100 },
  { key: 'description', title: t('aps.priority-rule.index.描述'), dataIndex: 'description', width: 200, ellipsis: true },
  { key: 'status', title: t('aps.priority-rule.index.启用'), slotName: 'status', width: 90 },
  { key: 'action', title: t('aps.priority-rule.index.操作'), slotName: 'action', width: 80 },
]
const formSchema: MFormField[] = [
  { field: 'name', label: t('aps.priority-rule.index.规则名称'), type: 'input', required: true },
  { field: 'type', label: t('aps.priority-rule.index.规则类型'), type: 'select', required: true, options: [
    { label: 'EDD', value: 'EDD' }, { label: 'SPT', value: 'SPT' },
    { label: 'HPF', value: 'HPF' }, { label: 'FIFO', value: 'FIFO' },
  ]},
  { field: 'weight', label: t('aps.priority-rule.index.权重系数'), type: 'number', required: true, props: { min: 1, max: 10 } },
  { field: 'description', label: t('aps.priority-rule.index.描述'), type: 'textarea', props: { autoSize: { minRows: 2 } } },
]
async function loadData() {
  loading.value = true
  try { const res = await apsApi.getPriorityRules(); tableData.value = (res.list ?? []) as any[] }
  catch { tableData.value = [] } finally { loading.value = false }
}
const togglingId = ref<string | null>(null)
async function handleToggle(id: string, enabled: boolean) {
  togglingId.value = id
  try { await apsApi.togglePriorityRule(id, enabled); Message.success(enabled ? t('common.status.active') : t('common.status.inactive')); loadData() }
  catch { /* handled */ } finally { togglingId.value = null }
}
const drawerVisible = ref(false); const saving = ref(false); const editing = ref<PriorityRule | null>(null); const formData = ref<Record<string, unknown>>({})
function openDrawer(item: PriorityRule | null) { editing.value = item; formData.value = item ? { ...item } : { weight: 5 }; drawerVisible.value = true }
async function handleSave(data: Record<string, unknown>) {
  saving.value = true
  try {
    if (editing.value) { await apsApi.updatePriorityRule(editing.value.id, data); Message.success(t('aps.priority-rule.message.update')) }
    else { await apsApi.createPriorityRule(data); Message.success(t('aps.priority-rule.message.create')) }
    drawerVisible.value = false; loadData()
  } catch { /* handled */ } finally { saving.value = false }
}
onMounted(loadData)
</script>
<style scoped>.page-container { padding: 16px; }</style>
