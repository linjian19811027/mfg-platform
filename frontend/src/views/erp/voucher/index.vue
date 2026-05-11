<template>
  <div class="page-container">
    <a-card>
      <div class="search-bar">
        <a-select v-model="query.type" :placeholder="$t('erp.voucher.index.凭证类型')" allow-clear style="width:130px">
          <a-option v-for="t in typeOptions" :key="t.value" :value="t.value">{{ t.label }}</a-option>
        </a-select>
        <a-select v-model="query.status" :placeholder="$t('common.status')" allow-clear style="width:120px">
          <a-option v-for="s in statusOptions" :key="s.value" :value="s.value">{{ s.label }}</a-option>
        </a-select>
        <a-button type="primary" @click="loadData">{{ $t('common.search') }}</a-button>
        <a-button style="margin-left:auto" type="primary" @click="openCreate">新建凭证</a-button>
      </div>

      <MTable :columns="columns" :data="list" :loading="loading" :total="total" @change="onTableChange">
        <template #status="{ record }">
          <a-tag :color="statusColor(record.status as string)">{{ statusLabel(record.status as string) }}</a-tag>
        </template>
        <template #action="{ record }">
          <a-button
            v-if="record.status === 'draft'"
            type="text" size="small" status="success"
            @click="handleApprove(record as Voucher)"
          >审批</a-button>
        </template>
      </MTable>
    </a-card>

    <a-drawer v-model:visible="createVisible" :title="$t('erp.voucher.index.新建凭证')" :width="480" @cancel="createVisible=false">
      <MForm :schema="createSchema" v-model="createForm" :loading="submitting" @submit="handleCreate" @cancel="createVisible=false" />
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
import { erpApi, type Voucher } from '@/api/erp'

const typeOptions = [
  { label: 'PURCHASE', value: 'PURCHASE' }, { label: 'SALES', value: 'SALES' },
  { label: 'PRODUCTION', value: 'PRODUCTION' }, { label: 'ADJUST', value: 'ADJUST' },
]
const statusOptions = [
  { label: '草稿', value: 'draft' }, { label: '已审批', value: 'approved' },
  { label: '已过账', value: 'posted' }, { label: '已冲销', value: 'reversed' },
]
const statusColorMap: Record<string, string> = {
  draft: 'gray', approved: 'blue', posted: 'green', reversed: 'red',
}
const statusLabelMap: Record<string, string> = {
  draft: '草稿', approved: '已审批', posted: '已过账', reversed: '已冲销',
}
const statusColor = (s: string) => statusColorMap[s] ?? 'gray'
const statusLabel = (s: string) => statusLabelMap[s] ?? s

const columns: MTableColumn[] = [
  { key: 'code', title: t('erp.voucher.index.凭证编号'), width: 140 },
  { key: 'type', title: t('erp.voucher.index.类型'), width: 110 },
  { key: 'status', title: t('erp.voucher.index.状态'), width: 90, slotName: 'status' },
  { key: 'totalDebit', title: t('erp.voucher.index.借方合计'), width: 110 },
  { key: 'totalCredit', title: t('erp.voucher.index.贷方合计'), width: 110 },
  { key: 'period', title: t('erp.voucher.index.期间'), width: 90 },
  { key: 'description', title: t('erp.voucher.index.描述'), ellipsis: true },
  { key: 'createdAt', title: t('erp.voucher.index.创建时间'), width: 160 },
  { key: 'action', title: t('erp.voucher.index.操作'), width: 80, slotName: 'action' },
]

const createSchema: MFormField[] = [
  { field: 'code', label: '凭证编号', type: 'input', required: true },
  { field: 'type', label: '凭证类型', type: 'select', required: true, options: typeOptions },
  { field: 'period', label: '期间', type: 'input', required: true, props: { placeholder: '如 2024-01' } },
  { field: 'description', label: '描述', type: 'textarea' },
]

const query = reactive({ type: '', status: '' })
const list = ref<Voucher[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const pageSize = ref(20)
const createVisible = ref(false)
const submitting = ref(false)
const createForm = ref<Record<string, unknown>>({})

async function loadData() {
  loading.value = true
  try {
    const res = await erpApi.getVouchers({ ...query, page: page.value, pageSize: pageSize.value })
    list.value = res.list
    total.value = res.total
  } finally { loading.value = false }
}

function onTableChange(e: { page: number; pageSize: number }) { page.value = e.page; pageSize.value = e.pageSize; loadData() }
function openCreate() { createForm.value = {}; createVisible.value = true }

async function handleApprove(record: Voucher) {
  try {
    await erpApi.approveVoucher(record.id)
    Message.success('审批成功')
    loadData()
  } catch { /* handled by request interceptor */ }
}

async function handleCreate(data: Record<string, unknown>) {
  submitting.value = true
  try {
    await erpApi.createVoucher(data as Parameters<typeof erpApi.createVoucher>[0])
    Message.success('创建成功')
    createVisible.value = false
    loadData()
  } finally { submitting.value = false }
}

loadData()
</script>

<style scoped>
.page-container { padding: 16px; }
.search-bar { display: flex; gap: 8px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
</style>
