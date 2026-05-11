// ECharts 工业主题（深色风格，与设计规范一致）
export const industrialTheme = {
  color: ['#1B4FD8', '#00D4C8', '#FF6B35', '#00B578', '#A78BFA', '#F59E0B'],
  backgroundColor: 'transparent',
  textStyle: {
    color: '#8B949E',
    fontFamily: 'Inter, "PingFang SC", sans-serif',
  },
  title: {
    textStyle: { color: '#E6EDF3' },
    subtextStyle: { color: '#8B949E' },
  },
  legend: {
    textStyle: { color: '#8B949E' },
  },
  grid: {
    borderColor: '#21262D',
  },
  categoryAxis: {
    axisLine: { lineStyle: { color: '#30363D' } },
    axisTick: { lineStyle: { color: '#30363D' } },
    axisLabel: { color: '#8B949E' },
    splitLine: { lineStyle: { color: '#21262D' } },
  },
  valueAxis: {
    axisLine: { lineStyle: { color: '#30363D' } },
    axisTick: { lineStyle: { color: '#30363D' } },
    axisLabel: { color: '#8B949E' },
    splitLine: { lineStyle: { color: '#21262D' } },
  },
  tooltip: {
    backgroundColor: '#161B22',
    borderColor: '#30363D',
    textStyle: { color: '#E6EDF3' },
  },
  line: {
    smooth: true,
    symbol: 'circle',
    symbolSize: 6,
    lineStyle: { width: 2 },
  },
}
