<template>
  <div class="page-container">
    <!-- 顶部筛选 + 操作 -->
    <a-card :bordered="false" style="margin-bottom: 16px">
      <a-row :gutter="16" align="center">
        <a-col flex="auto">
          <a-space wrap>
            <a-form-item :label="$t('hr.schedules.index.工作中心')" style="margin-bottom: 0">
              <a-input
                v-model="filter.workCenter"
                :placeholder="$t('hr.schedules.index.请输入工作中心')"
                allow-clear
                style="width: 180px"
                @change="fetchStats"
              />
            </a-form-item>
            <a-form-item :label="$t('hr.schedules.index.月份')" style="margin-bottom: 0">
              <a-month-picker
                v-model="filter.month"
                style="width: 160px"
                @change="handleMonthChange"
              />
            </a-form-item>
          </a-space>
        </a-col>
        <a-col flex="none">
          <a-space>
            <a-button type="primary" @click="() => showCreateModal()">
              <template #icon><icon-plus /></template>
              新建排班
            </a-button>
            <a-button @click="showBatchModal">
              <template #icon><icon-apps /></template>
              批量排班
            </a-button>
          </a-space>
        </a-col>
      </a-row>
    </a-card>

    <!-- 统计卡片 -->
    <a-row :gutter="16" style="margin-bottom: 16px">
      <a-col :span="4" v-for="item in shiftStats" :key="item.shiftCode">
        <a-card :bordered="false" size="small">
          <a-statistic :title="item.shiftName" :value="item.count" suffix="人" />
        </a-card>
      </a-col>
      <a-col :span="4">
        <a-card :bordered="false" size="small">
          <a-statistic :title="$t('hr.schedules.index.未排班员工')" :value="stats.unscheduledCount" suffix="人" :value-style="{ color: '#f53f3f' }" />
        </a-card>
      </a-col>
    </a-row>

    <!-- 日历 -->
    <a-card :bordered="false">
      <a-calendar
        :panel-value="calendarDate"
        @panel-change="handlePanelChange"
        @cell-click="handleDateClick"
      >
        <template #cell="{ date }">
          <div class="calendar-cell">
            <div class="date-num">{{ date.getDate() }}</div>
            <div v-if="getDaySchedules(date).length" class="day-schedules">
              <a-tag
                v-for="s in getDaySchedules(date).slice(0, 2)"
                :key="s.id"
                :color="shiftColor(s.shiftCode)"
                size="small"
                style="margin: 1px 0; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap"
              >
                {{ s.empName }} · {{ s.shiftName }}
              </a-tag>
              <span v-if="getDaySchedules(date).length > 2" class="more-hint">
                +{{ getDaySchedules(date).length - 2 }} 人
              </span>
            </div>
          </div>
        </template>
      </a-calendar>
    </a-card>

    <!-- 侧边抽屉：当天排班明细 -->
    <a-drawer
      v-model:visible="drawerVisible"
      :title="`${selectedDateStr} 排班明细`"
      width="480"
      :footer="false"
    >
      <div style="margin-bottom: 12px">
        <a-button type="primary" size="small" @click="() => showCreateModal(selectedDate)">
          <template #icon><icon-plus /></template>
          新增排班
        </a-button>
      </div>
      <a-list :data="selectedDaySchedules" :bordered="false">
        <template #item="{ item }">
          <a-list-item>
            <a-list-item-meta>
              <template #title>
                <a-space>
                  <span>{{ item.empName }}</span>
                  <a-tag :color="shiftColor(item.shiftCode)" size="small">{{ item.shiftName }}</a-tag>
                </a-space>
              </template>
              <template #description>{{ item.empNo }} · {{ item.workCenterName || '-' }}</template>
            </a-list-item-meta>
            <template #actions>
              <a-popconfirm
                :content="isPastDate(selectedDate) ? '历史排班不可删除' : '确定删除此排班？'"
                :ok-button-props="{ disabled: isPastDate(selectedDate) }"
                @ok="handleDeleteSchedule(item)"
              >
                <a-button
                  type="text"
                  size="small"
                  status="danger"
                  :disabled="isPastDate(selectedDate)"
                >
                  删除
                </a-button>
              </a-popconfirm>
            </template>
          </a-list-item>
        </template>
        <template #empty>
          <a-empty :description="$t('hr.schedules.index.当天暂无排班')" />
        </template>
      </a-list>
    </a-drawer>

    <!-- 新建排班弹窗 -->
    <a-modal
      v-model:visible="createModalVisible"
      :title="$t('hr.schedules.index.新建排班')"
      :ok-loading="submitLoading"
      @ok="handleCreateSubmit"
      @cancel="createModalVisible = false"
    >
      <a-form :model="createForm" :rules="createRules" ref="createFormRef" layout="vertical">
        <a-form-item :label="$t('hr.schedules.index.员工')" field="empId">
          <a-select
            v-model="createForm.empId"
            :placeholder="$t('hr.schedules.index.请选择员工')"
            :options="employeeOptions"
            :filter-option="filterEmployee"
            allow-search
          />
        </a-form-item>
        <a-form-item :label="$t('hr.schedules.index.排班日期')" field="scheduleDate">
          <a-date-picker v-model="createForm.scheduleDate" style="width: 100%" />
        </a-form-item>
        <a-form-item :label="$t('hr.schedules.index.班次')" field="shiftCode">
          <a-select v-model="createForm.shiftCode" :placeholder="$t('hr.schedules.index.请选择班次')">
            <a-option v-for="s in shifts" :key="s.code" :value="s.code">{{ s.name }}</a-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="$t('hr.schedules.index.工作中心')">
          <a-input v-model="createForm.workCenter" :placeholder="$t('hr.schedules.index.请输入工作中心可选')" />
        </a-form-item>
        <a-form-item :label="$t('common.remark')">
          <a-input v-model="createForm.remark" :placeholder="$t('hr.schedules.index.备注可选')" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 批量排班弹窗 -->
    <a-modal
      v-model:visible="batchModalVisible"
      :title="$t('hr.schedules.index.批量排班')"
      width="640px"
      :ok-loading="batchLoading"
      @ok="handleBatchSubmit"
      @cancel="batchModalVisible = false"
    >
      <a-alert type="info" style="margin-bottom: 16px">
        单次批量最多 500 条，同一员工同一天已有排班将自动跳过。
      </a-alert>
      <a-form :model="batchForm" :rules="batchRules" ref="batchFormRef" layout="vertical">
        <a-form-item :label="$t('hr.schedules.index.选择员工')" field="empIds">
          <a-select
            v-model="batchForm.empIds"
            :placeholder="$t('hr.schedules.index.请选择员工可多选')"
            :options="employeeOptions"
            multiple
            allow-search
            :filter-option="filterEmployee"
          />
        </a-form-item>
        <a-form-item :label="$t('hr.schedules.index.日期范围')" field="dateRange">
          <a-range-picker v-model="batchForm.dateRange" style="width: 100%" />
        </a-form-item>
        <a-form-item :label="$t('hr.schedules.index.班次')" field="shiftCode">
          <a-select v-model="batchForm.shiftCode" :placeholder="$t('hr.schedules.index.请选择班次')">
            <a-option v-for="s in shifts" :key="s.code" :value="s.code">{{ s.name }}</a-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="$t('hr.schedules.index.工作中心')">
          <a-input v-model="batchForm.workCenter" :placeholder="$t('hr.schedules.index.请输入工作中心可选')" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">

import { ref, reactive, computed, onMounted } from 'vue'
import { Message } from '@arco-design/web-vue'
import { IconPlus, IconApps } from '@arco-design/web-vue/es/icon'
import {
  getSchedules, getScheduleStats, getShifts,
  createSchedule, batchCreateSchedule, deleteSchedule,
} from '@/api/hr'
import { getEmployees } from '@/api/hr'

// ── 状态 ──────────────────────────────────────────────────────────────────
const calendarDate = ref(new Date())
const filter = reactive({ workCenter: '', month: new Date() })
const schedules = ref<any[]>([])
const stats = reactive({ unscheduledCount: 0 })
const shiftStats = ref<any[]>([])
const shifts = ref<any[]>([])
const employeeOptions = ref<any[]>([])

// 抽屉
const drawerVisible = ref(false)
const selectedDate = ref<Date>(new Date())
const selectedDateStr = computed(() => {
  const d = selectedDate.value
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})
const selectedDaySchedules = computed(() =>
  schedules.value.filter((s) => s.scheduleDate === selectedDateStr.value)
)

// 新建弹窗
const createModalVisible = ref(false)
const submitLoading = ref(false)
const createFormRef = ref()
const createForm = reactive({ empId: '', scheduleDate: '', shiftCode: '', workCenter: '', remark: '' })
const createRules = {
  empId: [{ required: true, message: '请选择员工' }],
  scheduleDate: [{ required: true, message: '请选择排班日期' }],
  shiftCode: [{ required: true, message: '请选择班次' }],
}

// 批量弹窗
const batchModalVisible = ref(false)
const batchLoading = ref(false)
const batchFormRef = ref()
const batchForm = reactive({ empIds: [], dateRange: [], shiftCode: '', workCenter: '' })
const batchRules = {
  empIds: [{ required: true, message: '请选择员工' }],
  dateRange: [{ required: true, message: '请选择日期范围' }],
  shiftCode: [{ required: true, message: '请选择班次' }],
}

// ── 初始化 ────────────────────────────────────────────────────────────────
onMounted(async () => {
  await Promise.all([fetchShifts(), fetchEmployees()])
  fetchSchedules()
  fetchStats()
})

async function fetchShifts() {
  try {
    const res = await getShifts()
    shifts.value = (res as any).list ?? (res as any).data ?? []
  } catch (e: any) {
    Message.error(e.message || '加载班次失败')
  }
}

async function fetchEmployees() {
  try {
    const res = await getEmployees({ status: 'ACTIVE', pageSize: 500 })
    employeeOptions.value = ((res as any).list ?? (res as any).items ?? []).map((e: any) => ({
      value: e.id,
      label: `${e.empNo} ${e.name}`,
      empNo: e.empNo,
      name: e.name,
    }))
  } catch (e: any) {
    Message.error(e.message || '加载员工失败')
  }
}

async function fetchSchedules() {
  const year = calendarDate.value.getFullYear()
  const month = calendarDate.value.getMonth() + 1
  try {
    const res = await getSchedules({
      year,
      month,
      workCenter: filter.workCenter || undefined,
      pageSize: 500,
    })
    schedules.value = (res as any).list ?? (res as any).items ?? []
  } catch (e: any) {
    Message.error(e.message || '加载排班失败')
  }
}

async function fetchStats() {
  const year = calendarDate.value.getFullYear()
  const month = calendarDate.value.getMonth() + 1
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`
  try {
    const res = await getScheduleStats({ startDate, endDate, workCenter: filter.workCenter || undefined })
    shiftStats.value = (res as any).shiftStats ?? []
    stats.unscheduledCount = (res as any).unscheduledCount ?? 0
  } catch (e: any) {
    Message.error(e.message || '加载统计失败')
  }
}

// ── 日历操作 ──────────────────────────────────────────────────────────────
function handlePanelChange(date: Date) {
  calendarDate.value = date
  fetchSchedules()
  fetchStats()
}

function handleMonthChange(val: Date) {
  calendarDate.value = val
  fetchSchedules()
  fetchStats()
}

function handleDateClick(date: Date) {
  selectedDate.value = date
  drawerVisible.value = true
}

function getDaySchedules(date: Date) {
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  return schedules.value.filter((s) => s.scheduleDate === dateStr)
}

function isPastDate(date: Date) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return date < today
}

function shiftColor(code: string) {
  const map: Record<string, string> = { DAY: 'blue', MID: 'orange', NIGHT: 'purple', NORMAL: 'green' }
  return map[code] ?? 'gray'
}

function filterEmployee(input: string, option: any) {
  return option.label.toLowerCase().includes(input.toLowerCase())
}

// ── 新建排班 ──────────────────────────────────────────────────────────────
function showCreateModal(date?: Date) {
  Object.assign(createForm, { empId: '', shiftCode: '', workCenter: '', remark: '' })
  createForm.scheduleDate = date
    ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    : ''
  createModalVisible.value = true
}

async function handleCreateSubmit() {
  try {
    await createFormRef.value?.validate()
    submitLoading.value = true
    await createSchedule(createForm)
    Message.success('排班创建成功')
    createModalVisible.value = false
    fetchSchedules()
    fetchStats()
  } catch (e: any) {
    if (e.message) Message.error(e.message)
  } finally {
    submitLoading.value = false
  }
}

// ── 批量排班 ──────────────────────────────────────────────────────────────
function showBatchModal() {
  Object.assign(batchForm, { empIds: [], dateRange: [], shiftCode: '', workCenter: '' })
  batchModalVisible.value = true
}

async function handleBatchSubmit() {
  try {
    await batchFormRef.value?.validate()
    batchLoading.value = true
    await batchCreateSchedule({
      empIds: batchForm.empIds,
      startDate: batchForm.dateRange[0],
      endDate: batchForm.dateRange[1],
      shiftCode: batchForm.shiftCode,
      workCenter: batchForm.workCenter || undefined,
    })
    Message.success('批量排班成功')
    batchModalVisible.value = false
    fetchSchedules()
    fetchStats()
  } catch (e: any) {
    if (e.message) Message.error(e.message)
  } finally {
    batchLoading.value = false
  }
}

// ── 删除排班 ──────────────────────────────────────────────────────────────
async function handleDeleteSchedule(item: any) {
  if (isPastDate(selectedDate.value)) return
  try {
    await deleteSchedule(item.id)
    Message.success('删除成功')
    fetchSchedules()
    fetchStats()
  } catch (e: any) {
    Message.error(e.message || '删除失败')
  }
}
</script>

<style scoped>
.page-container { padding: 16px; }

.calendar-cell {
  min-height: 60px;
  padding: 2px 4px;
}

.date-num {
  font-size: 14px;
  margin-bottom: 2px;
}

.day-schedules {
  font-size: 11px;
}

.more-hint {
  color: var(--color-text-3);
  font-size: 11px;
}
</style>
