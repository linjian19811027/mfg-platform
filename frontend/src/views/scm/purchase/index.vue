<template>
  <div class="page-container">
    <a-card>
      <div class="search-bar">
        <a-select v-model="query.status" :placeholder="$t('common.status')" allow-clear style="width:140px">
          <a-option value="DRAFT">{{ $t('scm.purchase.draft') }}</a-option>
          <a-option value="CONFIRMED">{{ $t('scm.purchase.lbl1575') }}</a-option>
          <a-option value="PARTIAL">{{ $t('scm.purchase.lbl1576') }}</a-option>
          <a-option value="RECEIVED">{{ $t('scm.purchase.lbl1577') }}</a-option>
          <a-option value="CLOSED">{{ $t('scm.purchase.closed') }}</a-option>
        </a-select>
        <a-button type="primary" @click="loadData">{{ $t('common.search') }}</a-button>
        <a-button @click="resetQuery">{{ $t('common.reset') }}</a-button>
        <a-button style="margin-left:auto" type="primary" @click="openCreate">{{ $t('scm.purchase.lbl1578') }}</a-button>
      </div>

      <MTable :columns="columns" :data="list" :loading="loading" :total="total" @change="onTableChange">
        <template #status="{ record }">
          <a-tag :color="statusColor(record.status as string)">{{ statusLabel(record.status as string) }}</a-tag>
        </template>
        <template #action="{ record }">
          <a-space>
            <a-button type="text" size="small" @click="viewDetail(record as PurchaseOrder)">{{ $t('scm.purchase.view') }}</a-button>
            <a-button v-if="record.status === 'DRAFT'" type="text" size="small" status="success" @click="handleConfirm(record as PurchaseOrder)">{{ $t('scm.purchase.confirm') }}</a-button>
          </a-space>
        </template>
      </MTable>
    </a-card>

    <a-drawer v-model:visible="createVisible" :title="$t('scm.purchase.index.新建采购订单')" :width="480" @cancel="createVisible=false">
      <a-form :model="createFormData" layout="vertical">
        <a-form-item :label="$t('scm.purchase.index.供应商')" required>
          <a-select
            v-model="createFormData.supplierId"
            :placeholder="$t('scm.purchase.index.搜索供应商名称')"
            allow-search
            allow-clear
            :filter-option="false"
            style="width: 100%"
            @search="searchSuppliers"
          >
            <a-option v-for="s in supplierOptions" :key="s.id" :value="s.id" :label="s.name" />
          </a-select>
        </a-form-item>
        <a-form-item :label="$t('scm.purchase.index.币种')" required>
          <a-select v-model="createFormData.currency" style="width: 100%">
            <a-option value="CNY">CNY</a-option>
            <a-option value="USD">USD</a-option>
            <a-option value="EUR">EUR</a-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="$t('scm.purchase.index.订单日期')" required>
          <a-date-picker v-model="createFormData.orderDate" style="width: 100%" />
        </a-form-item>
        <a-form-item :label="$t('scm.purchase.index.预计到货日期')">
          <a-date-picker v-model="createFormData.expectedDate" style="width: 100%" />
        </a-form-item>
        <a-form-item style="margin-top: 24px">
          <a-space>
            <a-button type="primary" :loading="submitting" @click="handleCreate">{{ $t('common.save') }}</a-button>
            <a-button @click="createVisible = false">{{ $t('common.cancel') }}</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-drawer>

    <a-drawer v-model:visible="detailVisible" ::title="t('scm.purchase.lbl1579')" :width="520" @cancel="detailVisible=false">
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
import { scmApi, type PurchaseOrder, type Supplier } from '@/api/scm'

const statusColorMap: Record<string, string> = {
  DRAFT: 'gray', CONFIRMED: 'blue', PARTIAL: 'orange', RECEIVED: 'green', CLOSED: 'gray',
}
const statusLabelMap: Record<string, string> = {
  DRAFT: t('scm.purchase.draft')
}
const statusColor = (s: string) => statusColorMap[s] ?? 'gray'
const statusLabel = (s: string) => statusLabelMap[s] ?? s

const columns: MTableColumn[] = [
  { key: 'code', title: t('scm.purchase.index.订单编号'), width: 140 },
  { key: 'supplierName', title: t('scm.purchase.index.供应商名称') },
  { key: 'status', title: t('scm.purchase.index.状态'), width: 100, slotName: 'status' },
  { key: 'totalAmount', title: t('scm.purchase.index.总金额'), width: 110 },
  { key: 'currency', title: t('scm.purchase.index.币种'), width: 70 },
  { key: 'orderDate', title: t('scm.purchase.index.订单日期'), width: 110 },
  { key: 'expectedDate', title: t('scm.purchase.index.预计到货'), width: 110 },
  { key: 'action', title: t('scm.purchase.index.操作'), width: 120, slotName: 'action' },
]

const query = reactive({ status: '' })
const list = ref<PurchaseOrder[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const pageSize = ref(20)
const createVisible = ref(false)
const detailVisible = ref(false)
const submitting = ref(false)
const createFormData = reactive({ supplierId: '', currency: 'CNY', orderDate: '', expectedDate: '' })
const supplierOptions = ref<Supplier[]>([])
let supTimer: ReturnType<typeof setTimeout> | null = null
async function searchSuppliers(kw: string) {
  if (supTimer) clearTimeout(supTimer)
  supTimer = setTimeout(async () => {
    const res = await scmApi.getSuppliers({ keyword: kw, pageSize: 20 })
    supplierOptions.value = res.list ?? []
  }, 300)
}
const currentOrder = ref<PurchaseOrder | null>(null)

const detailItems = computed(() => {
  const o = currentOrder.value
  if (!o) return []
  return [
    { label: t('scm.purchase.lbl1580'), value: o.code }, { label: t('scm.purchase.lbl1581'), value: o.supplierName },
    { label: t('scm.purchase.status'), value: statusLabel(o.status) }, { label: t('scm.purchase.lbl1582'), value: o.totalAmount },
    { label: t('scm.purchase.lbl1583'), value: o.currency }, { label: t('scm.purchase.lbl1584'), value: o.orderDate },
    { label: t('scm.purchase.lbl1585'), value: o.expectedDate },
  ]
})

async function loadData() {
  loading.value = true
  try {
    const res = await scmApi.getPurchaseOrders({ ...query, page: page.value, pageSize: pageSize.value })
    list.value = res.list
    total.value = res.total
  } finally { loading.value = false }
}

function resetQuery() { query.status = ''; loadData() }
function onTableChange(e: { page: number; pageSize: number }) { page.value = e.page; pageSize.value = e.pageSize; loadData() }
function openCreate() {
  Object.assign(createFormData, { supplierId: '', currency: 'CNY', orderDate: '', expectedDate: '' })
  supplierOptions.value = []
  createVisible.value = true
}
function viewDetail(o: PurchaseOrder) { currentOrder.value = o; detailVisible.value = true }

async function handleConfirm(o: PurchaseOrder) {
  try {
    await scmApi.confirmPurchaseOrder(o.id)
    Message.success(t('scm.确认成功'))
    loadData()
  } catch { /* handled by request interceptor */ }
}

async function handleCreate() {
  if (!createFormData.supplierId) { Message.warning(t('scm.请选择供应商')); return }
  if (!createFormData.orderDate) { Message.warning(t('scm.请选择订单日期')); return }
  submitting.value = true
  try {
    await scmApi.createPurchaseOrder({ ...createFormData } as Parameters<typeof scmApi.createPurchaseOrder>[0])
    Message.success(t('scm.创建成功'))
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
