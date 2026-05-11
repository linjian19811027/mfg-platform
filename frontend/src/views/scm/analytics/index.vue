<template>
  <div class="page-container">
    <a-card :bordered="false" style="margin-bottom: 16px">
      <a-space wrap>
        <a-date-picker v-model="query.startDate" :placeholder="$t('scm.analytics.index.开始月份')" picker="month" style="width: 140px" />
        <a-date-picker v-model="query.endDate" :placeholder="$t('scm.analytics.index.结束月份')" picker="month" style="width: 140px" />
        <a-button type="primary" :loading="loading" @click="loadData">{{ $t('common.search') }}</a-button>
      </a-space>
    </a-card>

    <a-row :gutter="16" style="margin-bottom: 16px">
      <a-col :span="24">
        <a-card :title="$t('scm.analytics.index.采购金额趋势近12个月')" :bordered="false">
          <div ref="trendRef" class="chart-container" />
        </a-card>
      </a-col>
    </a-row>

    <a-row :gutter="16" style="margin-bottom: 16px">
      <a-col :span="12">
        <a-card :title="$t('scm.analytics.index.供应商采购占比')" :bordered="false">
          <div ref="supplierRef" class="chart-container" />
        </a-card>
      </a-col>
      <a-col :span="12">
        <a-card :title="$t('scm.analytics.index.品类采购对比')" :bordered="false">
          <div ref="categoryRef" class="chart-container" />
        </a-card>
      </a-col>
    </a-row>

    <a-card :title="$t('scm.analytics.index.交期达成率趋势')" :bordered="false">
      <div ref="deliveryRef" class="chart-container" />
    </a-card>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
import { useI18n } from 'vue-i18n'
import { ref, reactive, onMounted, onUnmounted, nextTick } from 'vue'
import * as echarts from 'echarts/core'
import { LineChart, BarChart, PieChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { scmApi } from '@/api/scm'

echarts.use([LineChart, BarChart, PieChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer])

const loading = ref(false)
const query = reactive({ startDate: '', endDate: '' })
const trendRef = ref<HTMLElement | null>(null)
const supplierRef = ref<HTMLElement | null>(null)
const categoryRef = ref<HTMLElement | null>(null)
const deliveryRef = ref<HTMLElement | null>(null)
let charts: echarts.ECharts[] = []

const baseOpt = {
  backgroundColor: 'transparent',
  tooltip: { trigger: 'axis', backgroundColor: '#161B22', borderColor: '#30363D', textStyle: { color: '#E6EDF3' } },
  grid: { top: 20, right: 20, bottom: 30, left: 60 },
}

async function loadData() {
  loading.value = true
  try {
    const [amountRes, deliveryRes] = await Promise.all([
      scmApi.getAmountAnalysis(query),
      scmApi.getDeliveryTrend(query),
    ])
    await nextTick()
    charts.forEach(c => c.dispose())
    charts = []

    // 趋势图
    if (trendRef.value) {
      const c = echarts.init(trendRef.value)
      c.setOption({ ...baseOpt, xAxis: { type: 'category', data: amountRes.trend.map(d => d.month), axisLabel: { color: '#8B949E' }, axisLine: { lineStyle: { color: '#30363D' } } }, yAxis: { type: 'value', axisLabel: { color: '#8B949E' }, splitLine: { lineStyle: { color: '#21262D' } } }, series: [{ type: 'line', data: amountRes.trend.map(d => d.amount), smooth: true, lineStyle: { color: '#1B4FD8', width: 2 }, itemStyle: { color: '#1B4FD8' }, areaStyle: { color: 'rgba(27,79,216,0.1)' } }] })
      charts.push(c)
    }

    // 供应商饼图
    if (supplierRef.value) {
      const c = echarts.init(supplierRef.value)
      c.setOption({ backgroundColor: 'transparent', tooltip: { trigger: 'item', backgroundColor: '#161B22', borderColor: '#30363D', textStyle: { color: '#E6EDF3' } }, legend: { textStyle: { color: '#8B949E' }, bottom: 0 }, series: [{ type: 'pie', radius: ['40%', '70%'], data: amountRes.bySupplier.map(s => ({ name: s.name, value: s.amount })), label: { color: '#8B949E' } }] })
      charts.push(c)
    }

    // 品类柱状图
    if (categoryRef.value) {
      const c = echarts.init(categoryRef.value)
      c.setOption({ ...baseOpt, xAxis: { type: 'category', data: amountRes.byCategory.map(d => d.name), axisLabel: { color: '#8B949E', rotate: 30 }, axisLine: { lineStyle: { color: '#30363D' } } }, yAxis: { type: 'value', axisLabel: { color: '#8B949E' }, splitLine: { lineStyle: { color: '#21262D' } } }, series: [{ type: 'bar', data: amountRes.byCategory.map(d => d.amount), itemStyle: { color: '#00D4C8', borderRadius: [4, 4, 0, 0] } }] })
      charts.push(c)
    }

    // 交期达成率
    if (deliveryRef.value) {
      const c = echarts.init(deliveryRef.value)
      c.setOption({ ...baseOpt, xAxis: { type: 'category', data: deliveryRes.trend.map(d => d.month), axisLabel: { color: '#8B949E' }, axisLine: { lineStyle: { color: '#30363D' } } }, yAxis: { type: 'value', min: 0, max: 100, axisLabel: { color: '#8B949E', formatter: '{value}%' }, splitLine: { lineStyle: { color: '#21262D' } } }, series: [{ type: 'line', data: deliveryRes.trend.map(d => (d.rate * 100).toFixed(1)), smooth: true, lineStyle: { color: '#00B578', width: 2 }, itemStyle: { color: '#00B578' } }] })
      charts.push(c)
    }
  } catch { /* handled */ } finally { loading.value = false }
}

onMounted(loadData)
onUnmounted(() => charts.forEach(c => c.dispose()))
</script>

<style scoped>
.page-container { padding: 16px; }
.chart-container { height: 260px; width: 100%; }
</style>
