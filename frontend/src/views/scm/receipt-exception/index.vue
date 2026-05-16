<template>
  <div class="page-container">
    <a-card :bordered="false" style="margin-bottom: 16px">
      <a-space wrap>
        <a-select v-model="query.status" :placeholder="$t('common.status')" allow-clear style="width: 130px">
          <a-option value="OPEN">{{ $t('scm.receipt-exception.lbl1598') }}</a-option>
          <a-option value="PROCESSING">{{ $t('scm.receipt-exception.lbl1599') }}</a-option>
          <a-option value="CLOSED">{{ $t('scm.receipt-exception.closed') }}</a-option>
        </a-select>
        <a-button type="primary" @click="loadData">{{ $t('common.search') }}</a-button>
        <a-button @click="resetQuery">{{ $t('common.reset') }}</a-button>
      </a-space>
      <template #extra>
        <a-button type="primary" @click="openDrawer(null)">{{ $t('scm.receipt-exception.lbl1600') }}</a-button>
      </template>
    </a-card>

    <a-card :bordered="false">
      <MTable :columns="columns" :data="tableData" :loading="loading" :total="total" :page-size="20" @change="onTableChange">
        <template #status="{ record }">
          <a-tag :color="record.status === 'CLOSED' ? 'green' : record.status === 'PROCESSING' ? 'orange' : 'red'">
            {{ record.status === 'CLOSED' ? t('scm.receipt-exception.r33062') : record.status === 'PROCESSING' ? $t('scm.receipt-exception.lbl1601') : $t('scm.receipt-exception.lbl1602') }}
          </a-tag>
        </template>
        <template #action="{ record }">
          <a-space>
            <a-link v-if="record.status === 'OPEN'" @click="openDrawer(record as unknown as ReceiptException)">{{ $t('scm.receipt-exception.lbl1603') }}</a-link>
            <a-popconfirm v-if="record.status === 'PROCESSING'" :content="$t('scm.receipt-exception.index.确认关闭该异常')" @ok="handleClose(record.id as string)">
              <a-link>{{ $t('scm.receipt-exception.close') }}</a-link>
            </a-popconfirm>
          </a-space>
        </template>
      </MTable>
    </a-card>

    <a-drawer v-model:visible="drawerVisible" ::title="t('scm.receipt-exception.lbl1604')" :width="520" @cancel="drawerVisible = false">
      <MForm :schema="formSchema" v-model="formData" :loading="saving" :submit-text="$t('scm.receipt-exception.index.保存')" @submit="handleSave" @cancel="drawerVisible = false" />
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
import { scmApi, type ReceiptException } from '@/api/scm'

const loading = ref(false)
const tableData = ref<any[]>([])
const total = ref(0)
const query = reactive({ status: '', page: 1, pageSize: 20 })

const columns: MTableColumn[] = [
  { key: 'exceptionType', title: t('scm.receipt-exception.index.异常类型'), dataIndex: 'exceptionType', width: 130 },
  { key: 'description', title: t('scm.receipt-exception.index.描述'), dataIndex: 'description', width: 200, ellipsis: true },
  { key: 'status', title: t('scm.receipt-exception.index.状态'), slotName: 'status', width: 100 },
  { key: 'createdAt', title: t('scm.receipt-exception.index.创建时间'), dataIndex: 'createdAt', width: 160 },
  { key: 'action', title: t('scm.receipt-exception.index.操作'), slotName: 'action', width: 120 },
]

const formSchema: MFormField[] = [
  { field: 'exceptionType', label: t('scm.receipt-exception.lbl1605'), type: 'select', required: true, options: [
    { label: t('scm.receipt-exception.lbl1606'), value: 'QTY_MISMATCH' }, { label: t('scm.receipt-exception.lbl1607'), value: 'QUALITY_ISSUE' },
    { label: t('scm.receipt-exception.lbl1608'), value: 'PACKAGING_DAMAGE' }, { label: t('scm.receipt-exception.lbl1609'), value: 'OTHER' },
  ]},
  { field: 'description', label: t('scm.receipt-exception.lbl1610'), type: 'textarea', required: true, props: { autoSize: { minRows: 3 } } },
  { field: 'handling', label: t('scm.receipt-exception.lbl1611'), type: 'textarea', props: { autoSize: { minRows: 2 } } },
]

async function loadData() {
  loading.value = true
  try {
    const params: Record<string, unknown> = { page: query.page, pageSize: query.pageSize }
    if (query.status) params.status = query.status
    const res = await scmApi.getReceiptExceptions(params)
    tableData.value = (res.list ?? []) as any[]
    total.value = res.total ?? 0
  } catch { tableData.value = [] } finally { loading.value = false }
}

function resetQuery() { query.status = ''; query.page = 1; loadData() }
function onTableChange(e: { page: number; pageSize: number }) { query.page = e.page; query.pageSize = e.pageSize; loadData() }

const drawerVisible = ref(false)
const saving = ref(false)
const editing = ref<ReceiptException | null>(null)
const formData = ref<Record<string, unknown>>({})

function openDrawer(item: ReceiptException | null) {
  editing.value = item
  formData.value = item ? { ...item } : {}
  drawerVisible.value = true
}

async function handleSave(data: Record<string, unknown>) {
  saving.value = true
  try {
    if (editing.value) { await scmApi.processException(editing.value.id, data); Message.success(t('scm.处理成功')) }
    else { await scmApi.createReceiptException(data); Message.success(t('scm.创建成功')) }
    drawerVisible.value = false
    loadData()
  } catch { /* handled */ } finally { saving.value = false }
}

async function handleClose(id: string) {
  try { await scmApi.closeException(id); Message.success(t('scm.已关闭')); loadData() }
  catch { /* handled */ }
}

onMounted(loadData)
</script>

<style scoped>
.page-container { padding: 16px; }
</style>
