<template>
  <div class="page-container">
    <a-card :bordered="false" style="margin-bottom: 16px">
      <a-space wrap>
        <a-input v-model="query.keyword" :placeholder="$t('erp.customer.index.客户名称编码')" allow-clear style="width: 200px" @keyup.enter="loadData" />
        <a-select v-model="query.status" :placeholder="$t('common.status')" allow-clear style="width: 120px">
          <a-option value="ACTIVE">{{ $t('erp.customer.status.active') }}</a-option>
          <a-option value="INACTIVE">{{ $t('erp.customer.status.inactive') }}</a-option>
        </a-select>
        <a-button type="primary" @click="loadData">{{ $t('common.search') }}</a-button>
        <a-button @click="resetQuery">{{ $t('common.reset') }}</a-button>
      </a-space>
      <template #extra>
        <a-button type="primary" @click="openDrawer(null)">{{ $t('erp.customer.lbl1178') }}</a-button>
      </template>
    </a-card>
    <a-card :bordered="false">
      <MTable :columns="columns" :data="tableData" :loading="loading" :total="total" :page-size="20" @change="onTableChange">
        <template #status="{ record }">
          <a-tag :color="record.status === 'ACTIVE' ? 'green' : 'gray'">{{ record.status === 'ACTIVE' ? $t('erp.customer.enable') : $t('erp.customer.disable') }}</a-tag>
        </template>
        <template #action="{ record }">
          <a-link @click="openDrawer(record as unknown as ErpCustomer)">{{ $t('common.edit') }}</a-link>
        </template>
      </MTable>
    </a-card>
    <a-drawer v-model:visible="drawerVisible" ::title="t('erp.customer.lbl1179')" :width="520" @cancel="drawerVisible = false">
      <MForm :schema="formSchema" v-model="formData" :loading="saving" :submit-text="$t('erp.customer.index.保存')" @submit="handleSave" @cancel="drawerVisible = false" />
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
import { erpExtApi, type ErpCustomer } from '@/api/erp-ext'
const loading = ref(false); const tableData = ref<any[]>([]); const total = ref(0)
const query = reactive({ keyword: '', status: '', page: 1, pageSize: 20 })
const columns: MTableColumn[] = [
  { key: 'code', title: t('erp.customer.index.编码'), dataIndex: 'code', width: 120 },
  { key: 'name', title: t('erp.customer.index.客户名称'), dataIndex: 'name', width: 180 },
  { key: 'type', title: t('erp.customer.index.类型'), dataIndex: 'type', width: 100 },
  { key: 'creditLimit', title: t('erp.customer.index.信用额度'), dataIndex: 'creditLimit', width: 120 },
  { key: 'contactName', title: t('erp.customer.index.联系人'), dataIndex: 'contactName', width: 110 },
  { key: 'status', title: t('erp.customer.index.状态'), slotName: 'status', width: 90 },
  { key: 'action', title: t('erp.customer.index.操作'), slotName: 'action', width: 80 },
]
const formSchema: MFormField[] = [
  { field: 'name', label: t('erp.customer.lbl1180'), type: 'input', required: true },
  { field: 'code', label: t('erp.customer.lbl1181'), type: 'input' },
  { field: 'type', label: t('erp.customer.lbl1182'), type: 'select', options: [{ label: t('erp.customer.lbl1183'), value: 'STRATEGIC' }, { label: t('erp.customer.lbl1184'), value: 'KEY' }, { label: t('erp.customer.lbl1185a'), value: 'GENERAL' }, { label: t('erp.customer.lbl1185b'), value: 'POTENTIAL' }] },
  { field: 'creditLimit', label: t('erp.customer.lbl1185'), type: 'number', props: { min: 0, precision: 2 } },
  { field: 'contactName', label: t('erp.customer.lbl1186'), type: 'input' },
  { field: 'contactPhone', label: t('erp.customer.lbl1187'), type: 'input' },
  { field: 'contactEmail', label: t('erp.customer.lbl1188'), type: 'input' },
  { field: 'status', label: t('erp.customer.status'), type: 'select', options: [{ label: t('erp.customer.enable'), value: 'ACTIVE' }, { label: t('erp.customer.disable'), value: 'INACTIVE' }] },
]
async function loadData() {
  loading.value = true
  try { const res = await erpExtApi.getCustomers(query); tableData.value = (res.list ?? []) as any[]; total.value = res.total ?? 0 }
  catch { tableData.value = [] } finally { loading.value = false }
}
function resetQuery() { query.keyword = ''; query.status = ''; query.page = 1; loadData() }
function onTableChange(e: { page: number; pageSize: number }) { query.page = e.page; query.pageSize = e.pageSize; loadData() }
const drawerVisible = ref(false); const saving = ref(false); const editing = ref<ErpCustomer | null>(null); const formData = ref<Record<string, unknown>>({})
function openDrawer(item: ErpCustomer | null) { editing.value = item; formData.value = item ? { ...item } : { status: 'ACTIVE' }; drawerVisible.value = true }
async function handleSave(data: Record<string, unknown>) {
  saving.value = true
  try {
    if (editing.value) { await erpExtApi.updateCustomer(editing.value.id, data); Message.success(t('erp.更新成功')) }
    else { await erpExtApi.createCustomer(data); Message.success(t('erp.创建成功')) }
    drawerVisible.value = false; loadData()
  } catch { /* handled */ } finally { saving.value = false }
}
onMounted(loadData)
</script>
<style scoped>.page-container { padding: 16px; }</style>
