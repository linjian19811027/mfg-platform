<template>
  <div class="page-container">
    <a-card>
      <div class="search-bar">
        <a-select v-model="query.status" :placeholder="$t('common.status')" allow-clear style="width:130px">
          <a-option v-for="s in statusOptions" :key="s.value" :value="s.value">{{ s.label }}</a-option>
        </a-select>
        <a-button type="primary" @click="loadData">{{ $t('common.search') }}</a-button>
        <a-button @click="resetQuery">{{ $t('common.reset') }}</a-button>
        <a-button style="margin-left:auto" type="primary" @click="openCreate">{{ $t('erp.salesorder.lbl1224') }}</a-button>
      </div>

      <MTable :columns="columns" :data="list" :loading="loading" :total="total" @change="onTableChange">
        <template #status="{ record }">
          <a-tag :color="statusColor(record.status as string)">{{ statusLabel(record.status as string) }}</a-tag>
        </template>
        <template #totalAmount="{ record }">
          {{ (record.totalAmount as number).toFixed(2) }} {{ record.currency }}
        </template>
        <template #action="{ record }">
          <a-space>
            <a-button type="text" size="small" @click="viewDetail(record as SalesOrder)">{{ $t('erp.salesorder.view') }}</a-button>
            <a-button
              v-if="record.status === 'DRAFT'"
              type="text" size="small" status="success"
              @click="handleConfirm(record as SalesOrder)"
            >{{ $t('erp.salesorder.confirm') }}</a-button>
          </a-space>
        </template>
      </MTable>
    </a-card>

    <a-drawer v-model:visible="createVisible" :title="$t('erp.salesorder.index.新建订单')" :width="480" @cancel="createVisible=false">
      <a-form :model="createFormData" layout="vertical">
        <a-form-item :label="$t('erp.salesorder.index.客户')" required>
          <a-select
            v-model="createFormData.customerId"
            :placeholder="$t('erp.salesorder.index.搜索客户名称')"
            allow-search
            allow-clear
            :filter-option="false"
            style="width: 100%"
            @search="searchCustomers"
          >
            <a-option v-for="c in customerOptions" :key="c.id" :value="c.id" :label="c.name" />
          </a-select>
        </a-form-item>
        <a-form-item :label="$t('erp.salesorder.index.币种')" required>
          <a-select v-model="createFormData.currency" style="width: 100%">
            <a-option value="CNY">CNY</a-option>
            <a-option value="USD">USD</a-option>
            <a-option value="EUR">EUR</a-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="$t('erp.salesorder.index.订单日期')" required>
          <a-date-picker v-model="createFormData.orderDate" style="width: 100%" />
        </a-form-item>
        <a-form-item :label="$t('erp.salesorder.index.交货日期')">
          <a-date-picker v-model="createFormData.deliveryDate" style="width: 100%" />
        </a-form-item>
        <a-form-item style="margin-top: 24px">
          <a-space>
            <a-button type="primary" :loading="submitting" @click="handleCreate">{{ $t('common.save') }}</a-button>
            <a-button @click="createVisible = false">{{ $t('common.cancel') }}</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-drawer>

    <a-drawer v-model:visible="detailVisible" :title="$t('erp.salesorder.index.订单详情')" :width="520" @cancel="detailVisible=false">
      <a-descriptions :data="detailItems" layout="inline-vertical" bordered />
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
import { useI18n } from 'vue-i18n'
import { ref, reactive, computed } from 'vue'
import { Message } from '@arco-design/web-vue'
import MTable from '@/components/MTable/index.vue'
import type { MTableColumn } from '@/components/MTable/index.vue'
import { erpExtApi as erpApi, type SalesOrder, type Customer } from '@/api/erp-ext'

const statusOptions = [
  { label: t('erp.salesorder.draft'), value: 'DRAFT' }, { label: t('erp.salesorder.lbl1225'), value: 'CONFIRMED' },
  { label: t('erp.salesorder.lbl1226'), value: 'IN_PRODUCTION' }, { label: t('erp.salesorder.lbl1227'), value: 'SHIPPED' },
  { label: t('erp.salesorder.lbl1228'), value: 'DELIVERED' }, { label: t('erp.salesorder.closed'), value: 'CLOSED' },
]
const statusColorMap: Record<string, string> = {
  DRAFT: 'gray', CONFIRMED: 'blue', IN_PRODUCTION: 'orange', SHIPPED: 'arcoblue', DELIVERED: 'green', CLOSED: 'gray',
}
const statusLabelMap: Record<string, string> = {
  DRAFT: t('erp.salesorder.draft')
}
const statusColor = (s: string) => statusColorMap[s] ?? 'gray'
const statusLabel = (s: string) => statusLabelMap[s] ?? s

const columns: MTableColumn[] = [
  { key: 'code', title: t('erp.salesorder.index.订单编号'), width: 140 },
  { key: 'customerName', title: t('erp.salesorder.index.客户名称') },
  { key: 'status', title: t('erp.salesorder.index.状态'), width: 90, slotName: 'status' },
  { key: 'totalAmount', title: t('erp.salesorder.index.总金额'), width: 140, slotName: 'totalAmount' },
  { key: 'orderDate', title: t('erp.salesorder.index.订单日期'), width: 110 },
  { key: 'deliveryDate', title: t('erp.salesorder.index.交货日期'), width: 110 },
  { key: 'action', title: t('erp.salesorder.index.操作'), width: 120, slotName: 'action' },
]

const query = reactive({ status: '' })
const list = ref<SalesOrder[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const pageSize = ref(20)
const createVisible = ref(false)
const detailVisible = ref(false)
const submitting = ref(false)
const createFormData = reactive({ customerId: '', currency: 'CNY', orderDate: '', deliveryDate: '' })
const customerOptions = ref<Customer[]>([])
let custTimer: ReturnType<typeof setTimeout> | null = null
async function searchCustomers(kw: string) {
  if (custTimer) clearTimeout(custTimer)
  custTimer = setTimeout(async () => {
    const res = await erpApi.getCustomers({ keyword: kw, pageSize: 20 })
    customerOptions.value = res.list ?? []
  }, 300)
}
const currentDetail = ref<SalesOrder | null>(null)

const detailItems = computed(() => {
  if (!currentDetail.value) return []
  const o = currentDetail.value
  return [
    { label: t('erp.salesorder.lbl1229'), value: o.code }, { label: t('erp.salesorder.lbl1230'), value: o.customerId },
    { label: t('erp.salesorder.lbl1231'), value: o.customerName ?? '-' }, { label: t('erp.salesorder.status'), value: statusLabel(o.status) },
    { label: t('erp.salesorder.lbl1232'), value: `${o.totalAmount} ${o.currency}` }, { label: t('erp.salesorder.lbl1233'), value: o.orderDate },
    { label: t('erp.salesorder.lbl1234'), value: o.deliveryDate ?? '-' },
  ]
})

async function loadData() {
  loading.value = true
  try {
    const res = await erpApi.getSalesOrders({ ...query, page: page.value, pageSize: pageSize.value })
    list.value = res.list
    total.value = res.total
  } finally { loading.value = false }
}

function resetQuery() { query.status = ''; loadData() }
function onTableChange(e: { page: number; pageSize: number }) { page.value = e.page; pageSize.value = e.pageSize; loadData() }
function openCreate() {
  Object.assign(createFormData, { customerId: '', currency: 'CNY', orderDate: '', deliveryDate: '' })
  customerOptions.value = []
  createVisible.value = true
}
function viewDetail(record: SalesOrder) { currentDetail.value = record; detailVisible.value = true }

async function handleConfirm(record: SalesOrder) {
  try {
    await erpApi.confirmSalesOrder(record.id)
    Message.success(t('erp.订单已确认'))
    loadData()
  } catch { /* handled by request interceptor */ }
}

async function handleCreate() {
  if (!createFormData.customerId) { Message.warning(t('erp.请选择客户')); return }
  if (!createFormData.orderDate) { Message.warning(t('erp.请选择订单日期')); return }
  submitting.value = true
  try {
    await erpApi.createSalesOrder({ ...createFormData } as Parameters<typeof erpApi.createSalesOrder>[0])
    Message.success(t('erp.创建成功'))
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
