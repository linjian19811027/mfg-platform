<template>
  <div class="page-container">
    <a-card :bordered="false">
      <!-- 筛选栏 -->
      <a-form :model="searchForm" layout="inline" class="search-form" @keyup.enter="handleSearch">
        <a-form-item :label="$t('hr.work-hours.summary.员工工号姓名')">
          <a-input
            v-model="searchForm.keyword"
            :placeholder="$t('hr.work-hours.summary.请输入工号或姓名')"
            allow-clear
            style="width: 200px"
          />
        </a-form-item>
        <a-form-item :label="$t('hr.work-hours.summary.日期范围')">
          <a-range-picker v-model="searchForm.dateRange" style="width: 260px" />
        </a-form-item>
        <a-form-item :label="$t('hr.work-hours.summary.汇总维度')">
          <a-select v-model="searchForm.dimension" style="width: 120px">
            <a-option value="DAY">日</a-option>
            <a-option value="WEEK">周</a-option>
            <a-option value="MONTH">月</a-option>
          </a-select>
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" @click="handleSearch">{{ $t('common.search') }}</a-button>
            <a-button @click="handleReset">{{ $t('common.reset') }}</a-button>
          </a-space>
        </a-form-item>
      </a-form>

      <!-- 操作栏 -->
      <div class="action-bar">
        <a-button @click="handleExport" :loading="exportLoading">
          <template #icon><icon-download /></template>
          导出 Excel
        </a-button>
      </div>

      <!-- 表格 -->
      <a-table
        :columns="columns"
        :data="tableData"
        :loading="loading"
        :pagination="pagination"
        @page-change="handlePageChange"
        @page-size-change="handlePageSizeChange"
        row-key="id"
      >
        <template #totalHours="{ record }">
          <span style="font-weight: 500">{{ record.totalHours }}</span>
        </template>
        <template #overtimeHours="{ record }">
          <span :style="record.overtimeHours > 0 ? 'color: #f53f3f' : ''">
            {{ record.overtimeHours }}
          </span>
        </template>
        <template #empty>
          <a-empty :description="$t('hr.work-hours.summary.暂无工时数据请调整筛选条件后重')" />
        </template>
      </a-table>
    </a-card>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
import { useI18n } from 'vue-i18n'
import { ref, reactive, onMounted } from 'vue'
import { Message } from '@arco-design/web-vue'
import { IconDownload } from '@arco-design/web-vue/es/icon'
import { getWorkHourSummary, exportWorkHours } from '@/api/hr'

const searchForm = reactive({
  keyword: '',
  dateRange: [] as string[],
  dimension: 'DAY',
})

const loading = ref(false)
const exportLoading = ref(false)
const tableData = ref([])
const pagination = reactive({
  current: 1,
  pageSize: 20,
  total: 0,
  showTotal: true,
  showPageSize: true,
})

const columns = [
  { title: t('hr.work-hours.summary.员工工号'), dataIndex: 'empNo', width: 120 },
  { title: t('hr.work-hours.summary.员工姓名'), dataIndex: 'empName', width: 100 },
  { title: t('hr.work-hours.summary.工种'), dataIndex: 'jobType', width: 120 },
  { title: t('hr.work-hours.summary.工作中心'), dataIndex: 'workCenter', width: 120 },
  { title: t('hr.work-hours.summary.汇总日期'), dataIndex: 'summaryDate', width: 120 },
  { title: t('hr.work-hours.summary.总工时h'), dataIndex: 'totalHours', slotName: 'totalHours', width: 110 },
  { title: t('hr.work-hours.summary.正常工时h'), dataIndex: 'normalHours', width: 120 },
  { title: t('hr.work-hours.summary.加班工时h'), dataIndex: 'overtimeHours', slotName: 'overtimeHours', width: 120 },
]

onMounted(() => {
  fetchData()
})

function buildParams() {
  const params: any = {
    keyword: searchForm.keyword || undefined,
    dimension: searchForm.dimension,
    page: pagination.current,
    pageSize: pagination.pageSize,
  }
  if (searchForm.dateRange?.length === 2) {
    params.startDate = searchForm.dateRange[0]
    params.endDate = searchForm.dateRange[1]
  }
  return params
}

async function fetchData() {
  loading.value = true
  try {
    const res = await getWorkHourSummary(buildParams())
    tableData.value = (res as any).list ?? (res as any).items ?? []
    pagination.total = (res as any).total ?? 0
  } catch (e: any) {
    Message.error(e.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  pagination.current = 1
  fetchData()
}

function handleReset() {
  Object.assign(searchForm, { keyword: '', dateRange: [], dimension: 'DAY' })
  handleSearch()
}

function handlePageChange(page: number) {
  pagination.current = page
  fetchData()
}

function handlePageSizeChange(pageSize: number) {
  pagination.pageSize = pageSize
  pagination.current = 1
  fetchData()
}

async function handleExport() {
  exportLoading.value = true
  try {
    const params = buildParams()
    delete params.page
    delete params.pageSize
    const res = await exportWorkHours(params)
    const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `工时统计_${new Date().getTime()}.xlsx`
    a.click()
    window.URL.revokeObjectURL(url)
    Message.success('导出成功')
  } catch (e: any) {
    Message.error(e.message || '导出失败')
  } finally {
    exportLoading.value = false
  }
}
</script>

<style scoped>
.page-container { padding: 16px; }
.search-form { margin-bottom: 16px; }
.action-bar { margin-bottom: 16px; }
</style>
