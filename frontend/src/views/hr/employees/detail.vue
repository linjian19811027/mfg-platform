<template>
  <div class="page-container">
    <a-page-header :title="$t('hr.employees.detail.员工详情')" @back="handleBack">
      <template #extra>
        <a-space>
          <a-button @click="handleEdit">编辑</a-button>
          <a-button type="primary" @click="handleStatusChange">变更状态</a-button>
        </a-space>
      </template>
    </a-page-header>

    <a-card :bordered="false" :loading="loading">
      <a-tabs default-active-key="basic">
        <!-- 基本信息 -->
        <a-tab-pane key="basic" :title="$t('hr.employees.detail.基本信息')">
          <a-descriptions :column="2" bordered>
            <a-descriptions-item :label="$t('hr.employees.detail.工号')">{{ employeeData.employeeNo }}</a-descriptions-item>
            <a-descriptions-item :label="$t('hr.employees.detail.姓名')">{{ employeeData.name }}</a-descriptions-item>
            <a-descriptions-item :label="$t('hr.employees.detail.工种')">{{ employeeData.jobType }}</a-descriptions-item>
            <a-descriptions-item :label="$t('hr.employees.detail.工作中心')">{{ employeeData.workCenter }}</a-descriptions-item>
            <a-descriptions-item :label="$t('common.status')">
              <a-tag v-if="employeeData.status === 'ACTIVE'" color="green">在职</a-tag>
              <a-tag v-else-if="employeeData.status === 'INACTIVE'" color="gray">离职</a-tag>
              <a-tag v-else-if="employeeData.status === 'SUSPENDED'" color="orange">停职</a-tag>
            </a-descriptions-item>
            <a-descriptions-item :label="$t('hr.employees.detail.入职日期')">{{ employeeData.hireDate }}</a-descriptions-item>
            <a-descriptions-item :label="$t('hr.employees.detail.离职日期')">{{ employeeData.terminationDate || '-' }}</a-descriptions-item>
            <a-descriptions-item :label="$t('hr.employees.detail.联系电话')">{{ employeeData.phone }}</a-descriptions-item>
            <a-descriptions-item :label="$t('hr.employees.detail.邮箱')">{{ employeeData.email }}</a-descriptions-item>
            <a-descriptions-item :label="$t('hr.employees.detail.创建时间')">{{ employeeData.createdAt }}</a-descriptions-item>
          </a-descriptions>
        </a-tab-pane>

        <!-- 技能认证 -->
        <a-tab-pane key="certifications" :title="$t('hr.employees.detail.技能认证')">
          <div class="tab-header">
            <a-button type="primary" @click="handleAddCertification">
              <template #icon><icon-plus /></template>
              添加认证
            </a-button>
          </div>
          <a-table
            :columns="certColumns"
            :data="certifications"
            :loading="certLoading"
            :pagination="false"
            row-key="id"
          >
            <template #status="{ record }">
              <a-tag v-if="record.isExpired" color="red">已过期</a-tag>
              <a-tag v-else-if="record.isExpiringSoon" color="orange">即将到期</a-tag>
              <a-tag v-else color="green">有效</a-tag>
            </template>
            <template #action="{ record }">
              <a-space>
                <a-button type="text" size="small" @click="handleRenewCert(record)">续期</a-button>
                <a-popconfirm :content="$t('hr.employees.detail.确定删除此认证吗')" @ok="handleDeleteCert(record)">
                  <a-button type="text" size="small" status="danger">删除</a-button>
                </a-popconfirm>
              </a-space>
            </template>
          </a-table>
        </a-tab-pane>

        <!-- 排班记录 -->
        <a-tab-pane key="schedules" :title="$t('hr.employees.detail.排班记录')">
          <a-calendar :panel-value="calendarDate" @panel-change="handleCalendarChange">
            <template #cell="{ date }">
              <div class="calendar-cell">
                <div class="date-label">{{ date.getDate() }}</div>
                <div v-if="getScheduleForDate(date)" class="schedule-info">
                  <a-tag size="small" color="blue">{{ getScheduleForDate(date)?.shiftName }}</a-tag>
                </div>
              </div>
            </template>
          </a-calendar>
        </a-tab-pane>

        <!-- 工时记录 -->
        <a-tab-pane key="workHours" :title="$t('hr.employees.detail.工时记录')">
          <a-form :model="workHourQuery" layout="inline" class="query-form">
            <a-form-item :label="$t('hr.employees.detail.日期范围')">
              <a-range-picker v-model="workHourQuery.dateRange" style="width: 300px" />
            </a-form-item>
            <a-form-item>
              <a-button type="primary" @click="fetchWorkHours">{{ $t('common.search') }}</a-button>
            </a-form-item>
          </a-form>
          <a-table
            :columns="workHourColumns"
            :data="workHours"
            :loading="workHourLoading"
            :pagination="workHourPagination"
            @page-change="handleWorkHourPageChange"
            row-key="id"
          >
            <template #footer>
              <div style="text-align: right; padding: 8px 0;">
                <a-space size="large">
                  <span>总工时: <strong>{{ workHourSummary.totalHours }}</strong> 小时</span>
                  <span>正常工时: <strong>{{ workHourSummary.normalHours }}</strong> 小时</span>
                  <span>加班工时: <strong>{{ workHourSummary.overtimeHours }}</strong> 小时</span>
                </a-space>
              </div>
            </template>
          </a-table>
        </a-tab-pane>
      </a-tabs>
    </a-card>

    <!-- 添加认证弹窗 -->
    <a-modal
      v-model:visible="certModalVisible"
      :title="$t('hr.employees.detail.添加技能认证')"
      @ok="handleCertSubmit"
      @cancel="certModalVisible = false"
    >
      <a-form :model="certForm" :rules="certRules" ref="certFormRef" layout="vertical">
        <a-form-item :label="$t('hr.employees.detail.认证类型')" field="certTypeId">
          <a-select v-model="certForm.certTypeId" :placeholder="$t('hr.employees.detail.请选择认证类型')">
            <a-option v-for="type in certTypes" :key="type.id" :value="type.id">
              {{ type.name }}
            </a-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="$t('hr.employees.detail.证书编号')" field="certNo">
          <a-input v-model="certForm.certNo" :placeholder="$t('hr.employees.detail.请输入证书编号')" />
        </a-form-item>
        <a-form-item :label="$t('hr.employees.detail.获得日期')" field="obtainedDate">
          <a-date-picker v-model="certForm.obtainedDate" style="width: 100%" />
        </a-form-item>
        <a-form-item :label="$t('hr.employees.detail.有效期至')" field="expiryDate">
          <a-date-picker v-model="certForm.expiryDate" style="width: 100%" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 续期弹窗 -->
    <a-modal
      v-model:visible="renewModalVisible"
      :title="$t('hr.employees.detail.续期认证')"
      @ok="handleRenewSubmit"
      @cancel="renewModalVisible = false"
    >
      <a-form :model="renewForm" layout="vertical">
        <a-form-item :label="$t('hr.employees.detail.新有效期至')">
          <a-date-picker v-model="renewForm.newExpiryDate" style="width: 100%" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
import { useI18n } from 'vue-i18n'
import { ref, reactive, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Message } from '@arco-design/web-vue'
import { IconPlus } from '@arco-design/web-vue/es/icon'
import {
  getEmployee,
  getEmployeeCertifications,
  getCertificationTypes,
  addCertification,
  renewCertification,
  deleteCertification,
} from '@/api/hr'
import { getSchedules, getWorkHourRecords } from '@/api/hr'

const route = useRoute()
const router = useRouter()
const employeeId = route.params.id as string

const loading = ref(false)
const employeeData = ref<any>({})

const certLoading = ref(false)
const certifications = ref<any[]>([])
const certTypes = ref<any[]>([])
const certColumns = [
  { title: t('hr.employees.detail.认证类型'), dataIndex: 'certTypeName', width: 150 },
  { title: t('hr.employees.detail.证书编号'), dataIndex: 'certNo', width: 150 },
  { title: t('hr.employees.detail.获得日期'), dataIndex: 'obtainedDate', width: 120 },
  { title: t('hr.employees.detail.有效期至'), dataIndex: 'expiryDate', width: 120 },
  { title: t('hr.employees.detail.状态'), dataIndex: 'status', slotName: 'status', width: 100 },
  { title: t('hr.employees.detail.操作'), slotName: 'action', width: 150 },
]

const certModalVisible = ref(false)
const certFormRef = ref()
const certForm = reactive({
  certTypeId: '',
  certNo: '',
  obtainedDate: '',
  expiryDate: '',
})
const certRules = {
  certTypeId: [{ required: true, message: '请选择认证类型' }],
  certNo: [{ required: true, message: '请输入证书编号' }],
  obtainedDate: [{ required: true, message: '请选择获得日期' }],
  expiryDate: [{ required: true, message: '请选择有效期' }],
}

const renewModalVisible = ref(false)
const renewForm = reactive({
  id: '',
  newExpiryDate: '',
})

const calendarDate = ref(new Date())
const schedules = ref<any[]>([])

const workHourLoading = ref(false)
const workHours = ref([])
const workHourQuery = reactive({
  dateRange: [],
})
const workHourPagination = reactive({
  current: 1,
  pageSize: 20,
  total: 0,
})
const workHourSummary = reactive({
  totalHours: 0,
  normalHours: 0,
  overtimeHours: 0,
})
const workHourColumns = [
  { title: t('hr.employees.detail.日期'), dataIndex: 'workDate', width: 120 },
  { title: t('hr.employees.detail.工单号'), dataIndex: 'woNo', width: 150 },
  { title: t('hr.employees.detail.工序'), dataIndex: 'operationName', width: 150 },
  { title: t('hr.employees.detail.开始时间'), dataIndex: 'startTime', width: 160 },
  { title: t('hr.employees.detail.结束时间'), dataIndex: 'endTime', width: 160 },
  { title: t('hr.employees.detail.实际工时'), dataIndex: 'actualHours', width: 100 },
  { title: t('hr.employees.detail.加班工时'), dataIndex: 'overtimeHours', width: 100 },
]

onMounted(async () => {
  await fetchEmployee()
  await fetchCertifications()
  await fetchCertTypes()
  await fetchSchedules()
  await fetchWorkHours()
})

async function fetchEmployee() {
  loading.value = true
  try {
    const res = await getEmployee(employeeId)
    employeeData.value = res
  } catch (error: any) {
    Message.error(error.message || '加载失败')
  } finally {
    loading.value = false
  }
}

async function fetchCertifications() {
  certLoading.value = true
  try {
    const res = await getEmployeeCertifications(employeeId)
    certifications.value = (res as any).list ?? (res as any).data ?? res ?? []
  } catch (error: any) {
    Message.error(error.message || '加载认证失败')
  } finally {
    certLoading.value = false
  }
}

async function fetchCertTypes() {
  try {
    const res = await getCertificationTypes()
    certTypes.value = (res as any).list ?? (res as any).data ?? res ?? []
  } catch (error: any) {
    Message.error(error.message || '加载认证类型失败')
  }
}

async function fetchSchedules() {
  try {
    const year = calendarDate.value.getFullYear()
    const month = calendarDate.value.getMonth() + 1
    const res = await getSchedules({
      employeeId,
      year,
      month,
    })
    schedules.value = (res as any).list ?? (res as any).items ?? []
  } catch (error: any) {
    Message.error(error.message || '加载排班失败')
  }
}

async function fetchWorkHours() {
  workHourLoading.value = true
  try {
    const params: any = {
      employeeId,
      page: workHourPagination.current,
      pageSize: workHourPagination.pageSize,
    }
    if (workHourQuery.dateRange?.length === 2) {
      params.startDate = workHourQuery.dateRange[0]
      params.endDate = workHourQuery.dateRange[1]
    }
    const res = await getWorkHourRecords(params)
    workHours.value = (res as any).list ?? (res as any).items ?? []
    workHourPagination.total = (res as any).total ?? 0
    const items = (res as any).list ?? (res as any).items ?? []
    workHourSummary.totalHours = items.reduce((sum: number, item: any) => sum + item.actualHours, 0).toFixed(2)
    workHourSummary.normalHours = items.reduce((sum: number, item: any) => sum + (item.actualHours - item.overtimeHours), 0).toFixed(2)
    workHourSummary.overtimeHours = items.reduce((sum: number, item: any) => sum + item.overtimeHours, 0).toFixed(2)
  } catch (error: any) {
    Message.error(error.message || '加载工时失败')
  } finally {
    workHourLoading.value = false
  }
}

function handleBack() {
  router.back()
}

function handleEdit() {
  // 跳转到编辑页面或打开编辑弹窗
  Message.info('编辑功能待实现')
}

function handleStatusChange() {
  Message.info('状态变更功能待实现')
}

function handleAddCertification() {
  Object.assign(certForm, {
    certTypeId: '',
    certNo: '',
    obtainedDate: '',
    expiryDate: '',
  })
  certModalVisible.value = true
}

async function handleCertSubmit() {
  try {
    await certFormRef.value?.validate()
    await addCertification({
      employeeId,
      ...certForm,
    })
    Message.success('添加成功')
    certModalVisible.value = false
    fetchCertifications()
  } catch (error: any) {
    if (error.message) {
      Message.error(error.message)
    }
  }
}

function handleRenewCert(record: any) {
  renewForm.id = record.id
  renewForm.newExpiryDate = ''
  renewModalVisible.value = true
}

async function handleRenewSubmit() {
  try {
    await renewCertification(renewForm.id, { expiryDate: renewForm.newExpiryDate })
    Message.success('续期成功')
    renewModalVisible.value = false
    fetchCertifications()
  } catch (error: any) {
    Message.error(error.message || '续期失败')
  }
}

async function handleDeleteCert(record: any) {
  try {
    await deleteCertification(record.id)
    Message.success('删除成功')
    fetchCertifications()
  } catch (error: any) {
    Message.error(error.message || '删除失败')
  }
}

function handleCalendarChange(date: Date) {
  calendarDate.value = date
  fetchSchedules()
}

function getScheduleForDate(date: Date) {
  const dateStr = date.toISOString().split('T')[0]
  return schedules.value.find((s: any) => s.scheduleDate === dateStr)
}

function handleWorkHourPageChange(page: number) {
  workHourPagination.current = page
  fetchWorkHours()
}
</script>

<style scoped>
.page-container {
  padding: 16px;
}

.tab-header {
  margin-bottom: 16px;
}

.query-form {
  margin-bottom: 16px;
}

.calendar-cell {
  height: 100%;
  padding: 4px;
}

.date-label {
  font-size: 14px;
  margin-bottom: 4px;
}

.schedule-info {
  font-size: 12px;
}
</style>
