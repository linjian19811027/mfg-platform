<template>
  <div class="page-container">
    <a-card :bordered="false" style="margin-bottom: 16px">
      <a-space wrap>
        <a-select v-model="query.inspectionType" :placeholder="$t('qms.final-inspection.index.检验类型')" allow-clear style="width: 140px">
          <a-option value="FQC">{{ $t('qms.final-inspection.lbl1486') }}</a-option>
          <a-option value="OQC">{{ $t('qms.final-inspection.lbl1487') }}</a-option>
        </a-select>
        <a-select v-model="query.result" :placeholder="$t('qms.final-inspection.index.检验结果')" allow-clear style="width: 120px">
          <a-option value="PASS">{{ $t('qms.final-inspection.qualified') }}</a-option>
          <a-option value="FAIL">{{ $t('qms.final-inspection.unqualified') }}</a-option>
        </a-select>
        <a-button type="primary" @click="loadData">{{ $t('common.search') }}</a-button>
        <a-button @click="resetQuery">{{ $t('common.reset') }}</a-button>
      </a-space>
      <template #extra>
        <a-button type="primary" @click="openDrawer(null)">{{ $t('qms.final-inspection.lbl1488') }}</a-button>
      </template>
    </a-card>

    <a-card :bordered="false">
      <MTable :columns="columns" :data="tableData" :loading="loading" :total="total" :page-size="20" @change="onTableChange">
        <template #result="{ record }">
          <a-tag :color="resultColor(record.result as string)">{{ resultLabel(record.result as string) }}</a-tag>
        </template>
        <template #action="{ record }">
          <a-space>
            <a-link v-if="!record.result" @click="openResultModal(record as Record<string, unknown>)">{{ $t('qms.final-inspection.lbl1489') }}</a-link>
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
      <a-form :model="resultForm" layout="vertical">
        <a-form-item :label="$t('qms.final-inspection.index.检验结果')" required>
          <a-radio-group v-model="resultForm.result">
            <a-radio value="PASS"><a-tag color="green">{{ $t('qms.final-inspection.qualified') }}</a-tag></a-radio>
            <a-radio value="FAIL"><a-tag color="red">{{ $t('qms.final-inspection.unqualified') }}</a-tag></a-radio>
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
const query = reactive({ inspectionType: '', result: '', page: 1, pageSize: 20 })

const columns: MTableColumn[] = [
  { key: 'materialName', title: t('qms.final-inspection.index.物料名称'), dataIndex: 'materialName', width: 160 },
  { key: 'batchId', title: t('qms.final-inspection.index.批次号'), dataIndex: 'batchId', width: 120 },
  { key: 'inspectionType', title: t('qms.final-inspection.index.检验类型'), dataIndex: 'inspectionType', width: 120 },
  { key: 'result', title: t('qms.final-inspection.index.检验结果'), dataIndex: 'result', width: 100 },
  { key: 'inspectorId', title: t('qms.final-inspection.index.检验员'), dataIndex: 'inspectorId', width: 110 },
  { key: 'inspectionTime', title: t('qms.final-inspection.index.检验时间'), dataIndex: 'inspectionTime', width: 160 },
  { key: 'action', title: t('qms.final-inspection.index.操作'), slotName: 'action', width: 100 },
]

const formSchema: MFormField[] = [
  { field: 'materialId', label: t('qms.final-inspection.material'), type: 'material-select', required: true },
  { field: 'batchId', label: t('qms.final-inspection.lbl1490'), type: 'input' },
  { field: 'inspectionType', label: t('qms.final-inspection.lbl1491'), type: 'select', required: true, options: [
    { label: t('qms.final-inspection.lbl1492'), value: 'FQC' }, { label: t('qms.final-inspection.lbl1493'), value: 'OQC' },
  ]},
  { field: 'standardId', label: t('qms.final-inspection.lbl1494'), type: 'input' },
]

const resultColorMap: Record<string, string> = { PASS: 'green', FAIL: 'red' }
const resultLabelMap: Record<string, string> = { PASS: t('qms.final-inspection.qualified'), FAIL: t('qms.final-inspection.unqualified') }
const resultColor = (r: string) => resultColorMap[r] ?? 'gray'
const resultLabel = (r: string) => resultLabelMap[r] ?? r

async function loadData() {
  loading.value = true
  try {
    const params: Record<string, unknown> = { page: query.page, pageSize: query.pageSize }
    if (query.inspectionType) params.inspectionType = query.inspectionType
    if (query.result) params.result = query.result
    const res = await qmsApi.getInspections(params)
    tableData.value = (res.list ?? []).filter(r => r.inspectionType === 'FQC' || r.inspectionType === 'OQC') as any[]
    total.value = res.total ?? 0
  } catch { tableData.value = [] } finally { loading.value = false }
}

function resetQuery() { query.inspectionType = ''; query.result = ''; query.page = 1; loadData() }
function onTableChange(e: { page: number; pageSize: number }) { query.page = e.page; query.pageSize = e.pageSize; loadData() }

const drawerVisible = ref(false)
const saving = ref(false)
const formData = ref<Record<string, unknown>>({})
function openDrawer(_item: null) { formData.value = {}; drawerVisible.value = true }
async function handleCreate(data: Record<string, unknown>) {
  saving.value = true
  try {
    await qmsApi.createFinalInspection(data)
    Message.success(t('qms.创建成功'))
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
    Message.success(t('qms.结果录入成功'))
    resultModalVisible.value = false
    loadData()
  } catch { /* handled */ } finally { submitting.value = false }
}

onMounted(loadData)
</script>

<style scoped>
.page-container { padding: 16px; }
</style>
