<template>
  <div class="page-container">
    <a-card :bordered="false" style="margin-bottom: 16px">
      <a-space wrap>
        <a-select v-model="query.status" :placeholder="$t('common.status')" allow-clear style="width: 130px">
          <a-option value="DRAFT">草稿</a-option>
          <a-option value="ACTIVE">执行中</a-option>
          <a-option value="COMPLETED">已完成</a-option>
        </a-select>
        <a-button type="primary" @click="loadData">{{ $t('common.search') }}</a-button>
        <a-button @click="resetQuery">{{ $t('common.reset') }}</a-button>
      </a-space>
      <template #extra>
        <a-button type="primary" @click="openDrawer(null)">新建召回</a-button>
      </template>
    </a-card>

    <a-card :bordered="false">
      <MTable :columns="columns" :data="tableData" :loading="loading" :total="total" :page-size="20" @change="onTableChange">
        <template #status="{ record }">
          <a-tag :color="record.status === 'ACTIVE' ? 'red' : record.status === 'COMPLETED' ? 'green' : 'gray'">
            {{ record.status === 'ACTIVE' ? '执行中' : record.status === 'COMPLETED' ? '已完成' : '草稿' }}
          </a-tag>
        </template>
        <template #recoveryRate="{ record }">
          <span v-if="record.affectedQty">
            {{ (((record.recoveredQty as number || 0) / (record.affectedQty as number)) * 100).toFixed(1) }}%
          </span>
          <span v-else>-</span>
        </template>
        <template #action="{ record }">
          <a-link @click="openDrawer(record as unknown as Recall)">{{ $t('common.edit') }}</a-link>
        </template>
      </MTable>
    </a-card>

    <a-drawer v-model:visible="drawerVisible" :title="editing ? '编辑召回' : '新建召回'" :width="520" @cancel="drawerVisible = false">
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
  { key: 'code', title: t('qms.recall.index.召回编号'), dataIndex: 'code', width: 130 },
  { key: 'materialId', title: t('qms.recall.index.物料'), dataIndex: 'materialCode', width: 130 },
  { key: 'reason', title: t('qms.recall.index.召回原因'), dataIndex: 'reason', width: 200, ellipsis: true },
  { key: 'affectedQty', title: t('qms.recall.index.影响数量'), dataIndex: 'affectedQty', width: 100 },
  { key: 'recoveredQty', title: t('qms.recall.index.已回收'), dataIndex: 'recoveredQty', width: 100 },
  { key: 'recoveryRate', title: t('qms.recall.index.回收率'), slotName: 'recoveryRate', width: 90 },
  { key: 'status', title: t('qms.recall.index.状态'), slotName: 'status', width: 100 },
  { key: 'action', title: t('qms.recall.index.操作'), slotName: 'action', width: 80 },
]

const formSchema: MFormField[] = [
  { field: 'code', label: '召回编号', type: 'input', required: true },
  { field: 'materialId', label: '物料ID', type: 'input' },
  { field: 'batchIds', label: '批次号（逗号分隔）', type: 'textarea', props: { autoSize: { minRows: 2 } } },
  { field: 'reason', label: '召回原因', type: 'textarea', required: true, props: { autoSize: { minRows: 3 } } },
  { field: 'affectedQty', label: '影响数量', type: 'number', props: { min: 0 } },
  { field: 'recoveredQty', label: '已回收数量', type: 'number', props: { min: 0 } },
  { field: 'status', label: '状态', type: 'select', options: [
    { label: '草稿', value: 'DRAFT' }, { label: '执行中', value: 'ACTIVE' }, { label: '已完成', value: 'COMPLETED' },
  ]},
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
    if (editing.value) { await qmsApi.updateRecall(editing.value.id, data); Message.success('更新成功') }
    else { await qmsApi.createRecall(data); Message.success('创建成功') }
    drawerVisible.value = false
    loadData()
  } catch { /* handled */ } finally { saving.value = false }
}

onMounted(loadData)
</script>

<style scoped>
.page-container { padding: 16px; }
</style>
