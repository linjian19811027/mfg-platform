<template>
  <div class="page-container">
    <a-card :bordered="false" style="margin-bottom: 16px">
      <a-space wrap>
        <a-input v-model="query.keyword" :placeholder="$t('eam.spare-part.index.备件编码名称')" allow-clear style="width: 200px" @keyup.enter="loadData" />
        <a-button type="primary" @click="loadData">{{ $t('common.search') }}</a-button>
        <a-button @click="resetQuery">{{ $t('common.reset') }}</a-button>
      </a-space>
      <template #extra>
        <a-space>
          <a-button type="primary" @click="openDrawer(null)">{{ $t('eam.spare-part.index.新建备件') }}</a-button>
          <a-button @click="openInOutModal('IN')">{{ $t('eam.spare-part.index.入库') }}</a-button>
          <a-button @click="openInOutModal('OUT')">{{ $t('eam.spare-part.index.出库') }}</a-button>
        </a-space>
      </template>
    </a-card>

    <a-card :bordered="false">
      <MTable :columns="columns" :data="tableData" :loading="loading" :total="total" :page-size="20" @change="onTableChange">
        <template #stockStatus="{ record }">
          <a-tag :color="(record.qty as number) < (record.safetyQty as number) ? 'red' : 'green'">
            {{ (record.qty as number) < (record.safetyQty as number) ? $t('common.sparePart.stockLow') : $t('common.status.normal') }}
          </a-tag>
        </template>
        <template #action="{ record }">
          <a-space>
            <a-link @click="openDrawer(record as unknown as SparePart)">{{ $t('common.edit') }}</a-link>
            <a-link @click="openTransactionDrawer(record.id as string)">{{ $t('eam.spare-part.index.流水') }}</a-link>
          </a-space>
        </template>
      </MTable>
    </a-card>

    <!-- 新建/编辑抽屉 -->
    <a-drawer v-model:visible="drawerVisible" :title="editing ? $t('eam.spare-part.index.编辑备件') : $t('eam.spare-part.index.新建备件')" :width="480" @cancel="drawerVisible = false">
      <MForm :schema="formSchema" v-model="formData" :loading="saving" :submit-text="$t('eam.spare-part.index.保存')" @submit="handleSave" @cancel="drawerVisible = false" />
    </a-drawer>

    <!-- 入库/出库弹窗 -->
    <a-modal v-model:visible="inOutModalVisible" :title="inOutType === 'IN' ? $t('eam.spare-part.index.备件入库') : $t('eam.spare-part.index.备件出库')" :ok-loading="inOutting" @ok="handleInOut" @cancel="inOutModalVisible = false">
      <a-form layout="vertical">
        <a-form-item :label="$t('eam.spare-part.index.备件ID')" required><a-input v-model="inOutForm.sparePartId" /></a-form-item>
        <a-form-item :label="$t('eam.spare-part.index.数量')" required><a-input-number v-model="inOutForm.qty" :min="1" style="width:100%" /></a-form-item>
        <a-form-item :label="$t('common.remark')"><a-input v-model="inOutForm.remark" /></a-form-item>
      </a-form>
    </a-modal>

    <!-- 流水记录抽屉 -->
    <a-drawer v-model:visible="txDrawerVisible" :title="$t('eam.spare-part.index.备件流水记录')" :width="600" @cancel="txDrawerVisible = false">
      <a-table :columns="txColumns" :data="transactions" :loading="txLoading" :pagination="false" row-key="id" size="small">
        <template #type="{ record }">
          <a-tag :color="record.type === 'IN' ? 'green' : record.type === 'OUT' ? 'red' : 'orange'">
            {{ { IN: t('common.sparePart.type.in'), OUT: t('common.sparePart.type.out'), ISSUE: t('common.sparePart.type.issue') }[record.type as string] ?? record.type }}
          </a-tag>
        </template>
      </a-table>
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
import { eamApi, type SparePart } from '@/api/eam'

const loading = ref(false)
const tableData = ref<any[]>([])
const total = ref(0)
const query = reactive({ keyword: '', page: 1, pageSize: 20 })

const columns: MTableColumn[] = [
  { key: 'code', title: t('eam.spare-part.index.备件编码'), dataIndex: 'code', width: 130 },
  { key: 'name', title: t('eam.spare-part.index.备件名称'), dataIndex: 'name', width: 160 },
  { key: 'spec', title: t('eam.spare-part.index.规格'), dataIndex: 'spec', width: 120 },
  { key: 'qty', title: t('eam.spare-part.index.库存数量'), dataIndex: 'qty', width: 100 },
  { key: 'safetyQty', title: t('eam.spare-part.index.安全库存'), dataIndex: 'safetyQty', width: 100 },
  { key: 'unit', title: t('eam.spare-part.index.单位'), dataIndex: 'unit', width: 80 },
  { key: 'stockStatus', title: t('eam.spare-part.index.库存状态'), slotName: 'stockStatus', width: 100 },
  { key: 'action', title: t('eam.spare-part.index.操作'), slotName: 'action', width: 120 },
]

const txColumns = [
  { title: t('eam.spare-part.index.类型'), slotName: 'type', width: 80 },
  { title: t('eam.spare-part.index.数量'), dataIndex: 'qty', width: 80 },
  { title: t('eam.spare-part.index.操作员'), dataIndex: 'operatorId', width: 110 },
  { title: t('eam.spare-part.index.时间'), dataIndex: 'createdAt', width: 160 },
]

const formSchema: MFormField[] = [
  { field: 'code', label: t('eam.spare-part.index.备件编码'), type: 'input', required: true },
  { field: 'name', label: t('eam.spare-part.index.备件名称'), type: 'input', required: true },
  { field: 'spec', label: t('eam.spare-part.index.规格'), type: 'input' },
  { field: 'safetyQty', label: t('eam.spare-part.index.安全库存'), type: 'number', required: true, props: { min: 0 } },
  { field: 'unit', label: t('eam.spare-part.index.单位'), type: 'uom-select', required: true },
]

async function loadData() {
  loading.value = true
  try {
    const res = await eamApi.getSpareParts(query)
    tableData.value = (res.list ?? []) as any[]
    total.value = res.total ?? 0
  } catch { tableData.value = [] } finally { loading.value = false }
}

function resetQuery() { query.keyword = ''; query.page = 1; loadData() }
function onTableChange(e: { page: number; pageSize: number }) { query.page = e.page; query.pageSize = e.pageSize; loadData() }

const drawerVisible = ref(false)
const saving = ref(false)
const editing = ref<SparePart | null>(null)
const formData = ref<Record<string, unknown>>({})

function openDrawer(item: SparePart | null) {
  editing.value = item
  formData.value = item ? { ...item } : {}
  drawerVisible.value = true
}

async function handleSave(data: Record<string, unknown>) {
  saving.value = true
  try {
    if (editing.value) { await eamApi.updateSparePart(editing.value.id, data); Message.success(t('common.msg.updateSuccess')) }
    else { await eamApi.createSparePart(data); Message.success(t('common.msg.createSuccess')) }
    drawerVisible.value = false; loadData()
  } catch { /* handled */ } finally { saving.value = false }
}

// 入库/出库
const inOutModalVisible = ref(false)
const inOutting = ref(false)
const inOutType = ref<'IN' | 'OUT'>('IN')
const inOutForm = reactive({ sparePartId: '', qty: 1, remark: '' })

function openInOutModal(type: 'IN' | 'OUT') {
  inOutType.value = type
  inOutForm.sparePartId = ''
  inOutForm.qty = 1
  inOutForm.remark = ''
  inOutModalVisible.value = true
}

async function handleInOut() {
  if (!inOutForm.sparePartId || !inOutForm.qty) { Message.warning(t('common.sparePart.msg.fillIdQty')); return }
  inOutting.value = true
  try {
    if (inOutType.value === 'IN') {
      await eamApi.receiveSparePart(inOutForm.sparePartId, { qty: inOutForm.qty, remark: inOutForm.remark })
    } else {
      await eamApi.issueSparePart(inOutForm.sparePartId, { qty: inOutForm.qty, remark: inOutForm.remark })
    }
    Message.success(inOutType.value === 'IN' ? t('common.sparePart.msg.inSuccess') : t('common.sparePart.msg.outSuccess'))
    inOutModalVisible.value = false
    loadData()
  } catch { /* handled */ } finally { inOutting.value = false }
}

// 流水记录
const txDrawerVisible = ref(false)
const txLoading = ref(false)
const transactions = ref<any[]>([])

async function openTransactionDrawer(sparePartId: string) {
  txDrawerVisible.value = true
  txLoading.value = true
  try {
    const res = await eamApi.getSparePartTransactions({ sparePartId })
    transactions.value = (res.list ?? []) as any[]
  } catch { transactions.value = [] } finally { txLoading.value = false }
}

onMounted(loadData)
</script>

<style scoped>
.page-container { padding: 16px; }
</style>
