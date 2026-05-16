<template>
  <div class="page-container">
    <a-card :bordered="false" style="margin-bottom: 16px">
      <a-space wrap>
        <a-select v-model="query.status" :placeholder="$t('common.status')" allow-clear style="width: 130px">
          <a-option value="PENDING">{{ $t('erp.sales-return.pending') }}</a-option><a-option value="INSPECTING">{{ $t('erp.sales-return.inspecting') }}</a-option>
          <a-option value="ACCEPTED">{{ $t('erp.sales-return.lbl1218') }}</a-option><a-option value="REJECTED">{{ $t('erp.sales-return.rejected') }}</a-option>
        </a-select>
        <a-button type="primary" @click="loadData">{{ $t('common.search') }}</a-button>
        <a-button @click="resetQuery">{{ $t('common.reset') }}</a-button>
      </a-space>
      <template #extra><a-button type="primary" @click="openDrawer">{{ $t('erp.sales-return.lbl1219') }}</a-button></template>
    </a-card>
    <a-card :bordered="false">
      <MTable :columns="columns" :data="tableData" :loading="loading" :total="total" :page-size="20" @change="onTableChange">
        <template #status="{ record }">
          <a-tag :color="record.status === 'ACCEPTED' ? 'green' : record.status === 'REJECTED' ? 'red' : record.status === 'INSPECTING' ? 'orange' : 'gray'">
            {{ { PENDING: t('erp.sales-return.pending'), INSPECTING: t('erp.sales-return.inspecting'), ACCEPTED: t('erp.sales-return.lbl1220'), REJECTED: t('erp.sales-return.rejected') }[record.status as string] ?? record.status }}
          </a-tag>
        </template>
        <template #action="{ record }">
          <a-space>
            <a-popconfirm v-if="record.status === 'INSPECTING'" :content="$t('erp.sales-return.index.确认接受退货')" @ok="handleAccept(record.id as string)"><a-link>{{ $t('erp.sales-return.r33020') }}</a-link></a-popconfirm>
            <a-popconfirm v-if="record.status === 'INSPECTING'" :content="$t('erp.sales-return.index.确认拒绝退货')" @ok="handleReject(record.id as string)"><a-link status="danger">{{ $t('erp.sales-return.r33021') }}</a-link></a-popconfirm>
          </a-space>
        </template>
      </MTable>
    </a-card>
    <a-drawer v-model:visible="drawerVisible" :title="$t('erp.sales-return.index.新建退货单')" :width="480" @cancel="drawerVisible = false">
      <MForm :schema="formSchema" v-model="formData" :loading="saving" :submit-text="$t('erp.sales-return.index.创建')" @submit="handleCreate" @cancel="drawerVisible = false" />
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
import { erpExtApi } from '@/api/erp-ext'
const loading = ref(false); const tableData = ref<any[]>([]); const total = ref(0)
const query = reactive({ status: '', page: 1, pageSize: 20 })
const columns: MTableColumn[] = [
  { key: 'code', title: t('erp.sales-return.index.退货单号'), dataIndex: 'code', width: 130 },
  { key: 'customerName', title: t('erp.sales-return.index.客户'), dataIndex: 'customerName', width: 150 },
  { key: 'reason', title: t('erp.sales-return.index.退货原因'), dataIndex: 'reason', width: 200, ellipsis: true },
  { key: 'status', title: t('erp.sales-return.index.状态'), slotName: 'status', width: 100 },
  { key: 'createdAt', title: t('erp.sales-return.index.创建时间'), dataIndex: 'createdAt', width: 160 },
  { key: 'action', title: t('erp.sales-return.index.操作'), slotName: 'action', width: 140 },
]
const formSchema: MFormField[] = [
  { field: 'salesOrderId', label: t('erp.sales-return.lbl1221'), type: 'select', placeholder: t('erp.sales-return.r33022') },
  { field: 'customerId', label: t('erp.sales-return.lbl1222'), type: 'select', placeholder: t('erp.sales-return.r33023') },
  { field: 'reason', label: t('erp.sales-return.lbl1223'), type: 'textarea', required: true, props: { autoSize: { minRows: 2 } } },
]
async function loadData() {
  loading.value = true
  try { const res = await erpExtApi.getSalesReturns(query); tableData.value = (res.list ?? []) as any[]; total.value = res.total ?? 0 }
  catch { tableData.value = [] } finally { loading.value = false }
}
function resetQuery() { query.status = ''; query.page = 1; loadData() }
function onTableChange(e: { page: number; pageSize: number }) { query.page = e.page; query.pageSize = e.pageSize; loadData() }
const drawerVisible = ref(false); const saving = ref(false); const formData = ref<Record<string, unknown>>({})
function openDrawer() { formData.value = {}; drawerVisible.value = true }
async function handleCreate(data: Record<string, unknown>) {
  saving.value = true
  try { await erpExtApi.createSalesReturn(data); Message.success(t('erp.创建成功')); drawerVisible.value = false; loadData() }
  catch { /* handled */ } finally { saving.value = false }
}
async function handleAccept(id: string) { try { await erpExtApi.acceptReturn(id); Message.success(t('erp.已接受')); loadData() } catch { /* handled */ } }
async function handleReject(id: string) { try { await erpExtApi.rejectReturn(id); Message.success(t('erp.已拒绝')); loadData() } catch { /* handled */ } }
onMounted(loadData)
</script>
<style scoped>.page-container { padding: 16px; }</style>
