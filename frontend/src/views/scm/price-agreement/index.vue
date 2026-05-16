<template>
  <div class="page-container">
    <a-card :bordered="false" style="margin-bottom: 16px">
      <a-space wrap>
        <SupplierSelect v-model="query.supplierId" :placeholder="$t('scm.price-agreement.index.供应商')" allow-clear style="width: 160px" @change="loadData" />
        <a-select v-model="query.status" :placeholder="$t('common.status')" allow-clear style="width: 130px">
          <a-option value="ACTIVE">{{ $t('scm.price-agreement.valid') }}</a-option>
          <a-option value="EXPIRED">{{ $t('scm.price-agreement.expired') }}</a-option>
          <a-option value="CANCELLED">{{ $t('scm.price-agreement.lbl1562') }}</a-option>
        </a-select>
        <a-button type="primary" @click="loadData">{{ $t('common.search') }}</a-button>
        <a-button @click="resetQuery">{{ $t('common.reset') }}</a-button>
      </a-space>
      <template #extra>
        <a-button type="primary" @click="openDrawer(null)">{{ $t('scm.price-agreement.lbl1563') }}</a-button>
      </template>
    </a-card>

    <a-card :bordered="false">
      <MTable :columns="columns" :data="tableData" :loading="loading" :total="total" :page-size="20" @change="onTableChange">
        <template #status="{ record }">
          <a-tag :color="record.status === 'ACTIVE' ? 'green' : record.status === 'EXPIRED' ? 'red' : 'gray'">
            {{ record.status === 'ACTIVE' ? t('scm.price-agreement.r33058') : record.status === 'EXPIRED' ? $t('scm.price-agreement.expired') : $t('scm.price-agreement.lbl1564') }}
          </a-tag>
        </template>
        <template #expiring="{ record }">
          <a-tag v-if="isExpiringSoon(record.endDate as string, record.status as string)" color="orange">
            {{ $t('scm.price-agreement.r33059', {endDate: daysUntilExpiry(record.endDate as string)}) }}
          </a-tag>
        </template>
        <template #action="{ record }">
          <a-space>
            <a-link @click="openDrawer(record as unknown as PriceAgreement)">{{ $t('common.edit') }}</a-link>
            <a-popconfirm v-if="record.status === 'ACTIVE'" :content="$t('scm.price-agreement.index.确认使该协议过期')" @ok="handleExpire(record.id as string)">
              <a-link status="danger">{{ $t('scm.price-agreement.lbl1565') }}</a-link>
            </a-popconfirm>
          </a-space>
        </template>
      </MTable>
    </a-card>

    <a-drawer v-model:visible="drawerVisible" ::title="t('scm.price-agreement.lbl1566')" :width="520" @cancel="drawerVisible = false">
      <MForm :schema="formSchema" v-model="formData" :loading="saving" :submit-text="$t('scm.price-agreement.index.保存')" @submit="handleSave" @cancel="drawerVisible = false" />
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
import { scmApi, type PriceAgreement } from '@/api/scm'
import SupplierSelect from '@/components/BusinessSelect/SupplierSelect.vue'

const loading = ref(false)
const tableData = ref<any[]>([])
const total = ref(0)
const query = reactive({ supplierId: '', status: '', page: 1, pageSize: 20 })

const columns: MTableColumn[] = [
  { key: 'supplierName', title: t('scm.price-agreement.index.供应商'), dataIndex: 'supplierName', width: 150 },
  { key: 'materialName', title: t('scm.price-agreement.index.物料名称'), dataIndex: 'materialName', width: 160 },
  { key: 'price', title: t('scm.price-agreement.index.协议价格'), dataIndex: 'price', width: 110 },
  { key: 'currency', title: t('scm.price-agreement.index.币种'), dataIndex: 'currency', width: 80 },
  { key: 'startDate', title: t('scm.price-agreement.index.开始日期'), dataIndex: 'startDate', width: 120 },
  { key: 'endDate', title: t('scm.price-agreement.index.结束日期'), dataIndex: 'endDate', width: 120 },
  { key: 'status', title: t('scm.price-agreement.index.状态'), slotName: 'status', width: 90 },
  { key: 'expiring', title: t('scm.price-agreement.index.到期预警'), slotName: 'expiring', width: 120 },
  { key: 'action', title: t('scm.price-agreement.index.操作'), slotName: 'action', width: 120 },
]

const formSchema: MFormField[] = [
  { field: 'supplierId', label: t('scm.price-agreement.lbl1567'), type: 'supplier-select', required: true },
  { field: 'materialId', label: t('scm.price-agreement.lbl1568'), type: 'material-select' },
  { field: 'price', label: t('scm.price-agreement.lbl1569'), type: 'number', required: true, props: { min: 0, precision: 4 } },
  { field: 'currency', label: t('scm.price-agreement.lbl1570'), type: 'select', required: true, options: [{ label: 'CNY', value: 'CNY' }, { label: 'USD', value: 'USD' }, { label: 'EUR', value: 'EUR' }, { label: 'GBP', value: 'GBP' }, { label: 'JPY', value: 'JPY' }, { label: 'HKD', value: 'HKD' }] },
  { field: 'startDate', label: t('scm.price-agreement.lbl1571'), type: 'date', required: true },
  { field: 'endDate', label: t('scm.price-agreement.lbl1572'), type: 'date', required: true },
]

function isExpiringSoon(date: string, status: string) {
  if (!date || status !== 'ACTIVE') return false
  return (new Date(date).getTime() - Date.now()) < 30 * 86400000
}

function daysUntilExpiry(date: string) {
  return Math.max(0, Math.floor((new Date(date).getTime() - Date.now()) / 86400000))
}

async function loadData() {
  loading.value = true
  try {
    const params: Record<string, unknown> = { page: query.page, pageSize: query.pageSize }
    if (query.supplierId) params.supplierId = query.supplierId
    if (query.status) params.status = query.status
    const res = await scmApi.getPriceAgreements(params)
    tableData.value = (res.list ?? []) as any[]
    total.value = res.total ?? 0
  } catch { tableData.value = [] } finally { loading.value = false }
}

function resetQuery() { query.supplierId = ''; query.status = ''; query.page = 1; loadData() }
function onTableChange(e: { page: number; pageSize: number }) { query.page = e.page; query.pageSize = e.pageSize; loadData() }

const drawerVisible = ref(false)
const saving = ref(false)
const editing = ref<PriceAgreement | null>(null)
const formData = ref<Record<string, unknown>>({})

function openDrawer(item: PriceAgreement | null) {
  editing.value = item
  formData.value = item ? { ...item } : {}
  drawerVisible.value = true
}

async function handleSave(data: Record<string, unknown>) {
  saving.value = true
  try {
    await scmApi.createPriceAgreement(data)
    Message.success(editing.value ? t('scm.price-agreement.lbl1573') : t('scm.price-agreement.lbl1574'))
    drawerVisible.value = false
    loadData()
  } catch { /* handled */ } finally { saving.value = false }
}

async function handleExpire(id: string) {
  try { await scmApi.expirePriceAgreement(id); Message.success(t('scm.协议已过期')); loadData() }
  catch { /* handled */ }
}

onMounted(loadData)
</script>

<style scoped>
.page-container { padding: 16px; }
</style>
