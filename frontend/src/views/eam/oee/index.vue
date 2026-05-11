<template>
  <div class="page-container">
    <a-card :bordered="false" style="margin-bottom: 16px">
      <a-space wrap>
        <a-input v-model="query.equipmentId" :placeholder="$t('eam.oee.index.设备ID')" allow-clear style="width: 160px" @keyup.enter="loadData" />
        <a-date-picker v-model="query.startDate" :placeholder="$t('eam.oee.index.开始日期')" style="width: 140px" />
        <a-date-picker v-model="query.endDate" :placeholder="$t('eam.oee.index.结束日期')" style="width: 140px" />
        <a-button type="primary" @click="loadData">{{ $t('common.search') }}</a-button>
        <a-button @click="openInputModal">录入 OEE 数据</a-button>
      </a-space>
    </a-card>

    <a-row :gutter="16" style="margin-bottom: 16px">
      <a-col :span="16">
        <a-card :title="$t('eam.oee.index.OEE趋势图')" :bordered="false">
          <div ref="trendRef" class="chart-container" />
        </a-card>
      </a-col>
      <a-col :span="8">
        <a-card :title="$t('eam.oee.index.设备绩效排名')" :bordered="false">
          <div ref="rankRef" class="chart-container" />
        </a-card>
      </a-col>
    </a-row>

    <a-card :title="$t('eam.oee.index.OEE明细记录')" :bordered="false">
      <MTable :columns="columns" :data="tableData" :loading="loading" :total="total" :page-size="20" @change="onTableChange">
        <template #oee="{ record }">
          <span :style="{ color: (record.oee as number) < 0.65 ? '#F53F3F' : '#00B578', fontWeight: '600' }">
            {{ ((record.oee as number || 0) * 100).toFixed(1) }}%
          </span>
        </template>
      </MTable>
    </a-card>

    <!-- 录入弹窗 -->
    <a-modal v-model:visible="inputModalVisible" :title="$t('eam.oee.index.录入OEE数据')" :ok-loading="inputting" @ok="handleInput" @cancel="inputModalVisible = false">
      <a-form :model="inputForm" layout="vertical">
        <a-form-item :label="$t('eam.oee.index.设备ID')" required><a-input v-model="inputForm.equipmentId" /></a-form-item>
        <a-form-item :label="$t('eam.oee.index.日期')" required><a-date-picker v-model="inputForm.date" style="width:100%" /></a-form-item>
        <a-form-item :label="$t('eam.oee.index.计划运行时间分钟')" required><a-input-number v-model="inputForm.plannedTime" :min="1" style="width:100%" /></a-form-item>
        <a-form-item :label="$t('eam.oee.index.实际运行时间分钟')" required><a-input-number v-model="inputForm.actualTime" :min="0" style="width:100%" /></a-form-item>
        <a-form-item :label="$t('eam.oee.index.总产量')" required><a-input-number v-model="inputForm.output" :min="0" style="width:100%" /></a-form-item>
        <a-form-item :label="$t('eam.oee.index.合格品数量')" required><a-input-number v-model="inputForm.qualifiedOutput" :min="0" style="width:100%" /></a-form-item>
        <!-- 自动计算预览 -->
        <a-form-item :label="$t('eam.oee.index.OEE预览')">
          <a-space>
            <span>可用率: {{ calcAvailability }}%</span>
            <span>性能率: {{ calcPerformance }}%</span>
            <span>质量率: {{ calcQuality }}%</span>
            <span style="font-weight:600;color:#1B4FD8">OEE: {{ calcOee }}%</span>
          </a-space>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
import { useI18n } from 'vue-i18n'
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { Message } from '@arco-design/web-vue'
import * as echarts from 'echarts/core'
import { LineChart, BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import MTable from '@/components/MTable/index.vue'
import type { MTableColumn } from '@/components/MTable/index.vue'
import { eamApi } from '@/api/eam'

echarts.use([LineChart, BarChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer])

const loading = ref(false)
const tableData = ref<any[]>([])
const total = ref(0)
const query = reactive({ equipmentId: '', startDate: '', endDate: '', page: 1, pageSize: 20 })
const trendRef = ref<HTMLElement | null>(null)
const rankRef = ref<HTMLElement | null>(null)
let trendChart: echarts.ECharts | null = null
let rankChart: echarts.ECharts | null = null

const columns: MTableColumn[] = [
  { key: 'equipmentName', title: t('eam.oee.index.设备名称'), dataIndex: 'equipmentName', width: 150 },
  { key: 'date', title: t('eam.oee.index.日期'), dataIndex: 'date', width: 120 },
  { key: 'availability', title: t('eam.oee.index.可用率'), dataIndex: 'availability', width: 90 },
  { key: 'performance', title: t('eam.oee.index.性能率'), dataIndex: 'performance', width: 90 },
  { key: 'quality', title: t('eam.oee.index.质量率'), dataIndex: 'quality', width: 90 },
  { key: 'oee', title: 'OEE', slotName: 'oee', width: 100 },
]

async function loadData() {
  loading.value = true
  try {
    const res = await eamApi.getOeeRecords(query)
    tableData.value = (res.list ?? []) as any[]
    total.value = res.total ?? 0
    await nextTick()
    renderCharts()
  } catch { tableData.value = [] } finally { loading.value = false }
}

function renderCharts() {
  const data = tableData.value
  const baseOpt = { backgroundColor: 'transparent', tooltip: { trigger: 'axis', backgroundColor: '#161B22', borderColor: '#30363D', textStyle: { color: '#E6EDF3' } }, grid: { top: 20, right: 20, bottom: 30, left: 50 } }

  if (trendRef.value) {
    trendChart?.dispose(); trendChart = echarts.init(trendRef.value)
    trendChart.setOption({ ...baseOpt, xAxis: { type: 'category', data: data.map(r => r.date ?? ''), axisLabel: { color: '#8B949E' }, axisLine: { lineStyle: { color: '#30363D' } } }, yAxis: { type: 'value', min: 0, max: 1, axisLabel: { color: '#8B949E', formatter: (v: number) => `${(v * 100).toFixed(0)}%` }, splitLine: { lineStyle: { color: '#21262D' } } }, series: [{ name: 'OEE', type: 'line', data: data.map(r => r.oee ?? 0), smooth: true, lineStyle: { color: '#1B4FD8', width: 2 }, itemStyle: { color: (p: { value: number }) => p.value < 0.65 ? '#F53F3F' : '#1B4FD8' }, markLine: { silent: true, data: [{ yAxis: 0.65, lineStyle: { color: '#F53F3F', type: 'dashed' }, label: { formatter: '65%', color: '#F53F3F' } }] } }] })
  }

  if (rankRef.value) {
    // 按设备汇总平均 OEE
    const byEquip: Record<string, number[]> = {}
    data.forEach(r => {
      const name = r.equipmentName as string ?? r.equipmentId as string ?? 'Unknown'
      if (!byEquip[name]) byEquip[name] = []
      byEquip[name].push(r.oee as number ?? 0)
    })
    const ranked = Object.entries(byEquip).map(([name, vals]) => ({ name, avg: vals.reduce((s, v) => s + v, 0) / vals.length })).sort((a, b) => b.avg - a.avg)
    rankChart?.dispose(); rankChart = echarts.init(rankRef.value)
    rankChart.setOption({ backgroundColor: 'transparent', tooltip: { trigger: 'axis', backgroundColor: '#161B22', borderColor: '#30363D', textStyle: { color: '#E6EDF3' } }, grid: { top: 20, right: 20, bottom: 30, left: 80 }, xAxis: { type: 'value', max: 1, axisLabel: { color: '#8B949E', formatter: (v: number) => `${(v * 100).toFixed(0)}%` }, splitLine: { lineStyle: { color: '#21262D' } } }, yAxis: { type: 'category', data: ranked.map(r => r.name), axisLabel: { color: '#8B949E' }, axisLine: { lineStyle: { color: '#30363D' } } }, series: [{ type: 'bar', data: ranked.map(r => ({ value: r.avg, itemStyle: { color: r.avg < 0.65 ? '#F53F3F' : '#1B4FD8', borderRadius: [0, 4, 4, 0] } })) }] })
  }
}

function onTableChange(e: { page: number; pageSize: number }) { query.page = e.page; query.pageSize = e.pageSize; loadData() }

// 录入
const inputModalVisible = ref(false)
const inputting = ref(false)
const inputForm = reactive({ equipmentId: '', date: '', plannedTime: 480, actualTime: 0, output: 0, qualifiedOutput: 0 })

const calcAvailability = computed(() => inputForm.plannedTime > 0 ? ((inputForm.actualTime / inputForm.plannedTime) * 100).toFixed(1) : '0.0')
const calcPerformance = computed(() => inputForm.actualTime > 0 ? Math.min(100, ((inputForm.output / inputForm.actualTime) * 100)).toFixed(1) : '0.0')
const calcQuality = computed(() => inputForm.output > 0 ? ((inputForm.qualifiedOutput / inputForm.output) * 100).toFixed(1) : '0.0')
const calcOee = computed(() => {
  const a = inputForm.plannedTime > 0 ? inputForm.actualTime / inputForm.plannedTime : 0
  const p = inputForm.actualTime > 0 ? Math.min(1, inputForm.output / inputForm.actualTime) : 0
  const q = inputForm.output > 0 ? inputForm.qualifiedOutput / inputForm.output : 0
  return (a * p * q * 100).toFixed(1)
})

function openInputModal() {
  Object.assign(inputForm, { equipmentId: '', date: '', plannedTime: 480, actualTime: 0, output: 0, qualifiedOutput: 0 })
  inputModalVisible.value = true
}

async function handleInput() {
  if (!inputForm.equipmentId || !inputForm.date) { Message.warning('请填写设备ID和日期'); return }
  inputting.value = true
  try {
    await eamApi.createOee({ ...inputForm })
    Message.success('OEE 数据录入成功')
    inputModalVisible.value = false
    loadData()
  } catch { /* handled */ } finally { inputting.value = false }
}

onMounted(loadData)
onUnmounted(() => { trendChart?.dispose(); rankChart?.dispose() })
</script>

<style scoped>
.page-container { padding: 16px; }
.chart-container { height: 260px; width: 100%; }
</style>
