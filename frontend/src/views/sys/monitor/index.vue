<template>
  <div class="monitor-page">
    <!-- 顶部状态栏 -->
    <a-row :gutter="16" style="margin-bottom: 16px">
      <a-col :span="6">
        <a-card :bordered="false" :loading="loading" class="stat-card">
          <div class="stat-header">
            <icon-cloud style="color: #165dff; font-size: 24px" />
            <span class="stat-title">{{ $t('sys.monitor.lbl1689') }}</span>
          </div>
          <a-tag :color="health.status === 'UP' ? 'green' : 'red'" size="large" style="margin-top: 8px">
            {{ health.status === 'UP' ? $t('sys.monitor.lbl1690') : $t('sys.monitor.lbl1691') }}
          </a-tag>
          <div class="stat-sub">{{ $t('sys.monitor.r22013', {mode: health.mode}) }}</div>
        </a-card>
      </a-col>
      <a-col :span="6">
        <a-card :bordered="false" :loading="loading" class="stat-card">
          <div class="stat-header">
            <icon-computer style="color: #00b42a; font-size: 24px" />
            <span class="stat-title">{{ $t('sys.monitor.lbl1692') }}</span>
          </div>
          <a-progress
            :percent="metrics.cpu?.usagePercent ?? 0"
            :color="cpuColor"
            :stroke-width="8"
            style="margin-top: 8px"
          />
          <div class="stat-sub">{{ $t('sys.monitor.r33067', {cores: metrics.cpu?.cores}) }} · {{ $t('sys.monitor.r33068', {loadAvg1m: metrics.cpu?.loadAvg1m}) }}</div>
        </a-card>
      </a-col>
      <a-col :span="6">
        <a-card :bordered="false" :loading="loading" class="stat-card">
          <div class="stat-header">
            <icon-storage style="color: #ff7d00; font-size: 24px" />
            <span class="stat-title">{{ $t('sys.monitor.lbl1693') }}</span>
          </div>
          <a-progress
            :percent="metrics.memory?.usagePercent ?? 0"
            :color="memColor"
            :stroke-width="8"
            style="margin-top: 8px"
          />
          <div class="stat-sub">{{ metrics.memory?.usedMB }} MB / {{ metrics.memory?.totalMB }} MB</div>
        </a-card>
      </a-col>
      <a-col :span="6">
        <a-card :bordered="false" :loading="loading" class="stat-card">
          <div class="stat-header">
            <icon-apps style="color: #722ed1; font-size: 24px" />
            <span class="stat-title">{{ $t('sys.monitor.lbl1694') }}</span>
          </div>
          <div class="stat-big">{{ metrics.database?.connections ?? 0 }}</div>
          <div class="stat-sub">{{ $t('sys.monitor.r22014', {activeConnections: metrics.database?.activeConnections ?? 0}) }}</div>
        </a-card>
      </a-col>
    </a-row>

    <a-row :gutter="16" style="margin-bottom: 16px">
      <!-- 日志趋势图 -->
      <a-col :span="16">
        <a-card :title="$t('sys.monitor.index.最近60分钟日志趋势')" :bordered="false" :loading="loading">
          <div ref="trendChartRef" style="height: 280px"></div>
        </a-card>
      </a-col>

      <!-- 系统信息 -->
      <a-col :span="8">
        <a-card :title="$t('sys.monitor.index.系统信息')" :bordered="false" :loading="loading">
          <a-descriptions :column="1" size="small">
            <a-descriptions-item :label="$t('sys.monitor.index.主机名')">{{ metrics.system?.hostname }}</a-descriptions-item>
            <a-descriptions-item :label="$t('sys.monitor.index.平台')">{{ metrics.system?.platform }} / {{ metrics.system?.arch }}</a-descriptions-item>
            <a-descriptions-item label="Node.js">{{ metrics.system?.nodeVersion }}</a-descriptions-item>
            <a-descriptions-item :label="$t('sys.monitor.index.系统运行')">{{ formatUptime(metrics.system?.uptimeSec) }}</a-descriptions-item>
            <a-descriptions-item :label="$t('sys.monitor.index.进程运行')">{{ formatUptime(metrics.system?.processUptimeSec) }}</a-descriptions-item>
            <a-descriptions-item :label="$t('sys.monitor.index.堆内存')">{{ metrics.memory?.process?.heapUsedMB }} / {{ metrics.memory?.process?.heapTotalMB }} MB</a-descriptions-item>
            <a-descriptions-item label="RSS">{{ metrics.memory?.process?.rssMB }} MB</a-descriptions-item>
            <a-descriptions-item :label="$t('sys.monitor.index.数据库大小')">{{ metrics.database?.sizeMB }} MB</a-descriptions-item>
          </a-descriptions>
        </a-card>
      </a-col>
    </a-row>

    <a-row :gutter="16">
      <!-- 内存详情 -->
      <a-col :span="8">
        <a-card :title="$t('sys.monitor.index.内存分布')" :bordered="false" :loading="loading">
          <div ref="memChartRef" style="height: 220px"></div>
        </a-card>
      </a-col>

      <!-- CPU 负载 -->
      <a-col :span="8">
        <a-card :title="$t('sys.monitor.index.CPU负载均值')" :bordered="false" :loading="loading">
          <div ref="cpuChartRef" style="height: 220px"></div>
        </a-card>
      </a-col>

      <!-- 近1小时日志统计 -->
      <a-col :span="8">
        <a-card :title="$t('sys.monitor.index.近1小时日志统计')" :bordered="false" :loading="loading">
          <a-row :gutter="8" style="margin-bottom: 12px">
            <a-col :span="12">
              <a-statistic :title="$t('sys.monitor.index.总日志')" :value="metrics.logs?.total ?? 0" />
            </a-col>
            <a-col :span="12">
              <a-statistic :title="$t('sys.monitor.index.错误')" :value="metrics.logs?.errors ?? 0" :value-style="{ color: '#f53f3f' }" />
            </a-col>
          </a-row>
          <a-row :gutter="8">
            <a-col :span="12">
              <a-statistic :title="$t('sys.monitor.index.操作')" :value="metrics.logs?.operations ?? 0" :value-style="{ color: '#165dff' }" />
            </a-col>
            <a-col :span="12">
              <a-statistic :title="$t('sys.monitor.index.登录')" :value="metrics.logs?.logins ?? 0" :value-style="{ color: '#00b42a' }" />
            </a-col>
          </a-row>
          <a-divider style="margin: 12px 0" />
          <div ref="logPieRef" style="height: 120px"></div>
        </a-card>
      </a-col>
    </a-row>

    <!-- 刷新按钮 -->
    <div style="position: fixed; bottom: 32px; right: 32px">
      <a-button type="primary" shape="circle" size="large" :loading="loading" @click="refresh">
        <template #icon><icon-refresh /></template>
      </a-button>
    </div>
  </div>
</template>

<script setup lang="ts">

import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Message } from '@arco-design/web-vue'
import { IconCloud, IconComputer, IconStorage, IconApps, IconRefresh } from '@arco-design/web-vue/es/icon'
import * as echarts from 'echarts'
import { getHealth, getMetrics, getMetricsTrend } from '@/api/monitor'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()

const loading = ref(false)
const health = ref<any>({ status: 'UP', mode: 'DEGRADED' })
const metrics = ref<any>({})
const trend = ref<any[]>([])

const trendChartRef = ref()
const memChartRef = ref()
const cpuChartRef = ref()
const logPieRef = ref()
let trendChart: echarts.ECharts | null = null
let memChart: echarts.ECharts | null = null
let cpuChart: echarts.ECharts | null = null
let logPieChart: echarts.ECharts | null = null
let timer: ReturnType<typeof setInterval> | null = null

const cpuColor = computed(() => {
  const v = metrics.value.cpu?.usagePercent ?? 0
  return v > 80 ? '#f53f3f' : v > 60 ? '#ff7d00' : '#00b42a'
})
const memColor = computed(() => {
  const v = metrics.value.memory?.usagePercent ?? 0
  return v > 85 ? '#f53f3f' : v > 70 ? '#ff7d00' : '#165dff'
})

function formatUptime(sec?: number) {
  if (!sec) return '-'
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return d > 0 ? t('sys.monitor.uptimeDays', { d, h }) : h > 0 ? t('sys.monitor.uptimeHours', { h, m }) : t('sys.monitor.uptimeMinutes', { m })
}

async function refresh() {
  loading.value = true
  try {
    const [h, m, t] = await Promise.all([getHealth(), getMetrics(), getMetricsTrend()])
    health.value = (h as any).data ?? h
    metrics.value = (m as any).data ?? m
    trend.value = ((t as any).data ?? t)?.points ?? []
    renderCharts()
  } catch (e: any) {
    Message.error(e.message || t('sys.加载失败'))
  } finally {
    loading.value = false
  }
}

function renderCharts() {
  renderTrend()
  renderMem()
  renderCpu()
  renderLogPie()
}

function renderTrend() {
  if (!trendChartRef.value) return
  if (!trendChart) trendChart = echarts.init(trendChartRef.value)
  const times = trend.value.map(p => p.time)
  trendChart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: [t('sys.monitor.action'), t('sys.monitor.lbl1695'), t('sys.monitor.lbl1696')], bottom: 0 },
    grid: { left: 40, right: 20, top: 20, bottom: 40 },
    xAxis: { type: 'category', data: times, axisLabel: { interval: 9, fontSize: 11 } },
    yAxis: { type: 'value', minInterval: 1 },
    series: [
      { name: t('sys.monitor.action'), type: 'line', smooth: true, data: trend.value.map(p => p.operations), itemStyle: { color: '#165dff' }, areaStyle: { opacity: 0.1 } },
      { name: t('sys.monitor.lbl1697'), type: 'line', smooth: true, data: trend.value.map(p => p.logins), itemStyle: { color: '#00b42a' }, areaStyle: { opacity: 0.1 } },
      { name: t('sys.monitor.lbl1698'), type: 'line', smooth: true, data: trend.value.map(p => p.errors), itemStyle: { color: '#f53f3f' }, areaStyle: { opacity: 0.1 } },
    ],
  })
}

function renderMem() {
  if (!memChartRef.value) return
  if (!memChart) memChart = echarts.init(memChartRef.value)
  const m = metrics.value.memory ?? {}
  const proc = m.process ?? {}
  memChart.setOption({
    tooltip: { trigger: 'item', formatter: '{b}: {c} MB ({d}%)' },
    series: [{
      type: 'pie', radius: ['45%', '70%'], center: ['50%', '50%'],
      data: [
        { name: t('sys.monitor.lbl1699'), value: proc.heapUsedMB ?? 0, itemStyle: { color: '#165dff' } },
        { name: t('sys.monitor.lbl1700'), value: Math.max(0, (proc.rssMB ?? 0) - (proc.heapUsedMB ?? 0)), itemStyle: { color: '#722ed1' } },
        { name: t('sys.monitor.lbl1701'), value: m.freeMB ?? 0, itemStyle: { color: '#e5e6eb' } },
        { name: t('sys.monitor.lbl1702'), value: Math.max(0, (m.usedMB ?? 0) - (proc.rssMB ?? 0)), itemStyle: { color: '#ff7d00' } },
      ],
      label: { fontSize: 11 },
    }],
  })
}

function renderCpu() {
  if (!cpuChartRef.value) return
  if (!cpuChart) cpuChart = echarts.init(cpuChartRef.value)
  const cpu = metrics.value.cpu ?? {}
  cpuChart.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: 50, right: 20, top: 20, bottom: 30 },
    xAxis: { type: 'category', data: [t('sys.monitor.lbl1703'), t('sys.monitor.lbl1704'), t('sys.monitor.lbl1705')] },
    yAxis: { type: 'value', max: Math.max(cpu.cores ?? 1, cpu.loadAvg15m ?? 1) * 1.2 },
    series: [{
      type: 'bar', barWidth: '40%',
      data: [
        { value: cpu.loadAvg1m ?? 0, itemStyle: { color: '#165dff' } },
        { value: cpu.loadAvg5m ?? 0, itemStyle: { color: '#00b42a' } },
        { value: cpu.loadAvg15m ?? 0, itemStyle: { color: '#ff7d00' } },
      ],
      label: { show: true, position: 'top', formatter: '{c}' },
    }],
  })
}

function renderLogPie() {
  if (!logPieRef.value) return
  if (!logPieChart) logPieChart = echarts.init(logPieRef.value)
  const logs = metrics.value.logs ?? {}
  logPieChart.setOption({
    tooltip: { trigger: 'item' },
    series: [{
      type: 'pie', radius: '70%', center: ['50%', '50%'],
      data: [
        { name: t('sys.monitor.action'), value: logs.operations ?? 0, itemStyle: { color: '#165dff' } },
        { name: t('sys.monitor.lbl1706'), value: logs.logins ?? 0, itemStyle: { color: '#00b42a' } },
        { name: t('sys.monitor.lbl1707'), value: logs.errors ?? 0, itemStyle: { color: '#f53f3f' } },
      ],
      label: { fontSize: 11 },
    }],
  })
}

function handleResize() {
  trendChart?.resize(); memChart?.resize(); cpuChart?.resize(); logPieChart?.resize()
}

onMounted(() => {
  refresh()
  timer = setInterval(refresh, 30000) // 每30秒自动刷新
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
  trendChart?.dispose(); memChart?.dispose(); cpuChart?.dispose(); logPieChart?.dispose()
  window.removeEventListener('resize', handleResize)
})
</script>

<style scoped>
.monitor-page { padding: 16px; }
.stat-card { height: 120px; }
.stat-header { display: flex; align-items: center; gap: 8px; }
.stat-title { font-size: 14px; color: var(--color-text-2); }
.stat-big { font-size: 32px; font-weight: 600; color: var(--color-text-1); margin-top: 4px; }
.stat-sub { font-size: 12px; color: var(--color-text-3); margin-top: 4px; }
</style>
