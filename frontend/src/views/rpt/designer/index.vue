<template>
  <div class="designer-page">
    <!-- Toolbar -->
    <div class="designer-toolbar">
      <a-button @click="$router.push('/rpt/list')">{{ $t('common.back') || '返回' }}</a-button>
      <span class="report-name">{{ reportName }}</span>
      <div style="flex: 1"></div>
      <a-button @click="previewReport">{{ $t('common.preview') || '预览' }}</a-button>
      <a-button type="primary" :loading="saving" @click="saveReport">{{ $t('common.save') || '保存' }}</a-button>
    </div>

    <div class="designer-body">
      <!-- Component Panel -->
      <div class="component-panel">
        <div class="panel-title">组件</div>
        <div class="component-group">
          <div class="group-title">图表</div>
          <div class="component-item" v-for="c in chartComponents" :key="c.type"
               draggable="true" @dragstart="onDragStart($event, c)">
            <component :is="c.icon" style="font-size: 18px" />
            <span>{{ c.label }}</span>
          </div>
        </div>
        <div class="component-group">
          <div class="group-title">数据</div>
          <div class="component-item" v-for="c in dataComponents" :key="c.type"
               draggable="true" @dragstart="onDragStart($event, c)">
            <component :is="c.icon" style="font-size: 18px" />
            <span>{{ c.label }}</span>
          </div>
        </div>
        <div class="component-group">
          <div class="group-title">其他</div>
          <div class="component-item" v-for="c in otherComponents" :key="c.type"
               draggable="true" @dragstart="onDragStart($event, c)">
            <component :is="c.icon" style="font-size: 18px" />
            <span>{{ c.label }}</span>
          </div>
        </div>
      </div>

      <!-- Canvas -->
      <div class="canvas-area" @drop="onDrop" @dragover.prevent>
        <div class="canvas" :style="{ width: '1200px', height: '800px' }">
          <div
            v-for="(comp, idx) in components"
            :key="comp.id"
            class="canvas-widget"
            :class="{ selected: selectedIndex === idx }"
            :style="{ left: comp.x + 'px', top: comp.y + 'px', width: comp.w + 'px', height: comp.h + 'px' }"
            @click="selectedIndex = idx"
          >
            <div class="widget-header" @mousedown.stop="startDrag($event, idx)">
              <span>{{ comp.title || comp.type }}</span>
              <a-button size="mini" type="text" status="danger" @click.stop="removeComponent(idx)">
                <template #icon><icon-close /></template>
              </a-button>
            </div>
            <div class="widget-body">
              <div v-if="comp.type === 'kpi'" class="kpi-widget">
                <div class="kpi-value">{{ comp.config?.value ?? '—' }}</div>
                <div class="kpi-label">{{ comp.config?.label ?? '' }}</div>
              </div>
              <div v-else-if="comp.type === 'text'" class="text-widget">
                {{ comp.config?.content ?? '文本内容' }}
              </div>
              <div v-else class="chart-placeholder">
                <component :is="getChartIcon(comp.type)" style="font-size: 32px; color: var(--color-text-3)" />
                <span>{{ comp.type }}</span>
              </div>
            </div>
            <!-- Resize handle -->
            <div class="resize-handle" @mousedown.stop="startResize($event, idx)"></div>
          </div>
          <div v-if="components.length === 0" class="canvas-empty">
            从左侧拖拽组件到画布
          </div>
        </div>
      </div>

      <!-- Property Panel -->
      <div class="property-panel">
        <div class="panel-title">属性</div>
        <template v-if="selectedComponent">
          <a-form :model="selectedComponent" layout="vertical" size="small">
            <a-form-item label="标题">
              <a-input v-model="selectedComponent.title" />
            </a-form-item>
            <a-form-item label="X">
              <a-input-number v-model="selectedComponent.x" :min="0" style="width: 100%" />
            </a-form-item>
            <a-form-item label="Y">
              <a-input-number v-model="selectedComponent.y" :min="0" style="width: 100%" />
            </a-form-item>
            <a-form-item label="宽度">
              <a-input-number v-model="selectedComponent.w" :min="50" style="width: 100%" />
            </a-form-item>
            <a-form-item label="高度">
              <a-input-number v-model="selectedComponent.h" :min="50" style="width: 100%" />
            </a-form-item>
            <a-form-item v-if="selectedComponent.type === 'kpi'" label="数值">
              <a-input v-model="(selectedComponent.config as any).value" />
            </a-form-item>
            <a-form-item v-if="selectedComponent.type === 'kpi'" label="标签">
              <a-input v-model="(selectedComponent.config as any).label" />
            </a-form-item>
            <a-form-item v-if="selectedComponent.type === 'text'" label="内容">
              <a-textarea v-model="(selectedComponent.config as any).content" />
            </a-form-item>
          </a-form>
        </template>
        <a-empty v-else description="选中组件查看属性" style="margin-top: 40px" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Message } from '@arco-design/web-vue'
import {
  IconApps, IconStorage, IconFile, IconImage, IconFilter, IconEdit,
  IconDashboard, IconComputer, IconEye, IconNav,
} from '@arco-design/web-vue/es/icon'
import { request } from '@/utils/request'

interface WidgetComponent {
  id: string
  type: string
  title: string
  x: number
  y: number
  w: number
  h: number
  config: Record<string, unknown>
  dataSource?: Record<string, unknown>
}

const route = useRoute()
const router = useRouter()
const saving = ref(false)
const reportName = ref('')
const components = ref<WidgetComponent[]>([])
const selectedIndex = ref(-1)
const reportId = computed(() => route.params.id as string)
const selectedComponent = computed(() => selectedIndex.value >= 0 ? components.value[selectedIndex.value] : null)

const chartComponents = [
  { type: 'line', label: '折线图', icon: IconApps },
  { type: 'bar', label: '柱状图', icon: IconNav },
  { type: 'pie', label: '饼图', icon: IconEye },
  { type: 'gauge', label: '仪表盘', icon: IconDashboard },
]

const dataComponents = [
  { type: 'table', label: '数据表格', icon: IconStorage },
  { type: 'kpi', label: '指标卡', icon: IconComputer },
]

const otherComponents = [
  { type: 'text', label: '文本', icon: IconEdit },
  { type: 'image', label: '图片', icon: IconImage },
  { type: 'filter', label: '筛选器', icon: IconFilter },
]

function getChartIcon(type: string): any {
  const map: Record<string, any> = { line: IconApps, bar: IconNav, pie: IconEye, gauge: IconDashboard, table: IconStorage, kpi: IconComputer }
  return map[type] ?? IconFile
}

function onDragStart(e: DragEvent, comp: { type: string; label: string }) {
  e.dataTransfer?.setData('widget-type', comp.type)
  e.dataTransfer?.setData('widget-label', comp.label)
}

function onDrop(e: DragEvent) {
  const type = e.dataTransfer?.getData('widget-type')
  const label = e.dataTransfer?.getData('widget-label')
  if (!type) return

  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const x = Math.round((e.clientX - rect.left) / 20) * 20
  const y = Math.round((e.clientY - rect.top) / 20) * 20

  const widget: WidgetComponent = {
    id: `w_${Date.now()}`,
    type,
    title: label ?? type,
    x, y,
    w: type === 'kpi' ? 200 : 350,
    h: type === 'kpi' ? 120 : 250,
    config: type === 'kpi' ? { value: '0', label: '指标' } : type === 'text' ? { content: '文本内容' } : {},
  }
  components.value.push(widget)
  selectedIndex.value = components.value.length - 1
}

function removeComponent(idx: number) {
  components.value.splice(idx, 1)
  if (selectedIndex.value >= components.value.length) selectedIndex.value = components.value.length - 1
}

function startDrag(e: MouseEvent, idx: number) {
  selectedIndex.value = idx
  const comp = components.value[idx]
  const startX = e.clientX
  const startY = e.clientY
  const origX = comp.x
  const origY = comp.y

  function onMove(ev: MouseEvent) {
    comp.x = Math.max(0, origX + ev.clientX - startX)
    comp.y = Math.max(0, origY + ev.clientY - startY)
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

function startResize(e: MouseEvent, idx: number) {
  const comp = components.value[idx]
  const startX = e.clientX
  const startY = e.clientY
  const startW = comp.w
  const startH = comp.h

  function onMove(ev: MouseEvent) {
    comp.w = Math.max(50, startW + ev.clientX - startX)
    comp.h = Math.max(50, startH + ev.clientY - startY)
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

async function loadReport() {
  try {
    const report = await request.get(`/v1/rpt/reports/${reportId.value}`) as any
    reportName.value = report.name
    components.value = (report.components ?? []).map((c: any, i: number) => ({
      id: c.id ?? `w_${i}`,
      type: c.type ?? 'text',
      title: c.title ?? c.type,
      x: c.x ?? 0, y: c.y ?? 0, w: c.w ?? 300, h: c.h ?? 200,
      config: c.config ?? {},
      dataSource: c.dataSource,
    }))
  } catch { Message.error('加载报表失败') }
}

async function saveReport() {
  saving.value = true
  try {
    await request.put(`/v1/rpt/reports/${reportId.value}`, {
      components: components.value,
      layout: { width: 1200, height: 800 },
    })
    Message.success('保存成功')
  } catch { Message.error('保存失败') } finally { saving.value = false }
}

function previewReport() {
  router.push(`/rpt/preview/${reportId.value}`)
}

onMounted(loadReport)
</script>

<style scoped>
.designer-page { height: 100vh; display: flex; flex-direction: column; background: var(--color-bg-2); }
.designer-toolbar { display: flex; align-items: center; gap: 12px; padding: 8px 16px; background: #fff; border-bottom: 1px solid var(--color-border); }
.report-name { font-size: 16px; font-weight: 600; }
.designer-body { display: flex; flex: 1; overflow: hidden; }

.component-panel { width: 200px; background: #fff; border-right: 1px solid var(--color-border); overflow-y: auto; padding: 12px; }
.panel-title { font-size: 13px; font-weight: 600; color: var(--color-text-2); margin-bottom: 12px; text-transform: uppercase; letter-spacing: 1px; }
.component-group { margin-bottom: 16px; }
.group-title { font-size: 12px; color: var(--color-text-3); margin-bottom: 8px; }
.component-item { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 6px; cursor: grab; font-size: 13px; color: var(--color-text-2); transition: background 0.15s; }
.component-item:hover { background: var(--color-fill-2); }

.canvas-area { flex: 1; overflow: auto; padding: 24px; display: flex; justify-content: center; }
.canvas { position: relative; background: #fff; border: 1px solid var(--color-border); border-radius: 8px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
.canvas-empty { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); color: var(--color-text-3); font-size: 14px; }

.canvas-widget { position: absolute; border: 1.5px solid transparent; border-radius: 6px; overflow: hidden; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.08); cursor: move; transition: border-color 0.15s; }
.canvas-widget:hover { border-color: var(--color-primary-light-3); }
.canvas-widget.selected { border-color: var(--color-primary); box-shadow: 0 0 0 2px rgba(var(--primary-6), 0.15); }
.widget-header { display: flex; justify-content: space-between; align-items: center; padding: 4px 8px; background: var(--color-fill-1); font-size: 12px; color: var(--color-text-2); border-bottom: 1px solid var(--color-border); }
.widget-body { padding: 8px; height: calc(100% - 30px); display: flex; align-items: center; justify-content: center; }
.chart-placeholder { display: flex; flex-direction: column; align-items: center; gap: 6px; color: var(--color-text-3); font-size: 12px; }
.kpi-widget { text-align: center; }
.kpi-value { font-size: 28px; font-weight: 700; color: var(--color-primary); }
.kpi-label { font-size: 12px; color: var(--color-text-3); margin-top: 4px; }
.text-widget { font-size: 14px; color: var(--color-text-1); padding: 8px; }
.resize-handle { position: absolute; right: 0; bottom: 0; width: 12px; height: 12px; cursor: nwse-resize; background: linear-gradient(135deg, transparent 50%, var(--color-primary-light-4) 50%); border-radius: 0 0 6px 0; }

.property-panel { width: 260px; background: #fff; border-left: 1px solid var(--color-border); overflow-y: auto; padding: 12px; }
</style>
