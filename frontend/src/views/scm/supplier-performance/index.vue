<template>
  <div class="page-container">
    <a-row :gutter="16" style="margin-bottom: 16px">
      <a-col :span="24">
        <a-card :title="$t('scm.supplier-performance.index.供应商绩效排名Top10')" :bordered="false">
          <div ref="chartRef" class="chart-container" />
        </a-card>
      </a-col>
    </a-row>

    <a-row :gutter="16">
      <a-col :span="24">
        <a-card :title="$t('scm.supplier-performance.index.资质效期预警')" :bordered="false">
          <MTable :columns="qualColumns" :data="qualData" :loading="qualLoading" :total="qualData.length" :show-column-config="false">
            <template #status="{ record }">
              <a-tag :color="record.status === 'EXPIRED' ? 'red' : record.status === 'EXPIRING' ? 'orange' : 'green'">
                {{ record.status === 'EXPIRED' ? t('scm.supplier-performance.r33065') : record.status === 'EXPIRING' ? $t('scm.supplier-performance.expiring') : $t('scm.supplier-performance.valid') }}
              </a-tag>
            </template>
          </MTable>
        </a-card>
      </a-col>
    </a-row>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
import { useI18n } from 'vue-i18n'
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import * as echarts from 'echarts/core'
import { BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import MTable from '@/components/MTable/index.vue'
import type { MTableColumn } from '@/components/MTable/index.vue'
import { scmApi } from '@/api/scm'

echarts.use([BarChart, GridComponent, TooltipComponent, CanvasRenderer])

const chartRef = ref<HTMLElement | null>(null)
let chart: echarts.ECharts | null = null

const qualLoading = ref(false)
const qualData = ref<any[]>([])

const qualColumns: MTableColumn[] = [
  { key: 'supplierName', title: t('scm.supplier-performance.index.供应商'), dataIndex: 'supplierName', width: 160 },
  { key: 'certType', title: t('scm.supplier-performance.index.资质类型'), dataIndex: 'certType', width: 130 },
  { key: 'certNo', title: t('scm.supplier-performance.index.证书编号'), dataIndex: 'certNo', width: 140 },
  { key: 'expiryDate', title: t('scm.supplier-performance.index.到期日期'), dataIndex: 'expiryDate', width: 120 },
  { key: 'status', title: t('scm.supplier-performance.index.状态'), slotName: 'status', width: 100 },
]

async function loadPerformance() {
  try {
    const res = await scmApi.getSupplierPerformance()
    const ranking = res.ranking ?? []
    await nextTick()
    if (chartRef.value) {
      chart?.dispose()
      chart = echarts.init(chartRef.value)
      chart.setOption({
        backgroundColor: 'transparent',
        tooltip: { trigger: 'axis', backgroundColor: '#161B22', borderColor: '#30363D', textStyle: { color: '#E6EDF3' } },
        grid: { top: 20, right: 20, bottom: 60, left: 60 },
        xAxis: {
          type: 'category',
          data: ranking.map(r => r.supplierName),
          axisLabel: { color: '#8B949E', rotate: 30, fontSize: 11 },
          axisLine: { lineStyle: { color: '#30363D' } },
        },
        yAxis: { type: 'value', max: 100, axisLabel: { color: '#8B949E', formatter: t('scm.supplier-performance.lbl1644') }, splitLine: { lineStyle: { color: '#21262D' } } },
        series: [{
          type: 'bar',
          data: ranking.map(r => ({ value: r.score, itemStyle: { color: r.score >= 80 ? '#00B578' : r.score >= 60 ? '#FF6B35' : '#F53F3F', borderRadius: [4, 4, 0, 0] } })),
          label: { show: true, position: 'top', color: '#8B949E', fontSize: 11 },
        }],
      })
    }
  } catch { /* handled */ }
}

async function loadQualifications() {
  qualLoading.value = true
  try {
    const res = await scmApi.getQualifications({ expiringSoon: true, pageSize: 50 })
    qualData.value = (res.list ?? []) as any[]
  } catch { qualData.value = [] } finally { qualLoading.value = false }
}

onMounted(() => { loadPerformance(); loadQualifications() })
onUnmounted(() => { chart?.dispose() })
</script>

<style scoped>
.page-container { padding: 16px; }
.chart-container { height: 300px; width: 100%; }
</style>
