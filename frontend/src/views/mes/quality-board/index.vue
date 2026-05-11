<template>
  <div class="qb-page">
    <!-- 标题栏 -->
    <div class="qb-header">
      <span class="qb-title">质量看板</span>
      <span class="qb-update">最后更新：{{ lastUpdate }}</span>
      <a-button size="small" :loading="loading" @click="refresh">刷新</a-button>
    </div>

    <!-- 统计卡片 -->
    <a-row :gutter="16" style="margin-bottom: 16px">
      <a-col :span="8">
        <div class="stat-card">
          <div class="stat-label">今日不合格品</div>
          <div class="stat-value danger">{{ data.todayNcCount ?? 0 }}</div>
        </div>
      </a-col>
      <a-col :span="8">
        <div class="stat-card">
          <div class="stat-label">首检通过率</div>
          <div class="stat-value success">{{ ((data.firstPassRate ?? 0) * 100).toFixed(1) }}%</div>
        </div>
      </a-col>
      <a-col :span="8">
        <div class="stat-card">
          <div class="stat-label">综合合格率</div>
          <div class="stat-value primary">{{ ((data.overallPassRate ?? 0) * 100).toFixed(1) }}%</div>
        </div>
      </a-col>
    </a-row>

    <!-- 图表区 -->
    <a-row :gutter="16" style="margin-bottom: 16px">
      <a-col :span="12">
        <a-card :title="$t('mes.quality-board.index.不合格品趋势近7天')" :bordered="false">
          <div ref="trendRef" class="chart-container" />
        </a-card>
      </a-col>
      <a-col :span="12">
        <a-card :title="$t('mes.quality-board.index.各工序首检通过率')" :bordered="false">
          <div ref="passRateRef" class="chart-container" />
        </a-card>
      </a-col>
    </a-row>

    <!-- 近期不合格品 -->
    <a-card :title="$t('mes.quality-board.index.近期不合格品记录')" :bordered="false">
      <a-table
        :columns="ncColumns"
        :data="data.recentNcs ?? []"
        :pagination="{ pageSize: 8 }"
        row-key="time"
        :loading="loading"
        :bordered="{ cell: false }"
      />
    </a-card>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
import { useI18n } from 'vue-i18n'
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import * as echarts from 'echarts/core'
import { LineChart, BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { mesApi, type QualityDashboard } from '@/api/mes'

echarts.use([LineChart, BarChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer])

const loading = ref(false)
const lastUpdate = ref('--')
const data = ref<Partial<QualityDashboard>>({})
const trendRef = ref<HTMLElement | null>(null)
const passRateRef = ref<HTMLElement | null>(null)
let trendChart: echarts.ECharts | null = null
let passRateChart: echarts.ECharts | null = null
let timer: ReturnType<typeof setInterval> | null = null

const ncColumns = [
  { title: t('mes.quality-board.index.工单号'), dataIndex: 'woCode', width: 130 },
  { title: t('mes.quality-board.index.工序'), dataIndex: 'operationName', width: 120 },
  { title: t('mes.quality-board.index.缺陷类型'), dataIndex: 'defectType', width: 120 },
  { title: t('mes.quality-board.index.数量'), dataIndex: 'qty', width: 80 },
  { title: t('mes.quality-board.index.时间'), dataIndex: 'time', width: 160 },
]

async function refresh() {
  loading.value = true
  try {
    const res = await mesApi.getQualityDashboard()
    data.value = res ?? mockData()
  } catch {
    data.value = mockData()
  } finally {
    loading.value = false
    lastUpdate.value = new Date().toLocaleTimeString('zh-CN')
    await nextTick()
    initCharts()
  }
}

function mockData(): QualityDashboard {
  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i))
    return `${d.getMonth() + 1}/${d.getDate()}`
  })
  return {
    todayNcCount: 3, firstPassRate: 0.92, overallPassRate: 0.97,
    ncTrend: dates.map((date, i) => ({ date, count: [2, 4, 1, 3, 5, 2, 3][i] })),
    operationPassRates: [
      { operationName: '拉丝', rate: 0.98 }, { operationName: '绞线', rate: 0.95 },
      { operationName: '绝缘', rate: 0.93 }, { operationName: '护套', rate: 0.97 },
    ],
    recentNcs: [],
  }
}

function initCharts() {
  // 趋势图
  if (trendRef.value) {
    trendChart?.dispose()
    trendChart = echarts.init(trendRef.value)
    trendChart.setOption({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', backgroundColor: '#161B22', borderColor: '#30363D', textStyle: { color: '#E6EDF3' } },
      grid: { top: 20, right: 20, bottom: 30, left: 40 },
      xAxis: { type: 'category', data: data.value.ncTrend?.map(d => d.date) ?? [], axisLabel: { color: '#8B949E' }, axisLine: { lineStyle: { color: '#30363D' } } },
      yAxis: { type: 'value', axisLabel: { color: '#8B949E' }, splitLine: { lineStyle: { color: '#21262D' } } },
      series: [{ type: 'line', data: data.value.ncTrend?.map(d => d.count) ?? [], smooth: true, symbol: 'circle', symbolSize: 6, lineStyle: { color: '#FF6B35', width: 2 }, itemStyle: { color: '#FF6B35' }, areaStyle: { color: 'rgba(255,107,53,0.1)' } }],
    })
  }
  // 首检通过率柱状图
  if (passRateRef.value) {
    passRateChart?.dispose()
    passRateChart = echarts.init(passRateRef.value)
    const rates = data.value.operationPassRates ?? []
    passRateChart.setOption({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', backgroundColor: '#161B22', borderColor: '#30363D', textStyle: { color: '#E6EDF3' }, formatter: (p: { name: string; value: number }[]) => `${p[0].name}: ${(p[0].value * 100).toFixed(1)}%` },
      grid: { top: 20, right: 20, bottom: 30, left: 50 },
      xAxis: { type: 'category', data: rates.map(r => r.operationName), axisLabel: { color: '#8B949E' }, axisLine: { lineStyle: { color: '#30363D' } } },
      yAxis: { type: 'value', min: 0.8, max: 1, axisLabel: { color: '#8B949E', formatter: (v: number) => `${(v * 100).toFixed(0)}%` }, splitLine: { lineStyle: { color: '#21262D' } } },
      series: [{ type: 'bar', data: rates.map(r => r.rate), itemStyle: { color: '#00D4C8', borderRadius: [4, 4, 0, 0] } }],
    })
  }
}

onMounted(() => { refresh(); timer = setInterval(refresh, 30_000); window.addEventListener('resize', handleResize) })
onUnmounted(() => { if (timer) clearInterval(timer); trendChart?.dispose(); passRateChart?.dispose(); window.removeEventListener('resize', handleResize) })
function handleResize() { trendChart?.resize(); passRateChart?.resize() }
</script>

<style scoped>
.qb-page { padding: 16px; background: #0D1117; min-height: 100%; color: #E6EDF3; }
.qb-header { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; }
.qb-title { font-size: 20px; font-weight: 600; }
.qb-update { font-size: 12px; color: #8B949E; }
.stat-card { background: #161B22; border: 1px solid #21262D; border-radius: 8px; padding: 20px 24px; text-align: center; }
.stat-label { font-size: 13px; color: #8B949E; margin-bottom: 8px; }
.stat-value { font-size: 32px; font-weight: 700; }
.stat-value.danger { color: #F53F3F; }
.stat-value.success { color: #00B578; }
.stat-value.primary { color: #1B4FD8; }
.chart-container { height: 240px; width: 100%; }
</style>
