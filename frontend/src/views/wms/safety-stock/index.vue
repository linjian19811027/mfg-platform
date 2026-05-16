<template>
  <div class="page-container">
    <a-card :bordered="false" style="margin-bottom: 16px">
      <a-space wrap>
        <a-input v-model="query.keyword" :placeholder="$t('wms.safety-stock.index.物料编码名称')" allow-clear style="width: 200px" @keyup.enter="loadData" />
        <a-select v-model="query.alertOnly" :placeholder="$t('wms.safety-stock.index.显示范围')" style="width: 130px">
          <a-option :value="false">{{ $t('wms.safety-stock.lbl1936') }}</a-option>
          <a-option :value="true">{{ $t('wms.safety-stock.lbl1937') }}</a-option>
        </a-select>
        <a-button type="primary" @click="loadData">{{ $t('common.search') }}</a-button>
        <a-button @click="resetQuery">{{ $t('common.reset') }}</a-button>
      </a-space>
      <template #extra>
        <a-button type="primary" @click="openDrawer(null)">{{ $t('wms.safety-stock.lbl1938') }}</a-button>
      </template>
    </a-card>

    <a-card :bordered="false">
      <MTable :columns="columns" :data="tableData" :loading="loading" :total="total" :page-size="20" @change="onTableChange">
        <template #alert="{ record }">
          <a-tag v-if="(record.currentQty as number) < (record.safetyQty as number)" color="red">
            {{ $t('wms.safety-stock.r33101', {toFixedn2n: ((record.safetyQty as number) - (record.currentQty as number)).toFixed(2)}) }}
          </a-tag>
          <a-tag v-else color="green">{{ $t('wms.safety-stock.normal') }}</a-tag>
        </template>
        <template #action="{ record }">
          <a-space>
            <a-link @click="openDrawer(record as unknown as SafetyStock)">{{ $t('common.edit') }}</a-link>
            <a-popconfirm :content="$t('wms.safety-stock.index.确认删除该安全库存设置')" @ok="handleDelete(record.id as string)">
              <a-link status="danger">{{ $t('common.delete') }}</a-link>
            </a-popconfirm>
          </a-space>
        </template>
      </MTable>
    </a-card>

    <a-drawer v-model:visible="drawerVisible" ::title="t('wms.safety-stock.lbl1939')" :width="480" @cancel="drawerVisible = false">
      <MForm :schema="formSchema" v-model="formData" :loading="saving" :submit-text="$t('wms.safety-stock.index.保存')" @submit="handleSave" @cancel="drawerVisible = false" />
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
import { wmsApi, type SafetyStock } from '@/api/wms'

const loading = ref(false)
const tableData = ref<any[]>([])
const total = ref(0)
const query = reactive({ keyword: '', alertOnly: false, page: 1, pageSize: 20 })

const columns: MTableColumn[] = [
  { key: 'materialCode', title: t('wms.safety-stock.index.物料编码'), dataIndex: 'materialCode', width: 130 },
  { key: 'materialName', title: t('wms.safety-stock.index.物料名称'), dataIndex: 'materialName', width: 160 },
  { key: 'warehouseId', title: t('wms.safety-stock.index.仓库'), dataIndex: 'warehouseName', width: 120 },
  { key: 'safetyQty', title: t('wms.safety-stock.index.安全库存量'), dataIndex: 'safetyQty', width: 110 },
  { key: 'currentQty', title: t('wms.safety-stock.index.当前库存'), dataIndex: 'currentQty', width: 100 },
  { key: 'unit', title: t('wms.safety-stock.index.单位'), dataIndex: 'uomCode', width: 80 },
  { key: 'alert', title: t('wms.safety-stock.index.预警状态'), slotName: 'alert', width: 160 },
  { key: 'action', title: t('wms.safety-stock.index.操作'), slotName: 'action', width: 120 },
]

const formSchema: MFormField[] = [
  { field: 'materialId', label: t('wms.safety-stock.material'), type: 'material-select', required: true },
  { field: 'warehouseId', label: t('wms.safety-stock.lbl1940'), type: 'warehouse-select' },
  { field: 'safetyQty', label: t('wms.safety-stock.lbl1941'), type: 'number', required: true, props: { min: 0, precision: 4 } },
  { field: 'unit', label: t('wms.safety-stock.lbl1942'), type: 'input', required: true },
]

async function loadData() {
  loading.value = true
  try {
    const params: Record<string, unknown> = { page: query.page, pageSize: query.pageSize }
    if (query.keyword) params.keyword = query.keyword
    const res = await wmsApi.getSafetyStocks(params)
    let list = (res.list ?? []) as any[]
    if (query.alertOnly) list = list.filter(r => (r.currentQty as number) < (r.safetyQty as number))
    tableData.value = list
    total.value = res.total ?? 0
  } catch { tableData.value = [] } finally { loading.value = false }
}

function resetQuery() { query.keyword = ''; query.alertOnly = false; query.page = 1; loadData() }
function onTableChange(e: { page: number; pageSize: number }) { query.page = e.page; query.pageSize = e.pageSize; loadData() }

const drawerVisible = ref(false)
const saving = ref(false)
const editing = ref<SafetyStock | null>(null)
const formData = ref<Record<string, unknown>>({})

function openDrawer(item: SafetyStock | null) {
  editing.value = item
  formData.value = item ? { ...item } : {}
  drawerVisible.value = true
}

async function handleSave(data: Record<string, unknown>) {
  saving.value = true
  try {
    if (editing.value) { await wmsApi.updateSafetyStock(editing.value.id, data); Message.success(t('wms.更新成功')) }
    else { await wmsApi.createSafetyStock(data); Message.success(t('wms.创建成功')) }
    drawerVisible.value = false
    loadData()
  } catch { /* handled */ } finally { saving.value = false }
}

async function handleDelete(id: string) {
  try { await wmsApi.deleteSafetyStock(id); Message.success(t('wms.删除成功')); loadData() }
  catch { /* handled */ }
}

onMounted(loadData)
</script>

<style scoped>
.page-container { padding: 16px; }
</style>
