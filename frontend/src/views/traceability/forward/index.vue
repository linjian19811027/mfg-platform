<template>
  <div class="page-container">
    <a-page-header :title="$t('traceability.forward.index.正向追溯')" @back="handleBack" />

    <a-card :bordered="false">
      <!-- 查询输入 -->
      <a-form :model="queryForm" layout="inline" class="query-form">
        <a-form-item :label="$t('traceability.forward.index.追溯码')">
          <a-input
            v-model="queryForm.traceCode"
            :placeholder="$t('traceability.forward.index.请输入或扫描追溯码')"
            style="width: 300px"
            @pressEnter="handleTrace"
          >
            <template #suffix>
              <icon-qrcode />
            </template>
          </a-input>
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" @click="handleTrace" :loading="loading">
              <template #icon><icon-search /></template>
              {{ $t('traceability.forward.trace') }}
            </a-button>
            <a-button @click="handleReset">{{ $t('common.reset') }}</a-button>
          </a-space>
        </a-form-item>
      </a-form>

      <!-- 筛选条件 -->
      <a-form v-if="traceResult" :model="filterForm" layout="inline" class="filter-form">
        <a-form-item :label="$t('traceability.forward.index.物料编码')">
          <a-input v-model="filterForm.materialCode" :placeholder="$t('traceability.forward.index.筛选物料')" style="width: 150px" />
        </a-form-item>
        <a-form-item :label="$t('traceability.forward.index.库存状态')">
          <a-select v-model="filterForm.inventoryStatus" :placeholder="$t('traceability.forward.index.全部')" allow-clear style="width: 120px">
            <a-option value="IN_STOCK">{{ $t('traceability.forward.lbl1833') }}</a-option>
            <a-option value="SHIPPED">{{ $t('traceability.forward.lbl1834') }}</a-option>
            <a-option value="CONSUMED">{{ $t('traceability.forward.lbl1835') }}</a-option>
          </a-select>
        </a-form-item>
        <a-form-item>
          <a-button @click="applyFilter">{{ $t('traceability.forward.lbl1836') }}</a-button>
        </a-form-item>
      </a-form>

      <!-- 追溯结果 -->
      <div v-if="traceResult" class="trace-result">
        <a-alert v-if="traceResult.truncated" type="warning" style="margin-bottom: 16px">
          {{ $t('traceability.forward.traceNodesTruncated') }}
        </a-alert>

        <a-space style="margin-bottom: 16px">
          <a-button @click="handleExportPdf" :loading="exportLoading">
            <template #icon><icon-download /></template>
            {{ $t('traceability.forward.exportPdf') }}
          </a-button>
          <a-button @click="handleGenerateReport">{{ $t('traceability.forward.lbl1837') }}</a-button>
          <a-tag color="blue">{{ $t('traceability.forward.r22019', {nodeCount: traceResult.nodeCount}) }}</a-tag>
        </a-space>

        <!-- 树形图展示 -->
        <a-card :title="$t('traceability.forward.index.追溯链路图')" :bordered="false">
          <div ref="treeChartRef" style="height: 600px"></div>
        </a-card>

        <!-- 节点列表 -->
        <a-card :title="$t('traceability.forward.index.节点明细')" :bordered="false" style="margin-top: 16px">
          <a-table
            :columns="nodeColumns"
            :data="filteredNodes"
            :pagination="{ pageSize: 20 }"
            row-key="batchId"
          >
            <template #traceCode="{ record }">
              <a-link @click="handleViewBatch(record)">{{ record.traceCode }}</a-link>
            </template>
            <template #inspectionStatus="{ record }">
              <a-tag v-if="record.inspectionStatus === 'PASSED'" color="green">{{ $t('traceability.forward.qualified') }}</a-tag>
              <a-tag v-else-if="record.inspectionStatus === 'FAILED'" color="red">{{ $t('traceability.forward.unqualified') }}</a-tag>
              <a-tag v-else color="orange">{{ $t('traceability.forward.uninspected') }}</a-tag>
            </template>
            <template #inventoryStatus="{ record }">
              <a-tag v-if="record.inventoryStatus === 'IN_STOCK'" color="blue">{{ $t('traceability.forward.lbl1838') }}</a-tag>
              <a-tag v-else-if="record.inventoryStatus === 'SHIPPED'" color="gray">{{ $t('traceability.forward.lbl1839') }}</a-tag>
              <a-tag v-else-if="record.inventoryStatus === 'CONSUMED'" color="purple">{{ $t('traceability.forward.lbl1840') }}</a-tag>
            </template>
            <template #isFrozen="{ record }">
              <a-tag v-if="record.isFrozen" color="red">{{ $t('traceability.forward.r33093') }}</a-tag>
              <span v-else>{{ $t('traceability.forward.r33094') }}</span>
            </template>
            <template #missingData="{ record }">
              <a-tag v-if="record.missingData" color="red">{{ $t('traceability.forward.lbl1841') }}</a-tag>
              <span v-else>{{ $t('traceability.forward.lbl1842') }}</span>
            </template>
          </a-table>
        </a-card>
      </div>

      <!-- 空状态 -->
      <a-empty v-else :description="$t('traceability.forward.index.请输入追溯码开始追溯')" style="margin: 60px 0" />
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
import { forwardTrace, forwardTracePdf, generateReport } from '@/api/traceability'

const route = useRoute()
const router = useRouter()

const queryForm = reactive({
  traceCode: '',
})

const filterForm = reactive({
  materialCode: '',
  inventoryStatus: undefined,
})

const loading = ref(false)
const exportLoading = ref(false)
const traceResult = ref<any>(null)
const treeChartRef = ref()
let treeChart: echarts.ECharts | null = null

const nodeColumns = [
  { title: t('traceability.forward.index.层级'), dataIndex: 'depth', width: 80 },
  { title: t('traceability.forward.index.追溯码'), dataIndex: 'traceCode', slotName: 'traceCode', width: 200 },
  { title: t('traceability.forward.index.物料编码'), dataIndex: 'materialCode', width: 150 },
  { title: t('traceability.forward.index.物料名称'), dataIndex: 'materialName', width: 180 },
  { title: t('traceability.forward.index.批次号'), dataIndex: 'batchNo', width: 150 },
  { title: t('traceability.forward.index.检验状态'), dataIndex: 'inspectionStatus', slotName: 'inspectionStatus', width: 100 },
  { title: t('traceability.forward.index.库存状态'), dataIndex: 'inventoryStatus', slotName: 'inventoryStatus', width: 100 },
  { title: t('traceability.forward.index.是否冻结'), dataIndex: 'isFrozen', slotName: 'isFrozen', width: 90 },
  { title: t('traceability.forward.index.数据状态'), dataIndex: 'missingData', slotName: 'missingData', width: 100 },
]

const filteredNodes = computed(() => {
  if (!traceResult.value) return []
  
  let nodes = traceResult.value.nodes || []
  
  if (filterForm.materialCode) {
    nodes = nodes.filter((n: any) => n.materialCode?.includes(filterForm.materialCode))
  }
  
  if (filterForm.inventoryStatus) {
    nodes = nodes.filter((n: any) => n.inventoryStatus === filterForm.inventoryStatus)
  }
  
  return nodes
})

onMounted(() => {
  // 如果 URL 中有追溯码参数，自动执行追溯
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
    const res = await forwardTrace(queryForm.traceCode)
    traceResult.value = res
    
    // 渲染树形图
    setTimeout(() => {
      renderTreeChart()
    }, 100)
    
    Message.success(t('traceability.追溯完成'))
  } catch (error: any) {
    Message.error(error.message || t('traceability.追溯失败'))
  } finally {
    loading.value = false
  }
}

function handleReset() {
  queryForm.traceCode = ''
  traceResult.value = null
  Object.assign(filterForm, {
    materialCode: '',
    inventoryStatus: undefined,
  })
}

function applyFilter() {
  // 筛选逻辑已通过 computed 实现
  Message.success(t('traceability.筛选已应用'))
}

function renderTreeChart() {
  if (!treeChartRef.value || !traceResult.value) return
  
  treeChart = echarts.init(treeChartRef.value)
  
  // 构建树形数据
  const treeData = buildTreeData(traceResult.value.nodes)
  
  const option = {
    tooltip: {
      trigger: 'item',
      triggerOn: 'mousemove',
      formatter: (params: any) => {
        const data = params.data
        return `
          <div>
            <strong>${data.name}</strong><br/>
            ${t('traceability.forward.material')}: ${data.materialCode}<br/>
            ${t('traceability.forward.batch')}: ${data.batchNo}<br/>
            ${t('traceability.forward.inspection')}: ${data.inspectionStatus}<br/>
            ${t('traceability.forward.inventory')}: ${data.inventoryStatus}
          </div>
        `
      },
    },
    series: [
      {
        type: 'tree',
        data: [treeData],
        top: '10%',
        left: '10%',
        bottom: '10%',
        right: '20%',
        symbolSize: 10,
        label: {
          position: 'left',
          verticalAlign: 'middle',
          align: 'right',
          fontSize: 12,
        },
        leaves: {
          label: {
            position: 'right',
            verticalAlign: 'middle',
            align: 'left',
          },
        },
        emphasis: {
          focus: 'descendant',
        },
        expandAndCollapse: true,
        animationDuration: 550,
        animationDurationUpdate: 750,
        itemStyle: {
          color: (params: any) => {
            if (params.data.isFrozen) return '#f53f3f'
            if (params.data.inspectionStatus === 'FAILED') return '#ff7d00'
            if (params.data.inspectionStatus === 'PASSED') return '#00b42a'
            return '#165dff'
          },
        },
      },
    ],
  }
  
  treeChart.setOption(option)
}

function buildTreeData(nodes: any[]) {
  if (!nodes || nodes.length === 0) return {}
  
  // 简化版：假设第一个节点是根节点
  const root = nodes[0]
  return {
    name: root.traceCode || root.batchId,
    materialCode: root.materialCode,
    batchNo: root.batchNo,
    inspectionStatus: root.inspectionStatus,
    inventoryStatus: root.inventoryStatus,
    isFrozen: root.isFrozen,
    children: buildChildren(nodes, root.batchId, 1),
  }
}

function buildChildren(nodes: any[], _parentId: string, currentDepth: number): any[] {
  const children = nodes.filter((n: any) => n.depth === currentDepth)
  
  return children.map((child: any) => ({
    name: child.traceCode || child.batchId,
    materialCode: child.materialCode,
    batchNo: child.batchNo,
    inspectionStatus: child.inspectionStatus,
    inventoryStatus: child.inventoryStatus,
    isFrozen: child.isFrozen,
    children: buildChildren(nodes, child.batchId, currentDepth + 1),
  }))
}

function handleResize() {
  treeChart?.resize()
}

function handleBack() {
  router.back()
}

function handleViewBatch(record: any) {
  router.push(`/traceability/batches/${record.batchId}`)
}

async function handleExportPdf() {
  exportLoading.value = true
  try {
    const res = await forwardTracePdf(queryForm.traceCode)
    const blob = new Blob([new Uint8Array(res.data)], { type: 'application/pdf' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${t('traceability.forward.r33095')}_${queryForm.traceCode}_${new Date().getTime()}.pdf`
    a.click()
    window.URL.revokeObjectURL(url)
    Message.success(t('traceability.导出成功'))
  } catch (error: any) {
    Message.error(error.message || t('traceability.导出失败'))
  } finally {
    exportLoading.value = false
  }
}

async function handleGenerateReport() {
  try {
    await generateReport({
      traceCode: queryForm.traceCode,
      reportType: 'FORWARD',
    })
    Message.success(t('traceability.报告生成中，请稍后在报告列表查看'))
  } catch (error: any) {
    Message.error(error.message || t('traceability.生成失败'))
  }
}
</script>

<style scoped>
.page-container {
  padding: 16px;
}

.query-form {
  margin-bottom: 16px;
}

.filter-form {
  margin-bottom: 16px;
  padding: 16px;
  background-color: var(--color-fill-2);
  border-radius: 4px;
}

.trace-result {
  margin-top: 24px;
}
</style>
