<template>
  <div class="page-container">
    <a-page-header :title="$t('traceability.batches.detail.追溯批次详情')" @back="handleBack">
      <template #extra>
        <a-space>
          <a-button @click="handleForwardTrace">
            <template #icon><icon-arrow-right /></template>
            正向追溯
          </a-button>
          <a-button @click="handleBackwardTrace">
            <template #icon><icon-arrow-left /></template>
            反向追溯
          </a-button>
          <a-button type="primary" @click="handleGenerateReport" :loading="reportLoading">
            <template #icon><icon-file /></template>
            生成报告
          </a-button>
        </a-space>
      </template>
    </a-page-header>

    <a-spin :loading="loading">
      <!-- 基本信息 + 状态 -->
      <a-card :bordered="false" style="margin-bottom: 16px">
        <a-row :gutter="24">
          <!-- 左：基本信息 -->
          <a-col :span="16">
            <a-descriptions :column="2" bordered>
              <a-descriptions-item :label="$t('traceability.batches.detail.追溯码')" :span="2">
                <span style="font-family: monospace; font-size: 15px; font-weight: 600">
                  {{ batch.traceCode }}
                </span>
              </a-descriptions-item>
              <a-descriptions-item :label="$t('traceability.batches.detail.物料编码')">{{ batch.materialCode }}</a-descriptions-item>
              <a-descriptions-item :label="$t('traceability.batches.detail.物料名称')">{{ batch.materialName }}</a-descriptions-item>
              <a-descriptions-item :label="$t('traceability.batches.detail.批次号')">{{ batch.batchNo }}</a-descriptions-item>
              <a-descriptions-item :label="$t('traceability.batches.detail.生产工单')">{{ batch.mesWoId || '-' }}</a-descriptions-item>
              <a-descriptions-item :label="$t('traceability.batches.detail.计划数量')">{{ batch.plannedQty }}</a-descriptions-item>
              <a-descriptions-item :label="$t('traceability.batches.detail.实际数量')">{{ batch.actualQty }}</a-descriptions-item>
              <a-descriptions-item :label="$t('traceability.batches.detail.生产开始')">{{ batch.productionStart || '-' }}</a-descriptions-item>
              <a-descriptions-item :label="$t('traceability.batches.detail.生产完成')">{{ batch.productionEnd || '-' }}</a-descriptions-item>
              <a-descriptions-item :label="$t('traceability.batches.detail.操作人')">{{ batch.operatorId || '-' }}</a-descriptions-item>
              <a-descriptions-item :label="$t('traceability.batches.detail.创建时间')">{{ batch.createdAt }}</a-descriptions-item>
            </a-descriptions>
          </a-col>

          <!-- 右：状态 + 条码图片 -->
          <a-col :span="8">
            <a-space direction="vertical" fill>
              <!-- 状态标签 -->
              <a-card size="small" :bordered="false" style="background: var(--color-fill-2)">
                <a-space wrap>
                  <div>
                    <span class="label">检验状态：</span>
                    <a-tag v-if="batch.inspectionStatus === 'PASSED'" color="green">合格</a-tag>
                    <a-tag v-else-if="batch.inspectionStatus === 'FAILED'" color="red">不合格</a-tag>
                    <a-tag v-else-if="batch.inspectionStatus === 'CONCESSION'" color="orange">让步接收</a-tag>
                    <a-tag v-else color="gray">待检</a-tag>
                  </div>
                  <div>
                    <span class="label">库存状态：</span>
                    <a-tag v-if="batch.inventoryStatus === 'IN_STOCK'" color="blue">在库</a-tag>
                    <a-tag v-else-if="batch.inventoryStatus === 'SHIPPED'" color="gray">已发货</a-tag>
                    <a-tag v-else-if="batch.inventoryStatus === 'CONSUMED'" color="purple">已消耗</a-tag>
                    <a-tag v-else-if="batch.inventoryStatus === 'FROZEN'" color="red">已冻结</a-tag>
                  </div>
                  <div v-if="batch.isFrozen">
                    <span class="label">冻结原因：</span>
                    <a-tag color="red">{{ batch.freezeReason || '召回冻结' }}</a-tag>
                  </div>
                </a-space>
              </a-card>

              <!-- 条码/二维码 -->
              <a-card v-if="batch.barcodePath || batch.qrcodePath" size="small" :title="$t('traceability.batches.detail.条码二维码')" :bordered="false">
                <a-space>
                  <div v-if="batch.barcodePath" style="text-align: center">
                    <img :src="batch.barcodePath" alt="条码" style="max-width: 160px; max-height: 60px" />
                    <div style="font-size: 11px; color: var(--color-text-3)">Code128</div>
                  </div>
                  <div v-if="batch.qrcodePath" style="text-align: center">
                    <img :src="batch.qrcodePath" alt="二维码" style="max-width: 80px; max-height: 80px" />
                    <div style="font-size: 11px; color: var(--color-text-3)">QR Code</div>
                  </div>
                </a-space>
              </a-card>
            </a-space>
          </a-col>
        </a-row>
      </a-card>

      <!-- 上下游批次 -->
      <a-row :gutter="16">
        <!-- 上游批次（原材料） -->
        <a-col :span="12">
          <a-card :title="$t('traceability.batches.detail.上游批次直接原材料')" :bordered="false">
            <a-table
              :columns="upstreamColumns"
              :data="batch.upstreamBatches || []"
              :pagination="false"
              row-key="id"
              size="small"
            >
              <template #traceCode="{ record }">
                <a-link @click="goToBatch(record.inputBatchId)">{{ record.traceCode }}</a-link>
              </template>
              <template #linkType="{ record }">
                <a-tag size="small" :color="linkTypeColor(record.linkType)">{{ linkTypeLabel(record.linkType) }}</a-tag>
              </template>
              <template #empty>
                <a-empty :description="$t('traceability.batches.detail.无上游原材料批次')" />
              </template>
            </a-table>
          </a-card>
        </a-col>

        <!-- 下游批次（成品） -->
        <a-col :span="12">
          <a-card :title="$t('traceability.batches.detail.下游批次直接成品')" :bordered="false">
            <a-table
              :columns="downstreamColumns"
              :data="batch.downstreamBatches || []"
              :pagination="false"
              row-key="id"
              size="small"
            >
              <template #traceCode="{ record }">
                <a-link @click="goToBatch(record.outputBatchId)">{{ record.traceCode }}</a-link>
              </template>
              <template #empty>
                <a-empty :description="$t('traceability.batches.detail.无下游成品批次')" />
              </template>
            </a-table>
          </a-card>
        </a-col>
      </a-row>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
import { useI18n } from 'vue-i18n'
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Message } from '@arco-design/web-vue'
import { IconArrowRight, IconArrowLeft, IconFile } from '@arco-design/web-vue/es/icon'
import { getTraceBatch, generateReport } from '@/api/traceability'

const route = useRoute()
const router = useRouter()
const batchId = route.params.id as string

const loading = ref(false)
const reportLoading = ref(false)
const batch = ref<any>({})

const upstreamColumns = [
  { title: t('traceability.batches.detail.追溯码'), dataIndex: 'traceCode', slotName: 'traceCode', width: 180 },
  { title: t('traceability.batches.detail.物料名称'), dataIndex: 'materialName', width: 140 },
  { title: t('traceability.batches.detail.投入数量'), dataIndex: 'inputQty', width: 90 },
  { title: t('traceability.batches.detail.关联类型'), dataIndex: 'linkType', slotName: 'linkType', width: 90 },
]

const downstreamColumns = [
  { title: t('traceability.batches.detail.追溯码'), dataIndex: 'traceCode', slotName: 'traceCode', width: 180 },
  { title: t('traceability.batches.detail.物料名称'), dataIndex: 'materialName', width: 140 },
  { title: t('traceability.batches.detail.产出数量'), dataIndex: 'outputQty', width: 90 },
]

onMounted(fetchBatch)

async function fetchBatch() {
  loading.value = true
  try {
    const res = await getTraceBatch(batchId)
    batch.value = res
  } catch (e: any) {
    Message.error(e.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function handleBack() { router.back() }

function handleForwardTrace() {
  router.push(`/traceability/forward/${batch.value.traceCode}`)
}

function handleBackwardTrace() {
  router.push(`/traceability/backward/${batch.value.traceCode}`)
}

async function handleGenerateReport() {
  reportLoading.value = true
  try {
    await generateReport({ batchId, format: 'PDF' })
    Message.success('报告生成中，请稍后下载')
  } catch (e: any) {
    Message.error(e.message || '生成失败')
  } finally {
    reportLoading.value = false
  }
}

function goToBatch(id: string) {
  router.push(`/traceability/batches/${id}`)
}

function linkTypeLabel(type: string) {
  const map: Record<string, string> = {
    PRODUCTION: '生产', SPLIT: '拆分', MERGE: '合并', REWORK: '返工',
  }
  return map[type] ?? type
}

function linkTypeColor(type: string) {
  const map: Record<string, string> = {
    PRODUCTION: 'blue', SPLIT: 'orange', MERGE: 'green', REWORK: 'red',
  }
  return map[type] ?? 'gray'
}
</script>

<style scoped>
.page-container { padding: 16px; }
.label { color: var(--color-text-3); font-size: 13px; }
</style>
