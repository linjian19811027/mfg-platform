<template>
  <div class="page-container">
    <!-- 工单查询 -->
    <a-card :bordered="false" style="margin-bottom: 16px">
      <a-space>
        <a-input v-model="woCode" :placeholder="$t('mes.operation.index.输入工单号')" allow-clear style="width: 240px" @keyup.enter="searchWorkOrder" />
        <a-button type="primary" :loading="loading" @click="searchWorkOrder">{{ $t('common.search') }}</a-button>
        <a-button @click="resetPage">{{ $t('common.reset') }}</a-button>
      </a-space>
    </a-card>

    <a-card v-if="currentWo" :bordered="false">
      <template #title>{{ currentWo.code }} — 工序列表</template>
      <a-table :columns="opColumns" :data="operations" :pagination="false" row-key="id" :loading="loading">
        <template #status="{ record }">
          <a-tag :color="opStatusColor(record.status as string)">{{ opStatusLabel(record.status as string) }}</a-tag>
        </template>
        <template #progress="{ record }">
          <a-progress :percent="calcPercent(record.completedQty as number, record.plannedQty as number)" size="small" />
          <span style="font-size: 11px; color: #8b949e">{{ record.completedQty }}/{{ record.plannedQty }}</span>
        </template>
        <template #action="{ record }">
          <a-space>
            <a-button v-if="record.status === 'pending'" type="primary" size="mini" @click="openStartModal(record as WorkOrderOperation)">开工</a-button>
            <template v-if="record.status === 'in_progress'">
              <a-button status="success" size="mini" @click="openCompleteModal(record as WorkOrderOperation)">完工</a-button>
              <a-button status="warning" size="mini" @click="openExceptionModal(record as WorkOrderOperation)">异常</a-button>
            </template>
          </a-space>
        </template>
      </a-table>
    </a-card>

    <!-- 开工弹窗 -->
    <a-modal v-model:visible="startModalVisible" :title="$t('mes.operation.index.开工确认')" :ok-loading="operating" @ok="handleStart" @cancel="startModalVisible = false">
      <a-form :model="startForm" layout="vertical">
        <a-form-item :label="$t('mes.operation.index.操作员')">
          <a-input :value="(authStore as any).realName || authStore.userId || ''" readonly />
        </a-form-item>
        <a-form-item :label="$t('mes.operation.index.设备可选')">
          <a-select
            v-model="startForm.equipmentId"
            :placeholder="$t('mes.operation.index.搜索设备编码名称')"
            allow-search
            allow-clear
            :filter-option="false"
            style="width: 100%"
            @search="searchEquipments"
          >
            <a-option v-for="e in equipmentOptions" :key="e.id" :value="e.id" :label="`${e.code} - ${e.name}`" />
          </a-select>
        </a-form-item>
        <a-form-item :label="$t('mes.operation.index.物料已确认')"><a-switch v-model="startForm.materialConfirmed" /></a-form-item>
        <a-form-item :label="$t('mes.operation.index.工艺路线已确认')"><a-switch v-model="startForm.routingConfirmed" /></a-form-item>
      </a-form>
    </a-modal>

    <!-- 完工弹窗 -->
    <a-modal v-model:visible="completeModalVisible" :title="$t('mes.operation.index.完工录入')" :ok-loading="operating" @ok="handleComplete" @cancel="completeModalVisible = false">
      <a-form :model="completeForm" layout="vertical">
        <a-form-item :label="$t('mes.operation.index.完成数量')" required><a-input-number v-model="completeForm.completedQty" :min="1" :precision="4" style="width:100%" /></a-form-item>
        <a-form-item :label="$t('mes.operation.index.报废数量')"><a-input-number v-model="completeForm.scrapQty" :min="0" :precision="4" style="width:100%" /></a-form-item>
        <a-form-item :label="$t('mes.operation.index.实际工时分钟')"><a-input-number v-model="completeForm.actualHours" :min="0" style="width:100%" /></a-form-item>
        <a-form-item :label="$t('mes.operation.index.产出批次号扫码')"><a-input v-model="completeForm.outputBatchId" :placeholder="$t('mes.operation.index.扫码或输入批次号')" /></a-form-item>
      </a-form>
    </a-modal>

    <!-- 异常报工弹窗 -->
    <a-modal v-model:visible="exceptionModalVisible" :title="$t('mes.operation.index.异常报工')" :ok-loading="operating" @ok="handleException" @cancel="exceptionModalVisible = false">
      <a-form :model="exceptionForm" layout="vertical">
        <a-form-item :label="$t('mes.operation.index.异常类型')" required>
          <a-select v-model="exceptionForm.exceptionType">
            <a-option value="EQUIPMENT_FAILURE">设备故障</a-option>
            <a-option value="QUALITY_ISSUE">质量问题</a-option>
            <a-option value="MATERIAL_SHORTAGE">物料短缺</a-option>
            <a-option value="OTHER">其他</a-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="$t('mes.operation.index.异常原因')" required>
          <a-textarea v-model="exceptionForm.reason" :auto-size="{ minRows: 3 }" />
        </a-form-item>
        <a-form-item :label="$t('mes.operation.index.设备ID可选')"><a-input v-model="exceptionForm.equipmentId" /></a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
import { useI18n } from 'vue-i18n'
import { ref, reactive } from 'vue'
import { Message } from '@arco-design/web-vue'
import { mesApi, type WorkOrder, type WorkOrderOperation } from '@/api/mes'
import { eamApi, type Equipment } from '@/api/eam'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const woCode = ref('')
const loading = ref(false)
const currentWo = ref<WorkOrder | null>(null)
const operations = ref<WorkOrderOperation[]>([])

const opColumns = [
  { title: t('mes.operation.index.序号'), dataIndex: 'seqNo', width: 65 },
  { title: t('mes.operation.index.工序名称'), dataIndex: 'name', width: 140 },
  { title: t('mes.operation.index.状态'), slotName: 'status', width: 100 },
  { title: t('mes.operation.index.进度'), slotName: 'progress', width: 180 },
  { title: t('mes.operation.index.操作'), slotName: 'action', width: 180 },
]

function opStatusColor(s: string) { return s === 'completed' ? 'green' : s === 'in_progress' ? 'orange' : 'gray' }
function opStatusLabel(s: string) { return s === 'completed' ? '已完成' : s === 'in_progress' ? '进行中' : '待开始' }
function calcPercent(done: number, total: number) { return total ? Math.min(100, Math.round(done / total * 100)) : 0 }

async function searchWorkOrder() {
  if (!woCode.value.trim()) { Message.warning('请输入工单号'); return }
  loading.value = true
  try {
    const res = await mesApi.getMesWorkOrders({ code: woCode.value.trim(), pageSize: 1 })
    const wo = res.list?.[0]
    if (!wo) { Message.warning('未找到工单'); return }
    const detail = await mesApi.getMesWorkOrder(wo.id)
    currentWo.value = detail
    operations.value = detail.operations ?? []
  } catch { /* handled */ } finally { loading.value = false }
}

function resetPage() { woCode.value = ''; currentWo.value = null; operations.value = [] }

// ─── 操作弹窗 ────────────────────────────────────────────────
const operating = ref(false)
const currentOp = ref<WorkOrderOperation | null>(null)

// 开工
const startModalVisible = ref(false)
const startForm = reactive({ operatorId: authStore.userId ?? '', equipmentId: '', materialConfirmed: false, routingConfirmed: false })
const equipmentOptions = ref<Equipment[]>([])
let eqTimer: ReturnType<typeof setTimeout> | null = null
async function searchEquipments(kw: string) {
  if (eqTimer) clearTimeout(eqTimer)
  eqTimer = setTimeout(async () => {
    const res = await eamApi.getEquipments({ keyword: kw, pageSize: 20 })
    equipmentOptions.value = (res.list ?? res) as Equipment[]
  }, 300)
}
function openStartModal(op: WorkOrderOperation) {
  currentOp.value = op
  startForm.operatorId = authStore.userId ?? ''
  startForm.equipmentId = ''
  startForm.materialConfirmed = false
  startForm.routingConfirmed = false
  equipmentOptions.value = []
  startModalVisible.value = true
}
async function handleStart() {
  if (!currentOp.value) return
  operating.value = true
  try {
    await mesApi.startOperation(currentOp.value.id, { ...startForm })
    Message.success('开工成功')
    startModalVisible.value = false
    if (currentWo.value) { const d = await mesApi.getMesWorkOrder(currentWo.value.id); operations.value = d.operations ?? [] }
  } catch { /* handled */ } finally { operating.value = false }
}

// 完工
const completeModalVisible = ref(false)
const completeForm = reactive({ completedQty: 1, scrapQty: 0, actualHours: 0, outputBatchId: '' })
function openCompleteModal(op: WorkOrderOperation) { currentOp.value = op; Object.assign(completeForm, { completedQty: op.plannedQty, scrapQty: 0, actualHours: 0, outputBatchId: '' }); completeModalVisible.value = true }
async function handleComplete() {
  if (!currentOp.value || !completeForm.completedQty) { Message.warning('请填写完成数量'); return }
  operating.value = true
  try {
    await mesApi.completeOperation(currentOp.value.id, { completedQty: completeForm.completedQty, scrapQty: completeForm.scrapQty, actualHours: completeForm.actualHours || undefined, outputBatchId: completeForm.outputBatchId || undefined })
    Message.success('完工登记成功')
    completeModalVisible.value = false
    if (currentWo.value) { const d = await mesApi.getMesWorkOrder(currentWo.value.id); operations.value = d.operations ?? [] }
  } catch { /* handled */ } finally { operating.value = false }
}

// 异常
const exceptionModalVisible = ref(false)
const exceptionForm = reactive({ exceptionType: '', reason: '', equipmentId: '' })
function openExceptionModal(op: WorkOrderOperation) { currentOp.value = op; Object.assign(exceptionForm, { exceptionType: '', reason: '', equipmentId: '' }); exceptionModalVisible.value = true }
async function handleException() {
  if (!currentOp.value || !exceptionForm.exceptionType || !exceptionForm.reason) { Message.warning('请填写异常类型和原因'); return }
  operating.value = true
  try {
    await mesApi.reportException(currentOp.value.id, { exceptionType: exceptionForm.exceptionType, reason: exceptionForm.reason, equipmentId: exceptionForm.equipmentId || undefined })
    Message.success('异常报工已记录')
    exceptionModalVisible.value = false
  } catch { /* handled */ } finally { operating.value = false }
}
</script>

<style scoped>
.page-container { padding: 16px; }
</style>
