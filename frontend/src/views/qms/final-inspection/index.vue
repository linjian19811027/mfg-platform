<template>
  <div class="page-container">
    <a-card :bordered="false" style="margin-bottom: 16px">
      <a-space wrap>
        <a-select v-model="query.inspectionType" :placeholder="$t('qms.final-inspection.index.检验类型')" allow-clear style="width: 140px">
          <a-option value="FQC">成品检验(FQC)</a-option>
          <a-option value="OQC">出货检验(OQC)</a-option>
        </a-select>
        <a-select v-model="query.status" :placeholder="$t('common.status')" allow-clear style="width: 120px">
          <a-option value="pending">待检</a-option>
          <a-option value="in_progress">检验中</a-option>
          <a-option value="passed">合格</a-option>
          <a-option value="failed">不合格</a-option>
        </a-select>
        <a-button type="primary" @click="loadData">{{ $t('common.search') }}</a-button>
        <a-button @click="resetQuery">{{ $t('common.reset') }}</a-button>
      </a-space>
      <template #extra>
        <a-button type="primary" @click="openDrawer(null)">新建检验任务</a-button>
      </template>
    </a-card>

    <a-card :bordered="false">
      <MTable :columns="columns" :data="tableData" :loading="loading" :total="total" :page-size="20" @change="onTableChange">
        <template #status="{ record }">
          <a-tag :color="statusColor(record.status as string)">{{ statusLabel(record.status as string) }}</a-tag>
        </template>
        <template #action="{ record }">
          <a-space>
            <a-link v-if="record.status === 'pending' || record.status === 'in_progress'" @click="openResultModal(record as Record<string, unknown>)">录入结果</a-link>
          </a-space>
        </template>
      </MTable>
    </a-card>

    <!-- 新建抽屉 -->
    <a-drawer v-model:visible="drawerVisible" :title="$t('qms.final-inspection.index.新建检验任务')" :width="480" @cancel="drawerVisible = false">
      <MForm :schema="formSchema" v-model="formData" :loading="saving" :submit-text="$t('qms.final-inspection.index.创建')" @submit="handleCreate" @cancel="drawerVisible = false" />
    </a-drawer>

    <!-- 录入结果弹窗 -->
    <a-modal v-model:visible="resultModalVisible" :title="$t('qms.final-inspection.index.录入检验结果')" :ok-loading="submitting" @ok="handleSubmitResult" @cancel="resultModalVisible = false">
      <a-form layout="vertical">
        <a-form-item :label="$t('qms.final-inspection.index.检验结果')" required>
          <a-radio-group v-model="resultForm.result">
            <a-radio value="PASS"><a-tag color="green">合格</a-tag></a-radio>
            <a-radio value="FAIL"><a-tag color="red">不合格</a-tag></a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item :label="$t('common.remark')">
          <a-textarea v-model="resultForm.remark" :auto-size="{ minRows: 2 }" />
        </a-form-item>
      </a-form>
    </a-modal>
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
import { qmsApi } from '@/api/qms'

const loading = ref(false)
const tableData = ref<any[]>([])
const total = ref(0)
const query = reactive({ inspectionType: '', status: '', page: 1, pageSize: 20 })

const columns: MTableColumn[] = [
  { key: 'materialName', title: t('qms.final-inspection.index.物料名称'), dataIndex: 'materialName', width: 160 },
  { key: 'batchId', title: t('qms.final-inspection.index.批次号'), dataIndex: 'batchId', width: 120 },
  { key: 'inspectionType', title: t('qms.final-inspection.index.检验类型'), dataIndex: 'inspectionType', width: 120 },
  { key: 'status', title: t('qms.final-inspection.index.状态'), slotName: 'status', width: 100 },
  { key: 'inspectorId', title: t('qms.final-inspection.index.检验员'), dataIndex: 'inspectorId', width: 110 },
  { key: 'createdAt', title: t('qms.final-inspection.index.创建时间'), dataIndex: 'createdAt', width: 160 },
  { key: 'action', title: t('qms.final-inspection.index.操作'), slotName: 'action', width: 100 },
]

const formSchema: MFormField[] = [
  { field: 'materialId', label: '物料ID', type: 'input', required: true },
  { field: 'batchId', label: '批次号', type: 'input' },
  { field: 'inspectionType', label: '检验类型', type: 'select', required: true, options: [
    { label: '成品检验(FQC)', value: 'FQC' }, { label: '出货检验(OQC)', value: 'OQC' },
  ]},
  { field: 'standardId', label: '检验标准ID', type: 'input' },
]

function statusColor(s: string) {
  if (s === 'passed') return 'green'
  if (s === 'failed') return 'red'
  if (s === 'in_progress') return 'orange'
  return 'gray'
}
function statusLabel(s: string) {
  const m: Record<string, string> = { pending: '待检', in_progress: '检验中', passed: '合格', failed: '不合格' }
  return m[s] ?? s
}

async function loadData() {
  loading.value = true
  try {
    const params: Record<string, unknown> = { page: query.page, pageSize: query.pageSize }
    if (query.inspectionType) params.inspectionType = query.inspectionType
    if (query.status) params.status = query.status
    const res = await qmsApi.getInspections(params)
    tableData.value = (res.list ?? []).filter(r => r.inspectionType === 'FQC' || r.inspectionType === 'OQC') as any[]
    total.value = res.total ?? 0
  } catch { tableData.value = [] } finally { loading.value = false }
}

function resetQuery() { query.inspectionType = ''; query.status = ''; query.page = 1; loadData() }
function onTableChange(e: { page: number; pageSize: number }) { query.page = e.page; query.pageSize = e.pageSize; loadData() }

const drawerVisible = ref(false)
const saving = ref(false)
const formData = ref<Record<string, unknown>>({})
function openDrawer(_item: null) { formData.value = {}; drawerVisible.value = true }
async function handleCreate(data: Record<string, unknown>) {
  saving.value = true
  try {
    await qmsApi.createFinalInspection(data)
    Message.success('创建成功')
    drawerVisible.value = false
    loadData()
  } catch { /* handled */ } finally { saving.value = false }
}

const resultModalVisible = ref(false)
const submitting = ref(false)
const currentId = ref('')
const resultForm = reactive({ result: 'PASS', remark: '' })
function openResultModal(record: Record<string, unknown>) { currentId.value = record.id as string; resultForm.result = 'PASS'; resultForm.remark = ''; resultModalVisible.value = true }
async function handleSubmitResult() {
  submitting.value = true
  try {
    await qmsApi.submitResult(currentId.value, { result: resultForm.result as 'PASS' | 'FAIL' })
    Message.success('结果录入成功')
    resultModalVisible.value = false
    loadData()
  } catch { /* handled */ } finally { submitting.value = false }
}

onMounted(loadData)
</script>

<style scoped>
.page-container { padding: 16px; }
</style>
