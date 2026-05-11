<template>
  <div class="page-container">
    <!-- 顶部统计卡片 -->
    <a-row :gutter="16" style="margin-bottom: 16px">
      <a-col :span="6">
        <a-card :bordered="false" :loading="dashLoading">
          <a-statistic :title="$t('traceability.dashboard.index.本月新增批次')" :value="dash.newBatchCount ?? 0" suffix="个">
            <template #prefix><icon-plus-circle style="color: #165dff" /></template>
          </a-statistic>
        </a-card>
      </a-col>
      <a-col :span="6">
        <a-card :bordered="false" :loading="dashLoading">
          <a-statistic :title="$t('traceability.dashboard.index.本月追溯查询')" :value="dash.queryCount ?? 0" suffix="次">
            <template #prefix><icon-search style="color: #00b42a" /></template>
          </a-statistic>
        </a-card>
      </a-col>
      <a-col :span="6">
        <a-card :bordered="false" :loading="dashLoading">
          <a-statistic
            :title="$t('traceability.dashboard.index.当前冻结批次')"
            :value="dash.frozenBatchCount ?? 0"
            suffix="个"
            :value-style="{ color: '#f53f3f' }"
          >
            <template #prefix><icon-lock style="color: #f53f3f" /></template>
          </a-statistic>
        </a-card>
      </a-col>
      <a-col :span="6">
        <a-card :bordered="false" :loading="dashLoading">
          <a-statistic
            :title="$t('traceability.dashboard.index.待处理召回评估')"
            :value="dash.pendingRecallCount ?? 0"
            suffix="个"
            :value-style="{ color: '#ff7d00' }"
          >
            <template #prefix><icon-exclamation-circle style="color: #ff7d00" /></template>
          </a-statistic>
        </a-card>
      </a-col>
    </a-row>

    <a-row :gutter="16">
      <!-- 追溯覆盖率趋势图 -->
      <a-col :span="16">
        <a-card :title="$t('traceability.dashboard.index.追溯覆盖率趋势近6个月')" :bordered="false">
          <div v-if="coverageData.length" ref="coverageChartRef" style="height: 360px"></div>
          <a-empty v-else :description="$t('traceability.dashboard.index.暂无覆盖率数据')" style="padding: 80px 0" />
        </a-card>
      </a-col>

      <!-- 按物料类别覆盖率 -->
      <a-col :span="8">
        <a-card :title="$t('traceability.dashboard.index.物料类别覆盖率')" :bordered="false">
          <div v-if="categoryData.length" ref="categoryChartRef" style="height: 360px"></div>
          <a-empty v-else :description="$t('traceability.dashboard.index.暂无分类数据')" style="padding: 80px 0" />
        </a-card>
      </a-col>
    </a-row>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
import { useI18n } from 'vue-i18n'
import { ref, onMounted, onUnmounted } from 'vue'
import { Message } from '@arco-design/web-vue'
import {
  IconPlusCircle, IconSearch, IconLock, IconExclamationCircle,
} from '@arco-design/web-vue/es/icon'
import * as echarts from 'echarts'
import { getAnalyticsDashboard, getCoverageStats } from '@/api/traceability'

const dashLoading = ref(false)
const dash = ref<any>({})
const coverageData = ref<any[]>([])
const categoryData = ref<any[]>([])

const coverageChartRef = ref()
const categoryChartRef = ref()
let coverageChart: echarts.ECharts | null = null
let categoryChart: echarts.ECharts | null = null

onMounted(async () => {
  await Promise.all([fetchDashboard(), fetchCoverage()])
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  coverageChart?.dispose()
  categoryChart?.dispose()
  window.removeEventListener('resize', handleResize)
})

async function fetchDashboard() {
  dashLoading.value = true
  try {
    const res = await getAnalyticsDashboard()
    dash.value = res ?? {}
  } catch (e: any) {
    Message.error(e.message || '加载看板失败')
  } finally {
    dashLoading.value = false
  }
}

async function fetchCoverage() {
  try {
    const res = await getCoverageStats({ months: 6 })
    coverageData.value = (res as any).trend ?? []
    categoryData.value = (res as any).byCategory ?? []
    // 等 DOM 渲染后初始化图表
    setTimeout(() => {
      if (coverageData.value.length) initCoverageChart()
      if (categoryData.value.length) initCategoryChart()
    }, 100)
  } catch (e: any) {
    Message.error(e.message || '加载覆盖率失败')
  }
}

function initCoverageChart() {
  if (!coverageChartRef.value) return
  coverageChart = echarts.init(coverageChartRef.value)
  const months = coverageData.value.map((d: any) => d.month)
  const rates = coverageData.value.map((d: any) => d.coverageRate)

  coverageChart.setOption({
    tooltip: { trigger: 'axis', formatter: (p: any) => `${p[0].name}<br/>覆盖率: ${p[0].value}%` },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', data: months },
    yAxis: { type: 'value', name: '覆盖率(%)', min: 0, max: 100,
      axisLabel: { formatter: '{value}%' } },
    series: [{
      name: '追溯覆盖率',
      type: 'line',
      data: rates,
      smooth: true,
      areaStyle: { opacity: 0.2 },
      itemStyle: { color: '#165dff' },
      markLine: {
        data: [{ type: 'average', name: '平均值' }],
        lineStyle: { color: '#ff7d00', type: 'dashed' },
      },
    }],
  })
}

function initCategoryChart() {
  if (!categoryChartRef.value) return
  categoryChart = echarts.init(categoryChartRef.value)
  const categories = categoryData.value.map((d: any) => d.category)
  const rates = categoryData.value.map((d: any) => d.coverageRate)

  categoryChart.setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' },
      formatter: (p: any) => `${p[0].name}<br/>覆盖率: ${p[0].value}%` },
    grid: { left: '3%', right: '4%', bottom: '8%', containLabel: true },
    xAxis: { type: 'category', data: categories, axisLabel: { interval: 0, rotate: 30 } },
    yAxis: { type: 'value', name: '覆盖率(%)', min: 0, max: 100,
      axisLabel: { formatter: '{value}%' } },
    series: [{
      name: '覆盖率',
      type: 'bar',
      data: rates,
      barWidth: '60%',
      itemStyle: {
        color: (p: any) => {
          const v = p.value
          if (v >= 90) return '#00b42a'
          if (v >= 70) return '#ff7d00'
          return '#f53f3f'
        },
      },
      label: { show: true, position: 'top', formatter: '{c}%' },
    }],
  })
}

function handleResize() {
  coverageChart?.resize()
  categoryChart?.resize()
}
</script>

<style scoped>
.page-container { padding: 16px; }
</style>
