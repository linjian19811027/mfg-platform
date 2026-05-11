<template>
  <div class="page-container">
    <a-card :bordered="false" style="margin-bottom: 16px">
      <a-space wrap>
        <a-select v-model="query.status" :placeholder="$t('common.status')" allow-clear style="width: 130px">
          <a-option value="PENDING">待拣货</a-option>
          <a-option value="IN_PROGRESS">拣货中</a-option>
          <a-option value="COMPLETED">已完成</a-option>
        </a-select>
        <a-button type="primary" @click="loadData">{{ $t('common.search') }}</a-button>
        <a-button @click="resetQuery">{{ $t('common.reset') }}</a-button>
      </a-space>
      <template #extra>
        <a-button type="primary" @click="openCreateDrawer">新建拣货任务</a-button>
      </template>
    </a-card>

    <a-card :bordered="false">
      <MTable :columns="columns" :data="tableData" :loading="loading" :total="total" :page-size="20" @change="onTableChange">
        <template #status="{ record }">
          <a-tag :color="statusColor(record.status as string)">{{ statusLabel(record.status as string) }}</a-tag>
        </template>
        <template #priority="{ record }">
          <a-tag :color="(record.priority as number) >= 8 ? 'red' : (record.priority as number) >= 5 ? 'orange' : 'gray'">
            P{{ record.priority ?? 5 }}
          </a-tag>
        </template>
        <template #action="{ record }">
          <a-space>
            <a-link @click="openDetailDrawer(record as unknown as PickTask)">查看/执行</a-link>
            <a-link v-if="record.status === 'IN_PROGRESS'" @click="openVerifyDrawer(record as unknown as PickTask)">复核</a-link>
          </a-space>
        </template>
      </MTable>
    </a-card>

    <!-- 新建抽屉 -->
    <a-drawer v-model:visible="createDrawerVisible" :title="$t('wms.picking-task.index.新建拣货任务')" :width="480" @cancel="createDrawerVisible = false">
      <MForm :schema="createSchema" v-model="createForm" :loading="creating" :submit-text="$t('wms.picking-task.index.创建')" @submit="handleCreate" @cancel="createDrawerVisible = false" />
    </a-drawer>

    <!-- 拣货明细抽屉 -->
    <a-drawer v-model:visible="detailDrawerVisible" :title="`拣货任务 - ${currentTask?.code ?? ''}`" :width="720" @cancel="detailDrawerVisible = false">
      <a-table :columns="lineColumns" :data="currentTask?.lines ?? []" :pagination="false" row-key="id">
        <template #pickedQty="{ record }">
          <a-input-number v-model="(record as PickTaskLine).pickedQty" :min="0" :max="record.requiredQty as number" :precision="4" style="width: 100px" />
        </template>
      </a-table>
    </a-drawer>

    <!-- 复核弹窗 -->
    <a-modal v-model:visible="verifyModalVisible" :title="$t('wms.picking-task.index.拣货复核')" :ok-loading="verifying" @ok="handleVerify" @cancel="verifyModalVisible = false">
      <p style="color: #8b949e; margin-bottom: 12px">确认以下拣货数量并完成复核：</p>
      <a-table :columns="verifyColumns" :data="verifyLines" :pagination="false" row-key="lineId" size="small" />
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
import { wmsApi, type PickTask, type PickTaskLine } from '@/api/wms'

const loading = ref(false)
const tableData = ref<any[]>([])
const total = ref(0)
const query = reactive({ status: '', page: 1, pageSize: 20 })

const columns: MTableColumn[] = [
  { key: 'code', title: t('wms.picking-task.index.任务编号'), dataIndex: 'code', width: 140 },
  { key: 'priority', title: t('wms.picking-task.index.优先级'), slotName: 'priority', width: 90 },
  { key: 'referenceType', title: t('wms.picking-task.index.来源类型'), dataIndex: 'referenceType', width: 110 },
  { key: 'status', title: t('wms.picking-task.index.状态'), slotName: 'status', width: 100 },
  { key: 'createdAt', title: t('wms.picking-task.index.创建时间'), dataIndex: 'createdAt', width: 160 },
  { key: 'action', title: t('wms.picking-task.index.操作'), slotName: 'action', width: 160 },
]

const lineColumns = [
  { title: t('wms.picking-task.index.物料编码'), dataIndex: 'materialCode', width: 130 },
  { title: t('wms.picking-task.index.物料名称'), dataIndex: 'materialName', width: 160 },
  { title: t('wms.picking-task.index.货位'), dataIndex: 'locationCode', width: 110 },
  { title: t('wms.picking-task.index.应拣数量'), dataIndex: 'requiredQty', width: 100 },
  { title: t('wms.picking-task.index.实拣数量'), slotName: 'pickedQty', width: 130 },
  { title: t('wms.picking-task.index.单位'), dataIndex: 'uomCode', width: 80 },
]

const verifyColumns = [
  { title: t('wms.picking-task.index.物料编码'), dataIndex: 'materialCode', width: 130 },
  { title: t('wms.picking-task.index.实拣数量'), dataIndex: 'pickedQty', width: 100 },
]

function statusColor(s: string) { return s === 'COMPLETED' ? 'green' : s === 'IN_PROGRESS' ? 'orange' : 'gray' }
function statusLabel(s: string) { const m: Record<string, string> = { PENDING: '待拣货', IN_PROGRESS: '拣货中', COMPLETED: '已完成' }; return m[s] ?? s }

async function loadData() {
  loading.value = true
  try {
    const res = await wmsApi.getPickTasks(query)
    tableData.value = (res.list ?? []) as any[]
    total.value = res.total ?? 0
  } catch { tableData.value = [] } finally { loading.value = false }
}

function resetQuery() { query.status = ''; query.page = 1; loadData() }
function onTableChange(e: { page: number; pageSize: number }) { query.page = e.page; query.pageSize = e.pageSize; loadData() }

// 新建
const createDrawerVisible = ref(false)
const creating = ref(false)
const createForm = ref<Record<string, unknown>>({})
const createSchema: MFormField[] = [
  { field: 'referenceType', label: '来源类型', type: 'select', options: [{ label: '销售出库', value: 'SALES' }, { label: '生产领料', value: 'PRODUCTION' }, { label: '其他', value: 'OTHER' }] },
  { field: 'referenceId', label: '来源单据ID', type: 'input' },
  { field: 'priority', label: '优先级(1-10)', type: 'number', props: { min: 1, max: 10 } },
]
function openCreateDrawer() { createForm.value = { priority: 5 }; createDrawerVisible.value = true }
async function handleCreate(data: Record<string, unknown>) {
  creating.value = true
  try {
    await wmsApi.createPickTask(data)
    Message.success('创建成功')
    createDrawerVisible.value = false
    loadData()
  } catch { /* handled */ } finally { creating.value = false }
}

// 明细
const detailDrawerVisible = ref(false)
const currentTask = ref<PickTask | null>(null)
function openDetailDrawer(task: PickTask) { currentTask.value = task; detailDrawerVisible.value = true }

// 复核
const verifyModalVisible = ref(false)
const verifying = ref(false)
const verifyLines = ref<{ lineId: string; materialCode?: string; pickedQty: number }[]>([])

function openVerifyDrawer(task: PickTask) {
  currentTask.value = task
  verifyLines.value = (task.lines ?? []).map(l => ({ lineId: l.id, materialCode: l.materialCode, pickedQty: l.pickedQty ?? l.requiredQty }))
  verifyModalVisible.value = true
}

async function handleVerify() {
  if (!currentTask.value) return
  verifying.value = true
  try {
    await wmsApi.verifyPickTask(currentTask.value.id, verifyLines.value)
    Message.success('复核完成')
    verifyModalVisible.value = false
    loadData()
  } catch { /* handled */ } finally { verifying.value = false }
}

onMounted(loadData)
</script>

<style scoped>
.page-container { padding: 16px; }
</style>
