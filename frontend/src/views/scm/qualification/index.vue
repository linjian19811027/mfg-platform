<template>
  <div class="page-container">
    <a-card :bordered="false" style="margin-bottom: 16px">
      <a-space wrap>
        <a-input v-model="query.supplierId" :placeholder="$t('scm.qualification.index.供应商ID')" allow-clear style="width: 160px" @keyup.enter="loadData" />
        <a-select v-model="query.status" :placeholder="$t('common.status')" allow-clear style="width: 130px">
          <a-option value="VALID">{{ $t('scm.qualification.valid') }}</a-option>
          <a-option value="EXPIRING">{{ $t('scm.qualification.expiring') }}</a-option>
          <a-option value="EXPIRED">{{ $t('scm.qualification.expired') }}</a-option>
        </a-select>
        <a-button type="primary" @click="loadData">{{ $t('common.search') }}</a-button>
        <a-button @click="resetQuery">{{ $t('common.reset') }}</a-button>
      </a-space>
      <template #extra>
        <a-button type="primary" @click="openDrawer(null)">{{ $t('scm.qualification.lbl1591') }}</a-button>
      </template>
    </a-card>

    <a-card :bordered="false">
      <MTable :columns="columns" :data="tableData" :loading="loading" :total="total" :page-size="20" @change="onTableChange">
        <template #status="{ record }">
          <a-tag :color="record.status === 'VALID' ? 'green' : record.status === 'EXPIRING' ? 'orange' : 'red'">
            {{ record.status === 'VALID' ? t('scm.qualification.r33060') : record.status === 'EXPIRING' ? $t('scm.qualification.expiring') : $t('scm.qualification.expired') }}
          </a-tag>
        </template>
        <template #action="{ record }">
          <a-link @click="openDrawer(record as unknown as SupplierQualification)">{{ $t('common.edit') }}</a-link>
        </template>
      </MTable>
    </a-card>

    <a-drawer v-model:visible="drawerVisible" :title="t('scm.qualification.lbl1592')" :width="480" @cancel="drawerVisible = false">
      <MForm :schema="formSchema" v-model="formData" :loading="saving" :submit-text="$t('scm.qualification.index.保存')" @submit="handleSave" @cancel="drawerVisible = false" />
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
import { scmApi, type SupplierQualification } from '@/api/scm'

const loading = ref(false)
const tableData = ref<any[]>([])
const total = ref(0)
const query = reactive({ supplierId: '', status: '', page: 1, pageSize: 20 })

const columns: MTableColumn[] = [
  { key: 'supplierName', title: t('scm.qualification.index.供应商'), dataIndex: 'supplierName', width: 150 },
  { key: 'certType', title: t('scm.qualification.index.资质类型'), dataIndex: 'certType', width: 130 },
  { key: 'certNo', title: t('scm.qualification.index.证书编号'), dataIndex: 'certNo', width: 140 },
  { key: 'issueDate', title: t('scm.qualification.index.颁发日期'), dataIndex: 'issueDate', width: 120 },
  { key: 'expiryDate', title: t('scm.qualification.index.到期日期'), dataIndex: 'expiryDate', width: 120 },
  { key: 'status', title: t('scm.qualification.index.状态'), slotName: 'status', width: 100 },
  { key: 'action', title: t('scm.qualification.index.操作'), slotName: 'action', width: 80 },
]

const formSchema: MFormField[] = [
  { field: 'supplierId', label: t('scm.qualification.lbl1593'), type: 'supplier-select', required: true },
  { field: 'certType', label: t('scm.qualification.lbl1594'), type: 'input', required: true, props: { placeholder: t('scm.qualification.r33061') } },
  { field: 'certNo', label: t('scm.qualification.lbl1595'), type: 'input' },
  { field: 'issueDate', label: t('scm.qualification.lbl1596'), type: 'date' },
  { field: 'expiryDate', label: t('scm.qualification.lbl1597'), type: 'date', required: true },
]

async function loadData() {
  loading.value = true
  try {
    const params: Record<string, unknown> = { page: query.page, pageSize: query.pageSize }
    if (query.supplierId) params.supplierId = query.supplierId
    if (query.status) params.status = query.status
    const res = await scmApi.getQualifications(params)
    tableData.value = (res.list ?? []) as any[]
    total.value = res.total ?? 0
  } catch { tableData.value = [] } finally { loading.value = false }
}

function resetQuery() { query.supplierId = ''; query.status = ''; query.page = 1; loadData() }
function onTableChange(e: { page: number; pageSize: number }) { query.page = e.page; query.pageSize = e.pageSize; loadData() }

const drawerVisible = ref(false)
const saving = ref(false)
const editing = ref<SupplierQualification | null>(null)
const formData = ref<Record<string, unknown>>({})

function openDrawer(item: SupplierQualification | null) {
  editing.value = item
  formData.value = item ? { ...item } : {}
  drawerVisible.value = true
}

async function handleSave(data: Record<string, unknown>) {
  saving.value = true
  try {
    if (editing.value) { await scmApi.updateQualification(editing.value.id, data); Message.success(t('scm.更新成功')) }
    else { await scmApi.createQualification(data); Message.success(t('scm.创建成功')) }
    drawerVisible.value = false
    loadData()
  } catch { /* handled */ } finally { saving.value = false }
}

onMounted(loadData)
</script>

<style scoped>
.page-container { padding: 16px; }
</style>
