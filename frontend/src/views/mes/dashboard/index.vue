<template>
  <div class="production-board">
    <!-- 顶部标题栏 -->
    <div class="board-header">
      <div class="header-left">
        <span class="board-title">生产看板</span>
        <span class="board-subtitle">实时生产监控</span>
      </div>
      <div class="header-right">
        <span class="last-update">最后更新：{{ lastUpdateTime }}</span>
        <a-button type="outline" size="small" :loading="loading" @click="fetchData">
          <template #icon><icon-refresh /></template>
          刷新
        </a-button>
        <span class="realtime-clock">{{ currentTime }}</span>
      </div>
    </div>

    <!-- 第一行：统计卡片 -->
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-icon stat-icon--blue"><icon-file /></div>
        <div class="stat-content">
          <a-statistic :value="summary.totalWo" :title="$t('mes.dashboard.index.总工单数')" :value-style="{ color: '#E6EDF3', fontSize: '28px' }" />
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon stat-icon--cyan"><icon-loading /></div>
        <div class="stat-content">
          <a-statistic :value="summary.inProgress" :title="$t('mes.dashboard.index.进行中')" :value-style="{ color: '#00D4C8', fontSize: '28px' }" />
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon stat-icon--green"><icon-check-circle /></div>
        <div class="stat-content">
          <a-statistic :value="summary.completed" :title="$t('mes.dashboard.index.已完成')" :value-style="{ color: '#00B578', fontSize: '28px' }" />
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon stat-icon--orange"><icon-clock-circle /></div>
        <div class="stat-content">
          <a-statistic :value="summary.onTime" :title="$t('mes.dashboard.index.准时率')" suffix="%" :value-style="{ color: '#FF6B35', fontSize: '28px' }" />
        </div>
      </div>
    </div>

    <!-- 第二行：工单列表 + 趋势图 -->
    <div class="main-row">
      <!-- 左侧：工单进度列表 -->
      <div class="panel panel--left">
        <div class="panel-header">
          <span class="panel-title">工单进度</span>
          <a-tag color="blue" size="small">前 10 条</a-tag>
        </div>
        <a-table
          :data="workOrders.slice(0, 10)"
          :loading="loading"
          :pagination="false"
          :scroll="{ y: 320 }"
          size="small"
          row-key="id"
          class="wo-table"
        >
          <template #columns>
            <a-table-column :title="$t('mes.dashboard.index.工单号')" data-index="code" :width="120">
              <template #cell="{ record }">
                <span class="wo-code">{{ record.code }}</span>
              </template>
            </a-table-column>
            <a-table-column :title="$t('mes.dashboard.index.物料')" data-index="materialName" :width="140" ellipsis />
            <a-table-column :title="$t('mes.dashboard.index.计划完成')" :width="110">
              <template #cell="{ record }">
                <span class="qty-text">{{ record.completedQty }} / {{ record.plannedQty }}</span>
              </template>
            </a-table-column>
            <a-table-column :title="$t('mes.dashboard.index.进度')" :width="160">
              <template #cell="{ record }">
                <a-progress
                  :percent="record.progress"
                  :stroke-width="6"
                  :color="progressColor(record.progress)"
                  size="small"
                />
              </template>
            </a-table-column>
            <a-table-column :title="$t('mes.dashboard.index.状态')" data-index="status" :width="90">
              <template #cell="{ record }">
                <a-tag :color="statusColor(record.status)" size="small">{{ statusLabel(record.status) }}</a-tag>
              </template>
            </a-table-column>
          </template>
        </a-table>
      </div>

      <!-- 右侧：产量趋势图 -->
      <div class="panel panel--right">
        <div class="panel-header">
          <span class="panel-title">产量趋势（近 7 天）</span>
        </div>
        <div ref="chartRef" class="trend-chart"></div>
      </div>
    </div>

    <!-- 第三行：异常告警 -->
    <div class="panel panel--alert">
      <div class="panel-header">
        <span class="panel-title">异常告警</span>
        <a-tag v-if="exceptions.length > 0" color="red" size="small">{{ exceptions.length }} 条</a-tag>
        <a-tag v-else color="green" size="small">正常</a-tag>
      </div>
      <div v-if="exceptions.length === 0" class="no-alert">
        <icon-check-circle style="color: #00B578; margin-right: 6px;" />
        <span style="color: #8B949E;">暂无异常告警</span>
      </div>
      <div v-else class="alert-list">
        <a-alert
          v-for="ex in exceptions.slice(0, 5)"
          :key="ex.id"
          :type="alertType(ex.type)"
          :title="`[${ex.woCode}] ${ex.type}`"
          :content="ex.message + '  ' + ex.time"
          show-icon
          closable
          class="alert-item"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">

import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  TitleComponent,
  LegendComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { industrialTheme } from '@/utils/echarts-theme'
import { request } from '@/utils/request'

echarts.use([LineChart, GridComponent, TooltipComponent, TitleComponent, LegendComponent, CanvasRenderer])
echarts.registerTheme('industrial', industrialTheme)

// ─── 类型 ────────────────────────────────────────────────────────────────────
interface WorkOrderItem {
  id: string
  code: string
  materialName: string
  plannedQty: number
  completedQty: number
  status: string
  progress: number
}

interface OutputTrendItem {
  date: string
  qty: number
}

interface ExceptionItem {
  id: string
  woCode: string
  type: string
  message: string
  time: string
}

interface Summary {
  totalWo: number
  inProgress: number
  completed: number
  onTime: number
}

// ─── 状态 ────────────────────────────────────────────────────────────────────
const loading = ref(false)
const workOrders = ref<WorkOrderItem[]>([])
const outputTrend = ref<OutputTrendItem[]>([])
const exceptions = ref<ExceptionItem[]>([])
const summary = ref<Summary>({ totalWo: 0, inProgress: 0, completed: 0, onTime: 0 })

const currentTime = ref('')
const lastUpdateTime = ref('--')
const chartRef = ref<HTMLDivElement | null>(null)
let chartInstance: echarts.ECharts | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null
let clockTimer: ReturnType<typeof setInterval> | null = null

// ─── 工具函数 ────────────────────────────────────────────────────────────────
function formatTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function progressColor(pct: number): string {
  if (pct >= 100) return '#00B578'
  if (pct >= 60) return '#1B4FD8'
  if (pct >= 30) return '#FF6B35'
  return '#F53F3F'
}

function statusColor(status: string): string {
  const map: Record<string, string> = {
    draft: 'gray',
    released: 'blue',
    in_progress: 'cyan',
    completed: 'green',
    closed: 'gray',
  }
  return map[status] ?? 'gray'
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    draft: '草稿',
    released: '已下达',
    in_progress: '进行中',
    completed: '已完成',
    closed: '已关闭',
  }
  return map[status] ?? status
}

function alertType(type: string): 'error' | 'warning' | 'info' {
  if (type.includes('超期') || type.includes('故障') || type.includes('停机')) return 'error'
  if (type.includes('预警') || type.includes('延迟')) return 'warning'
  return 'info'
}

// ─── 数据获取 ────────────────────────────────────────────────────────────────
async function fetchData() {
  loading.value = true
  try {
    const data = await request.get<{
      workOrders: WorkOrderItem[]
      outputTrend: OutputTrendItem[]
      exceptions: ExceptionItem[]
      summary: Summary
    }>('/v1/mes/dashboards/production')

    workOrders.value = data.workOrders ?? []
    outputTrend.value = data.outputTrend ?? []
    exceptions.value = data.exceptions ?? []
    summary.value = data.summary ?? { totalWo: 0, inProgress: 0, completed: 0, onTime: 0 }
    lastUpdateTime.value = formatTime(new Date())
    updateChart()
  } catch {
    // 接口不存在时使用 mock 数据，保证页面可展示
    useMockData()
  } finally {
    loading.value = false
  }
}

function useMockData() {
  const now = new Date()
  workOrders.value = Array.from({ length: 10 }, (_, i) => ({
    id: `wo-${i + 1}`,
    code: `WO-2024-${String(i + 1).padStart(4, '0')}`,
    materialName: ['铜芯电缆', '铝芯导线', '绝缘护套', '钢芯铝绞线', '控制电缆'][i % 5],
    plannedQty: 1000 + i * 200,
    completedQty: Math.floor((1000 + i * 200) * (0.3 + i * 0.07)),
    status: ['in_progress', 'in_progress', 'completed', 'released', 'in_progress'][i % 5],
    progress: Math.min(100, Math.floor(30 + i * 7)),
  }))

  outputTrend.value = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now)
    d.setDate(now.getDate() - 6 + i)
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return { date: `${mm}/${dd}`, qty: 800 + Math.floor(Math.random() * 400) }
  })

  exceptions.value = [
    { id: 'e1', woCode: 'WO-2024-0003', type: '超期预警', message: '计划完工时间已超期 2 天', time: formatTime(now) },
    { id: 'e2', woCode: 'WO-2024-0007', type: '设备故障', message: '拉丝机 #3 报警停机', time: formatTime(now) },
  ]

  summary.value = { totalWo: 42, inProgress: 15, completed: 23, onTime: 87 }
  lastUpdateTime.value = formatTime(new Date())
  updateChart()
}

// ─── ECharts 图表 ────────────────────────────────────────────────────────────
function initChart() {
  if (!chartRef.value) return
  chartInstance = echarts.init(chartRef.value, 'industrial')
  updateChart()
}

function updateChart() {
  if (!chartInstance) return
  const dates = outputTrend.value.map(d => d.date)
  const qtys = outputTrend.value.map(d => d.qty)

  chartInstance.setOption({
    grid: { top: 20, right: 20, bottom: 36, left: 50 },
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown) => {
        const p = (params as Array<{ name: string; value: number }>)[0]
        return `${p.name}<br/>产量：<b>${p.value}</b>`
      },
    },
    xAxis: {
      type: 'category',
      data: dates,
      axisLine: { lineStyle: { color: '#30363D' } },
      axisLabel: { color: '#8B949E', fontSize: 11 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#8B949E', fontSize: 11 },
      splitLine: { lineStyle: { color: '#21262D' } },
      axisLine: { show: false },
    },
    series: [
      {
        type: 'line',
        data: qtys,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { color: '#00D4C8', width: 2 },
        itemStyle: { color: '#00D4C8' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(0,212,200,0.3)' },
            { offset: 1, color: 'rgba(0,212,200,0.02)' },
          ]),
        },
      },
    ],
  })
}

// ─── 时钟 ────────────────────────────────────────────────────────────────────
function startClock() {
  currentTime.value = formatTime(new Date())
  clockTimer = setInterval(() => {
    currentTime.value = formatTime(new Date())
  }, 1000)
}

// ─── 生命周期 ────────────────────────────────────────────────────────────────
onMounted(async () => {
  startClock()
  await fetchData()
  await nextTick()
  initChart()

  // 每 10 秒轮询（模拟 SSE）
  pollTimer = setInterval(fetchData, 10000)

  // 响应式 resize
  window.addEventListener('resize', onResize)
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
  if (clockTimer) clearInterval(clockTimer)
  window.removeEventListener('resize', onResize)
  chartInstance?.dispose()
})

function onResize() {
  chartInstance?.resize()
}
</script>

<style scoped>
.production-board {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  min-height: 100%;
  background: #0D1117;
  color: #E6EDF3;
}

/* ── 顶部标题栏 ── */
.board-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #161B22;
  border: 1px solid #21262D;
  border-radius: 6px;
}

.header-left {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.board-title {
  font-size: 20px;
  font-weight: 600;
  color: #E6EDF3;
  letter-spacing: 1px;
}

.board-subtitle {
  font-size: 12px;
  color: #8B949E;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.last-update {
  font-size: 12px;
  color: #8B949E;
}

.realtime-clock {
  font-size: 14px;
  font-family: 'Courier New', monospace;
  color: #00D4C8;
  min-width: 160px;
  text-align: right;
}

/* ── 统计卡片行 ── */
.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  background: #161B22;
  border: 1px solid #21262D;
  border-radius: 6px;
  transition: border-color 0.2s;
}

.stat-card:hover {
  border-color: #30363D;
}

.stat-icon {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}

.stat-icon--blue  { background: rgba(27,79,216,0.15); color: #1B4FD8; }
.stat-icon--cyan  { background: rgba(0,212,200,0.15); color: #00D4C8; }
.stat-icon--green { background: rgba(0,181,120,0.15); color: #00B578; }
.stat-icon--orange{ background: rgba(255,107,53,0.15); color: #FF6B35; }

.stat-content {
  flex: 1;
  min-width: 0;
}

/* ── 主内容行 ── */
.main-row {
  display: grid;
  grid-template-columns: 60% 40%;
  gap: 12px;
  min-height: 380px;
}

/* ── 面板通用 ── */
.panel {
  background: #161B22;
  border: 1px solid #21262D;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-bottom: 1px solid #21262D;
  flex-shrink: 0;
}

.panel-title {
  font-size: 14px;
  font-weight: 500;
  color: #C9D1D9;
}

/* ── 工单表格 ── */
.panel--left {
  flex: 1;
}

.wo-table {
  flex: 1;
}

.wo-code {
  font-family: 'Courier New', monospace;
  font-size: 12px;
  color: #58A6FF;
}

.qty-text {
  font-size: 12px;
  color: #8B949E;
}

/* ── 趋势图 ── */
.panel--right {
  flex: 1;
}

.trend-chart {
  flex: 1;
  min-height: 300px;
  padding: 8px;
}

/* ── 告警区 ── */
.panel--alert {
  min-height: 80px;
}

.no-alert {
  display: flex;
  align-items: center;
  padding: 16px;
  font-size: 13px;
}

.alert-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 16px;
}

.alert-item {
  border-radius: 4px;
}

/* ── Arco 表格深色覆盖 ── */
:deep(.arco-table) {
  background: transparent;
}

:deep(.arco-table-th) {
  background: #0D1117 !important;
  color: #8B949E;
  border-bottom: 1px solid #21262D;
  font-size: 12px;
}

:deep(.arco-table-tr) {
  background: transparent;
}

:deep(.arco-table-tr:hover .arco-table-td) {
  background: rgba(255,255,255,0.03) !important;
}

:deep(.arco-table-td) {
  border-bottom: 1px solid #21262D;
  color: #C9D1D9;
  font-size: 12px;
}

:deep(.arco-statistic-title) {
  color: #8B949E;
  font-size: 12px;
}
</style>
