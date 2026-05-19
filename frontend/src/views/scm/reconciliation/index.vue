<template>
  <div class="page-container">
    <a-card :bordered="false" style="margin-bottom: 16px">
      <a-space wrap>
        <a-input v-model="query.supplierId" :placeholder="$t('scm.reconciliation.index.供应商ID')" allow-clear style="width: 160px" @keyup.enter="loadData" />
        <a-select v-model="query.status" :placeholder="$t('common.status')" allow-clear style="width: 130px">
          <a-option value="DRAFT">{{ $t('scm.reconciliation.draft') }}</a-option>
          <a-option value="CONFIRMED">{{ $t('scm.reconciliation.lbl1612') }}</a-option>
          <a-option value="DISPUTED">{{ $t('scm.reconciliation.lbl1613') }}</a-option>
        </a-select>
        <a-button type="primary" @click="loadData">{{ $t('common.search') }}</a-button>
        <a-button @click="resetQuery">{{ $t('common.reset') }}</a-button>
      </a-space>
      <template #extra>
        <a-button type="primary" @click="openDrawer(null)">{{ $t('scm.reconciliation.lbl1614') }}</a-button>
      </template>
    </a-card>

    <a-card :bordered="false">
      <MTable :columns="columns" :data="tableData" :loading="loading" :total="total" :page-size="20" @change="onTableChange">
        <template #status="{ record }">
          <a-tag :color="record.status === 'CONFIRMED' ? 'green' : record.status === 'DISPUTED' ? 'red' : 'gray'">
            {{ record.status === 'CONFIRMED' ? t('scm.reconciliation.r33063') : record.status === 'DISPUTED' ? $t('scm.reconciliation.lbl1615') : $t('scm.reconciliation.draft') }}
          </a-tag>
        </template>
        <template #period="{ record }">{{ record.periodStart }} ~ {{ record.periodEnd }}</template>
        <template #action="{ record }">
          <a-space>
            <a-link @click="openDrawer(record as unknown as ScmReconciliation)">{{ $t('common.edit') }}</a-link>
            <a-popconfirm v-if="record.status === 'DRAFT'" :content="$t('scm.reconciliation.index.确认该对账单')" @ok="handleConfirm(record.id as string)">
              <a-link>{{ $t('scm.reconciliation.confirm') }}</a-link>
            </a-popconfirm>
          </a-space>
        </template>
      </MTable>
    </a-card>

    <a-drawer v-model:visible="drawerVisible" ::title="t('scm.reconciliation.lbl1616')" :width="480" @cancel="drawerVisible = false">
      <MForm :schema="formSchema" v-model="formData" :loading="saving" :submit-text="$t('scm.reconciliation.index.保存')" @submit="handleSave" @cancel="drawerVisible = false" />
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
import { scmApi, type ScmReconciliation } from '@/api/scm'

const loading = ref(false)
const tableData = ref<any[]>([])
const total = ref(0)
const query = reactive({ supplierId: '', status: '', page: 1, pageSize: 20 })

const columns: MTableColumn[] = [
  { key: 'supplierName', title: t('scm.reconciliation.index.供应商'), dataIndex: 'supplierName', width: 150 },
  { key: 'period', title: t('scm.reconciliation.index.对账期间'), slotName: 'period', width: 120 },
  { key: 'amount', title: t('scm.reconciliation.index.对账金额'), dataIndex: 'totalAmount', width: 120 },
  { key: 'currency', title: t('scm.reconciliation.index.币种'), dataIndex: 'currencyCode', width: 80 },
  { key: 'status', title: t('scm.reconciliation.index.状态'), slotName: 'status', width: 100 },
  { key: 'createdAt', title: t('scm.reconciliation.index.创建时间'), dataIndex: 'createdAt', width: 160 },
  { key: 'action', title: t('scm.reconciliation.index.操作'), slotName: 'action', width: 120 },
]

const formSchema: MFormField[] = [
  { field: 'supplierId', label: t('scm.reconciliation.lbl1617'), type: 'supplier-select', required: true },
  { field: 'period', label: t('scm.reconciliation.lbl1618'), type: 'input', required: true, props: { placeholder: t('scm.reconciliation.r33064') } },
  { field: 'amount', label: t('scm.reconciliation.lbl1619'), type: 'number', required: true, props: { min: 0, precision: 2 } },
  { field: 'currency', label: t('scm.reconciliation.lbl1620'), type: 'input', required: true, props: { placeholder: 'CNY' } },
]

async function loadData() {
  loading.value = true
  try {
    const params: Record<string, unknown> = { page: query.page, pageSize: query.pageSize }
    if (query.supplierId) params.supplierId = query.supplierId
    if (query.status) params.status = query.status
    const res = await scmApi.getReconciliations(params)
    tableData.value = (res.list ?? []) as any[]
    total.value = res.total ?? 0
  } catch { tableData.value = [] } finally { loading.value = false }
}

function resetQuery() { query.supplierId = ''; query.status = ''; query.page = 1; loadData() }
function onTableChange(e: { page: number; pageSize: number }) { query.page = e.page; query.pageSize = e.pageSize; loadData() }

const drawerVisible = ref(false)
const saving = ref(false)
const editing = ref<ScmReconciliation | null>(null)
const formData = ref<Record<string, unknown>>({})

function openDrawer(item: ScmReconciliation | null) {
  editing.value = item
  formData.value = item ? { ...item } : {}
  drawerVisible.value = true
}

async function handleSave(data: Record<string, unknown>) {
  saving.value = true
  try {
    await scmApi.createReconciliation(data)
    Message.success(editing.value ? t('scm.reconciliation.lbl1621') : t('scm.reconciliation.lbl1622'))
    drawerVisible.value = false
    loadData()
  } catch { /* handled */ } finally { saving.value = false }
}

async function handleConfirm(id: string) {
  try { await scmApi.confirmReconciliation(id); Message.success(t('scm.对账已确认')); loadData() }
  catch { /* handled */ }
}

onMounted(loadData)
</script>

<style scoped>
.page-container { padding: 16px; }
</style>
