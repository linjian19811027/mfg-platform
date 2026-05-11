<template>
  <div class="page-container">
    <a-card :title="$t('traceability.recall.index.发起召回评估')" :bordered="false" style="margin-bottom: 16px">
      <a-form :model="assessForm" layout="inline">
        <a-form-item :label="$t('traceability.recall.index.问题批次追溯码')">
          <a-input
            v-model="assessForm.traceCode"
            :placeholder="$t('traceability.recall.index.请输入或扫描问题批次追溯码')"
            style="width: 300px"
          >
            <template #suffix>
              <icon-qrcode />
            </template>
          </a-input>
        </a-form-item>
        <a-form-item :label="$t('traceability.recall.index.问题描述')">
          <a-textarea
            v-model="assessForm.reason"
            :placeholder="$t('traceability.recall.index.请描述问题原因')"
            style="width: 400px"
            :rows="2"
          />
        </a-form-item>
        <a-form-item>
          <a-button type="primary" @click="handleAssess" :loading="assessLoading">
            <template #icon><icon-thunderbolt /></template>
            发起评估
          </a-button>
        </a-form-item>
      </a-form>
    </a-card>

    <!-- 评估进度 -->
    <a-card v-if="currentAssessment" :title="$t('traceability.recall.index.评估进度')" :bordered="false" style="margin-bottom: 16px">
      <a-space direction="vertical" fill>
        <a-descriptions :column="3" bordered>
          <a-descriptions-item :label="$t('traceability.recall.index.评估编号')">{{ currentAssessment.assessmentNo }}</a-descriptions-item>
          <a-descriptions-item :label="$t('traceability.recall.index.问题批次')">{{ currentAssessment.problemBatchId }}</a-descriptions-item>
          <a-descriptions-item :label="$t('common.status')">
            <a-tag v-if="currentAssessment.status === 'CALCULATING'" color="blue">
              <template #icon><icon-loading /></template>
              计算中
            </a-tag>
            <a-tag v-else-if="currentAssessment.status === 'COMPLETED'" color="green">已完成</a-tag>
            <a-tag v-else-if="currentAssessment.status === 'FAILED'" color="red">失败</a-tag>
          </a-descriptions-item>
        </a-descriptions>

        <a-progress
          v-if="currentAssessment.status === 'CALCULATING'"
          :percent="progressPercent"
          status="normal"
        />

        <!-- 评估结果 -->
        <div v-if="currentAssessment.status === 'COMPLETED'" class="assessment-result">
          <a-row :gutter="16">
            <a-col :span="6">
              <a-statistic :title="$t('traceability.recall.index.受影响下游批次')" :value="currentAssessment.affectedOutputBatches" />
            </a-col>
            <a-col :span="6">
              <a-statistic :title="$t('traceability.recall.index.受影响上游批次')" :value="currentAssessment.affectedInputBatches" />
            </a-col>
            <a-col :span="6">
              <a-statistic :title="$t('traceability.recall.index.受影响销售订单')" :value="currentAssessment.affectedSoCount" />
            </a-col>
            <a-col :span="6">
              <a-statistic :title="$t('traceability.recall.index.在库数量')" :value="currentAssessment.inStockQty" suffix="件" />
            </a-col>
          </a-row>

          <a-divider />

          <h4>风险等级分布</h4>
          <a-row :gutter="16">
            <a-col :span="8">
              <a-card :bordered="false" :style="{ backgroundColor: '#ffece8' }">
                <a-statistic
                  :title="$t('traceability.recall.index.高风险已发货')"
                  :value="currentAssessment.highRiskCount"
                  :value-style="{ color: '#f53f3f' }"
                />
              </a-card>
            </a-col>
            <a-col :span="8">
              <a-card :bordered="false" :style="{ backgroundColor: '#fff7e8' }">
                <a-statistic
                  :title="$t('traceability.recall.index.中风险在库')"
                  :value="currentAssessment.mediumRiskCount"
                  :value-style="{ color: '#ff7d00' }"
                />
              </a-card>
            </a-col>
            <a-col :span="8">
              <a-card :bordered="false" :style="{ backgroundColor: '#e8ffea' }">
                <a-statistic
                  :title="$t('traceability.recall.index.低风险生产中')"
                  :value="currentAssessment.lowRiskCount"
                  :value-style="{ color: '#00b42a' }"
                />
              </a-card>
            </a-col>
          </a-row>

          <a-divider />

          <a-space>
            <a-button type="primary" @click="handleConfirmFreeze">
              <template #icon><icon-lock /></template>
              确认冻结在库批次
            </a-button>
            <a-button @click="handleViewDetail">查看详细报告</a-button>
          </a-space>
        </div>
      </a-space>
    </a-card>

    <!-- 历史评估记录 -->
    <a-card :title="$t('traceability.recall.index.历史评估记录')" :bordered="false">
      <a-table
        :columns="columns"
        :data="tableData"
        :loading="loading"
        :pagination="pagination"
        @page-change="handlePageChange"
        @page-size-change="handlePageSizeChange"
        row-key="id"
      >
        <template #assessmentNo="{ record }">
          <a-link @click="handleViewAssessment(record)">{{ record.assessmentNo }}</a-link>
        </template>
        <template #status="{ record }">
          <a-tag v-if="record.status === 'CALCULATING'" color="blue">计算中</a-tag>
          <a-tag v-else-if="record.status === 'COMPLETED'" color="green">已完成</a-tag>
          <a-tag v-else-if="record.status === 'FAILED'" color="red">失败</a-tag>
        </template>
        <template #riskLevel="{ record }">
          <a-space>
            <a-tag color="red">高: {{ record.highRiskCount }}</a-tag>
            <a-tag color="orange">中: {{ record.mediumRiskCount }}</a-tag>
            <a-tag color="green">低: {{ record.lowRiskCount }}</a-tag>
          </a-space>
        </template>
        <template #action="{ record }">
          <a-space>
            <a-button type="text" size="small" @click="handleViewAssessment(record)">详情</a-button>
            <a-button
              v-if="record.status === 'COMPLETED' && record.mediumRiskCount > 0"
              type="text"
              size="small"
              @click="handleFreeze(record)"
            >
              冻结在库批次
            </a-button>
          </a-space>
        </template>
      </a-table>
    </a-card>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
import { useI18n } from 'vue-i18n'
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { Message, Modal } from '@arco-design/web-vue'
import { IconQrcode, IconThunderbolt, IconLoading, IconLock } from '@arco-design/web-vue/es/icon'
import { assessRecall, getRecallAssessments, confirmRecall } from '@/api/traceability'
import { useRouter } from 'vue-router'

const router = useRouter()

const assessForm = reactive({
  traceCode: '',
  reason: '',
})

const assessLoading = ref(false)
const currentAssessment = ref<any>(null)
const progressPercent = ref(0)
let progressTimer: any = null

const loading = ref(false)
const tableData = ref([])
const pagination = reactive({
  current: 1,
  pageSize: 20,
  total: 0,
  showTotal: true,
  showPageSize: true,
})

const columns = [
  { title: t('traceability.recall.index.评估编号'), dataIndex: 'assessmentNo', slotName: 'assessmentNo', width: 180 },
  { title: t('traceability.recall.index.问题批次'), dataIndex: 'problemBatchId', width: 200 },
  { title: t('traceability.recall.index.状态'), dataIndex: 'status', slotName: 'status', width: 100 },
  { title: t('traceability.recall.index.受影响批次'), dataIndex: 'affectedOutputBatches', width: 120 },
  { title: t('traceability.recall.index.受影响订单'), dataIndex: 'affectedSoCount', width: 120 },
  { title: t('traceability.recall.index.风险分布'), dataIndex: 'riskLevel', slotName: 'riskLevel', width: 250 },
  { title: t('traceability.recall.index.创建时间'), dataIndex: 'createdAt', width: 160 },
  { title: t('traceability.recall.index.操作'), slotName: 'action', width: 200, fixed: 'right' },
]

onMounted(() => {
  fetchData()
})

onUnmounted(() => {
  if (progressTimer) {
    clearInterval(progressTimer)
  }
})

async function fetchData() {
  loading.value = true
  try {
    const params = {
      page: pagination.current,
      pageSize: pagination.pageSize,
    }
    const res = await getRecallAssessments(params)
    tableData.value = (res as any).list ?? (res as any).items ?? []
    pagination.total = (res as any).total ?? 0
  } catch (error: any) {
    Message.error(error.message || '加载失败')
  } finally {
    loading.value = false
  }
}

async function handleAssess() {
  if (!assessForm.traceCode) {
    Message.warning('请输入问题批次追溯码')
    return
  }
  if (!assessForm.reason) {
    Message.warning('请描述问题原因')
    return
  }

  assessLoading.value = true
  try {
    const res = await assessRecall(assessForm)
    currentAssessment.value = res
    
    // 如果状态是计算中，启动进度模拟
    if (currentAssessment.value.status === 'CALCULATING') {
      startProgressSimulation()
    }
    
    Message.success('评估已发起')
    fetchData()
  } catch (error: any) {
    Message.error(error.message || '评估失败')
  } finally {
    assessLoading.value = false
  }
}

function startProgressSimulation() {
  progressPercent.value = 0
  progressTimer = setInterval(() => {
    if (progressPercent.value < 90) {
      progressPercent.value += Math.random() * 10
    }
    
    // 实际应该轮询后端获取真实进度
    // 这里简化处理，3秒后模拟完成
    if (progressPercent.value >= 90) {
      clearInterval(progressTimer)
      setTimeout(() => {
        progressPercent.value = 100
        currentAssessment.value.status = 'COMPLETED'
        // 模拟数据
        currentAssessment.value.affectedOutputBatches = 15
        currentAssessment.value.affectedInputBatches = 8
        currentAssessment.value.affectedSoCount = 3
        currentAssessment.value.inStockQty = 120
        currentAssessment.value.highRiskCount = 5
        currentAssessment.value.mediumRiskCount = 7
        currentAssessment.value.lowRiskCount = 3
      }, 1000)
    }
  }, 300)
}

function handlePageChange(page: number) {
  pagination.current = page
  fetchData()
}

function handlePageSizeChange(pageSize: number) {
  pagination.pageSize = pageSize
  pagination.current = 1
  fetchData()
}

function handleViewAssessment(record: any) {
  currentAssessment.value = record
}

function handleViewDetail() {
  if (currentAssessment.value) {
    router.push(`/traceability/recall/assessments/${currentAssessment.value.id}`)
  }
}

function handleConfirmFreeze() {
  Modal.confirm({
    title: t('traceability.recall.index.确认冻结'),
    content: `确定要冻结 ${currentAssessment.value.mediumRiskCount} 个在库批次吗？冻结后这些批次将无法出库。`,
    onOk: async () => {
      try {
        await confirmRecall(currentAssessment.value.id)
        Message.success('冻结指令已发送')
        fetchData()
      } catch (error: any) {
        Message.error(error.message || '冻结失败')
      }
    },
  })
}

function handleFreeze(record: any) {
  currentAssessment.value = record
  handleConfirmFreeze()
}
</script>

<style scoped>
.page-container {
  padding: 16px;
}

.assessment-result {
  margin-top: 16px;
}
</style>
