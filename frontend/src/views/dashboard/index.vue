<template>
  <div class="dashboard-container">
    <!-- Welcome Banner (Light) -->
    <div class="welcome-banner">
      <div class="banner-content">
        <h2 class="welcome-title">{{ $t('dashboard.welcome', { name: authStore.username }) }}</h2>
        <p class="welcome-desc">{{ $t('dashboard.welcomeDesc') }}</p>
        <div class="banner-actions">
          <a-button type="primary" shape="round" size="large" class="glow-btn">
            {{ $t('dashboard.productionBoard') }}
            <template #icon><icon-right /></template>
          </a-button>
        </div>
      </div>
      <div class="banner-illustration">
        <div class="abstract-shape shape-blue"></div>
        <div class="abstract-shape shape-purple"></div>
        <div class="glass-orb"></div>
      </div>
    </div>

    <!-- Stats Row -->
    <div class="stats-grid">
      <div class="stat-card" v-for="stat in stats" :key="stat.title">
        <div class="stat-icon-wrapper" :style="{ background: stat.bg, color: stat.color }">
          <component :is="stat.icon" class="s-icon" />
        </div>
        <div class="stat-info">
          <div class="stat-title">{{ $t(stat.title) }}</div>
          <div class="stat-value">
            {{ stat.value }}
            <span class="stat-unit">{{ $t(stat.unit) }}</span>
          </div>
          <div class="stat-trend" :class="stat.trend > 0 ? 'up' : 'down'">
            <icon-arrow-rise v-if="stat.trend > 0" />
            <icon-arrow-fall v-else />
            {{ $t('dashboard.trendText', { value: Math.abs(stat.trend) }) }}
          </div>
        </div>
      </div>
    </div>

    <!-- Charts Area -->
    <div class="charts-section">
      <div class="chart-card">
        <div class="card-header">
          <h3 class="card-title">{{ $t('dashboard.oeeTrend') }}</h3>
          <a-radio-group type="button" v-model="timeRange" size="small">
            <a-radio value="week">{{ $t('dashboard.week') }}</a-radio>
            <a-radio value="month">{{ $t('dashboard.month') }}</a-radio>
          </a-radio-group>
        </div>
        <div class="chart-box" ref="chartRef"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, shallowRef, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useI18n } from 'vue-i18n'
import * as echarts from 'echarts'
import {
  IconRight, IconArrowRise, IconArrowFall,
  IconCheckCircleFill, IconClockCircle, IconUserGroup, IconThunderbolt
} from '@arco-design/web-vue/es/icon'

const authStore = useAuthStore()
const { t, locale } = useI18n()

const stats = ref([
  { title: 'dashboard.totalOutput', value: '12,450', unit: 'dashboard.unit.piece', icon: IconCheckCircleFill, trend: 5.2, bg: '#dcfce7', color: '#16a34a' },
  { title: 'dashboard.equipRate', value: '94.2', unit: '%', icon: IconThunderbolt, trend: 1.1, bg: '#dbeafe', color: '#2563eb' },
  { title: 'dashboard.avgMtt', value: '18', unit: 'dashboard.unit.min', icon: IconClockCircle, trend: -12.4, bg: '#fef08a', color: '#ca8a04' },
  { title: 'dashboard.workers', value: '142', unit: 'dashboard.unit.person', icon: IconUserGroup, trend: 0, bg: '#f3e8ff', color: '#9333ea' }
])

const timeRange = ref('week')
const chartRef = ref<HTMLElement | null>(null)
const chartInstance = shallowRef<echarts.ECharts | null>(null)

function initChart() {
  if (!chartRef.value) return
  chartInstance.value = echarts.init(chartRef.value)
  
  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      borderColor: '#e2e8f0',
      textStyle: { color: '#0f172a' }
    },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: [
        t('dashboard.mon'), t('dashboard.tue'), t('dashboard.wed'),
        t('dashboard.thu'), t('dashboard.fri'), t('dashboard.sat'), t('dashboard.sun')
      ],
      axisLine: { lineStyle: { color: '#cbd5e1' } },
      axisLabel: { color: '#64748b' }
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } },
      axisLabel: { color: '#64748b' }
    },
    series: [
      {
        name: 'OEE',
        type: 'line',
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 4, color: '#3b82f6' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(59, 130, 246, 0.4)' },
            { offset: 1, color: 'rgba(59, 130, 246, 0)' }
          ])
        },
        data: [78, 82, 85, 87, 86, 91, 94]
      }
    ]
  }
  chartInstance.value.setOption(option)
}

function handleResize() {
  chartInstance.value?.resize()
}

onMounted(() => {
  initChart()
  window.addEventListener('resize', handleResize)
})

watch(locale, () => {
  // Re-initialize chart when language changes to update labels
  initChart()
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  chartInstance.value?.dispose()
})
</script>

<style scoped>
.dashboard-container {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* Welcome Banner */
.welcome-banner {
  background: #ffffff;
  border-radius: 24px;
  padding: 40px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: relative;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.02);
}

.banner-content {
  position: relative;
  z-index: 2;
  max-width: 600px;
}
.welcome-title {
  font-size: 32px;
  font-weight: 800;
  color: #0f172a;
  margin: 0 0 12px;
}
.welcome-desc {
  font-size: 16px;
  color: #64748b;
  margin: 0 0 30px;
  line-height: 1.6;
}
.glow-btn {
  background: linear-gradient(135deg, #3b82f6, #6366f1);
  border: none;
  font-weight: 600;
  padding: 0 32px;
  height: 48px;
  box-shadow: 0 10px 20px -5px rgba(59, 130, 246, 0.5);
  transition: all 0.3s;
}
.glow-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 15px 25px -5px rgba(59, 130, 246, 0.6);
}

/* Abstract Illustration */
.banner-illustration {
  position: absolute;
  right: 0; top: 0; width: 400px; height: 100%;
}
.abstract-shape {
  position: absolute;
  border-radius: 50%;
  filter: blur(40px);
  opacity: 0.8;
}
.shape-blue {
  background: #bfdbfe;
  width: 200px; height: 200px;
  top: -50px; right: 50px;
  animation: floatLight 6s infinite alternate;
}
.shape-purple {
  background: #e9d5ff;
  width: 250px; height: 250px;
  bottom: -100px; right: -50px;
  animation: floatLight 8s infinite alternate-reverse;
}
.glass-orb {
  position: absolute;
  width: 120px; height: 120px;
  right: 80px; top: 50%; transform: translateY(-50%);
  background: rgba(255, 255, 255, 0.4);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.8);
  border-radius: 50%;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
}

@keyframes floatLight {
  100% { transform: translateY(20px); }
}

/* Stats */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 24px;
}
.stat-card {
  background: #ffffff;
  border-radius: 20px;
  padding: 24px;
  display: flex;
  align-items: center;
  gap: 20px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.02);
  transition: transform 0.3s, box-shadow 0.3s;
  cursor: pointer;
}
.stat-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
}
.stat-icon-wrapper {
  width: 60px; height: 60px;
  border-radius: 16px;
  display: flex; align-items: center; justify-content: center;
}
.s-icon { font-size: 28px; }

.stat-info { flex: 1; }
.stat-title { font-size: 14px; color: #64748b; margin-bottom: 8px; font-weight: 500; }
.stat-value { font-size: 28px; font-weight: 800; color: #0f172a; line-height: 1; margin-bottom: 8px; }
.stat-unit { font-size: 14px; font-weight: 500; color: #94a3b8; }
.stat-trend { font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 4px; }
.stat-trend.up { color: #16a34a; }
.stat-trend.down { color: #dc2626; }

/* Charts */
.charts-section {
  display: grid;
  grid-template-columns: 1fr;
}
.chart-card {
  background: #ffffff;
  border-radius: 20px;
  padding: 24px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.02);
}
.card-header {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;
}
.card-title { font-size: 18px; font-weight: 700; color: #0f172a; margin: 0; }

.chart-box {
  width: 100%;
  height: 350px;
}

@media (max-width: 1400px) {
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
}
</style>
