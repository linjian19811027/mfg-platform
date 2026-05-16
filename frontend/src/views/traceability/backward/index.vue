<template>
  <div class="page-container">
    <a-page-header :title="$t('traceability.backward.index.反向追溯')" @back="handleBack" />

    <a-card :bordered="false">
      <!-- 查询输入 -->
      <a-form :model="queryForm" layout="inline" class="query-form">
        <a-form-item :label="$t('traceability.backward.index.追溯码')">
          <a-input
            v-model="queryForm.traceCode"
            :placeholder="$t('traceability.backward.index.请输入或扫描追溯码')"
            style="width: 300px"
            @pressEnter="handleTrace"
          >
            <template #suffix><icon-qrcode /></template>
          </a-input>
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" @click="handleTrace" :loading="loading">
              <template #icon><icon-search /></template>
              {{ $t('traceability.backward.trace') }}
            </a-button>
            <a-button @click="handleReset">{{ $t('common.reset') }}</a-button>
          </a-space>
        </a-form-item>
      </a-form>

      <!-- 追溯结果 -->
      <div v-if="traceResult">
        <a-alert v-if="traceResult.truncated" type="warning" style="margin-bottom: 16px">
          {{ $t('traceability.backward.traceNodesTruncated') }}
        </a-alert>

        <a-space style="margin-bottom: 16px">
          <a-button @click="handleExportPdf" :loading="exportLoading">
            <template #icon><icon-download /></template>
            {{ $t('traceability.backward.exportPdf') }}
          </a-button>
          <a-tag color="blue">{{ $t('traceability.backward.r22018', {nodeCount: traceResult.nodeCount}) }}</a-tag>
          <a-tag v-if="hasMissingData" color="red">{{ $t('traceability.backward.lbl1807') }}</a-tag>
        </a-space>

        <!-- ECharts 树形图 -->
        <a-card :title="$t('traceability.backward.index.反向追溯链路图')" :bordered="false">
          <div ref="treeChartRef" style="height: 600px"></div>
        </a-card>

        <!-- 节点明细表格 -->
        <a-card :title="$t('traceability.backward.index.节点明细')" :bordered="false" style="margin-top: 16px">
          <a-table
            :columns="nodeColumns"
            :data="traceResult.nodes || []"
            :pagination="{ pageSize: 20 }"
            row-key="batchId"
          >
            <template #traceCode="{ record }">
              <a-link @click="handleViewBatch(record)">{{ record.traceCode }}</a-link>
            </template>
            <template #inspectionStatus="{ record }">
              <a-tag v-if="record.inspectionStatus === 'PASSED'" color="green">{{ $t('traceability.backward.qualified') }}</a-tag>
              <a-tag v-else-if="record.inspectionStatus === 'FAILED'" color="red">{{ $t('traceability.backward.unqualified') }}</a-tag>
              <a-tag v-else color="orange">{{ $t('traceability.backward.uninspected') }}</a-tag>
            </template>
            <template #missingData="{ record }">
              <a-tag v-if="record.missingData" color="red">{{ $t('traceability.backward.lbl1808') }}</a-tag>
              <span v-else style="color: var(--color-text-3)">{{ $t('traceability.backward.lbl1809') }}</span>
            </template>
          </a-table>
        </a-card>
      </div>

      <a-empty v-else :description="$t('traceability.backward.index.请输入追溯码开始反向追溯')" style="margin: 60px 0" />
    </a-card>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
import { useI18n } from 'vue-i18n'
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Message } from '@arco-design/web-vue'
import { IconSearch, IconQrcode, IconDownload } from '@arco-design/web-vue/es/icon'
import * as echarts from 'echarts'
import { backwardTrace, backwardTracePdf } from '@/api/traceability'

const route = useRoute()
const router = useRouter()

const queryForm = reactive({ traceCode: '' })
const loading = ref(false)
const exportLoading = ref(false)
const traceResult = ref<any>(null)
const treeChartRef = ref()
let treeChart: echarts.ECharts | null = null

const hasMissingData = computed(() =>
  (traceResult.value?.nodes ?? []).some((n: any) => n.missingData)
)

const nodeColumns = [
  { title: t('traceability.backward.index.层级'), dataIndex: 'depth', width: 70 },
  { title: t('traceability.backward.index.追溯码'), dataIndex: 'traceCode', slotName: 'traceCode', width: 200 },
  { title: t('traceability.backward.index.物料编码'), dataIndex: 'materialCode', width: 130 },
  { title: t('traceability.backward.index.物料名称'), dataIndex: 'materialName', width: 160 },
  { title: t('traceability.backward.index.批次号'), dataIndex: 'batchNo', width: 130 },
  { title: t('traceability.backward.index.供应商'), dataIndex: 'supplierName', width: 140 },
  { title: t('traceability.backward.index.采购订单'), dataIndex: 'scmPoNo', width: 130 },
  { title: t('traceability.backward.index.检验结果'), dataIndex: 'inspectionStatus', slotName: 'inspectionStatus', width: 90 },
  { title: t('traceability.backward.index.数据状态'), dataIndex: 'missingData', slotName: 'missingData', width: 90 },
]

onMounted(() => {
  const traceCode = route.params.traceCode as string
  if (traceCode) {
    queryForm.traceCode = traceCode
    handleTrace()
  }
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  treeChart?.dispose()
  window.removeEventListener('resize', handleResize)
})

async function handleTrace() {
  if (!queryForm.traceCode) {
    Message.warning(t('traceability.请输入追溯码'))
    return
  }
  loading.value = true
  try {
    const res = await backwardTrace(queryForm.traceCode)
    traceResult.value = res
    setTimeout(renderTreeChart, 100)
    Message.success(t('traceability.追溯完成'))
  } catch (e: any) {
    Message.error(e.message || t('traceability.追溯失败'))
  } finally {
    loading.value = false
  }
}

function handleReset() {
  queryForm.traceCode = ''
  traceResult.value = null
  treeChart?.clear()
}

function renderTreeChart() {
  if (!treeChartRef.value || !traceResult.value) return
  if (!treeChart) treeChart = echarts.init(treeChartRef.value)

  const nodes = traceResult.value.nodes ?? []
  if (!nodes.length) return

  const root = nodes[0]
  const treeData = buildTree(nodes, root.batchId, 0)

  treeChart.setOption({
    tooltip: {
      trigger: 'item',
      triggerOn: 'mousemove',
      formatter: (p: any) => {
        const d = p.data
        return `<strong>${d.name}</strong><br/>${t('traceability.backward.material')}: ${d.materialCode || '-'}<br/>${t('traceability.backward.supplier')}: ${d.supplierName || '-'}<br/>${t('traceability.backward.inspection')}: ${d.inspectionStatus || '-'}${d.missingData ? '<br/><span style="color:#f53f3f">' + t('traceability.backward.dataMissing') + '</span>' : ''}`
      },
    },
    series: [{
      type: 'tree',
      data: [treeData],
      top: '5%', left: '10%', bottom: '5%', right: '20%',
      symbolSize: 10,
      orient: 'RL',
      label: { position: 'right', verticalAlign: 'middle', align: 'left', fontSize: 12 },
      leaves: { label: { position: 'left', verticalAlign: 'middle', align: 'right' } },
      emphasis: { focus: 'descendant' },
      expandAndCollapse: true,
      animationDuration: 550,
    }],
  })
}

function buildTree(nodes: any[], batchId: string, depth: number): any {
  const node = nodes.find((n) => n.batchId === batchId)
  if (!node) return null
  const children = nodes
    .filter((n) => n.parentBatchId === batchId)
    .map((n) => buildTree(nodes, n.batchId, depth + 1))
    .filter(Boolean)

  return {
    name: node.traceCode || node.batchId,
    materialCode: node.materialCode,
    supplierName: node.supplierName,
    inspectionStatus: node.inspectionStatus,
    missingData: node.missingData,
    itemStyle: {
      color: node.missingData ? '#f53f3f'
        : node.inspectionStatus === 'FAILED' ? '#ff7d00'
        : node.inspectionStatus === 'PASSED' ? '#00b42a'
        : '#165dff',
    },
    children: children.length ? children : undefined,
  }
}

function handleResize() { treeChart?.resize() }
function handleBack() { router.back() }
function handleViewBatch(record: any) { router.push(`/traceability/batches/${record.batchId}`) }

async function handleExportPdf() {
  exportLoading.value = true
  try {
    const res = await backwardTracePdf(queryForm.traceCode)
    const blob = new Blob([new Uint8Array(res.data)], { type: 'application/pdf' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${t('traceability.backward.r33087')}_${queryForm.traceCode}_${Date.now()}.pdf`
    a.click()
    window.URL.revokeObjectURL(url)
    Message.success(t('traceability.导出成功'))
  } catch (e: any) {
    Message.error(e.message || t('traceability.导出失败'))
  } finally {
    exportLoading.value = false
  }
}
</script>

<style scoped>
.page-container { padding: 16px; }
.query-form { margin-bottom: 16px; }
</style>
