<template>
  <div class="page-container">
    <a-card :bordered="false" style="margin-bottom: 16px">
      <a-space wrap>
        <a-select v-model="query.status" :placeholder="$t('common.status')" allow-clear style="width: 130px">
          <a-option value="INITIATED">{{ $t('qms.recall.lbl1521') }}</a-option>
          <a-option value="IN_PROGRESS">{{ $t('qms.recall.lbl1522') }}</a-option>
          <a-option value="COMPLETED">{{ $t('qms.recall.completed') }}</a-option>
          <a-option value="CANCELLED">{{ $t('qms.recall.lbl1523') }}</a-option>
        </a-select>
        <a-button type="primary" @click="loadData">{{ $t('common.search') }}</a-button>
        <a-button @click="resetQuery">{{ $t('common.reset') }}</a-button>
      </a-space>
      <template #extra>
        <a-button type="primary" @click="openDrawer(null)">{{ $t('qms.recall.lbl1524') }}</a-button>
      </template>
    </a-card>

    <a-card :bordered="false">
      <MTable :columns="columns" :data="tableData" :loading="loading" :total="total" :page-size="20" @change="onTableChange">
        <template #status="{ record }">
          <a-tag :color="record.status === 'IN_PROGRESS' ? 'red' : record.status === 'COMPLETED' ? 'green' : 'blue'">
            {{ record.status === 'IN_PROGRESS' ? t('qms.recall.r33051') : record.status === 'COMPLETED' ? t('qms.recall.r33052') : record.status === 'CANCELLED' ? $t('qms.recall.lbl1525') : $t('qms.recall.lbl1526') }}
          </a-tag>
        </template>
        <template #action="{ record }">
          <a-link @click="openDrawer(record as unknown as Recall)">{{ $t('common.edit') }}</a-link>
        </template>
      </MTable>
    </a-card>

    <a-drawer v-model:visible="drawerVisible" ::title="t('qms.recall.lbl1527')" :width="520" @cancel="drawerVisible = false">
      <MForm :schema="formSchema" v-model="formData" :loading="saving" :submit-text="$t('qms.recall.index.保存')" @submit="handleSave" @cancel="drawerVisible = false" />
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
import { qmsApi, type Recall } from '@/api/qms'

const loading = ref(false)
const tableData = ref<any[]>([])
const total = ref(0)
const query = reactive({ status: '', page: 1, pageSize: 20 })

const columns: MTableColumn[] = [
  { key: 'recallNo', title: t('qms.recall.index.召回编号'), dataIndex: 'recallNo', width: 140 },
  { key: 'title', title: t('qms.recall.index.召回标题'), dataIndex: 'title', width: 200, ellipsis: true },
  { key: 'materialId', title: t('qms.recall.index.物料'), dataIndex: 'materialName', width: 120 },
  { key: 'affectedBatches', title: t('qms.recall.index.涉及批次'), dataIndex: 'affectedBatches', width: 150 },
  { key: 'status', title: t('qms.recall.index.状态'), slotName: 'status', width: 100 },
  { key: 'createdAt', title: t('qms.recall.index.发起时间'), dataIndex: 'createdAt', width: 170 },
  { key: 'action', title: t('qms.recall.index.操作'), slotName: 'action', width: 80 },
]

const formSchema: MFormField[] = [
  { field: 'recallNo', label: t('qms.recall.lbl1528'), type: 'input', required: true },
  { field: 'title', label: t('qms.recall.lbl1529'), type: 'input', required: true },
  { field: 'materialId', label: t('qms.recall.material'), type: 'material-select', required: true },
  { field: 'affectedBatches', label: t('qms.recall.lbl1530'), type: 'textarea', required: true, props: { autoSize: { minRows: 2 } } },
  { field: 'recallReason', label: t('qms.recall.lbl1531'), type: 'textarea', props: { autoSize: { minRows: 3 } } },
]

async function loadData() {
  loading.value = true
  try {
    const params: Record<string, unknown> = { page: query.page, pageSize: query.pageSize }
    if (query.status) params.status = query.status
    const res = await qmsApi.getRecalls(params)
    tableData.value = (res.list ?? []) as any[]
    total.value = res.total ?? 0
  } catch { tableData.value = [] } finally { loading.value = false }
}

function resetQuery() { query.status = ''; query.page = 1; loadData() }
function onTableChange(e: { page: number; pageSize: number }) { query.page = e.page; query.pageSize = e.pageSize; loadData() }

const drawerVisible = ref(false)
const saving = ref(false)
const editing = ref<Recall | null>(null)
const formData = ref<Record<string, unknown>>({})

function openDrawer(item: Recall | null) {
  editing.value = item
  formData.value = item ? { ...item } : { status: 'DRAFT' }
  drawerVisible.value = true
}

async function handleSave(data: Record<string, unknown>) {
  saving.value = true
  try {
    if (editing.value) { await qmsApi.updateRecall(editing.value.id, data); Message.success(t('qms.更新成功')) }
    else { await qmsApi.createRecall(data); Message.success(t('qms.创建成功')) }
    drawerVisible.value = false
    loadData()
  } catch { /* handled */ } finally { saving.value = false }
}

onMounted(loadData)
</script>

<style scoped>
.page-container { padding: 16px; }
</style>
