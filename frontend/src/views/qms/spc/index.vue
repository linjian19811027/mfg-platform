<template>
  <div class="page-container">
    <!-- 筛选栏 -->
    <a-card :bordered="false" style="margin-bottom: 16px">
      <a-space wrap>
        <a-input v-model="itemId" :placeholder="$t('qms.spc.index.检验项目ID')" allow-clear style="width: 200px" @keyup.enter="loadChart" />
        <a-input-number v-model="limit" :min="10" :max="200" :placeholder="$t('qms.spc.index.数据点数量')" style="width: 140px" />
        <a-button type="primary" :loading="loading" @click="loadChart">{{ $t('common.search') }}</a-button>
        <a-button @click="openAddModal">录入数据点</a-button>
      </a-space>
    </a-card>

    <!-- 控制图 -->
    <a-row :gutter="16">
      <a-col :span="24">
        <a-card :title="$t('qms.spc.index.Xbar均值控制图')" :bordered="false" style="margin-bottom: 16px">
          <div v-if="chartData.points.length" ref="xbarRef" class="chart-container" />
          <a-empty v-else :description="$t('qms.spc.index.请输入检验项目ID并查询')" />
        </a-card>
      </a-col>
      <a-col :span="24">
        <a-card :title="$t('qms.spc.index.R极差控制图')" :bordered="false">
          <div v-if="chartData.points.length" ref="rRef" class="chart-container" />
          <a-empty v-else :description="$t('qms.spc.index.请输入检验项目ID并查询')" />
        </a-card>
      </a-col>
    </a-row>

    <!-- 失控提示 -->
    <a-alert
      v-if="outOfControlPoints.length"
      type="error"
      style="margin-top: 16px"
      :content="`发现 ${outOfControlPoints.length} 个失控点，请检查生产过程！`"
    />

    <!-- 录入数据点弹窗 -->
    <a-modal v-model:visible="addModalVisible" :title="$t('qms.spc.index.录入SPC数据点')" :ok-loading="adding" @ok="handleAdd" @cancel="addModalVisible = false">
      <a-form :model="addForm" layout="vertical">
        <a-form-item :label="$t('qms.spc.index.检验项目ID')" required>
          <a-input v-model="addForm.itemId" :placeholder="$t('qms.spc.index.检验项目ID')" />
        </a-form-item>
        <a-form-item :label="$t('qms.spc.index.测量值')" required>
          <a-input-number v-model="addForm.value" :precision="4" style="width: 100%" />
        </a-form-item>
        <a-form-item :label="$t('qms.spc.index.操作员ID')">
          <a-input v-model="addForm.operatorId" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
import { useI18n } from 'vue-i18n'
import { ref, reactive, onUnmounted, nextTick } from 'vue'
import { Message } from '@arco-design/web-vue'
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, MarkLineComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { qmsApi } from '@/api/qms'
import { useAuthStore } from '@/stores/auth'

echarts.use([LineChart, GridComponent, TooltipComponent, MarkLineComponent, CanvasRenderer])

const authStore = useAuthStore()
const loading = ref(false)
const itemId = ref('')
const limit = ref(50)
const xbarRef = ref<HTMLElement | null>(null)
const rRef = ref<HTMLElement | null>(null)
let xbarChart: echarts.ECharts | null = null
let rChart: echarts.ECharts | null = null

const chartData = ref<{ points: { value: number; measuredAt: string }[]; ucl: number; cl: number; lcl: number }>({
  points: [], ucl: 0, cl: 0, lcl: 0,
})

const outOfControlPoints = ref<number[]>([])

async function loadChart() {
  if (!itemId.value.trim()) { Message.warning('请输入检验项目ID'); return }
  loading.value = true
  try {
    const res = await qmsApi.getSpcChart(itemId.value.trim(), limit.value)
    chartData.value = res
    outOfControlPoints.value = res.points
      .map((p, i) => ({ i, v: p.value }))
      .filter(({ v }) => v > res.ucl || v < res.lcl)
      .map(({ i }) => i)
    await nextTick()
    renderCharts()
  } catch { /* handled */ } finally { loading.value = false }
}

function renderCharts() {
  const { points, ucl, cl, lcl } = chartData.value
  const xData = points.map((_p, i) => `#${i + 1}`)
  const values = points.map(p => p.value)

  const baseOption = (_title: string, data: number[]) => ({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', backgroundColor: '#161B22', borderColor: '#30363D', textStyle: { color: '#E6EDF3' } },
    grid: { top: 30, right: 20, bottom: 30, left: 50 },
    xAxis: { type: 'category', data: xData, axisLabel: { color: '#8B949E' }, axisLine: { lineStyle: { color: '#30363D' } } },
    yAxis: { type: 'value', axisLabel: { color: '#8B949E' }, splitLine: { lineStyle: { color: '#21262D' } } },
    series: [{
      type: 'line',
      data: data.map((v, i) => ({ value: v, itemStyle: { color: outOfControlPoints.value.includes(i) ? '#F53F3F' : '#1B4FD8' } })),
      symbol: 'circle', symbolSize: 6,
      lineStyle: { color: '#1B4FD8', width: 2 },
      markLine: {
        silent: true,
        data: [
          { yAxis: ucl, name: 'UCL', lineStyle: { color: '#F53F3F', type: 'dashed' }, label: { formatter: `UCL: ${ucl.toFixed(3)}`, color: '#F53F3F' } },
          { yAxis: cl, name: 'CL', lineStyle: { color: '#00B578', type: 'solid' }, label: { formatter: `CL: ${cl.toFixed(3)}`, color: '#00B578' } },
          { yAxis: lcl, name: 'LCL', lineStyle: { color: '#F53F3F', type: 'dashed' }, label: { formatter: `LCL: ${lcl.toFixed(3)}`, color: '#F53F3F' } },
        ],
      },
    }],
  })

  if (xbarRef.value) {
    xbarChart?.dispose()
    xbarChart = echarts.init(xbarRef.value)
    xbarChart.setOption(baseOption('X-bar', values))
  }

  // R 图：相邻点差值
  const rValues = values.slice(1).map((v, i) => Math.abs(v - values[i]))
  const rMean = rValues.reduce((s, v) => s + v, 0) / (rValues.length || 1)
  const rUcl = rMean * 3.267
  if (rRef.value) {
    rChart?.dispose()
    rChart = echarts.init(rRef.value)
    rChart.setOption({
      ...baseOption('R', rValues),
      series: [{
        type: 'line', data: rValues, symbol: 'circle', symbolSize: 6,
        lineStyle: { color: '#00D4C8', width: 2 }, itemStyle: { color: '#00D4C8' },
        markLine: {
          silent: true,
          data: [
            { yAxis: rUcl, name: 'UCL', lineStyle: { color: '#F53F3F', type: 'dashed' }, label: { formatter: `UCL: ${rUcl.toFixed(3)}`, color: '#F53F3F' } },
            { yAxis: rMean, name: 'CL', lineStyle: { color: '#00B578' }, label: { formatter: `CL: ${rMean.toFixed(3)}`, color: '#00B578' } },
            { yAxis: 0, name: 'LCL', lineStyle: { color: '#F53F3F', type: 'dashed' }, label: { formatter: 'LCL: 0', color: '#F53F3F' } },
          ],
        },
      }],
    })
  }
}

// 录入数据点
const addModalVisible = ref(false)
const adding = ref(false)
const addForm = reactive({ itemId: '', value: 0, operatorId: '' })

function openAddModal() {
  addForm.itemId = itemId.value
  addForm.operatorId = authStore.userId ?? ''
  addForm.value = 0
  addModalVisible.value = true
}

async function handleAdd() {
  if (!addForm.itemId || addForm.value === undefined) { Message.warning('请填写检验项目ID和测量值'); return }
  adding.value = true
  try {
    await qmsApi.addSpcPoint({ itemId: addForm.itemId, value: addForm.value, operatorId: addForm.operatorId || undefined })
    Message.success('数据点录入成功')
    addModalVisible.value = false
    if (itemId.value === addForm.itemId) loadChart()
  } catch { /* handled */ } finally { adding.value = false }
}

onUnmounted(() => { xbarChart?.dispose(); rChart?.dispose() })
</script>

<style scoped>
.page-container { padding: 16px; }
.chart-container { height: 280px; width: 100%; }
</style>
