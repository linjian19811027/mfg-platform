<template>
  <div class="page-container">
    <a-card :bordered="false" style="margin-bottom: 16px">
      <a-space wrap>
        <a-input v-model="query.equipmentType" :placeholder="$t('eam.analytics.index.设备类型可选')" allow-clear style="width: 180px" />
        <a-date-picker v-model="query.startDate" :placeholder="$t('eam.analytics.index.开始月份')" picker="month" style="width: 140px" />
        <a-date-picker v-model="query.endDate" :placeholder="$t('eam.analytics.index.结束月份')" picker="month" style="width: 140px" />
        <a-button type="primary" :loading="loading" @click="loadData">{{ $t('common.search') }}</a-button>
      </a-space>
    </a-card>

    <a-row :gutter="16" style="margin-bottom: 16px">
      <a-col :span="24">
        <a-card :title="$t('eam.analytics.index.维保成本趋势近12个月')" :bordered="false">
          <div ref="costRef" class="chart-container" />
        </a-card>
      </a-col>
    </a-row>

    <a-card :title="$t('eam.analytics.index.故障类型帕累托分析')" :bordered="false">
      <div ref="paretoRef" class="chart-container" />
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, nextTick } from 'vue'
import * as echarts from 'echarts/core'
import { BarChart, LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { eamApi } from '@/api/eam'

echarts.use([BarChart, LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer])

const loading = ref(false)
const query = reactive({ equipmentType: '', startDate: '', endDate: '' })
const costRef = ref<HTMLElement | null>(null)
const paretoRef = ref<HTMLElement | null>(null)
let costChart: echarts.ECharts | null = null
let paretoChart: echarts.ECharts | null = null

async function loadData() {
  loading.value = true
  try {
    const res = await eamApi.getMaintenanceAnalytics(query)
    await nextTick()

    // 成本趋势图（堆叠柱状图）
    if (costRef.value) {
      costChart?.dispose(); costChart = echarts.init(costRef.value)
      const trend = res.costTrend ?? []
      costChart.setOption({
        backgroundColor: 'transparent',
        tooltip: { trigger: 'axis', backgroundColor: '#161B22', borderColor: '#30363D', textStyle: { color: '#E6EDF3' } },
        legend: { data: ['人工成本', '备件成本', '外委成本'], textStyle: { color: '#8B949E' }, top: 0 },
        grid: { top: 40, right: 20, bottom: 30, left: 60 },
        xAxis: { type: 'category', data: trend.map(d => d.month), axisLabel: { color: '#8B949E' }, axisLine: { lineStyle: { color: '#30363D' } } },
        yAxis: { type: 'value', axisLabel: { color: '#8B949E' }, splitLine: { lineStyle: { color: '#21262D' } } },
        series: [
          { name: '人工成本', type: 'bar', stack: 'cost', data: trend.map(d => d.labor), itemStyle: { color: '#1B4FD8' } },
          { name: '备件成本', type: 'bar', stack: 'cost', data: trend.map(d => d.parts), itemStyle: { color: '#00D4C8' } },
          { name: '外委成本', type: 'bar', stack: 'cost', data: trend.map(d => d.outsource), itemStyle: { color: '#FF6B35' } },
        ],
      })
    }

    // 帕累托图（柱状图 + 折线图）
    if (paretoRef.value) {
      paretoChart?.dispose(); paretoChart = echarts.init(paretoRef.value)
      const pareto = res.faultPareto ?? []
      paretoChart.setOption({
        backgroundColor: 'transparent',
        tooltip: { trigger: 'axis', backgroundColor: '#161B22', borderColor: '#30363D', textStyle: { color: '#E6EDF3' } },
        legend: { data: ['故障次数', '累计占比'], textStyle: { color: '#8B949E' }, top: 0 },
        grid: { top: 40, right: 60, bottom: 30, left: 60 },
        xAxis: { type: 'category', data: pareto.map(d => d.type), axisLabel: { color: '#8B949E', rotate: 30 }, axisLine: { lineStyle: { color: '#30363D' } } },
        yAxis: [
          { type: 'value', name: '次数', axisLabel: { color: '#8B949E' }, splitLine: { lineStyle: { color: '#21262D' } } },
          { type: 'value', name: '累计占比', min: 0, max: 100, axisLabel: { color: '#8B949E', formatter: '{value}%' }, splitLine: { show: false } },
        ],
        series: [
          { name: '故障次数', type: 'bar', data: pareto.map(d => d.count), itemStyle: { color: '#1B4FD8', borderRadius: [4, 4, 0, 0] } },
          { name: '累计占比', type: 'line', yAxisIndex: 1, data: pareto.map(d => (d.cumRate * 100).toFixed(1)), smooth: false, lineStyle: { color: '#FF6B35', width: 2 }, itemStyle: { color: '#FF6B35' } },
        ],
      })
    }
  } catch { /* handled */ } finally { loading.value = false }
}

onMounted(loadData)
onUnmounted(() => { costChart?.dispose(); paretoChart?.dispose() })
</script>

<style scoped>
.page-container { padding: 16px; }
.chart-container { height: 280px; width: 100%; }
</style>
