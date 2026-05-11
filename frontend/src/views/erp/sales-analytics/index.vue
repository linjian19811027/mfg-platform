<template>
  <div class="page-container">
    <a-card :bordered="false" style="margin-bottom: 16px">
      <a-space wrap>
        <a-date-picker v-model="query.startDate" :placeholder="$t('erp.sales-analytics.index.开始月份')" picker="month" style="width: 140px" />
        <a-date-picker v-model="query.endDate" :placeholder="$t('erp.sales-analytics.index.结束月份')" picker="month" style="width: 140px" />
        <a-button type="primary" :loading="loading" @click="loadData">{{ $t('common.search') }}</a-button>
      </a-space>
    </a-card>
    <a-row :gutter="16" style="margin-bottom: 16px">
      <a-col :span="24"><a-card :title="$t('erp.sales-analytics.index.销售金额趋势近12个月')" :bordered="false"><div ref="trendRef" class="chart-container" /></a-card></a-col>
    </a-row>
    <a-row :gutter="16" style="margin-bottom: 16px">
      <a-col :span="12"><a-card :title="$t('erp.sales-analytics.index.Top10客户销售排名')" :bordered="false"><div ref="customerRef" class="chart-container" /></a-card></a-col>
      <a-col :span="12"><a-card :title="$t('erp.sales-analytics.index.产品类别销售占比')" :bordered="false"><div ref="productRef" class="chart-container" /></a-card></a-col>
    </a-row>
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
import { erpExtApi } from '@/api/erp-ext'
echarts.use([LineChart, BarChart, PieChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer])
const loading = ref(false); const query = reactive({ startDate: '', endDate: '' })
const trendRef = ref<HTMLElement | null>(null); const customerRef = ref<HTMLElement | null>(null); const productRef = ref<HTMLElement | null>(null)
let charts: echarts.ECharts[] = []
const baseOpt = { backgroundColor: 'transparent', tooltip: { trigger: 'axis', backgroundColor: '#161B22', borderColor: '#30363D', textStyle: { color: '#E6EDF3' } }, grid: { top: 20, right: 20, bottom: 30, left: 60 } }
async function loadData() {
  loading.value = true
  try {
    const [trendRes, custRes, prodRes] = await Promise.all([erpExtApi.getSalesTrend(query), erpExtApi.getCustomerAnalysis(query), erpExtApi.getProductAnalysis(query)])
    await nextTick(); charts.forEach(c => c.dispose()); charts = []
    if (trendRef.value) {
      const c = echarts.init(trendRef.value)
      c.setOption({ ...baseOpt, xAxis: { type: 'category', data: trendRes.trend.map(d => d.month), axisLabel: { color: '#8B949E' }, axisLine: { lineStyle: { color: '#30363D' } } }, yAxis: { type: 'value', axisLabel: { color: '#8B949E' }, splitLine: { lineStyle: { color: '#21262D' } } }, series: [{ type: 'line', data: trendRes.trend.map(d => d.amount), smooth: true, lineStyle: { color: '#1B4FD8', width: 2 }, itemStyle: { color: '#1B4FD8' }, areaStyle: { color: 'rgba(27,79,216,0.1)' } }] })
      charts.push(c)
    }
    if (customerRef.value) {
      const c = echarts.init(customerRef.value)
      c.setOption({ ...baseOpt, xAxis: { type: 'category', data: custRes.list.map(d => d.customerName), axisLabel: { color: '#8B949E', rotate: 30 }, axisLine: { lineStyle: { color: '#30363D' } } }, yAxis: { type: 'value', axisLabel: { color: '#8B949E' }, splitLine: { lineStyle: { color: '#21262D' } } }, series: [{ type: 'bar', data: custRes.list.map(d => d.amount), itemStyle: { color: '#00D4C8', borderRadius: [4, 4, 0, 0] } }] })
      charts.push(c)
    }
    if (productRef.value) {
      const c = echarts.init(productRef.value)
      c.setOption({ backgroundColor: 'transparent', tooltip: { trigger: 'item', backgroundColor: '#161B22', borderColor: '#30363D', textStyle: { color: '#E6EDF3' } }, legend: { textStyle: { color: '#8B949E' }, bottom: 0 }, series: [{ type: 'pie', radius: ['40%', '70%'], data: prodRes.list.map(d => ({ name: d.productName, value: d.amount })), label: { color: '#8B949E' } }] })
      charts.push(c)
    }
  } catch { /* handled */ } finally { loading.value = false }
}
onMounted(loadData); onUnmounted(() => charts.forEach(c => c.dispose()))
</script>
<style scoped>.page-container { padding: 16px; } .chart-container { height: 260px; width: 100%; }</style>
