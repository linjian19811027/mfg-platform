<template>
  <div class="page-container">
    <a-card :bordered="false" style="margin-bottom: 16px">
      <a-space wrap>
        <a-input v-model="query.materialId" :placeholder="$t('erp.standard-cost.index.物料ID')" allow-clear style="width: 180px" @keyup.enter="loadData" />
        <a-button type="primary" @click="loadData">{{ $t('common.search') }}</a-button>
        <a-button @click="resetQuery">{{ $t('common.reset') }}</a-button>
      </a-space>
      <template #extra><a-button type="primary" @click="openDrawer(null)">新建标准成本</a-button></template>
    </a-card>
    <a-card :bordered="false">
      <MTable :columns="columns" :data="tableData" :loading="loading" :total="total" :page-size="20" @change="onTableChange">
        <template #action="{ record }">
          <a-space>
            <a-link @click="openDrawer(record as unknown as ErpStandardCost)">{{ $t('common.edit') }}</a-link>
            <a-popconfirm :content="$t('erp.standard-cost.index.确认触发BOM成本卷积计算')" @ok="handleCalculate(record.materialId as string)">
              <a-link>卷积计算</a-link>
            </a-popconfirm>
          </a-space>
        </template>
      </MTable>
    </a-card>
    <a-drawer v-model:visible="drawerVisible" :title="editing ? '编辑标准成本' : '新建标准成本'" :width="520" @cancel="drawerVisible = false">
      <MForm :schema="formSchema" v-model="formData" :loading="saving" :submit-text="$t('erp.standard-cost.index.保存')" @submit="handleSave" @cancel="drawerVisible = false" />
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
import { erpExtApi, type ErpStandardCost } from '@/api/erp-ext'
const loading = ref(false); const tableData = ref<any[]>([]); const total = ref(0)
const query = reactive({ materialId: '', page: 1, pageSize: 20 })
const columns: MTableColumn[] = [
  { key: 'materialName', title: t('erp.standard-cost.index.物料名称'), dataIndex: 'materialName', width: 160 },
  { key: 'version', title: t('erp.standard-cost.index.成本版本'), dataIndex: 'version', width: 110 },
  { key: 'materialCost', title: t('erp.standard-cost.index.材料成本'), dataIndex: 'materialCost', width: 110 },
  { key: 'laborCost', title: t('erp.standard-cost.index.人工成本'), dataIndex: 'laborCost', width: 110 },
  { key: 'overheadCost', title: t('erp.standard-cost.index.制造费用'), dataIndex: 'overheadCost', width: 110 },
  { key: 'totalCost', title: t('erp.standard-cost.index.总成本'), dataIndex: 'totalCost', width: 100 },
  { key: 'currency', title: t('erp.standard-cost.index.币种'), dataIndex: 'currency', width: 80 },
  { key: 'action', title: t('erp.standard-cost.index.操作'), slotName: 'action', width: 150 },
]
const formSchema: MFormField[] = [
  { field: 'materialId', label: '物料ID', type: 'input', required: true },
  { field: 'version', label: '成本版本', type: 'input', props: { placeholder: '如 2024-01' } },
  { field: 'materialCost', label: '材料成本', type: 'number', required: true, props: { min: 0, precision: 4 } },
  { field: 'laborCost', label: '人工成本', type: 'number', required: true, props: { min: 0, precision: 4 } },
  { field: 'overheadCost', label: '制造费用', type: 'number', required: true, props: { min: 0, precision: 4 } },
  { field: 'currency', label: '币种', type: 'input', required: true, props: { placeholder: 'CNY' } },
]
async function loadData() {
  loading.value = true
  try { const res = await erpExtApi.getStandardCosts(query); tableData.value = (res.list ?? []) as any[]; total.value = res.total ?? 0 }
  catch { tableData.value = [] } finally { loading.value = false }
}
function resetQuery() { query.materialId = ''; query.page = 1; loadData() }
function onTableChange(e: { page: number; pageSize: number }) { query.page = e.page; query.pageSize = e.pageSize; loadData() }
const drawerVisible = ref(false); const saving = ref(false); const editing = ref<ErpStandardCost | null>(null); const formData = ref<Record<string, unknown>>({})
function openDrawer(item: ErpStandardCost | null) { editing.value = item; formData.value = item ? { ...item } : { currency: 'CNY' }; drawerVisible.value = true }
async function handleSave(data: Record<string, unknown>) {
  saving.value = true
  try { await erpExtApi.createStandardCost(data); Message.success(editing.value ? '更新成功' : '创建成功'); drawerVisible.value = false; loadData() }
  catch { /* handled */ } finally { saving.value = false }
}
async function handleCalculate(materialId: string) {
  try { await erpExtApi.calculateStandardCost({ materialId } as object); Message.success('成本卷积计算完成'); loadData() }
  catch { /* handled */ }
}
onMounted(loadData)
</script>
<style scoped>.page-container { padding: 16px; }</style>
