<template>
  <div class="page-container">
    <a-page-header :title="$t('hr.employees.detail.员工详情')" @back="handleBack">
      <template #extra>
        <a-space>
          <a-button @click="handleEdit">{{ $t('common.edit') }}</a-button>
          <a-button type="primary" @click="handleStatusChange">{{ $t('hr.employees.index.变更员工状态') }}</a-button>
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
            <a-descriptions-item :label="$t('hr.employees.detail.工作中心')">{{ workCenterMap[employeeData.workCenterId] || employeeData.workCenterId || '-' }}</a-descriptions-item>
            <a-descriptions-item :label="$t('common.status')">
              <a-tag v-if="employeeData.status === 'ACTIVE'" color="green">{{ $t('common.status.onDuty') }}</a-tag>
              <a-tag v-else-if="employeeData.status === 'INACTIVE'" color="gray">{{ $t('common.status.inactive') }}</a-tag>
              <a-tag v-else-if="employeeData.status === 'SUSPENDED'" color="orange">{{ $t('common.status.suspended') }}</a-tag>
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
              {{ $t('hr.employees.detail.添加认证') }}
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
              <a-tag v-if="record.isExpired" color="red">{{ $t('hr.employees.detail.已过期') }}</a-tag>
              <a-tag v-else-if="record.isExpiringSoon" color="orange">{{ $t('hr.employees.detail.即将到期') }}</a-tag>
              <a-tag v-else color="green">{{ $t('hr.employees.detail.有效') }}</a-tag>
            </template>
            <template #action="{ record }">
              <a-space>
                <a-button type="text" size="small" @click="handleRenewCert(record)">{{ $t('hr.employees.detail.续期') }}</a-button>
                <a-popconfirm :content="$t('hr.employees.detail.确定删除此认证吗')" @ok="handleDeleteCert(record)">
                  <a-button type="text" size="small" status="danger">{{ $t('common.delete') }}</a-button>
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
                  <span>{{ $t('hr.employees.detail.总工时') }}: <strong>{{ workHourSummary.totalHours }}</strong> {{ $t('hr.employees.detail.小时') }}</span>
                  <span>{{ $t('hr.employees.detail.正常工时') }}: <strong>{{ workHourSummary.normalHours }}</strong> {{ $t('hr.employees.detail.小时') }}</span>
                  <span>{{ $t('hr.employees.detail.加班工时') }}: <strong>{{ workHourSummary.overtimeHours }}</strong> {{ $t('hr.employees.detail.小时') }}</span>
                </a-space>
              </div>
            </template>
          </a-table>
        </a-tab-pane>

        <!-- 履历记录 -->
        <a-tab-pane key="history" :title="t('hr.employees.detail.履历记录')">
          <EmployeeHistory :employee-id="employeeId" />
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
        <a-form-item :label="$t('hr.employees.detail.获得日期')" field="issueDate">
          <a-date-picker v-model="certForm.issueDate" style="width: 100%" />
        </a-form-item>
        <a-form-item :label="$t('hr.employees.detail.有效期至')" field="expireDate">
          <a-date-picker v-model="certForm.expireDate" style="width: 100%" />
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
      <a-form :model="renewForm" :rules="renewRules" ref="renewFormRef" layout="vertical">
        <a-form-item :label="$t('hr.employees.detail.新有效期至')" field="newExpiryDate">
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
  getWorkCenters,
} from '@/api/hr'
import { getSchedules, getWorkHourRecords } from '@/api/hr'
import EmployeeHistory from '@/views/hr/employee-history/index.vue'

const route = useRoute()
const router = useRouter()
const employeeId = route.params.id as string

const loading = ref(false)
const employeeData = ref<any>({})
const workCenterMap = ref<Record<number, string>>({})

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
  issueDate: '',
  expireDate: '',
})
const certRules = {
  certTypeId: [{ required: true, message: t('hr.employees.detail.请选择认证类型') }],
  certNo: [{ required: true, message: t('hr.employees.detail.请输入证书编号') }],
  issueDate: [{ required: true, message: t('hr.employees.detail.请选择获得日期') }],
  expireDate: [{ required: true, message: t('hr.employees.detail.请选择有效期') }],
}

const renewRules = {
  newExpiryDate: [{ required: true, message: t('hr.employees.detail.请选择新有效期') }],
}

const renewModalVisible = ref(false)
const renewForm = reactive({
  id: '',
  newExpiryDate: '',
})
const renewFormRef = ref()

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
    // 加载工作中心映射
    try {
      const wcRes = await getWorkCenters()
      const wcList = (wcRes as any).list ?? (wcRes as any).data ?? wcRes ?? []
      const map: Record<number, string> = {}
      wcList.forEach((item: any) => {
        if (item.id != null) map[item.id] = item.name || item.workCenterName || ''
      })
      workCenterMap.value = map
    } catch {
      // 工作中心加载失败不影响主数据
    }
    const res = await getEmployee(employeeId)
    employeeData.value = res
  } catch (error: any) {
    Message.error(error.message || t('common.msg.loadDataFail'))
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
    Message.error(error.message || t('common.msg.loadCertFail'))
  } finally {
    certLoading.value = false
  }
}

async function fetchCertTypes() {
  try {
    const res = await getCertificationTypes()
    certTypes.value = (res as any).list ?? (res as any).data ?? res ?? []
  } catch (error: any) {
    Message.error(error.message || t('common.msg.loadCertTypeFail'))
  }
}

async function fetchSchedules() {
  try {
    const year = calendarDate.value.getFullYear()
    const month = calendarDate.value.getMonth() + 1
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`
    const res = await getSchedules({
      empId: Number(employeeId),
      startDate,
      endDate,
    })
    schedules.value = (res as any).list ?? (res as any).items ?? []
  } catch (error: any) {
    Message.error(error.message || t('common.msg.loadScheduleFail'))
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
    Message.error(error.message || t('common.msg.loadWorkHoursFail'))
  } finally {
    workHourLoading.value = false
  }
}

function handleBack() {
  router.back()
}

function handleEdit() {
  // 跳转到编辑页面或打开编辑弹窗
  Message.info(t('common.msg.featurePending', { feature: t('common.edit') }))
}

function handleStatusChange() {
  Message.info(t('common.msg.featurePending', { feature: t('hr.employees.index.变更员工状态') }))
}

function handleAddCertification() {
  Object.assign(certForm, {
    certTypeId: '',
    certNo: '',
    issueDate: '',
    expireDate: '',
  })
  certModalVisible.value = true
}

async function handleCertSubmit() {
  try {
    await certFormRef.value?.validate()
    await addCertification({
      empId: Number(employeeId),
      ...certForm,
    } as any)
    Message.success(t('common.msg.addSuccess'))
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
    await renewFormRef.value?.validate()
    await renewCertification(renewForm.id, { expireDate: renewForm.newExpiryDate })
    Message.success(t('common.msg.renewSuccess'))
    renewModalVisible.value = false
    fetchCertifications()
  } catch (error: any) {
    Message.error(error.message || t('common.msg.renewFail'))
  }
}

async function handleDeleteCert(record: any) {
  try {
    await deleteCertification(record.id)
    Message.success(t('common.msg.deleteSuccess'))
    fetchCertifications()
  } catch (error: any) {
    Message.error(error.message || t('common.msg.deleteFail'))
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
