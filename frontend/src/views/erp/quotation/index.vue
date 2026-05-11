<template>
  <div class="page-container">
    <a-card :bordered="false" style="margin-bottom: 16px">
      <a-space wrap>
        <a-select v-model="query.status" :placeholder="$t('common.status')" allow-clear style="width: 130px">
          <a-option value="DRAFT">草稿</a-option><a-option value="SENT">已发送</a-option>
          <a-option value="ACCEPTED">已接受</a-option><a-option value="REJECTED">已拒绝</a-option><a-option value="EXPIRED">已过期</a-option>
        </a-select>
        <a-button type="primary" @click="loadData">{{ $t('common.search') }}</a-button>
        <a-button @click="resetQuery">{{ $t('common.reset') }}</a-button>
      </a-space>
      <template #extra><a-button type="primary" @click="openDrawer(null)">新建报价单</a-button></template>
    </a-card>
    <a-card :bordered="false">
      <MTable :columns="columns" :data="tableData" :loading="loading" :total="total" :page-size="20" @change="onTableChange">
        <template #status="{ record }">
          <a-tag :color="statusColor(record.status as string)">{{ statusLabel(record.status as string) }}</a-tag>
        </template>
        <template #action="{ record }">
          <a-space>
            <a-popconfirm v-if="record.status === 'DRAFT'" :content="$t('erp.quotation.index.确认发送报价')" @ok="handleSend(record.id as string)"><a-link>发送</a-link></a-popconfirm>
            <a-popconfirm v-if="record.status === 'SENT'" :content="$t('erp.quotation.index.确认客户已接受')" @ok="handleAccept(record.id as string)"><a-link>接受</a-link></a-popconfirm>
            <a-link v-if="record.status === 'ACCEPTED'" @click="handleConvert(record.id as string)">转订单</a-link>
          </a-space>
        </template>
      </MTable>
    </a-card>
    <a-drawer v-model:visible="drawerVisible" :title="$t('erp.quotation.index.新建报价单')" :width="480" @cancel="drawerVisible = false">
      <MForm :schema="formSchema" v-model="formData" :loading="saving" :submit-text="$t('erp.quotation.index.保存')" @submit="handleCreate" @cancel="drawerVisible = false" />
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
const STATUS_MAP: Record<string, { label: string; color: string }> = {
  DRAFT: { label: '草稿', color: 'gray' }, SENT: { label: '已发送', color: 'blue' },
  ACCEPTED: { label: '已接受', color: 'green' }, REJECTED: { label: '已拒绝', color: 'red' }, EXPIRED: { label: '已过期', color: 'gray' },
}
const columns: MTableColumn[] = [
  { key: 'code', title: t('erp.quotation.index.报价单号'), dataIndex: 'code', width: 130 },
  { key: 'customerName', title: t('erp.quotation.index.客户'), dataIndex: 'customerName', width: 150 },
  { key: 'totalAmount', title: t('erp.quotation.index.总金额'), dataIndex: 'totalAmount', width: 120 },
  { key: 'currency', title: t('erp.quotation.index.币种'), dataIndex: 'currency', width: 80 },
  { key: 'validUntil', title: t('erp.quotation.index.有效期'), dataIndex: 'validUntil', width: 120 },
  { key: 'status', title: t('erp.quotation.index.状态'), slotName: 'status', width: 100 },
  { key: 'action', title: t('erp.quotation.index.操作'), slotName: 'action', width: 160 },
]
const formSchema: MFormField[] = [
  { field: 'customerId', label: '客户ID', type: 'input', required: true },
  { field: 'currency', label: '币种', type: 'input', required: true, props: { placeholder: 'CNY' } },
  { field: 'validUntil', label: '有效期', type: 'date' },
]
function statusColor(s: string) { return STATUS_MAP[s]?.color ?? 'gray' }
function statusLabel(s: string) { return STATUS_MAP[s]?.label ?? s }
async function loadData() {
  loading.value = true
  try { const res = await erpExtApi.getQuotations(query); tableData.value = (res.list ?? []) as any[]; total.value = res.total ?? 0 }
  catch { tableData.value = [] } finally { loading.value = false }
}
function resetQuery() { query.status = ''; query.page = 1; loadData() }
function onTableChange(e: { page: number; pageSize: number }) { query.page = e.page; query.pageSize = e.pageSize; loadData() }
const drawerVisible = ref(false); const saving = ref(false); const formData = ref<Record<string, unknown>>({})
function openDrawer(_item: null) { formData.value = {}; drawerVisible.value = true }
async function handleCreate(data: Record<string, unknown>) {
  saving.value = true
  try { await erpExtApi.createQuotation(data); Message.success('创建成功'); drawerVisible.value = false; loadData() }
  catch { /* handled */ } finally { saving.value = false }
}
async function handleSend(id: string) { try { await erpExtApi.sendQuotation(id); Message.success('已发送'); loadData() } catch { /* handled */ } }
async function handleAccept(id: string) { try { await erpExtApi.acceptQuotation(id); Message.success('已接受'); loadData() } catch { /* handled */ } }
async function handleConvert(id: string) {
  try { await erpExtApi.convertQuotation(id); Message.success('销售订单已创建'); loadData() } catch { /* handled */ }
}
onMounted(loadData)
</script>
<style scoped>.page-container { padding: 16px; }</style>
