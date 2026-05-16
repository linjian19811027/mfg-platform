<template>
  <div class="page-container">
    <a-card :bordered="false" style="margin-bottom: 16px">
      <a-space wrap>
        <a-input v-model="query.keyword" :placeholder="$t('erp.cost-element.index.编码名称')" allow-clear style="width: 200px" @keyup.enter="loadData" />
        <a-button type="primary" @click="loadData">{{ $t('common.search') }}</a-button>
        <a-button @click="resetQuery">{{ $t('common.reset') }}</a-button>
      </a-space>
      <template #extra><a-button type="primary" @click="openDrawer(null)">{{ $t('erp.cost-element.lbl1172') }}</a-button></template>
    </a-card>
    <a-card :bordered="false">
      <MTable :columns="columns" :data="tableData" :loading="loading" :total="total" :page-size="20" @change="onTableChange">
        <template #status="{ record }">
          <a-tag :color="record.status === 'ACTIVE' ? 'green' : 'gray'">{{ record.status === 'ACTIVE' ? $t('erp.cost-element.enable') : $t('erp.cost-element.disable') }}</a-tag>
        </template>
        <template #action="{ record }">
          <a-link @click="openDrawer(record as unknown as ErpCostElement)">{{ $t('common.edit') }}</a-link>
        </template>
      </MTable>
    </a-card>
    <a-drawer v-model:visible="drawerVisible" ::title="t('erp.cost-element.lbl1173')" :width="480" @cancel="drawerVisible = false">
      <MForm :schema="formSchema" v-model="formData" :loading="saving" :submit-text="$t('erp.cost-element.index.保存')" @submit="handleSave" @cancel="drawerVisible = false" />
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
import { erpExtApi, type ErpCostElement } from '@/api/erp-ext'
const loading = ref(false); const tableData = ref<any[]>([]); const total = ref(0)
const query = reactive({ keyword: '', page: 1, pageSize: 20 })
const columns: MTableColumn[] = [
  { key: 'code', title: t('erp.cost-element.index.编码'), dataIndex: 'code', width: 130 },
  { key: 'name', title: t('erp.cost-element.index.名称'), dataIndex: 'name', width: 180 },
  { key: 'type', title: t('erp.cost-element.index.类型'), dataIndex: 'type', width: 120 },
  { key: 'status', title: t('erp.cost-element.index.状态'), slotName: 'status', width: 90 },
  { key: 'action', title: t('erp.cost-element.index.操作'), slotName: 'action', width: 80 },
]
const formSchema: MFormField[] = [
  { field: 'code', label: t('erp.cost-element.code'), type: 'input', required: true },
  { field: 'name', label: t('erp.cost-element.name'), type: 'input', required: true },
  { field: 'type', label: t('erp.cost-element.type'), type: 'select', required: true, options: [
    { label: t('erp.cost-element.lbl1174'), value: 'MATERIAL' }, { label: t('erp.cost-element.lbl1175'), value: 'LABOR' },
    { label: t('erp.cost-element.lbl1176'), value: 'OVERHEAD' }, { label: t('erp.cost-element.lbl1177'), value: 'OTHER' },
  ]},
  { field: 'status', label: t('erp.cost-element.status'), type: 'select', options: [{ label: t('erp.cost-element.enable'), value: 'ACTIVE' }, { label: t('erp.cost-element.disable'), value: 'INACTIVE' }] },
]
async function loadData() {
  loading.value = true
  try { const res = await erpExtApi.getCostElements(query); tableData.value = (res.list ?? []) as any[]; total.value = res.total ?? 0 }
  catch { tableData.value = [] } finally { loading.value = false }
}
function resetQuery() { query.keyword = ''; query.page = 1; loadData() }
function onTableChange(e: { page: number; pageSize: number }) { query.page = e.page; query.pageSize = e.pageSize; loadData() }
const drawerVisible = ref(false); const saving = ref(false); const editing = ref<ErpCostElement | null>(null); const formData = ref<Record<string, unknown>>({})
function openDrawer(item: ErpCostElement | null) { editing.value = item; formData.value = item ? { ...item } : { status: 'ACTIVE' }; drawerVisible.value = true }
async function handleSave(data: Record<string, unknown>) {
  saving.value = true
  try {
    if (editing.value) { await erpExtApi.updateCostElement(editing.value.id, data); Message.success(t('erp.更新成功')) }
    else { await erpExtApi.createCostElement(data); Message.success(t('erp.创建成功')) }
    drawerVisible.value = false; loadData()
  } catch { /* handled */ } finally { saving.value = false }
}
onMounted(loadData)
</script>
<style scoped>.page-container { padding: 16px; }</style>
