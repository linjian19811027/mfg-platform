<template>
  <div class="page-container">
    <a-card :bordered="false" style="margin-bottom: 16px">
      <a-space wrap>
        <a-input v-model="query.keyword" :placeholder="$t('wms.barcode-rule.index.编码名称')" allow-clear style="width: 200px" @keyup.enter="loadData" />
        <a-select v-model="query.status" :placeholder="$t('common.status')" allow-clear style="width: 120px">
          <a-option value="ACTIVE">启用</a-option>
          <a-option value="INACTIVE">停用</a-option>
        </a-select>
        <a-button type="primary" @click="loadData">{{ $t('common.search') }}</a-button>
        <a-button @click="resetQuery">{{ $t('common.reset') }}</a-button>
      </a-space>
      <template #extra>
        <a-button type="primary" @click="openDrawer(null)">新建条码规则</a-button>
      </template>
    </a-card>

    <a-card :bordered="false">
      <MTable :columns="columns" :data="tableData" :loading="loading" :total="total" :page-size="20" @change="onTableChange">
        <template #status="{ record }">
          <a-tag :color="record.status === 'ACTIVE' ? 'green' : 'gray'">{{ record.status === 'ACTIVE' ? '启用' : '停用' }}</a-tag>
        </template>
        <template #action="{ record }">
          <a-link @click="openDrawer(record as unknown as BarcodeRule)">{{ $t('common.edit') }}</a-link>
        </template>
      </MTable>
    </a-card>

    <a-drawer v-model:visible="drawerVisible" :title="editing ? '编辑条码规则' : '新建条码规则'" :width="520" @cancel="drawerVisible = false">
      <MForm :schema="formSchema" v-model="formData" :loading="saving" :submit-text="$t('wms.barcode-rule.index.保存')" @submit="handleSave" @cancel="drawerVisible = false" />
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
import { wmsApi, type BarcodeRule } from '@/api/wms'

const loading = ref(false)
const tableData = ref<any[]>([])
const total = ref(0)
const query = reactive({ keyword: '', status: '', page: 1, pageSize: 20 })

const columns: MTableColumn[] = [
  { key: 'code', title: t('wms.barcode-rule.index.规则编码'), dataIndex: 'code', width: 130 },
  { key: 'name', title: t('wms.barcode-rule.index.规则名称'), dataIndex: 'name', width: 160 },
  { key: 'objectType', title: t('wms.barcode-rule.index.对象类型'), dataIndex: 'objectType', width: 110 },
  { key: 'pattern', title: t('wms.barcode-rule.index.条码模板'), dataIndex: 'pattern', width: 200, ellipsis: true },
  { key: 'status', title: t('wms.barcode-rule.index.状态'), slotName: 'status', width: 90 },
  { key: 'action', title: t('wms.barcode-rule.index.操作'), slotName: 'action', width: 80 },
]

const formSchema: MFormField[] = [
  { field: 'code', label: '规则编码', type: 'input', required: true },
  { field: 'name', label: '规则名称', type: 'input', required: true },
  { field: 'objectType', label: '对象类型', type: 'select', required: true, options: [
    { label: '物料批次', value: 'BATCH' }, { label: '容器', value: 'CONTAINER' },
    { label: '货位', value: 'LOCATION' }, { label: '其他', value: 'OTHER' },
  ]},
  { field: 'pattern', label: '条码模板', type: 'input', required: true, placeholder: '如 {PREFIX}{DATE}{SEQ6}' },
  { field: 'status', label: '状态', type: 'select', required: true, options: [{ label: '启用', value: 'ACTIVE' }, { label: '停用', value: 'INACTIVE' }] },
]

async function loadData() {
  loading.value = true
  try {
    const params: Record<string, unknown> = { page: query.page, pageSize: query.pageSize }
    if (query.keyword) params.keyword = query.keyword
    if (query.status) params.status = query.status
    const res = await wmsApi.getBarcodeRules(params)
    tableData.value = (res.list ?? []) as any[]
    total.value = res.total ?? 0
  } catch { tableData.value = [] } finally { loading.value = false }
}

function resetQuery() { query.keyword = ''; query.status = ''; query.page = 1; loadData() }
function onTableChange(e: { page: number; pageSize: number }) { query.page = e.page; query.pageSize = e.pageSize; loadData() }

const drawerVisible = ref(false)
const saving = ref(false)
const editing = ref<BarcodeRule | null>(null)
const formData = ref<Record<string, unknown>>({})

function openDrawer(rule: BarcodeRule | null) {
  editing.value = rule
  formData.value = rule ? { ...rule } : { status: 'ACTIVE' }
  drawerVisible.value = true
}

async function handleSave(data: Record<string, unknown>) {
  saving.value = true
  try {
    if (editing.value) { await wmsApi.updateBarcodeRule(editing.value.id, data); Message.success('更新成功') }
    else { await wmsApi.createBarcodeRule(data); Message.success('创建成功') }
    drawerVisible.value = false
    loadData()
  } catch { /* handled */ } finally { saving.value = false }
}

onMounted(loadData)
</script>

<style scoped>
.page-container { padding: 16px; }
</style>
