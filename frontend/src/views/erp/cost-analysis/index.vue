<template>
  <div class="page-container">
    <a-card :bordered="false" style="margin-bottom: 16px">
      <a-space wrap>
        <a-input v-model="query.materialId" :placeholder="$t('erp.cost-analysis.index.物料ID')" allow-clear style="width: 180px" />
        <a-date-picker v-model="query.period" :placeholder="$t('erp.cost-analysis.index.会计期间')" picker="month" style="width: 140px" />
        <a-button type="primary" :loading="loading" @click="loadData">{{ $t('common.search') }}</a-button>
      </a-space>
    </a-card>
    <a-row :gutter="16" style="margin-bottom: 16px">
      <a-col :span="16">
        <a-card :title="$t('erp.cost-analysis.index.成本差异分析')" :bordered="false">
          <div ref="varianceRef" class="chart-container" />
        </a-card>
      </a-col>
      <a-col :span="8">
        <a-card :title="$t('erp.cost-analysis.index.成本构成')" :bordered="false">
          <div ref="pieRef" class="chart-container" />
        </a-card>
      </a-col>
    </a-row>
    <a-card :title="$t('erp.cost-analysis.index.产品成本明细')" :bordered="false">
      <MTable :columns="columns" :data="tableData" :loading="loading" :total="tableData.length" :show-column-config="false" />
    </a-card>
  </div>
</template>
<script setup lang="ts">
const { t } = useI18n()
import { useI18n } from 'vue-i18n'
import { ref, reactive, onMounted, onUnmounted, nextTick } from 'vue'
import * as echarts from 'echarts/core'
import { BarChart, PieChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import MTable from '@/components/MTable/index.vue'
import type { MTableColumn } from '@/components/MTable/index.vue'
import { erpExtApi } from '@/api/erp-ext'
echarts.use([BarChart, PieChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer])
const loading = ref(false); const tableData = ref<any[]>([])
const query = reactive({ materialId: '', period: '' })
const varianceRef = ref<HTMLElement | null>(null); const pieRef = ref<HTMLElement | null>(null)
let charts: echarts.ECharts[] = []
const columns: MTableColumn[] = [
  { key: 'materialName', title: t('erp.cost-analysis.index.物料名称'), dataIndex: 'materialName', width: 160 },
  { key: 'standardCost', title: t('erp.cost-analysis.index.标准成本'), dataIndex: 'standardCost', width: 120 },
  { key: 'actualCost', title: t('erp.cost-analysis.index.实际成本'), dataIndex: 'actualCost', width: 120 },
  { key: 'variance', title: t('erp.cost-analysis.index.差异'), dataIndex: 'variance', width: 100 },
  { key: 'varianceRate', title: t('erp.cost-analysis.index.差异率'), dataIndex: 'varianceRate', width: 100 },
]
async function loadData() {
  loading.value = true
  try {
    const [varRes, prodRes] = await Promise.all([erpExtApi.getCostVariance(query), erpExtApi.getProductCost(query)])
    tableData.value = (varRes.list ?? []) as any[]
    await nextTick()
    charts.forEach(c => c.dispose()); charts = []
    if (varianceRef.value) {
      const c = echarts.init(varianceRef.value)
      c.setOption({ backgroundColor: 'transparent', tooltip: { trigger: 'axis', backgroundColor: '#161B22', borderColor: '#30363D', textStyle: { color: '#E6EDF3' } }, grid: { top: 20, right: 20, bottom: 40, left: 60 }, xAxis: { type: 'category', data: tableData.value.map(r => r.materialName ?? ''), axisLabel: { color: '#8B949E', rotate: 30 }, axisLine: { lineStyle: { color: '#30363D' } } }, yAxis: { type: 'value', axisLabel: { color: '#8B949E' }, splitLine: { lineStyle: { color: '#21262D' } } }, series: [{ name: t('erp.cost-analysis.lbl1161'), type: 'bar', data: tableData.value.map(r => r.standardCost ?? 0), itemStyle: { color: '#1B4FD8' } }, { name: t('erp.cost-analysis.lbl1162'), type: 'bar', data: tableData.value.map(r => r.actualCost ?? 0), itemStyle: { color: '#FF6B35' } }] })
      charts.push(c)
    }
    if (pieRef.value) {
      const prod = prodRes as Record<string, unknown>
      const c = echarts.init(pieRef.value)
      c.setOption({ backgroundColor: 'transparent', tooltip: { trigger: 'item', backgroundColor: '#161B22', borderColor: '#30363D', textStyle: { color: '#E6EDF3' } }, legend: { textStyle: { color: '#8B949E' }, bottom: 0 }, series: [{ type: 'pie', radius: ['40%', '70%'], data: [{ name: t('erp.cost-analysis.lbl1163'), value: prod.materialCost ?? 0 }, { name: t('erp.cost-analysis.lbl1164'), value: prod.laborCost ?? 0 }, { name: t('erp.cost-analysis.lbl1165'), value: prod.overheadCost ?? 0 }], label: { color: '#8B949E' } }] })
      charts.push(c)
    }
  } catch { tableData.value = [] } finally { loading.value = false }
}
onMounted(loadData); onUnmounted(() => charts.forEach(c => c.dispose()))
</script>
<style scoped>.page-container { padding: 16px; } .chart-container { height: 260px; width: 100%; }</style>
