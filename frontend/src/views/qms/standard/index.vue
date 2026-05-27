<template>
  <div class="page-container">
    <a-card :bordered="false" style="margin-bottom: 16px">
      <a-space wrap>
        <a-input v-model="query.keyword" :placeholder="$t('qms.standard.index.标准编码名称')" allow-clear style="width: 200px" @keyup.enter="loadData" />
        <a-select v-model="query.inspectionType" :placeholder="$t('qms.standard.index.检验类型')" allow-clear style="width: 130px">
          <a-option value="IQC">{{ $t('qms.standard.lbl1532') }}</a-option>
          <a-option value="IPQC">{{ $t('qms.standard.lbl1533') }}</a-option>
          <a-option value="FQC">{{ $t('qms.standard.lbl1534') }}</a-option>
          <a-option value="OQC">{{ $t('qms.standard.lbl1535') }}</a-option>
        </a-select>
        <a-select v-model="query.status" :placeholder="$t('common.status')" allow-clear style="width: 120px">
          <a-option value="ACTIVE">{{ $t('qms.standard.enable') }}</a-option>
          <a-option value="INACTIVE">{{ $t('qms.standard.disable') }}</a-option>
        </a-select>
        <a-button type="primary" @click="loadData">{{ $t('common.search') }}</a-button>
        <a-button @click="resetQuery">{{ $t('common.reset') }}</a-button>
      </a-space>
      <template #extra>
        <a-button type="primary" @click="openDrawer(null)">{{ $t('qms.standard.lbl1536') }}</a-button>
      </template>
    </a-card>

    <a-card :bordered="false">
      <MTable :columns="columns" :data="tableData" :loading="loading" :total="total" :page-size="20" @change="onTableChange">
        <template #status="{ record }">
          <a-tag :color="record.status === 'ACTIVE' ? 'green' : 'gray'">{{ record.status === 'ACTIVE' ? $t('qms.standard.enable') : $t('qms.standard.disable') }}</a-tag>
        </template>
        <template #action="{ record }">
          <a-space>
            <a-link @click="openDetailDrawer(record as unknown as InspectionStandard)">{{ $t('qms.standard.lbl1537') }}</a-link>
            <a-link @click="openDrawer(record as unknown as InspectionStandard)">{{ $t('common.edit') }}</a-link>
          </a-space>
        </template>
      </MTable>
    </a-card>

    <!-- 新建/编辑抽屉 -->
    <a-drawer v-model:visible="drawerVisible" :title="t('qms.standard.lbl1538')" :width="520" @cancel="drawerVisible = false">
      <MForm :schema="formSchema" v-model="formData" :loading="saving" :submit-text="$t('qms.standard.index.保存')" @submit="handleSave" @cancel="drawerVisible = false" />
    </a-drawer>

    <!-- 详情/版本历史抽屉 -->
    <a-drawer v-model:visible="detailDrawerVisible" :title="t('qms.standard.lbl1539')" :width="640" @cancel="detailDrawerVisible = false">
      <template v-if="currentStd">
        <a-descriptions :column="2" bordered style="margin-bottom: 16px">
          <a-descriptions-item :label="$t('common.code')">{{ currentStd.code }}</a-descriptions-item>
          <a-descriptions-item :label="$t('qms.standard.index.版本')">{{ currentStd.version ?? 'V1.0' }}</a-descriptions-item>
          <a-descriptions-item :label="$t('qms.standard.index.检验类型')">{{ currentStd.inspectionType }}</a-descriptions-item>
          <a-descriptions-item :label="$t('common.status')">
            <a-tag :color="currentStd.status === 'ACTIVE' ? 'green' : 'gray'">{{ currentStd.status === 'ACTIVE' ? $t('qms.standard.enable') : $t('qms.standard.disable') }}</a-tag>
          </a-descriptions-item>
        </a-descriptions>

        <div style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center">
          <span style="font-weight: 500">{{ $t('qms.standard.lbl1540') }}</span>
          <a-button size="small" type="primary" @click="openVersionModal">{{ $t('qms.standard.lbl1541') }}</a-button>
        </div>
        <a-table :columns="itemColumns" :data="currentStd.items ?? []" :pagination="false" row-key="id" size="small" />
      </template>
    </a-drawer>

    <!-- 发布新版本弹窗 -->
    <a-modal v-model:visible="versionModalVisible" :title="$t('qms.standard.index.发布新版本')" :ok-loading="versioning" @ok="handleNewVersion" @cancel="versionModalVisible = false">
      <a-form :model="{versionReason}" layout="vertical">
        <a-form-item :label="$t('qms.standard.index.变更说明')">
          <a-textarea v-model="versionReason" :auto-size="{ minRows: 3 }" :placeholder="$t('qms.standard.index.请描述本次版本变更内容')" />
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
import { qmsApi, type InspectionStandard } from '@/api/qms'

const loading = ref(false)
const tableData = ref<any[]>([])
const total = ref(0)
const query = reactive({ keyword: '', inspectionType: '', status: '', page: 1, pageSize: 20 })

const columns: MTableColumn[] = [
  { key: 'code', title: t('qms.standard.index.标准编码'), dataIndex: 'code', width: 130 },
  { key: 'name', title: t('qms.standard.index.标准名称'), dataIndex: 'name', width: 180 },
  { key: 'inspectionType', title: t('qms.standard.index.检验类型'), dataIndex: 'inspectionType', width: 110 },
  { key: 'version', title: t('qms.standard.index.版本'), dataIndex: 'version', width: 90 },
  { key: 'status', title: t('qms.standard.index.状态'), slotName: 'status', width: 90 },
  { key: 'createdAt', title: t('qms.standard.index.创建时间'), dataIndex: 'createdAt', width: 160 },
  { key: 'action', title: t('qms.standard.index.操作'), slotName: 'action', width: 150 },
]

const itemColumns = [
  { title: t('qms.standard.index.检验项目'), dataIndex: 'name', width: 160 },
  { title: t('qms.standard.index.检验方法'), dataIndex: 'method', width: 120 },
  { title: t('qms.standard.index.下限'), dataIndex: 'lowerLimit', width: 90 },
  { title: t('qms.standard.index.上限'), dataIndex: 'upperLimit', width: 90 },
  { title: t('qms.standard.index.单位'), dataIndex: 'unit', width: 80 },
]

const formSchema: MFormField[] = [
  { field: 'code', label: t('qms.standard.lbl1542'), type: 'input', required: true },
  { field: 'name', label: t('qms.standard.lbl1543'), type: 'input', required: true },
  { field: 'inspectionType', label: t('qms.standard.lbl1544'), type: 'select', required: true, options: [
    { label: t('qms.standard.lbl1545'), value: 'IQC' }, { label: t('qms.standard.lbl1546'), value: 'IPQC' },
    { label: t('qms.standard.lbl1547'), value: 'FQC' }, { label: t('qms.standard.lbl1548'), value: 'OQC' },
  ]},
  { field: 'materialId', label: t('qms.standard.lbl1549'), type: 'material-select' },
  { field: 'status', label: t('qms.standard.status'), type: 'select', options: [{ label: t('qms.standard.enable'), value: 'ACTIVE' }, { label: t('qms.standard.disable'), value: 'INACTIVE' }] },
]

async function loadData() {
  loading.value = true
  try {
    const params: Record<string, unknown> = { page: query.page, pageSize: query.pageSize }
    if (query.keyword) params.keyword = query.keyword
    if (query.inspectionType) params.inspectionType = query.inspectionType
    if (query.status) params.status = query.status
    const res = await qmsApi.getStandards(params)
    tableData.value = (res.list ?? []) as any[]
    total.value = res.total ?? 0
  } catch { tableData.value = [] } finally { loading.value = false }
}

function resetQuery() { query.keyword = ''; query.inspectionType = ''; query.status = ''; query.page = 1; loadData() }
function onTableChange(e: { page: number; pageSize: number }) { query.page = e.page; query.pageSize = e.pageSize; loadData() }

const drawerVisible = ref(false)
const saving = ref(false)
const editing = ref<InspectionStandard | null>(null)
const formData = ref<Record<string, unknown>>({})

function openDrawer(std: InspectionStandard | null) {
  editing.value = std
  formData.value = std ? { ...std } : { status: 'ACTIVE' }
  drawerVisible.value = true
}

async function handleSave(data: Record<string, unknown>) {
  saving.value = true
  try {
    await qmsApi.createStandard(data)
    Message.success(editing.value ? t('qms.standard.lbl1550') : t('qms.standard.lbl1551'))
    drawerVisible.value = false
    loadData()
  } catch { /* handled */ } finally { saving.value = false }
}

const detailDrawerVisible = ref(false)
const currentStd = ref<InspectionStandard | null>(null)
const versionModalVisible = ref(false)
const versioning = ref(false)
const versionReason = ref('')

async function openDetailDrawer(std: InspectionStandard) {
  detailDrawerVisible.value = true
  try {
    const detail = await qmsApi.getStandard(std.id)
    currentStd.value = detail
  } catch { currentStd.value = std }
}

function openVersionModal() { versionReason.value = ''; versionModalVisible.value = true }

async function handleNewVersion() {
  if (!currentStd.value) return
  versioning.value = true
  try {
    await qmsApi.createStandardVersion(currentStd.value.id, { changes: {}, reason: versionReason.value })
    Message.success(t('qms.新版本已发布'))
    versionModalVisible.value = false
    loadData()
  } catch { /* handled */ } finally { versioning.value = false }
}

onMounted(loadData)
</script>

<style scoped>
.page-container { padding: 16px; }
</style>
