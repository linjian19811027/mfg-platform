<template>
  <div class="gantt-page">
    <!-- 顶部工具栏 -->
    <div class="gantt-toolbar">
      <a-space wrap>
        <span class="toolbar-label">开始日期</span>
        <a-date-picker v-model="dateRange.start" style="width: 150px" @change="handleQuery" />
        <span class="toolbar-label">结束日期</span>
        <a-date-picker v-model="dateRange.end" style="width: 150px" @change="handleQuery" />
        <a-button type="primary" :loading="loading" @click="handleQuery">{{ $t('common.search') }}</a-button>
        <a-divider direction="vertical" />
        <!-- 图例 -->
        <div class="legend">
          <span class="legend-item"><span class="legend-dot" style="background:#58A6FF"></span>待排程</span>
          <span class="legend-item"><span class="legend-dot" style="background:#F78166"></span>进行中</span>
          <span class="legend-item"><span class="legend-dot" style="background:#3FB950"></span>已完成</span>
          <span class="legend-item"><span class="legend-dot" style="background:#6E7681"></span>已取消</span>
          <span class="legend-item"><span class="legend-dot conflict-dot"></span>冲突</span>
        </div>
      </a-space>
    </div>

    <!-- 甘特图容器 -->
    <div class="gantt-body">
      <div v-if="loading" class="gantt-loading">
        <a-spin tip="加载中..." />
      </div>
      <div v-else-if="resources.length === 0" class="gantt-empty">
        <a-empty :description="$t('aps.gantt.index.暂无数据')" />
      </div>
      <div v-else ref="scrollContainer" class="gantt-scroll-container">
        <canvas ref="canvasRef" @mousedown="onMouseDown" @mousemove="onMouseMove" @mouseup="onMouseUp" @mouseleave="onMouseLeave"></canvas>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
import { useI18n } from 'vue-i18n'
import { ref, reactive, onMounted, onUnmounted, nextTick } from 'vue'
import { Message } from '@arco-design/web-vue'
import { apsApi } from '@/api/aps'
import type { ApsSchedule, ApsResource } from '@/api/aps'
import { request } from '@/utils/request'

// ─── 常量 ────────────────────────────────────────────────────────────────────
const LEFT_WIDTH = 160   // 左侧资源列宽
const ROW_HEIGHT = 40    // 行高
const HEADER_HEIGHT = 40 // 顶部时间轴高度
const BAR_PADDING = 6    // bar 上下内边距
const BAR_HEIGHT = ROW_HEIGHT - BAR_PADDING * 2
const DEFAULT_DAY_WIDTH = 40

// ─── 类型 ────────────────────────────────────────────────────────────────────
interface GanttBar {
  id: string
  woCode: string
  resourceId: string
  resourceIndex: number
  startMs: number
  endMs: number
  status: string
  x: number
  y: number
  width: number
  height: number
}

// ─── 状态 ────────────────────────────────────────────────────────────────────
const loading = ref(false)
const resources = ref<ApsResource[]>([])
const schedules = ref<ApsSchedule[]>([])
const bars = ref<GanttBar[]>([])

const canvasRef = ref<HTMLCanvasElement | null>(null)
const scrollContainer = ref<HTMLDivElement | null>(null)

const dayWidth = ref(DEFAULT_DAY_WIDTH)
let viewStartMs = 0   // 视图起始时间（毫秒）
let totalDays = 0

// 日期范围（默认本周起 +30天）
const today = new Date()
const defaultStart = new Date(today)
defaultStart.setDate(today.getDate() - today.getDay() + 1) // 本周一
const defaultEnd = new Date(defaultStart)
defaultEnd.setDate(defaultStart.getDate() + 29)

const dateRange = reactive({
  start: formatDate(defaultStart),
  end: formatDate(defaultEnd),
})

// ─── 拖拽状态 ────────────────────────────────────────────────────────────────
let dragging: GanttBar | null = null
let dragStartX = 0
let dragOriginalX = 0
let dragOriginalStartMs = 0
let dragOriginalEndMs = 0
let rafId = 0

// ─── 工具函数 ────────────────────────────────────────────────────────────────
function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function parseMs(iso: string): number {
  return new Date(iso).getTime()
}

function msToX(ms: number): number {
  return LEFT_WIDTH + ((ms - viewStartMs) / 86400000) * dayWidth.value
}

function xToMs(x: number): number {
  return viewStartMs + ((x - LEFT_WIDTH) / dayWidth.value) * 86400000
}

function snapToDay(ms: number): number {
  return Math.round(ms / 86400000) * 86400000
}

// ─── 数据加载 ────────────────────────────────────────────────────────────────
async function handleQuery() {
  if (!dateRange.start || !dateRange.end) {
    Message.warning('请选择日期范围')
    return
  }
  loading.value = true
  try {
    const [resRes, schRes] = await Promise.all([
      apsApi.getResources({ page: 1, pageSize: 100 }),
      apsApi.getSchedules({ page: 1, pageSize: 200 }),
    ])
    resources.value = resRes.list ?? []
    schedules.value = schRes.list ?? []
    buildBars()
    await nextTick()
    initCanvas()
    draw()
  } catch (e) {
    Message.error('数据加载失败')
  } finally {
    loading.value = false
  }
}

function buildBars() {
  const startMs = parseMs(dateRange.start)
  const endMs = parseMs(dateRange.end) + 86400000 // 包含结束当天
  viewStartMs = startMs
  totalDays = Math.ceil((endMs - startMs) / 86400000)

  const resourceIndexMap = new Map<string, number>()
  resources.value.forEach((r, i) => resourceIndexMap.set(r.id, i))

  bars.value = schedules.value
    .filter(s => {
      const sMs = parseMs(s.plannedStart)
      const eMs = parseMs(s.plannedEnd)
      return eMs > startMs && sMs < endMs
    })
    .map(s => {
      const sMs = parseMs(s.plannedStart)
      const eMs = parseMs(s.plannedEnd)
      const rIdx = resourceIndexMap.get(s.resourceId) ?? -1
      const x = msToX(sMs)
      const y = HEADER_HEIGHT + rIdx * ROW_HEIGHT + BAR_PADDING
      const w = Math.max(4, ((eMs - sMs) / 86400000) * dayWidth.value)
      return {
        id: s.id,
        woCode: (s as any).woCode ?? s.woId,
        resourceId: s.resourceId,
        resourceIndex: rIdx,
        startMs: sMs,
        endMs: eMs,
        status: s.status,
        x,
        y,
        width: w,
        height: BAR_HEIGHT,
      } as GanttBar
    })
    .filter(b => b.resourceIndex >= 0)
}

// ─── Canvas 初始化 ────────────────────────────────────────────────────────────
function initCanvas() {
  const canvas = canvasRef.value
  if (!canvas) return
  const canvasWidth = LEFT_WIDTH + totalDays * dayWidth.value
  const canvasHeight = HEADER_HEIGHT + resources.value.length * ROW_HEIGHT
  canvas.width = canvasWidth
  canvas.height = canvasHeight
  canvas.style.display = 'block'
}

// ─── 冲突检测 ────────────────────────────────────────────────────────────────
function getConflictIds(): Set<string> {
  const conflictSet = new Set<string>()
  const byResource = new Map<string, GanttBar[]>()
  for (const b of bars.value) {
    if (!byResource.has(b.resourceId)) byResource.set(b.resourceId, [])
    byResource.get(b.resourceId)!.push(b)
  }
  byResource.forEach(list => {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j]
        if (a.startMs < b.endMs && a.endMs > b.startMs) {
          conflictSet.add(a.id)
          conflictSet.add(b.id)
        }
      }
    }
  })
  return conflictSet
}

// ─── 绘制 ────────────────────────────────────────────────────────────────────
function draw() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const W = canvas.width
  const H = canvas.height
  ctx.clearRect(0, 0, W, H)

  drawBackground(ctx, W, H)
  drawTimeAxis(ctx, W)
  drawResourceLabels(ctx, H)
  drawGridLines(ctx, W, H)
  drawBars(ctx)
}

function drawBackground(ctx: CanvasRenderingContext2D, W: number, H: number) {
  // 资源行交替背景
  resources.value.forEach((_, i) => {
    ctx.fillStyle = i % 2 === 0 ? '#1C2128' : '#161B22'
    ctx.fillRect(0, HEADER_HEIGHT + i * ROW_HEIGHT, W, ROW_HEIGHT)
  })

  // 周末列高亮
  for (let d = 0; d < totalDays; d++) {
    const dayMs = viewStartMs + d * 86400000
    const dow = new Date(dayMs).getDay()
    if (dow === 0 || dow === 6) {
      ctx.fillStyle = 'rgba(255,255,255,0.03)'
      ctx.fillRect(LEFT_WIDTH + d * dayWidth.value, HEADER_HEIGHT, dayWidth.value, H - HEADER_HEIGHT)
    }
  }
}

function drawTimeAxis(ctx: CanvasRenderingContext2D, W: number) {
  // 时间轴背景
  ctx.fillStyle = '#0D1117'
  ctx.fillRect(0, 0, W, HEADER_HEIGHT)

  ctx.fillStyle = '#8B949E'
  ctx.font = '11px monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  for (let d = 0; d < totalDays; d++) {
    const dayMs = viewStartMs + d * 86400000
    const date = new Date(dayMs)
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const dd = String(date.getDate()).padStart(2, '0')
    const label = `${mm}/${dd}`
    const x = LEFT_WIDTH + d * dayWidth.value + dayWidth.value / 2

    // 只在宽度足够时显示标签
    if (dayWidth.value >= 28) {
      ctx.fillText(label, x, HEADER_HEIGHT / 2)
    } else if (date.getDate() % 5 === 1) {
      ctx.fillText(label, x, HEADER_HEIGHT / 2)
    }
  }

  // 今天竖线
  const todayMs = new Date(formatDate(new Date())).getTime()
  if (todayMs >= viewStartMs && todayMs < viewStartMs + totalDays * 86400000) {
    const tx = msToX(todayMs)
    ctx.strokeStyle = '#F78166'
    ctx.lineWidth = 1.5
    ctx.setLineDash([4, 3])
    ctx.beginPath()
    ctx.moveTo(tx, 0)
    ctx.lineTo(tx, HEADER_HEIGHT + resources.value.length * ROW_HEIGHT)
    ctx.stroke()
    ctx.setLineDash([])
  }
}

function drawResourceLabels(ctx: CanvasRenderingContext2D, H: number) {
  // 左侧列背景
  ctx.fillStyle = '#0D1117'
  ctx.fillRect(0, 0, LEFT_WIDTH, H)

  // 分隔线
  ctx.strokeStyle = '#30363D'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(LEFT_WIDTH, 0)
  ctx.lineTo(LEFT_WIDTH, H)
  ctx.stroke()

  ctx.fillStyle = '#C9D1D9'
  ctx.font = '12px sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'

  resources.value.forEach((r, i) => {
    const y = HEADER_HEIGHT + i * ROW_HEIGHT + ROW_HEIGHT / 2
    const label = r.name.length > 14 ? r.name.slice(0, 13) + '…' : r.name
    ctx.fillText(label, 8, y)
  })
}

function drawGridLines(ctx: CanvasRenderingContext2D, W: number, H: number) {
  ctx.strokeStyle = '#21262D'
  ctx.lineWidth = 0.5

  // 水平行分隔线
  for (let i = 0; i <= resources.value.length; i++) {
    const y = HEADER_HEIGHT + i * ROW_HEIGHT
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(W, y)
    ctx.stroke()
  }

  // 垂直天分隔线
  for (let d = 0; d <= totalDays; d++) {
    const x = LEFT_WIDTH + d * dayWidth.value
    ctx.beginPath()
    ctx.moveTo(x, HEADER_HEIGHT)
    ctx.lineTo(x, H)
    ctx.stroke()
  }
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: '#58A6FF',
  in_progress: '#F78166',
  completed: '#3FB950',
  cancelled: '#6E7681',
}

function drawBars(ctx: CanvasRenderingContext2D) {
  const conflicts = getConflictIds()

  for (const bar of bars.value) {
    const color = STATUS_COLORS[bar.status] ?? '#58A6FF'
    const isConflict = conflicts.has(bar.id)

    // bar 主体
    ctx.fillStyle = color
    ctx.globalAlpha = bar === dragging ? 0.75 : 1
    roundRect(ctx, bar.x, bar.y, bar.width, bar.height, 3)
    ctx.fill()
    ctx.globalAlpha = 1

    // 冲突红色边框
    if (isConflict) {
      ctx.strokeStyle = '#FF4D4F'
      ctx.lineWidth = 2
      roundRect(ctx, bar.x, bar.y, bar.width, bar.height, 3)
      ctx.stroke()
    }

    // 文字
    if (bar.width > 20) {
      ctx.fillStyle = '#fff'
      ctx.font = '11px sans-serif'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.save()
      ctx.beginPath()
      ctx.rect(bar.x + 4, bar.y, bar.width - 8, bar.height)
      ctx.clip()
      ctx.fillText(bar.woCode, bar.x + 4, bar.y + bar.height / 2)
      ctx.restore()
    }
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

// ─── 命中测试 ────────────────────────────────────────────────────────────────
function hitTest(cx: number, cy: number): GanttBar | null {
  // 从后往前（上层优先）
  for (let i = bars.value.length - 1; i >= 0; i--) {
    const b = bars.value[i]
    if (cx >= b.x && cx <= b.x + b.width && cy >= b.y && cy <= b.y + b.height) {
      return b
    }
  }
  return null
}

function getCanvasPos(e: MouseEvent): { x: number; y: number } {
  const canvas = canvasRef.value!
  const rect = canvas.getBoundingClientRect()
  return { x: e.clientX - rect.left, y: e.clientY - rect.top }
}

// ─── 拖拽事件 ────────────────────────────────────────────────────────────────
function onMouseDown(e: MouseEvent) {
  const { x, y } = getCanvasPos(e)
  const bar = hitTest(x, y)
  if (!bar) return
  dragging = bar
  dragStartX = x
  dragOriginalX = bar.x
  dragOriginalStartMs = bar.startMs
  dragOriginalEndMs = bar.endMs
  canvasRef.value!.style.cursor = 'grabbing'
}

function onMouseMove(e: MouseEvent) {
  const { x, y } = getCanvasPos(e)

  if (!dragging) {
    // 悬停时改变光标
    const bar = hitTest(x, y)
    canvasRef.value!.style.cursor = bar ? 'grab' : 'default'
    return
  }

  const dx = x - dragStartX
  const newX = dragOriginalX + dx
  const durationMs = dragOriginalEndMs - dragOriginalStartMs

  // 限制不超出左侧列
  const clampedX = Math.max(LEFT_WIDTH, newX)
  dragging.x = clampedX

  // 更新时间（吸附到天）
  const newStartMs = snapToDay(xToMs(clampedX))
  dragging.startMs = newStartMs
  dragging.endMs = newStartMs + durationMs
  dragging.width = Math.max(4, (durationMs / 86400000) * dayWidth.value)

  // RAF 重绘
  if (rafId) cancelAnimationFrame(rafId)
  rafId = requestAnimationFrame(draw)
}

function onMouseUp(_e: MouseEvent) {
  if (!dragging) return
  const bar = dragging
  dragging = null
  canvasRef.value!.style.cursor = 'default'

  // 重新对齐 x 坐标
  bar.x = msToX(bar.startMs)

  // 调用后端更新（接口不存在时静默失败）
  const newStart = new Date(bar.startMs).toISOString()
  const newEnd = new Date(bar.endMs).toISOString()
  request.patch(`/v1/aps/schedules/${bar.id}`, { plannedStart: newStart, plannedEnd: newEnd })
    .catch(() => { /* 接口不存在时静默忽略 */ })

  draw()
}

function onMouseLeave() {
  if (dragging) {
    // 取消拖拽，恢复原始位置
    dragging.x = dragOriginalX
    dragging.startMs = dragOriginalStartMs
    dragging.endMs = dragOriginalEndMs
    dragging.width = Math.max(4, ((dragOriginalEndMs - dragOriginalStartMs) / 86400000) * dayWidth.value)
    dragging = null
    draw()
  }
  if (canvasRef.value) canvasRef.value.style.cursor = 'default'
}

// ─── 响应式 resize ────────────────────────────────────────────────────────────
function onResize() {
  if (resources.value.length === 0) return
  initCanvas()
  draw()
}

// ─── 生命周期 ────────────────────────────────────────────────────────────────
onMounted(() => {
  handleQuery()
  window.addEventListener('resize', onResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  if (rafId) cancelAnimationFrame(rafId)
})
</script>

<style scoped>
.gantt-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #0D1117;
  color: #C9D1D9;
}

.gantt-toolbar {
  padding: 12px 16px;
  background: #161B22;
  border-bottom: 1px solid #30363D;
  flex-shrink: 0;
}

.toolbar-label {
  font-size: 13px;
  color: #8B949E;
}

.legend {
  display: flex;
  align-items: center;
  gap: 12px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #8B949E;
}

.legend-dot {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  display: inline-block;
}

.conflict-dot {
  background: #58A6FF;
  border: 2px solid #FF4D4F;
  width: 10px;
  height: 10px;
}

.gantt-body {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.gantt-loading,
.gantt-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.gantt-scroll-container {
  width: 100%;
  height: 100%;
  overflow-x: auto;
  overflow-y: auto;
}

.gantt-scroll-container canvas {
  display: block;
}
</style>
