<template>
  <div class="page-container">
    <!-- 统计卡片 -->
    <a-row :gutter="16">
      <!-- 统计卡片 -->
      <a-col :span="6">
        <a-card :bordered="false">
          <a-statistic :title="$t('hr.work-hours.dashboard.本月总工时')" :value="dashboard.totalHours" :suffix="t('hr.employees.detail.小时')" :precision="2" />
        </a-card>
      </a-col>
      <a-col :span="6">
        <a-card :bordered="false">
          <a-statistic :title="$t('hr.work-hours.dashboard.正常工时')" :value="dashboard.normalHours" :suffix="$t('hr.employees.detail.小时')" :precision="2" />
        </a-card>
      </a-col>
      <a-col :span="6">
        <a-card :bordered="false">
          <a-statistic :title="$t('hr.work-hours.dashboard.加班工时')" :value="dashboard.overtimeHours" :suffix="$t('hr.employees.detail.小时')" :precision="2" :value-style="{ color: '#f53f3f' }" />
        </a-card>
      </a-col>
      <a-col :span="6">
        <a-card :bordered="false">
          <a-statistic :title="$t('hr.work-hours.dashboard.人均工时')" :value="dashboard.avgHours" :suffix="$t('hr.employees.detail.小时')" :precision="2" />
        </a-card>
      </a-col>
    </a-row>

    <a-row :gutter="16" style="margin-top: 16px">
      <!-- 工时趋势图 -->
      <a-col :span="16">
        <a-card :title="$t('hr.work-hours.dashboard.工时趋势近30天')" :bordered="false">
          <div ref="trendChartRef" style="height: 400px"></div>
        </a-card>
      </a-col>

      <!-- 工时排名 -->
      <a-col :span="8">
        <a-card :title="$t('hr.work-hours.dashboard.工时排名TOP10')" :bordered="false">
          <a-list :data="dashboard.topEmployees" :bordered="false">
            <template #item="{ item, index }">
              <a-list-item>
                <a-list-item-meta>
                  <template #avatar>
                    <a-avatar :style="{ backgroundColor: getRankColor(index) }">
                      {{ index + 1 }}
                    </a-avatar>
                  </template>
                  <template #title>{{ item.employeeName }}</template>
                  <template #description>
                    {{ item.jobType }} - {{ item.workCenter }}
                  </template>
                </a-list-item-meta>
                <template #actions>
                  <span style="font-weight: 500">{{ item.totalHours }} {{ $t('hr.employees.detail.小时') }}</span>
                </template>
              </a-list-item>
            </template>
          </a-list>
        </a-card>
      </a-col>
    </a-row>

    <a-row :gutter="16" style="margin-top: 16px">
      <!-- 工种分布 -->
      <a-col :span="12">
        <a-card :title="$t('hr.work-hours.dashboard.工种工时分布')" :bordered="false">
          <div ref="jobTypeChartRef" style="height: 350px"></div>
        </a-card>
      </a-col>

      <!-- 工作中心分布 -->
      <a-col :span="12">
        <a-card :title="$t('hr.work-hours.dashboard.工作中心工时分布')" :bordered="false">
          <div ref="workCenterChartRef" style="height: 350px"></div>
        </a-card>
      </a-col>
    </a-row>
  </div>
</template>

<script setup lang="ts">

import { ref, onMounted, onUnmounted } from 'vue'
import { Message } from '@arco-design/web-vue'
import * as echarts from 'echarts'
import { getWorkHourDashboard } from '@/api/hr'

import { useI18n } from 'vue-i18n'
const { t } = useI18n()

const dashboard = ref<any>({
  totalHours: 0,
  normalHours: 0,
  overtimeHours: 0,
  avgHours: 0,
  topEmployees: [],
  trendData: [],
  jobTypeDistribution: [],
  workCenterDistribution: [],
})

const trendChartRef = ref()
const jobTypeChartRef = ref()
const workCenterChartRef = ref()

let trendChart: echarts.ECharts | null = null
let jobTypeChart: echarts.ECharts | null = null
let workCenterChart: echarts.ECharts | null = null

onMounted(async () => {
  await fetchDashboard()
  initCharts()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  trendChart?.dispose()
  jobTypeChart?.dispose()
  workCenterChart?.dispose()
  window.removeEventListener('resize', handleResize)
})

async function fetchDashboard() {
  try {
    const res = await getWorkHourDashboard({})
    dashboard.value = res
  } catch (error: any) {
    Message.error(error.message || t('hr.work-hours.dashboard.加载失败'))
  }
}

function initCharts() {
  initTrendChart()
  initJobTypeChart()
  initWorkCenterChart()
}

function initTrendChart() {
  if (!trendChartRef.value) return
  
  trendChart = echarts.init(trendChartRef.value)
  
  const dates = dashboard.value.trendData?.map((item: any) => item.date) || []
  const normalHours = dashboard.value.trendData?.map((item: any) => item.normalHours) || []
  const overtimeHours = dashboard.value.trendData?.map((item: any) => item.overtimeHours) || []
  
  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
      },
    },
    legend: {
      data: [t('hr.work-hours.dashboard.正常工时'), t('hr.work-hours.dashboard.加班工时')],
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: dates,
    },
    yAxis: {
      type: 'value',
      name: t('hr.work-hours.dashboard.工时小时'),
    },
    series: [
      {
        name: t('hr.work-hours.dashboard.正常工时'),
        type: 'line',
        stack: 'Total',
        areaStyle: {},
        emphasis: {
          focus: 'series',
        },
        data: normalHours,
        itemStyle: {
          color: '#165dff',
        },
      },
      {
        name: t('hr.work-hours.dashboard.加班工时'),
        type: 'line',
        stack: 'Total',
        areaStyle: {},
        emphasis: {
          focus: 'series',
        },
        data: overtimeHours,
        itemStyle: {
          color: '#f53f3f',
        },
      },
    ],
  }
  
  trendChart.setOption(option)
}

function initJobTypeChart() {
  if (!jobTypeChartRef.value) return
  
  jobTypeChart = echarts.init(jobTypeChartRef.value)
  
  const data = dashboard.value.jobTypeDistribution?.map((item: any) => ({
    name: item.jobType,
    value: item.totalHours,
  })) || []
  
  const option = {
    tooltip: {
      trigger: 'item',
      formatter: `{a} <br/>{b}: {c} ${t('hr.employees.detail.小时')} ({d}%)`,
    },
    legend: {
      orient: 'vertical',
      left: 'left',
    },
    series: [
      {
        name: t('hr.work-hours.dashboard.工种工时分布'),
        type: 'pie',
        radius: '50%',
        data,
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)',
          },
        },
      },
    ],
  }
  
  jobTypeChart.setOption(option)
}

function initWorkCenterChart() {
  if (!workCenterChartRef.value) return
  
  workCenterChart = echarts.init(workCenterChartRef.value)
  
  const workCenters = dashboard.value.workCenterDistribution?.map((item: any) => item.workCenter) || []
  const hours = dashboard.value.workCenterDistribution?.map((item: any) => item.totalHours) || []
  
  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow',
      },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: workCenters,
      axisLabel: {
        interval: 0,
        rotate: 30,
      },
    },
    yAxis: {
      type: 'value',
      name: t('hr.work-hours.dashboard.工时小时'),
    },
    series: [
      {
        name: t('hr.work-hours.dashboard.总工时'),
        type: 'bar',
        data: hours,
        itemStyle: {
          color: '#14c9c9',
        },
        barWidth: '60%',
      },
    ],
  }
  
  workCenterChart.setOption(option)
}

function handleResize() {
  trendChart?.resize()
  jobTypeChart?.resize()
  workCenterChart?.resize()
}

function getRankColor(index: number) {
  if (index === 0) return '#f7ba1e'
  if (index === 1) return '#9fdb1d'
  if (index === 2) return '#ff7d00'
  return '#86909c'
}
</script>

<style scoped>
.page-container {
  padding: 16px;
}
</style>
