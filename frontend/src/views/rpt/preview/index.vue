<template>
  <div class="preview-page">
    <div class="preview-toolbar">
      <a-button @click="$router.push('/rpt/list')">{{ $t('common.back') || '返回列表' }}</a-button>
      <span class="report-name">{{ reportName }}</span>
      <div style="flex: 1"></div>
      <a-button @click="$router.push(`/rpt/designer/${reportId}`)">{{ $t('common.edit') || '编辑' }}</a-button>
    </div>

    <div class="preview-canvas">
      <div
        v-for="comp in components"
        :key="comp.id"
        class="preview-widget"
        :style="{ left: comp.x + 'px', top: comp.y + 'px', width: comp.w + 'px', height: comp.h + 'px' }"
      >
        <div class="widget-title">{{ comp.title || comp.type }}</div>
        <div class="widget-body">
          <!-- KPI -->
          <div v-if="comp.type === 'kpi'" class="kpi-display">
            <div class="kpi-value">{{ comp.config?.value ?? '—' }}</div>
            <div class="kpi-label">{{ comp.config?.label ?? '' }}</div>
          </div>
          <!-- Text -->
          <div v-else-if="comp.type === 'text'" class="text-display">
            {{ comp.config?.content ?? '' }}
          </div>
          <!-- Chart placeholder -->
          <div v-else class="chart-area">
            <div :ref="(el: any) => { if (el) chartRefs[comp.id] = el }" class="chart-container"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { Message } from '@arco-design/web-vue'
import * as echarts from 'echarts'
import { request } from '@/utils/request'

interface WidgetComponent {
  id: string; type: string; title: string
  x: number; y: number; w: number; h: number
  config: Record<string, unknown>
  dataSource?: { api?: string; field?: string }
}

const route = useRoute()
const reportName = ref('')
const components = ref<WidgetComponent[]>([])
const reportId = route.params.id as string
const chartRefs: Record<string, HTMLElement> = {}
const charts: Record<string, echarts.ECharts> = {}

async function loadReport() {
  try {
    const report = await request.get(`/v1/rpt/reports/${reportId}`) as any
    reportName.value = report.name
    components.value = (report.components ?? []).map((c: any, i: number) => ({
      id: c.id ?? `w_${i}`,
      type: c.type ?? 'text',
      title: c.title ?? '',
      x: c.x ?? 0, y: c.y ?? 0, w: c.w ?? 300, h: c.h ?? 200,
      config: c.config ?? {},
      dataSource: c.dataSource,
    }))

    await nextTick()
    renderCharts()
  } catch { Message.error('加载报表失败') }
}

function renderCharts() {
  for (const comp of components.value) {
    if (['line', 'bar', 'pie', 'gauge'].includes(comp.type)) {
      const el = chartRefs[comp.id]
      if (!el) continue
      const chart = echarts.init(el)
      charts[comp.id] = chart
      chart.setOption(getChartOption(comp) as any)
    }
  }
}

function getChartOption(comp: WidgetComponent): Record<string, unknown> {
  const cfg = comp.config ?? {}
  if (comp.type === 'line' || comp.type === 'bar') {
    return {
      xAxis: { type: 'category', data: (cfg.categories as string[]) ?? ['Q1', 'Q2', 'Q3', 'Q4'] },
      yAxis: { type: 'value' },
      series: [{ type: comp.type, data: (cfg.data as number[]) ?? [120, 200, 150, 180], smooth: comp.type === 'line' }],
    }
  }
  if (comp.type === 'pie') {
    return {
      series: [{ type: 'pie', radius: '60%', data: (cfg.data as any[]) ?? [
        { name: 'A', value: 30 }, { name: 'B', value: 50 }, { name: 'C', value: 20 },
      ] }],
    }
  }
  if (comp.type === 'gauge') {
    return {
      series: [{ type: 'gauge', data: [{ value: Number(cfg.value) || 75, name: String(cfg.label ?? '') }], max: Number(cfg.max) || 100 }],
    }
  }
  return {}
}

function handleResize() {
  Object.values(charts).forEach(c => c?.resize())
}

onMounted(() => {
  loadReport()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  Object.values(charts).forEach(c => c?.dispose())
  window.removeEventListener('resize', handleResize)
})
</script>

<style scoped>
.preview-page { min-height: 100vh; background: var(--color-bg-2); }
.preview-toolbar { display: flex; align-items: center; gap: 12px; padding: 8px 16px; background: #fff; border-bottom: 1px solid var(--color-border); position: sticky; top: 0; z-index: 10; }
.report-name { font-size: 16px; font-weight: 600; }
.preview-canvas { position: relative; width: 1200px; min-height: 800px; margin: 24px auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); padding: 16px; }
.preview-widget { position: absolute; border-radius: 6px; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.08); overflow: hidden; }
.widget-title { padding: 6px 10px; font-size: 12px; font-weight: 600; color: var(--color-text-2); background: var(--color-fill-1); border-bottom: 1px solid var(--color-border); }
.widget-body { padding: 8px; height: calc(100% - 32px); }
.kpi-display { text-align: center; display: flex; flex-direction: column; justify-content: center; height: 100%; }
.kpi-value { font-size: 32px; font-weight: 700; color: var(--color-primary); }
.kpi-label { font-size: 13px; color: var(--color-text-3); margin-top: 4px; }
.text-display { font-size: 14px; color: var(--color-text-1); padding: 8px; }
.chart-area { width: 100%; height: 100%; }
.chart-container { width: 100%; height: 100%; }
</style>
