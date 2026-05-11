<template>
  <div class="page-container">
    <a-card :bordered="false" style="margin-bottom: 16px">
      <a-space wrap>
        <a-input-number v-model="days" :min="7" :max="365" :placeholder="$t('wms.reports.turnover.分析天数')" style="width: 140px" />
        <a-input v-model="warehouseId" :placeholder="$t('wms.reports.turnover.仓库ID可选')" allow-clear style="width: 160px" />
        <a-button type="primary" :loading="loading" @click="loadData">{{ $t('common.search') }}</a-button>
      </a-space>
    </a-card>

    <a-row :gutter="16">
      <a-col :span="24">
        <a-card :title="$t('wms.reports.turnover.库存周转率分析')" :bordered="false">
          <div ref="chartRef" class="chart-container" />
        </a-card>
      </a-col>
    </a-row>

    <a-card :title="$t('wms.reports.turnover.周转率明细')" :bordered="false" style="margin-top: 16px">
      <MTable :columns="columns" :data="tableData" :loading="loading" :total="tableData.length" :show-column-config="false" />
    </a-card>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
import { useI18n } from 'vue-i18n'
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import * as echarts from 'echarts/core'
import { BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import MTable from '@/components/MTable/index.vue'
import type { MTableColumn } from '@/components/MTable/index.vue'
import { wmsApi } from '@/api/wms'

echarts.use([BarChart, GridComponent, TooltipComponent, CanvasRenderer])

const loading = ref(false)
const days = ref(30)
const warehouseId = ref('')
const tableData = ref<any[]>([])
const chartRef = ref<HTMLElement | null>(null)
let chart: echarts.ECharts | null = null

const columns: MTableColumn[] = [
  { key: 'materialCode', title: t('wms.reports.turnover.物料编码'), dataIndex: 'materialCode', width: 130 },
  { key: 'materialName', title: t('wms.reports.turnover.物料名称'), dataIndex: 'materialName', width: 160 },
  { key: 'avgInventory', title: t('wms.reports.turnover.平均库存'), dataIndex: 'avgInventory', width: 110 },
  { key: 'totalIssued', title: t('wms.reports.turnover.出库总量'), dataIndex: 'totalIssued', width: 110 },
  { key: 'turnoverRate', title: t('wms.reports.turnover.周转率'), dataIndex: 'turnoverRate', width: 100 },
  { key: 'turnoverDays', title: t('wms.reports.turnover.周转天数'), dataIndex: 'turnoverDays', width: 100 },
]

async function loadData() {
  loading.value = true
  try {
    const params: Record<string, unknown> = { days: days.value }
    if (warehouseId.value) params.warehouseId = warehouseId.value
    const res = await wmsApi.getTurnover(params)
    tableData.value = (res.list ?? []) as any[]
    await nextTick()
    renderChart()
  } catch { tableData.value = [] } finally { loading.value = false }
}

function renderChart() {
  if (!chartRef.value) return
  chart?.dispose()
  chart = echarts.init(chartRef.value)
  const top10 = tableData.value.slice(0, 10)
  chart.setOption({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', backgroundColor: '#161B22', borderColor: '#30363D', textStyle: { color: '#E6EDF3' } },
    grid: { top: 20, right: 20, bottom: 60, left: 60 },
    xAxis: {
      type: 'category',
      data: top10.map(r => r.materialCode ?? r.materialName ?? ''),
      axisLabel: { color: '#8B949E', rotate: 30, fontSize: 11 },
      axisLine: { lineStyle: { color: '#30363D' } },
    },
    yAxis: { type: 'value', name: '周转率', axisLabel: { color: '#8B949E' }, splitLine: { lineStyle: { color: '#21262D' } } },
    series: [{
      type: 'bar',
      data: top10.map(r => r.turnoverRate ?? 0),
      itemStyle: { color: '#1B4FD8', borderRadius: [4, 4, 0, 0] },
      label: { show: true, position: 'top', color: '#8B949E', fontSize: 11 },
    }],
  })
}

onMounted(loadData)
onUnmounted(() => { chart?.dispose(); window.removeEventListener('resize', () => chart?.resize()) })
</script>

<style scoped>
.page-container { padding: 16px; }
.chart-container { height: 300px; width: 100%; }
</style>
