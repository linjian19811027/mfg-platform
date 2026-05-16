<template>
  <div class="page-container">
    <a-page-header :title="$t('traceability.recall.detail.召回评估详情')" @back="handleBack" />

    <a-spin :loading="loading">
      <!-- 基本信息 -->
      <a-card :bordered="false" style="margin-bottom: 16px">
        <a-descriptions :column="3" bordered>
          <a-descriptions-item :label="$t('traceability.recall.detail.评估编号')">
            <span style="font-family: monospace; font-weight: 600">{{ assessment.assessmentNo }}</span>
          </a-descriptions-item>
          <a-descriptions-item :label="$t('traceability.recall.detail.问题批次')">{{ assessment.problemBatchId }}</a-descriptions-item>
          <a-descriptions-item :label="$t('traceability.recall.detail.版本号')">v{{ assessment.version }}</a-descriptions-item>
          <a-descriptions-item :label="$t('common.status')">
            <a-tag v-if="assessment.status === 'CALCULATING'" color="blue">{{ $t('traceability.recall.lbl1855') }}</a-tag>
            <a-tag v-else-if="assessment.status === 'COMPLETED'" color="green">{{ $t('traceability.recall.completed') }}</a-tag>
            <a-tag v-else-if="assessment.status === 'FAILED'" color="red">{{ $t('traceability.recall.lbl1856') }}</a-tag>
          </a-descriptions-item>
          <a-descriptions-item :label="$t('traceability.recall.detail.操作人')">{{ assessment.operatorId || '-' }}</a-descriptions-item>
          <a-descriptions-item :label="$t('traceability.recall.detail.完成时间')">{{ assessment.completedAt || '-' }}</a-descriptions-item>
        </a-descriptions>
      </a-card>

      <!-- 影响范围汇总 -->
      <a-row :gutter="16" style="margin-bottom: 16px">
        <a-col :span="4">
          <a-card :bordered="false" size="small">
            <a-statistic :title="$t('traceability.recall.detail.受影响客户')" :value="assessment.affectedCustomers ?? 0" />
          </a-card>
        </a-col>
        <a-col :span="4">
          <a-card :bordered="false" size="small">
            <a-statistic :title="$t('traceability.recall.detail.受影响销售订单')" :value="assessment.affectedSoCount ?? 0" />
          </a-card>
        </a-col>
        <a-col :span="4">
          <a-card :bordered="false" size="small">
            <a-statistic :title="$t('traceability.recall.detail.受影响成品批次')" :value="assessment.affectedOutputBatches ?? 0" />
          </a-card>
        </a-col>
        <a-col :span="4">
          <a-card :bordered="false" size="small">
            <a-statistic :title="$t('traceability.recall.detail.受影响原材料批次')" :value="assessment.affectedInputBatches ?? 0" />
          </a-card>
        </a-col>
        <a-col :span="4">
          <a-card :bordered="false" size="small">
            <a-statistic :title="$t('traceability.recall.detail.受影响供应商')" :value="assessment.affectedSuppliers ?? 0" />
          </a-card>
        </a-col>
        <a-col :span="4">
          <a-card :bordered="false" size="small">
            <a-statistic :title="$t('traceability.recall.r33096')" :value="assessment.inStockQty ?? 0" :suffix="t('traceability.recall.r44003')" />
          </a-card>
        </a-col>
      </a-row>

      <!-- 风险等级分布 -->
      <a-row :gutter="16" style="margin-bottom: 16px">
        <a-col :span="8">
          <a-card :bordered="false" :style="{ background: '#ffece8' }">
            <a-statistic
              :title="$t('traceability.recall.detail.高风险已发货')"
              :value="assessment.highRiskCount ?? 0"
              :value-style="{ color: '#f53f3f', fontSize: '32px' }"
            />
            <div style="color: #f53f3f; font-size: 12px; margin-top: 4px">{{ $t('traceability.recall.lbl1857') }}</div>
          </a-card>
        </a-col>
        <a-col :span="8">
          <a-card :bordered="false" :style="{ background: '#fff7e8' }">
            <a-statistic
              :title="$t('traceability.recall.detail.中风险在库待发')"
              :value="assessment.mediumRiskCount ?? 0"
              :value-style="{ color: '#ff7d00', fontSize: '32px' }"
            />
            <div style="color: #ff7d00; font-size: 12px; margin-top: 4px">{{ $t('traceability.recall.lbl1858') }}</div>
          </a-card>
        </a-col>
        <a-col :span="8">
          <a-card :bordered="false" :style="{ background: '#e8ffea' }">
            <a-statistic
              :title="$t('traceability.recall.detail.低风险在产')"
              :value="assessment.lowRiskCount ?? 0"
              :value-style="{ color: '#00b42a', fontSize: '32px' }"
            />
            <div style="color: #00b42a; font-size: 12px; margin-top: 4px">{{ $t('traceability.recall.lbl1859') }}</div>
          </a-card>
        </a-col>
      </a-row>

      <!-- 受影响批次列表 -->
      <a-card :title="$t('traceability.recall.detail.受影响批次列表')" :bordered="false">
        <a-table
          :columns="batchColumns"
          :data="affectedBatches"
          :loading="batchLoading"
          :pagination="pagination"
          @page-change="handlePageChange"
          row-key="id"
        >
          <template #traceCode="{ record }">
            <a-link @click="viewBatch(record)">{{ record.traceCode }}</a-link>
          </template>
          <template #inventoryStatus="{ record }">
            <a-tag v-if="record.inventoryStatus === 'IN_STOCK'" color="blue">{{ $t('traceability.recall.lbl1860') }}</a-tag>
            <a-tag v-else-if="record.inventoryStatus === 'SHIPPED'" color="gray">{{ $t('traceability.recall.lbl1861') }}</a-tag>
            <a-tag v-else-if="record.inventoryStatus === 'CONSUMED'" color="purple">{{ $t('traceability.recall.lbl1862') }}</a-tag>
            <a-tag v-else-if="record.inventoryStatus === 'FROZEN'" color="red">{{ $t('traceability.recall.lbl1863') }}</a-tag>
          </template>
          <template #riskLevel="{ record }">
            <a-tag v-if="record.riskLevel === 'HIGH'" color="red">{{ $t('traceability.recall.high') }}</a-tag>
            <a-tag v-else-if="record.riskLevel === 'MEDIUM'" color="orange">{{ $t('traceability.recall.medium') }}</a-tag>
            <a-tag v-else color="green">{{ $t('traceability.recall.low') }}</a-tag>
          </template>
          <template #isFrozen="{ record }">
            <a-tag v-if="record.isFrozen" color="red">{{ $t('traceability.recall.lbl1864') }}</a-tag>
            <span v-else style="color: var(--color-text-3)">{{ $t('traceability.recall.lbl1865') }}</span>
          </template>
          <template #empty>
            <a-empty :description="$t('traceability.recall.detail.暂无受影响批次数据')" />
          </template>
        </a-table>
      </a-card>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
import { useI18n } from 'vue-i18n'
import { ref, reactive, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Message } from '@arco-design/web-vue'
import { getRecallAssessment } from '@/api/traceability'

const route = useRoute()
const router = useRouter()
const assessmentId = route.params.id as string

const loading = ref(false)
const batchLoading = ref(false)
const assessment = ref<any>({})
const affectedBatches = ref([])
const pagination = reactive({ current: 1, pageSize: 20, total: 0, showTotal: true })

const batchColumns = [
  { title: t('traceability.recall.detail.追溯码'), dataIndex: 'traceCode', slotName: 'traceCode', width: 200 },
  { title: t('traceability.recall.detail.物料编码'), dataIndex: 'materialCode', width: 130 },
  { title: t('traceability.recall.detail.物料名称'), dataIndex: 'materialName', width: 160 },
  { title: t('traceability.recall.detail.批次号'), dataIndex: 'batchNo', width: 130 },
  { title: t('traceability.recall.detail.库存状态'), dataIndex: 'inventoryStatus', slotName: 'inventoryStatus', width: 100 },
  { title: t('traceability.recall.detail.风险等级'), dataIndex: 'riskLevel', slotName: 'riskLevel', width: 90 },
  { title: t('traceability.recall.detail.冻结状态'), dataIndex: 'isFrozen', slotName: 'isFrozen', width: 90 },
]

onMounted(fetchAssessment)

async function fetchAssessment() {
  loading.value = true
  try {
    const res = await getRecallAssessment(assessmentId)
    assessment.value = res
    affectedBatches.value = (res as any).affectedBatchList ?? []
    pagination.total = affectedBatches.value.length
  } catch (e: any) {
    Message.error(e.message || t('traceability.加载失败'))
  } finally {
    loading.value = false
  }
}

function handlePageChange(page: number) {
  pagination.current = page
}

function handleBack() { router.back() }

function viewBatch(record: any) {
  router.push(`/traceability/batches/${record.id}`)
}
</script>

<style scoped>
.page-container { padding: 16px; }
</style>
