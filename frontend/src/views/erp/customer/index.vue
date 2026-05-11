<template>
  <div class="page-container">
    <a-card :bordered="false" style="margin-bottom: 16px">
      <a-space wrap>
        <a-input v-model="query.keyword" :placeholder="$t('erp.customer.index.客户名称编码')" allow-clear style="width: 200px" @keyup.enter="loadData" />
        <a-select v-model="query.status" :placeholder="$t('common.status')" allow-clear style="width: 120px">
          <a-option value="ACTIVE">启用</a-option>
          <a-option value="INACTIVE">停用</a-option>
        </a-select>
        <a-button type="primary" @click="loadData">{{ $t('common.search') }}</a-button>
        <a-button @click="resetQuery">{{ $t('common.reset') }}</a-button>
      </a-space>
      <template #extra>
        <a-button type="primary" @click="openDrawer(null)">新建客户</a-button>
      </template>
    </a-card>
    <a-card :bordered="false">
      <MTable :columns="columns" :data="tableData" :loading="loading" :total="total" :page-size="20" @change="onTableChange">
        <template #status="{ record }">
          <a-tag :color="record.status === 'ACTIVE' ? 'green' : 'gray'">{{ record.status === 'ACTIVE' ? '启用' : '停用' }}</a-tag>
        </template>
        <template #action="{ record }">
          <a-link @click="openDrawer(record as unknown as ErpCustomer)">{{ $t('common.edit') }}</a-link>
        </template>
      </MTable>
    </a-card>
    <a-drawer v-model:visible="drawerVisible" :title="editing ? '编辑客户' : '新建客户'" :width="520" @cancel="drawerVisible = false">
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
  { field: 'name', label: '客户名称', type: 'input', required: true },
  { field: 'code', label: '客户编码', type: 'input' },
  { field: 'type', label: '客户类型', type: 'select', options: [{ label: '企业', value: 'ENTERPRISE' }, { label: '个人', value: 'INDIVIDUAL' }] },
  { field: 'creditLimit', label: '信用额度', type: 'number', props: { min: 0, precision: 2 } },
  { field: 'contactName', label: '联系人', type: 'input' },
  { field: 'contactPhone', label: '联系电话', type: 'input' },
  { field: 'email', label: '邮箱', type: 'input' },
  { field: 'taxNo', label: '税号', type: 'input' },
  { field: 'status', label: '状态', type: 'select', options: [{ label: '启用', value: 'ACTIVE' }, { label: '停用', value: 'INACTIVE' }] },
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
    if (editing.value) { await erpExtApi.updateCustomer(editing.value.id, data); Message.success('更新成功') }
    else { await erpExtApi.createCustomer(data); Message.success('创建成功') }
    drawerVisible.value = false; loadData()
  } catch { /* handled */ } finally { saving.value = false }
}
onMounted(loadData)
</script>
<style scoped>.page-container { padding: 16px; }</style>
