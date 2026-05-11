<template>
  <div class="page-container">
    <a-page-header :title="$t('plm.ecn-execution-plans.ECN执行计划详情')" @back="router.back()">
      <template #extra>
        <a-space>
          <a-button v-if="plan.status === 'PENDING'" type="primary" @click="handleTrigger" :loading="actionLoading">手动触发</a-button>
          <a-button v-if="plan.status === 'FAILED'" @click="handleRetry" :loading="actionLoading">重试失败项</a-button>
          <a-popconfirm v-if="plan.status === 'PENDING'" :content="$t('plm.ecn-execution-plans.确定取消此执行计划')" @ok="handleCancel">
            <a-button status="danger">{{ $t('common.cancel') }}</a-button>
          </a-popconfirm>
        </a-space>
      </template>
    </a-page-header>

    <a-spin :loading="loading">
      <!-- 基本信息 -->
      <a-card :bordered="false" style="margin-bottom: 16px">
        <a-row :gutter="16" align="center">
          <a-col :span="18">
            <a-descriptions :column="3" bordered>
              <a-descriptions-item :label="$t('plm.ecn-execution-plans.计划编号')">{{ plan.planNo }}</a-descriptions-item>
              <a-descriptions-item :label="$t('plm.ecn-execution-plans.ECN编号')">{{ plan.ecnNo }}</a-descriptions-item>
              <a-descriptions-item :label="$t('common.status')">
                <a-tag :color="statusColor(plan.status)">{{ statusLabel(plan.status) }}</a-tag>
              </a-descriptions-item>
              <a-descriptions-item :label="$t('plm.ecn-execution-plans.生效日期')">
                <span>{{ plan.effectiveDate }}</span>
                <a-button v-if="plan.status === 'PENDING'" type="text" size="mini" @click="showDateModal">修改</a-button>
              </a-descriptions-item>
              <a-descriptions-item :label="$t('plm.ecn-execution-plans.触发方式')">{{ plan.triggerType }}</a-descriptions-item>
              <a-descriptions-item :label="$t('plm.ecn-execution-plans.创建时间')">{{ plan.createdAt }}</a-descriptions-item>
            </a-descriptions>
          </a-col>
        </a-row>
      </a-card>

      <a-card :bordered="false">
        <a-tabs v-model:active-key="activeTab">
          <!-- 执行计划项 -->
          <a-tab-pane key="items" :title="$t('plm.ecn-execution-plans.执行计划项')">
            <a-table :columns="itemColumns" :data="plan.items ?? []" :pagination="false" row-key="id">
              <template #itemType="{ record }">
                <a-tag>{{ record.itemType === 'BOM' ? 'BOM变更' : '工艺路线变更' }}</a-tag>
              </template>
              <template #status="{ record }">
                <a-tag :color="({ COMPLETED: 'green', FAILED: 'red', PENDING: 'gray', IN_PROGRESS: 'orange' } as any)[record.status] ?? 'gray'">
                  {{ ({ COMPLETED: '已完成', FAILED: '失败', PENDING: '待执行', IN_PROGRESS: '执行中' } as any)[record.status] ?? record.status }}
                </a-tag>
              </template>
            </a-table>
          </a-tab-pane>

          <!-- 在制工单评估 -->
          <a-tab-pane key="wip" :title="$t('plm.ecn-execution-plans.在制工单评估')">
            <div v-if="wipAssessment">
              <!-- 汇总卡片 -->
              <a-row :gutter="16" style="margin-bottom: 16px">
                <a-col :span="6">
                  <a-card size="small" :bordered="false">
                    <a-statistic :title="$t('plm.ecn-execution-plans.受影响工单')" :value="wipAssessment.totalWoCount ?? 0" />
                  </a-card>
                </a-col>
                <a-col :span="6">
                  <a-card size="small" :bordered="false">
                    <a-statistic :title="$t('plm.ecn-execution-plans.继续旧版')" :value="wipAssessment.continueOldCount ?? 0" />
                  </a-card>
                </a-col>
                <a-col :span="6">
                  <a-card size="small" :bordered="false">
                    <a-statistic :title="$t('plm.ecn-execution-plans.切换新版')" :value="wipAssessment.switchNewCount ?? 0" />
                  </a-card>
                </a-col>
                <a-col :span="6">
                  <a-card size="small" :bordered="false">
                    <a-statistic :title="$t('plm.ecn-execution-plans.待人工确认')" :value="wipAssessment.suspendReviewCount ?? 0"
                      :value-style="wipAssessment.suspendReviewCount > 0 ? { color: '#ff7d00' } : {}" />
                  </a-card>
                </a-col>
              </a-row>

              <!-- 工单明细 -->
              <a-table :columns="wipColumns" :data="wipAssessment.items ?? []" :pagination="false" row-key="id">
                <template #suggestion="{ record }">
                  <a-tag :color="({ CONTINUE_OLD: 'blue', SWITCH_NEW: 'green', SUSPEND_REVIEW: 'orange' } as any)[record.suggestion] ?? 'gray'">
                    {{ ({ CONTINUE_OLD: '继续旧版', SWITCH_NEW: '切换新版', SUSPEND_REVIEW: '待确认' } as any)[record.suggestion] ?? record.suggestion }}
                  </a-tag>
                </template>
                <template #action="{ record }">
                  <a-button v-if="record.suggestion === 'SUSPEND_REVIEW'" type="text" size="small"
                    @click="showOverrideModal(record)">人工覆盖</a-button>
                </template>
              </a-table>

              <div style="margin-top: 16px; text-align: right">
                <a-button type="primary" @click="handleConfirmAssessment"
                  :disabled="(wipAssessment.suspendReviewCount ?? 0) > 0"
                  :loading="confirmLoading">
                  确认评估
                </a-button>
              </div>
            </div>
            <a-empty v-else :description="$t('plm.ecn-execution-plans.暂无评估数据')" />
          </a-tab-pane>

          <!-- 执行日志 -->
          <a-tab-pane key="logs" :title="$t('plm.ecn-execution-plans.执行日志')">
            <a-timeline>
              <a-timeline-item v-for="log in plan.logs ?? []" :key="log.id">
                <div>{{ log.action }} — {{ log.status }}</div>
                <div style="color: var(--color-text-3); font-size: 12px">{{ log.createdAt }}</div>
                <div v-if="log.errorMessage" style="color: #f53f3f; font-size: 12px">{{ log.errorMessage }}</div>
              </a-timeline-item>
            </a-timeline>
          </a-tab-pane>
        </a-tabs>
      </a-card>
    </a-spin>

    <!-- 修改生效日期弹窗 -->
    <a-modal v-model:visible="dateModalVisible" :title="$t('plm.ecn-execution-plans.修改生效日期')" :ok-loading="dateLoading"
      @ok="submitDateChange" @cancel="dateModalVisible = false">
      <a-date-picker v-model="newEffectiveDate" style="width: 100%" show-time />
    </a-modal>

    <!-- 人工覆盖弹窗 -->
    <a-modal v-model:visible="overrideModalVisible" :title="$t('plm.ecn-execution-plans.人工覆盖建议')" :ok-loading="overrideLoading"
      @ok="submitOverride" @cancel="overrideModalVisible = false">
      <a-form :model="overrideForm" layout="vertical">
        <a-form-item :label="$t('plm.ecn-execution-plans.处理建议')" required>
          <a-select v-model="overrideForm.suggestion">
            <a-option value="CONTINUE_OLD">继续使用旧版BOM/工艺</a-option>
            <a-option value="SWITCH_NEW">切换到新版BOM/工艺</a-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="$t('plm.ecn-execution-plans.覆盖原因')" required>
          <a-textarea v-model="overrideForm.reason" :rows="3" :placeholder="$t('plm.ecn-execution-plans.请说明覆盖原因')" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
import { useI18n } from 'vue-i18n'
import { ref, reactive, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Message } from '@arco-design/web-vue'
import {
  getEcnExecutionPlan, triggerEcnExecutionPlan, retryEcnExecutionPlan, cancelEcnExecutionPlan,
  updateEcnEffectiveDate, getWipAssessment, confirmWipAssessment, overrideWipAssessmentItem,
} from '@/api/plm'

const route = useRoute()
const router = useRouter()
const id = route.params.id as string

const loading = ref(false)
const actionLoading = ref(false)
const confirmLoading = ref(false)
const plan = ref<any>({})
const wipAssessment = ref<any>(null)
const activeTab = ref('items')

const itemColumns = [
  { title: t('plm.ecn-execution-plans.detail.变更类型'), dataIndex: 'itemType', slotName: 'itemType', width: 110 },
  { title: t('plm.ecn-execution-plans.detail.目标ID'), dataIndex: 'targetId', width: 160 },
  { title: t('plm.ecn-execution-plans.detail.旧版本'), dataIndex: 'oldVersion', width: 100 },
  { title: t('plm.ecn-execution-plans.detail.新版本'), dataIndex: 'newVersion', width: 100 },
  { title: t('plm.ecn-execution-plans.detail.状态'), dataIndex: 'status', slotName: 'status', width: 90 },
  { title: t('plm.ecn-execution-plans.detail.错误信息'), dataIndex: 'errorMessage', width: 200 },
]

const wipColumns = [
  { title: t('plm.ecn-execution-plans.detail.工单编号'), dataIndex: 'woCode', width: 150 },
  { title: t('plm.ecn-execution-plans.detail.完工进度'), dataIndex: 'completionPct', width: 110 },
  { title: t('plm.ecn-execution-plans.detail.系统建议'), dataIndex: 'suggestion', slotName: 'suggestion', width: 110 },
  { title: t('plm.ecn-execution-plans.detail.操作'), slotName: 'action', width: 100 },
]

const dateModalVisible = ref(false)
const dateLoading = ref(false)
const newEffectiveDate = ref('')

const overrideModalVisible = ref(false)
const overrideLoading = ref(false)
const overrideTargetId = ref('')
const overrideForm = reactive({ suggestion: 'CONTINUE_OLD' as 'CONTINUE_OLD' | 'SWITCH_NEW', reason: '' })

onMounted(async () => {
  loading.value = true
  try {
    const [planRes, wipRes] = await Promise.all([getEcnExecutionPlan(id), getWipAssessment(id)])
    plan.value = (planRes as any).data
    wipAssessment.value = (wipRes as any).data
  } catch (e: any) { Message.error(e.message || '加载失败') }
  finally { loading.value = false }
})

async function handleTrigger() { actionLoading.value = true; try { await triggerEcnExecutionPlan(id); Message.success('触发成功'); reload() } catch (e: any) { Message.error(e.message || '触发失败') } finally { actionLoading.value = false } }
async function handleRetry() { actionLoading.value = true; try { await retryEcnExecutionPlan(id); Message.success('重试已发起'); reload() } catch (e: any) { Message.error(e.message || '操作失败') } finally { actionLoading.value = false } }
async function handleCancel() { try { await cancelEcnExecutionPlan(id); Message.success('取消成功'); plan.value.status = 'CANCELLED' } catch (e: any) { Message.error(e.message || '操作失败') } }

function showDateModal() { newEffectiveDate.value = plan.value.effectiveDate; dateModalVisible.value = true }
async function submitDateChange() {
  if (!newEffectiveDate.value) { Message.warning('请选择日期'); return }
  dateLoading.value = true
  try { await updateEcnEffectiveDate(id, { effectiveDate: newEffectiveDate.value }); Message.success('修改成功'); dateModalVisible.value = false; reload() }
  catch (e: any) { Message.error(e.message || '修改失败') }
  finally { dateLoading.value = false }
}

function showOverrideModal(record: any) { overrideTargetId.value = record.id; Object.assign(overrideForm, { suggestion: 'CONTINUE_OLD', reason: '' }); overrideModalVisible.value = true }
async function submitOverride() {
  if (!overrideForm.reason) { Message.warning('请填写覆盖原因'); return }
  overrideLoading.value = true
  try { await overrideWipAssessmentItem(overrideTargetId.value, overrideForm); Message.success('覆盖成功'); overrideModalVisible.value = false; reloadWip() }
  catch (e: any) { Message.error(e.message || '操作失败') }
  finally { overrideLoading.value = false }
}

async function handleConfirmAssessment() {
  confirmLoading.value = true
  try { await confirmWipAssessment(id); Message.success('评估已确认'); reloadWip() }
  catch (e: any) { Message.error(e.message || '操作失败') }
  finally { confirmLoading.value = false }
}

async function reload() { const res = await getEcnExecutionPlan(id); plan.value = (res as any).data }
async function reloadWip() { const res = await getWipAssessment(id); wipAssessment.value = (res as any).data }

function statusLabel(s: string) { return { PENDING: '待执行', IN_PROGRESS: '执行中', COMPLETED: '已完成', FAILED: '失败', CANCELLED: '已取消' }[s] ?? s }
function statusColor(s: string) { return { PENDING: 'gray', IN_PROGRESS: 'orange', COMPLETED: 'green', FAILED: 'red', CANCELLED: 'gray' }[s] ?? 'gray' }
</script>

<style scoped>
.page-container { padding: 16px; }
</style>
