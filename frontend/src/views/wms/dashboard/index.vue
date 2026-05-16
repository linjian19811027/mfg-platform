<template>
  <div class="wms-dashboard">
    <!-- 顶部标题栏 -->
    <div class="dashboard-header">
      <div class="header-left">
        <span class="title">{{ $t('wms.dashboard.lbl1879') }}</span>
        <span class="update-time">{{ $t('wms.dashboard.r22023', {lastUpdateTime: lastUpdateTime}) }}</span>
      </div>
      <a-button type="outline" size="small" :loading="loading" @click="refresh">
        <template #icon><icon-refresh /></template>
        {{ $t('wms.dashboard.refresh') }}
      </a-button>
    </div>

    <!-- 第一行：统计卡片 -->
    <a-row :gutter="16" class="stat-row">
      <a-col :span="8">
        <div class="stat-card">
          <div class="stat-label">{{ $t('wms.dashboard.lbl1880') }}</div>
          <div class="stat-value primary">{{ stats.totalSku }}</div>
        </div>
      </a-col>
      <a-col :span="8">
        <div class="stat-card">
          <div class="stat-label">{{ $t('wms.dashboard.lbl1881') }}</div>
          <div class="stat-value warning">{{ stats.alertCount }}</div>
        </div>
      </a-col>
      <a-col :span="8">
        <div class="stat-card">
          <div class="stat-label">{{ $t('wms.dashboard.lbl1882') }}</div>
          <div class="stat-value success">{{ stats.todayInbound }}</div>
        </div>
      </a-col>
    </a-row>

    <!-- 第二行：热力图 + 趋势图 -->
    <a-row :gutter="16" class="chart-row">
      <a-col :span="12">
        <div class="chart-card">
          <div class="card-title">{{ $t('wms.dashboard.lbl1883') }}</div>
          <div v-if="heatmapData.length > 0" ref="heatmapRef" class="chart-container"></div>
          <div v-else class="fallback-table">
            <a-table
              :data="inventoryList.slice(0, 10)"
              :columns="heatmapFallbackColumns"
              :pagination="false"
              size="small"
              :scroll="{ y: 260 }"
            />
          </div>
        </div>
      </a-col>
      <a-col :span="12">
        <div class="chart-card">
          <div class="card-title">{{ $t('wms.dashboard.lbl1884') }}</div>
          <div ref="trendRef" class="chart-container"></div>
        </div>
      </a-col>
    </a-row>

    <!-- 第三行：预警物料列表 -->
    <div class="chart-card alert-card">
      <div class="card-title">
        {{ $t('wms.dashboard.alertMaterialList') }}
        <a-tag color="red" size="small" style="margin-left: 8px">{{ $t('wms.dashboard.items', {length: alertList.length}) }}</a-tag>
      </div>
      <a-table
        :data="alertList"
        :columns="alertColumns"
        :pagination="{ pageSize: 8, showTotal: true }"
        :loading="loading"
        size="small"
        row-key="materialCode"
      >
        <template #alertLevel="{ record }">
          <a-tag :color="record.qty <= 5 ? 'red' : 'orange'">
            {{ record.qty <= 5 ? $t('wms.dashboard.lbl1885') : $t('wms.dashboard.lbl1886') }}
          </a-tag>
        </template>
      </a-table>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
import { useI18n } from 'vue-i18n'
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import * as echarts from 'echarts/core'
import { HeatmapChart, LineChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  VisualMapComponent,
  LegendComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { request } from '@/utils/request'

echarts.use([
  HeatmapChart,
  LineChart,
  GridComponent,
  TooltipComponent,
  VisualMapComponent,
  LegendComponent,
  CanvasRenderer,
])

// ─── 类型 ───────────────────────────────────────────────────────────────────
interface InventoryItem {
  materialCode: string
  materialName: string
  warehouseName: string
  qty: number
  safetyQty: number
}

interface MovementDay {
  date: string
  inbound: number
  outbound: number
  net: number
}

// ─── 状态 ───────────────────────────────────────────────────────────────────
const loading = ref(false)
const lastUpdateTime = ref('--')
const heatmapRef = ref<HTMLElement | null>(null)
const trendRef = ref<HTMLElement | null>(null)
let heatmapChart: echarts.ECharts | null = null
let trendChart: echarts.ECharts | null = null
let timer: ReturnType<typeof setInterval> | null = null

const stats = ref({ totalSku: 0, alertCount: 0, todayInbound: 0 })
const inventoryList = ref<InventoryItem[]>([])
const alertList = ref<InventoryItem[]>([])
const heatmapData = ref<[string, string, number][]>([])
const trendDays = ref<MovementDay[]>([])

// ─── 表格列定义 ──────────────────────────────────────────────────────────────
const heatmapFallbackColumns = [
  { title: t('wms.dashboard.index.物料编码'), dataIndex: 'materialCode', width: 120 },
  { title: t('wms.dashboard.index.库区'), dataIndex: 'warehouseName', width: 100 },
  { title: t('wms.dashboard.index.库存量'), dataIndex: 'qty', width: 80 },
]

const alertColumns = [
  { title: t('wms.dashboard.index.物料编码'), dataIndex: 'materialCode', width: 130 },
  { title: t('wms.dashboard.index.物料名称'), dataIndex: 'materialName', ellipsis: true },
  { title: t('wms.dashboard.index.当前库存'), dataIndex: 'qty', width: 100, sorter: true },
  { title: t('wms.dashboard.index.安全库存'), dataIndex: 'safetyQty', width: 100 },
  { title: t('wms.dashboard.index.预警级别'), slotName: 'alertLevel', width: 100 },
]

// ─── 数据加载 ────────────────────────────────────────────────────────────────
async function loadInventory() {
  try {
    const res = await request.get('/v1/wms/inventory')
    const list: InventoryItem[] = (res.data?.data ?? res.data ?? []).map((item: any) => ({
      materialCode: item.materialCode ?? item.material_code ?? '',
      materialName: item.materialName ?? item.material_name ?? '',
      warehouseName: item.warehouseName ?? item.warehouse_name ?? item.zone ?? '',
      qty: Number(item.qty ?? item.quantity ?? 0),
      safetyQty: Number(item.safetyQty ?? item.safety_qty ?? 10),
    }))
    inventoryList.value = list
    stats.value.totalSku = list.length

    // 预警物料：qty < safetyQty，按 qty 升序
    const alerts = list
      .filter((i) => i.qty < i.safetyQty)
      .sort((a, b) => a.qty - b.qty)
    alertList.value = alerts
    stats.value.alertCount = alerts.length

    // 热力图数据：取前 10 个物料 × 所有库区
    buildHeatmapData(list)
  } catch {
    // 接口失败时保留空数据
  }
}

async function loadMovement() {
  try {
    const res = await request.get('/v1/wms/reports/movement?days=7')
    const raw: any[] = res.data?.data ?? res.data ?? []
    trendDays.value = raw.map((d: any) => ({
      date: d.date ?? d.day ?? '',
      inbound: Number(d.inbound ?? d.in_qty ?? 0),
      outbound: Number(d.outbound ?? d.out_qty ?? 0),
      net: Number(d.net ?? (d.inbound ?? 0) - (d.outbound ?? 0)),
    }))
    // 今日入库量取最后一天
    if (trendDays.value.length > 0) {
      stats.value.todayInbound = trendDays.value[trendDays.value.length - 1].inbound
    }
  } catch {
    // 接口失败时保留空数据
  }
}

function buildHeatmapData(list: InventoryItem[]) {
  const materials = [...new Set(list.map((i) => i.materialCode))].slice(0, 10)
  const warehouses = [...new Set(list.map((i) => i.warehouseName))]
  const data: [string, string, number][] = []
  for (const mat of materials) {
    for (const wh of warehouses) {
      const item = list.find((i) => i.materialCode === mat && i.warehouseName === wh)
      if (item) data.push([mat, wh, item.qty])
    }
  }
  heatmapData.value = data
}

// ─── ECharts 初始化 ──────────────────────────────────────────────────────────
function initHeatmap() {
  if (!heatmapRef.value || heatmapData.value.length === 0) return
  if (heatmapChart) heatmapChart.dispose()
  heatmapChart = echarts.init(heatmapRef.value)

  const materials = [...new Set(heatmapData.value.map((d) => d[0]))]
  const warehouses = [...new Set(heatmapData.value.map((d) => d[1]))]
  const values = heatmapData.value.map((d) => d[2])
  const maxVal = Math.max(...values, 1)

  heatmapChart.setOption({
    ...buildBaseOption(),
    visualMap: {
      min: 0,
      max: maxVal,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      inRange: { color: ['#1B4FD8', '#00D4C8', '#FF6B35'] },
      textStyle: { color: '#8B949E' },
    },
    grid: { top: 20, right: 20, bottom: 60, left: 80 },
    xAxis: {
      type: 'category',
      data: materials,
      axisLabel: { color: '#8B949E', rotate: 30, fontSize: 11 },
      axisLine: { lineStyle: { color: '#30363D' } },
    },
    yAxis: {
      type: 'category',
      data: warehouses,
      axisLabel: { color: '#8B949E', fontSize: 11 },
      axisLine: { lineStyle: { color: '#30363D' } },
    },
    series: [
      {
        type: 'heatmap',
        data: heatmapData.value.map((d) => [
          materials.indexOf(d[0]),
          warehouses.indexOf(d[1]),
          d[2],
        ]),
        label: { show: true, color: '#E6EDF3', fontSize: 10 },
        emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' } },
      },
    ],
  })
}

function initTrend() {
  if (!trendRef.value) return
  if (trendChart) trendChart.dispose()
  trendChart = echarts.init(trendRef.value)

  const dates = trendDays.value.map((d) => d.date)
  const inbound = trendDays.value.map((d) => d.inbound)
  const outbound = trendDays.value.map((d) => d.outbound)
  const net = trendDays.value.map((d) => d.net)

  trendChart.setOption({
    ...buildBaseOption(),
    legend: {
      data: [t('wms.dashboard.lbl1887'), t('wms.dashboard.lbl1888'), t('wms.dashboard.lbl1889')],
      textStyle: { color: '#8B949E' },
      top: 0,
    },
    grid: { top: 40, right: 20, bottom: 30, left: 50 },
    xAxis: {
      type: 'category',
      data: dates,
      axisLabel: { color: '#8B949E', fontSize: 11 },
      axisLine: { lineStyle: { color: '#30363D' } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#8B949E' },
      splitLine: { lineStyle: { color: '#21262D' } },
    },
    series: [
      {
        name: t('wms.dashboard.lbl1890'),
        type: 'line',
        data: inbound,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { color: '#00B578', width: 2 },
        itemStyle: { color: '#00B578' },
      },
      {
        name: t('wms.dashboard.lbl1891'),
        type: 'line',
        data: outbound,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { color: '#FF6B35', width: 2 },
        itemStyle: { color: '#FF6B35' },
      },
      {
        name: t('wms.dashboard.lbl1892'),
        type: 'line',
        data: net,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { color: '#00D4C8', width: 2 },
        itemStyle: { color: '#00D4C8' },
      },
    ],
  })
}

function buildBaseOption() {
  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: '#161B22',
      borderColor: '#30363D',
      textStyle: { color: '#E6EDF3' },
    },
  }
}

// ─── 刷新 ────────────────────────────────────────────────────────────────────
async function refresh() {
  loading.value = true
  try {
    await Promise.all([loadInventory(), loadMovement()])
    lastUpdateTime.value = new Date().toLocaleTimeString('zh-CN')
    await nextTick()
    initHeatmap()
    initTrend()
  } finally {
    loading.value = false
  }
}

// ─── 生命周期 ────────────────────────────────────────────────────────────────
onMounted(async () => {
  await refresh()
  timer = setInterval(refresh, 30_000)

  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
  heatmapChart?.dispose()
  trendChart?.dispose()
  window.removeEventListener('resize', handleResize)
})

function handleResize() {
  heatmapChart?.resize()
  trendChart?.resize()
}
</script>

<style scoped>
.wms-dashboard {
  padding: 16px;
  background: #0d1117;
  min-height: 100vh;
  color: #e6edf3;
}

.dashboard-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.header-left {
  display: flex;
  align-items: baseline;
  gap: 16px;
}

.title {
  font-size: 20px;
  font-weight: 600;
  color: #e6edf3;
  letter-spacing: 1px;
}

.update-time {
  font-size: 12px;
  color: #8b949e;
}

/* 统计卡片 */
.stat-row {
  margin-bottom: 16px;
}

.stat-card {
  background: #161b22;
  border: 1px solid #21262d;
  border-radius: 8px;
  padding: 20px 24px;
  text-align: center;
}

.stat-label {
  font-size: 13px;
  color: #8b949e;
  margin-bottom: 8px;
}

.stat-value {
  font-size: 32px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.stat-value.primary { color: #1b4fd8; }
.stat-value.warning { color: #ff6b35; }
.stat-value.success { color: #00b578; }

/* 图表卡片 */
.chart-row {
  margin-bottom: 16px;
}

.chart-card {
  background: #161b22;
  border: 1px solid #21262d;
  border-radius: 8px;
  padding: 16px;
}

.card-title {
  font-size: 14px;
  font-weight: 600;
  color: #e6edf3;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
}

.chart-container {
  height: 300px;
  width: 100%;
}

.fallback-table {
  height: 300px;
  overflow: auto;
}

/* 预警列表 */
.alert-card {
  margin-bottom: 0;
}

/* Arco 表格深色适配 */
:deep(.arco-table) {
  background: transparent;
}

:deep(.arco-table-th) {
  background: #0d1117 !important;
  color: #8b949e;
  border-bottom-color: #21262d !important;
}

:deep(.arco-table-td) {
  background: transparent !important;
  color: #e6edf3;
  border-bottom-color: #21262d !important;
}

:deep(.arco-table-tr:hover .arco-table-td) {
  background: #21262d !important;
}

:deep(.arco-pagination) {
  color: #8b949e;
}
</style>
