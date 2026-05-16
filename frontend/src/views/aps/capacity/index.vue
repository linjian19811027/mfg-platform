<template>
  <div class="page-container">
    <a-card :bordered="false" style="margin-bottom: 16px">
      <a-space wrap>
        <a-select v-model="query.period" :placeholder="$t('aps.capacity.index.时间周期')" style="width: 120px">
          <a-option value="day">{{ $t('aps.capacity.day') }}</a-option>
          <a-option value="week">{{ $t('aps.capacity.week') }}</a-option>
          <a-option value="month">{{ $t('aps.capacity.month') }}</a-option>
        </a-select>
        <a-button type="primary" :loading="loading" @click="loadData">{{ $t('common.search') }}</a-button>
      </a-space>
    </a-card>
    <a-row :gutter="16" style="margin-bottom: 16px">
      <a-col :span="24">
        <a-card :title="$t('aps.capacity.index.资源产能负荷率')" :bordered="false">
          <div ref="capacityRef" class="chart-container" />
        </a-card>
      </a-col>
    </a-row>
    <a-card :title="$t('aps.capacity.index.交期风险工单预计延迟')" :bordered="false">
      <MTable :columns="deliveryColumns" :data="deliveryData" :loading="loading" :total="deliveryData.length" :show-column-config="false">
        <template #delayDays="{ record }">
          <a-tag :color="(record.delayDays as number) > 7 ? 'red' : 'orange'">{{ $t('aps.capacity.delayDays', {n: record.delayDays}) }}</a-tag>
        </template>
      </MTable>
    </a-card>
  </div>
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ref, reactive, onMounted, onUnmounted, nextTick } from 'vue'
import * as echarts from 'echarts/core'
import { BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, MarkLineComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import MTable from '@/components/MTable/index.vue'
import type { MTableColumn } from '@/components/MTable/index.vue'
import { apsApi } from '@/api/aps'
echarts.use([BarChart, GridComponent, TooltipComponent, MarkLineComponent, CanvasRenderer])
const { t } = useI18n()
const loading = ref(false); const query = reactive({ period: 'week' })
const capacityRef = ref<HTMLElement | null>(null); let capacityChart: echarts.ECharts | null = null
const deliveryData = ref<any[]>([])
const deliveryColumns: MTableColumn[] = [
  { key: 'woCode', title: t('aps.capacity.index.工单号'), dataIndex: 'woCode', width: 140 },
  { key: 'plannedEnd', title: t('aps.capacity.index.计划完成'), dataIndex: 'plannedEnd', width: 120 },
  { key: 'delayDays', title: t('aps.capacity.index.延迟天数'), slotName: 'delayDays', width: 120 },
]
async function loadData() {
  loading.value = true
  try {
    const [capRes, delRes] = await Promise.all([
      apsApi.getCapacityAnalysis({ period: query.period }),
      apsApi.getDeliveryAnalysis({}),
    ])
    deliveryData.value = (delRes.list ?? []) as any[]
    await nextTick()
    if (capacityRef.value) {
      capacityChart?.dispose(); capacityChart = echarts.init(capacityRef.value)
      const list = capRes.list ?? []
      capacityChart.setOption({
        backgroundColor: 'transparent',
        tooltip: { trigger: 'axis', backgroundColor: '#161B22', borderColor: '#30363D', textStyle: { color: '#E6EDF3' }, formatter: (p: { name: string; value: number }[]) => `${p[0].name}: ${(p[0].value * 100).toFixed(1)}%` },
        grid: { top: 20, right: 20, bottom: 40, left: 60 },
        xAxis: { type: 'category', data: list.map(d => d.resourceName ?? ''), axisLabel: { color: '#8B949E', rotate: 30 }, axisLine: { lineStyle: { color: '#30363D' } } },
        yAxis: { type: 'value', max: 1.5, axisLabel: { color: '#8B949E', formatter: (v: number) => `${(v * 100).toFixed(0)}%` }, splitLine: { lineStyle: { color: '#21262D' } } },
        series: [{
          type: 'bar',
          data: list.map(d => ({ value: d.loadRate ?? 0, itemStyle: { color: (d.loadRate as number) > 1 ? '#F53F3F' : (d.loadRate as number) > 0.8 ? '#FF6B35' : '#1B4FD8', borderRadius: [4, 4, 0, 0] } })),
          markLine: { silent: true, data: [{ yAxis: 1, lineStyle: { color: '#F53F3F', type: 'dashed' }, label: { formatter: '100%', color: '#F53F3F' } }] },
        }],
      })
    }
  } catch { /* handled */ } finally { loading.value = false }
}
onMounted(loadData); onUnmounted(() => capacityChart?.dispose())
</script>
<style scoped>.page-container { padding: 16px; } .chart-container { height: 300px; width: 100%; }</style>
