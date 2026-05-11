<template>
  <div class="page-container">
    <a-card :bordered="false" style="margin-bottom: 16px">
      <template #title>
        <a-space>
          <a-link @click="router.back()">← 返回</a-link>
          <span>工单详情</span>
        </a-space>
      </template>
      <a-descriptions :data="descItems" :column="3" bordered />
    </a-card>

    <a-card :bordered="false">
      <a-tabs default-active-key="operations">
        <a-tab-pane key="operations" :title="$t('mes.workorder.detail.工序进度')">
          <div v-if="workOrder?.operations?.length" style="padding: 16px 0">
            <a-steps :current="currentStep" direction="vertical">
              <a-step
                v-for="op in workOrder.operations"
                :key="op.id"
                :title="`${op.seqNo}. ${op.name}`"
                :status="stepStatus(op.status)"
              >
                <template #description>
                  <div style="margin-top: 8px">
                    <a-tag :color="opStatusColor(op.status)" style="margin-bottom: 8px">
                      {{ opStatusLabel(op.status) }}
                    </a-tag>
                    <a-progress
                      :percent="calcPercent(op.completedQty, op.plannedQty)"
                      :status="op.status === 'completed' ? 'success' : 'normal'"
                    />
                    <div style="font-size: 12px; color: var(--color-text-3); margin-top: 4px">
                      {{ op.completedQty }} / {{ op.plannedQty }}
                    </div>
                  </div>
                </template>
              </a-step>
            </a-steps>
          </div>
          <a-empty v-else :description="$t('mes.workorder.detail.暂无工序数据')" />
        </a-tab-pane>

        <a-tab-pane key="reports" :title="$t('mes.workorder.detail.报工记录')">
          <a-table
            :columns="reportColumns"
            :data="reports"
            :loading="reportsLoading"
            :pagination="{ total: reportsTotal, pageSize: 20, showTotal: true }"
            row-key="id"
            @page-change="loadReports"
          />
        </a-tab-pane>

        <!-- 工单树（多层级） -->
        <a-tab-pane key="tree" :title="$t('mes.workorder.detail.工单树')">
          <div v-if="treeData" style="padding: 8px 0">
            <a-tag color="blue" style="margin-bottom: 12px">整体完成度：{{ treeData.completionPct?.toFixed(1) }}%</a-tag>
            <a-tree :data="treeData.tree" :default-expand-all="true" block-node @select="onTreeNodeSelect">
              <template #title="node">
                <a-space>
                  <a-tag v-if="node.isCritical" color="red" size="small">关键</a-tag>
                  <span>{{ node.title }}</span>
                  <a-tag size="small" :color="woStatusColor(node.status)">{{ node.status }}</a-tag>
                </a-space>
              </template>
            </a-tree>
          </div>
          <a-empty v-else :description="$t('mes.workorder.detail.暂无子工单')" />
        </a-tab-pane>

        <!-- 关键路径 -->
        <a-tab-pane key="critical-path" :title="$t('mes.workorder.detail.关键路径')">
          <a-table :columns="criticalPathColumns" :data="criticalPath" :loading="criticalPathLoading" :pagination="false" row-key="id">
            <template #isCritical="{ record }">
              <a-tag v-if="record.isCritical" color="red">关键</a-tag>
              <span v-else>-</span>
            </template>
          </a-table>
        </a-tab-pane>

        <!-- 物料齐套 -->
        <a-tab-pane key="readiness" :title="$t('mes.workorder.detail.物料齐套')">
          <a-alert v-if="readiness?.isAllReady" type="success" style="margin-bottom: 12px">所有物料已齐套</a-alert>
          <a-alert v-else type="warning" style="margin-bottom: 12px">物料尚未完全齐套</a-alert>
        </a-tab-pane>
      </a-tabs>
    </a-card>

    <!-- 级联取消弹窗 -->
    <a-modal v-model:visible="cancelModalVisible" :title="$t('mes.workorder.detail.取消工单')" :ok-loading="cancelLoading"
      @ok="submitCancel" @cancel="cancelModalVisible = false">
      <a-alert v-if="cancelPreview?.length" type="warning" style="margin-bottom: 12px">
        此工单有 {{ cancelPreview.length }} 个子工单
      </a-alert>
      <a-form :model="cancelForm" layout="vertical">
        <a-form-item :label="$t('mes.workorder.detail.取消原因')" required>
          <a-textarea v-model="cancelForm.reason" :rows="3" :placeholder="$t('mes.workorder.detail.请输入取消原因')" />
        </a-form-item>
        <a-form-item v-if="cancelPreview?.length">
          <a-checkbox v-model="cancelForm.cascade">同时级联取消 {{ cancelPreview.length }} 个子工单</a-checkbox>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
import { useI18n } from 'vue-i18n'
import { ref, computed, onMounted, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { mesApi, type WorkOrder, type WorkOrderOperation } from '@/api/mes'
import { getWorkOrderTree, getWorkOrderCriticalPath, getWorkOrderReadiness, cancelWorkOrder } from '@/api/mes'

const route = useRoute()
const router = useRouter()
const id = route.params.id as string

const workOrder = ref<WorkOrder | null>(null)
const reports = ref<any[]>([])
const reportsLoading = ref(false)
const reportsTotal = ref(0)

// 多层级工单
const treeData = ref<any>(null)
const criticalPath = ref<any[]>([])
const criticalPathLoading = ref(false)
const readiness = ref<any>(null)
const cancelPreview = ref<any[]>([])
const cancelModalVisible = ref(false)
const cancelLoading = ref(false)
const cancelForm = reactive({ reason: '', cascade: false })

const criticalPathColumns = [
  { title: t('mes.workorder.detail.工单编号'), dataIndex: 'code', width: 150 },
  { title: t('mes.workorder.detail.物料'), dataIndex: 'materialName', width: 140 },
  { title: 'ES', dataIndex: 'es', width: 100 },
  { title: 'EF', dataIndex: 'ef', width: 100 },
  { title: 'LS', dataIndex: 'ls', width: 100 },
  { title: 'LF', dataIndex: 'lf', width: 100 },
  { title: t('mes.workorder.detail.总浮动'), dataIndex: 'totalFloat', width: 80 },
  { title: t('mes.workorder.detail.关键'), dataIndex: 'isCritical', slotName: 'isCritical', width: 70 },
]

const STATUS_LABEL: Record<string, string> = {
  draft: '草稿', released: '已下达', in_progress: '生产中', completed: '已完工', closed: '已关闭',
}

const OP_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: '待开始', color: 'gray' },
  in_progress: { label: '进行中', color: 'orange' },
  completed: { label: '已完成', color: 'green' },
}

const descItems = computed(() => {
  const wo = workOrder.value
  if (!wo) return []
  return [
    { label: '工单编号', value: wo.code },
    { label: '物料名称', value: wo.materialName ?? wo.materialId },
    { label: '状态', value: STATUS_LABEL[wo.status] ?? wo.status },
    { label: '计划数量', value: wo.plannedQty },
    { label: '完成数量', value: wo.completedQty },
    { label: '计划开始', value: wo.plannedStartDate ?? '-' },
    { label: '计划结束', value: wo.plannedEndDate ?? '-' },
  ]
})

const currentStep = computed(() => {
  const ops = workOrder.value?.operations ?? []
  const idx = ops.findIndex((op: WorkOrderOperation) => op.status === 'in_progress')
  return idx >= 0 ? idx : ops.filter((op: WorkOrderOperation) => op.status === 'completed').length
})

const reportColumns = [
  { title: t('mes.workorder.detail.报工时间'), dataIndex: 'reportTime', key: 'reportTime', width: 180 },
  { title: t('mes.workorder.detail.操作类型'), dataIndex: 'action', key: 'action', width: 120 },
  { title: t('mes.workorder.detail.完成数量'), dataIndex: 'completedQty', key: 'completedQty', width: 100 },
  { title: t('mes.workorder.detail.报废数量'), dataIndex: 'scrapQty', key: 'scrapQty', width: 100 },
  { title: t('mes.workorder.detail.操作员'), dataIndex: 'operatorId', key: 'operatorId', width: 120 },
]

function stepStatus(status: string) {
  if (status === 'completed') return 'finish'
  if (status === 'in_progress') return 'process'
  return 'wait'
}

function opStatusColor(s: string) { return OP_STATUS[s]?.color ?? 'gray' }
function opStatusLabel(s: string) { return OP_STATUS[s]?.label ?? s }
function woStatusColor(s: string) { return { released: 'blue', in_progress: 'orange', completed: 'green', cancelled: 'red' }[s] ?? 'gray' }

function calcPercent(completed: number, planned: number) {
  if (!planned) return 0
  return Math.min(100, Math.round((completed / planned) * 100))
}

function onTreeNodeSelect(keys: string[]) {
  if (keys[0]) router.push(`/mes/workorder/${keys[0]}`)
}

async function loadWorkOrder() {
  const res = await mesApi.getMesWorkOrder(id)
  workOrder.value = res
}

async function loadReports(page = 1) {
  reportsLoading.value = true
  try {
    const res = await mesApi.getProductionReports({ woId: id, page, pageSize: 20 })
    reports.value = (res.list ?? []) as any[]
    reportsTotal.value = res.total ?? 0
  } finally {
    reportsLoading.value = false
  }
}

async function loadTree() {
  try { const res = await getWorkOrderTree(id); treeData.value = (res as any).data } catch {}
}

async function loadCriticalPath() {
  criticalPathLoading.value = true
  try { const res = await getWorkOrderCriticalPath(id); criticalPath.value = (res as any).data?.criticalPath ?? [] }
  catch {} finally { criticalPathLoading.value = false }
}

async function loadReadiness() {
  try { const res = await getWorkOrderReadiness(id); readiness.value = (res as any).data } catch {}
}

async function submitCancel() {
  if (!cancelForm.reason) { return }
  cancelLoading.value = true
  try {
    await cancelWorkOrder(id, { cascade: cancelForm.cascade, reason: cancelForm.reason })
    cancelModalVisible.value = false
    loadWorkOrder()
  } catch (e: any) { console.error(e) }
  finally { cancelLoading.value = false }
}

onMounted(() => {
  loadWorkOrder()
  loadReports()
  loadTree()
  loadCriticalPath()
  loadReadiness()
})
</script>

<style scoped>
.page-container { padding: 16px; }
</style>
