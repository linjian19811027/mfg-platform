<template>
  <div class="page-container">
    <a-card :bordered="false" style="margin-bottom: 16px">
      <a-space wrap>
        <SupplierSelect v-model="query.supplierId" :placeholder="$t('scm.asn.index.供应商')" style="width: 200px" @change="loadData" />
        <a-select v-model="query.status" :placeholder="$t('common.status')" allow-clear style="width: 130px">
          <a-option value="PENDING">{{ $t('scm.asn.lbl1553') }}</a-option>
          <a-option value="RECEIVED">{{ $t('scm.asn.accepted') }}</a-option>
          <a-option value="CANCELLED">{{ $t('scm.asn.lbl1554') }}</a-option>
        </a-select>
        <a-button type="primary" @click="loadData">{{ $t('common.search') }}</a-button>
        <a-button @click="resetQuery">{{ $t('common.reset') }}</a-button>
      </a-space>
      <template #extra>
        <a-button type="primary" @click="openDrawer">{{ $t('scm.asn.lbl1555') }}</a-button>
      </template>
    </a-card>

    <a-card :bordered="false">
      <MTable :columns="columns" :data="tableData" :loading="loading" :total="total" :page-size="20" @change="onTableChange">
        <template #status="{ record }">
          <a-tag :color="record.status === 'RECEIVED' ? 'green' : record.status === 'CANCELLED' ? 'gray' : isOverdue(record.expectedDate as string) ? 'orange' : 'blue'">
            {{ record.status === 'RECEIVED' ? t('scm.asn.r33056') : record.status === 'CANCELLED' ? t('scm.asn.r33057') : isOverdue(record.expectedDate as string) ? $t('scm.asn.lbl1556') : $t('scm.asn.lbl1557') }}
          </a-tag>
        </template>
        <template #action="{ record }">
          <a-space>
            <a-popconfirm v-if="record.status === 'PENDING'" :content="$t('scm.asn.index.确认接收该ASN')" @ok="handleReceive(record.id as string)">
              <a-link>{{ $t('scm.asn.lbl1558') }}</a-link>
            </a-popconfirm>
            <a-popconfirm v-if="record.status === 'PENDING'" :content="$t('scm.asn.index.确认取消该ASN')" @ok="handleCancel(record.id as string)">
              <a-link status="danger">{{ $t('scm.asn.cancel') }}</a-link>
            </a-popconfirm>
          </a-space>
        </template>
      </MTable>
    </a-card>

    <a-drawer v-model:visible="drawerVisible" :title="$t('scm.asn.index.新建ASN')" :width="480" @cancel="drawerVisible = false">
      <MForm :schema="formSchema" v-model="formData" :loading="saving" :submit-text="$t('scm.asn.index.创建')" @submit="handleCreate" @cancel="drawerVisible = false" />
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
import { scmApi } from '@/api/scm'
import SupplierSelect from '@/components/BusinessSelect/SupplierSelect.vue'

const loading = ref(false)
const tableData = ref<any[]>([])
const total = ref(0)
const query = reactive({ supplierId: '', status: '', page: 1, pageSize: 20 })

const columns: MTableColumn[] = [
  { key: 'code', title: t('scm.asn.index.ASN编号'), dataIndex: 'asnNo', width: 130 },
  { key: 'supplierName', title: t('scm.asn.index.供应商'), dataIndex: 'supplierName', width: 150 },
  { key: 'poId', title: t('scm.asn.index.采购订单'), dataIndex: 'poId', width: 130 },
  { key: 'expectedDate', title: t('scm.asn.index.预计到货'), dataIndex: 'expectedDate', width: 120 },
  { key: 'status', title: t('scm.asn.index.状态'), slotName: 'status', width: 110 },
  { key: 'createdAt', title: t('scm.asn.index.创建时间'), dataIndex: 'createdAt', width: 160 },
  { key: 'action', title: t('scm.asn.index.操作'), slotName: 'action', width: 140 },
]

const formSchema: MFormField[] = [
  { field: 'supplierId', label: t('scm.asn.lbl1559'), type: 'supplier-select', required: true },
  { field: 'poId', label: t('scm.asn.lbl1560'), type: 'input' },
  { field: 'expectedDate', label: t('scm.asn.lbl1561'), type: 'date', required: true },
]

function isOverdue(date: string) { return date && new Date(date) < new Date() }
async function loadData() {
  loading.value = true
  try {
    const params: Record<string, unknown> = { page: query.page, pageSize: query.pageSize }
    if (query.supplierId) params.supplierId = query.supplierId
    if (query.status) params.status = query.status
    const res = await scmApi.getAsns(params)
    tableData.value = (res.list ?? []) as any[]
    total.value = res.total ?? 0
  } catch { tableData.value = [] } finally { loading.value = false }
}

function resetQuery() { query.supplierId = ''; query.status = ''; query.page = 1; loadData() }
function onTableChange(e: { page: number; pageSize: number }) { query.page = e.page; query.pageSize = e.pageSize; loadData() }

const drawerVisible = ref(false)
const saving = ref(false)
const formData = ref<Record<string, unknown>>({})
function openDrawer() { formData.value = {}; drawerVisible.value = true }
async function handleCreate(data: Record<string, unknown>) {
  saving.value = true
  try { await scmApi.createAsn(data); Message.success(t('scm.创建成功')); drawerVisible.value = false; loadData() }
  catch { /* handled */ } finally { saving.value = false }
}

async function handleReceive(id: string) {
  try { await scmApi.receiveAsn(id); Message.success(t('scm.已接收')); loadData() }
  catch { /* handled */ }
}

async function handleCancel(id: string) {
  try { await scmApi.cancelAsn(id); Message.success(t('scm.已取消')); loadData() }
  catch { /* handled */ }
}

onMounted(loadData)
</script>

<style scoped>
.page-container { padding: 16px; }
</style>
