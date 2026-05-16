<template>
  <div class="page-container">
    <a-card :bordered="false">
      <!-- 搜索栏 -->
      <a-form :model="searchForm" layout="inline" class="search-form" @keyup.enter="handleSearch">
        <a-form-item :label="$t('hr.employees.index.工号姓名')">
          <a-input v-model="searchForm.keyword" :placeholder="$t('hr.employees.index.请输入工号或姓名')" allow-clear style="width: 200px" />
        </a-form-item>
        <a-form-item :label="$t('hr.employees.index.工种')">
          <a-select v-model="searchForm.jobType" :placeholder="$t('hr.employees.index.请选择工种')" allow-clear style="width: 150px">
            <a-option v-for="jt in jobTypeOptions" :key="jt.value" :value="jt.value" :label="jt.label" />
          </a-select>
        </a-form-item>
        <a-form-item :label="$t('hr.employees.index.工作中心')">
          <a-select v-model="searchForm.workCenterId" :placeholder="$t('hr.employees.index.请选择工作中心')" allow-clear style="width: 150px">
            <a-option v-for="wc in workCenterOptions" :key="wc.value" :value="wc.value" :label="wc.label" />
          </a-select>
        </a-form-item>
        <a-form-item :label="$t('common.status')">
          <a-select v-model="searchForm.status" :placeholder="$t('hr.employees.index.全部')" allow-clear style="width: 120px">
            <a-option value="ACTIVE">{{ $t('common.status.onDuty') }}</a-option>
            <a-option value="INACTIVE">{{ $t('common.status.inactive') }}</a-option>
            <a-option value="SUSPENDED">{{ $t('common.status.suspended') }}</a-option>
          </a-select>
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" @click="handleSearch">{{ $t('common.search') }}</a-button>
            <a-button @click="handleReset">{{ $t('common.reset') }}</a-button>
          </a-space>
        </a-form-item>
      </a-form>

      <!-- 操作按钮 -->
      <div class="action-bar">
        <a-space>
          <a-button type="primary" @click="handleCreate">
            <template #icon><icon-plus /></template>
            {{ $t('hr.employees.action.create') }}
          </a-button>
          <a-button @click="handleExport" :loading="exportLoading">
            <template #icon><icon-download /></template>
            {{ $t('hr.employees.action.export') }}
          </a-button>
        </a-space>
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
        <template #status="{ record }">
          <a-tag v-if="record.status === 'ACTIVE'" color="green">{{ $t('common.status.onDuty') }}</a-tag>
          <a-tag v-else-if="record.status === 'INACTIVE'" color="gray">{{ $t('common.status.inactive') }}</a-tag>
          <a-tag v-else-if="record.status === 'SUSPENDED'" color="orange">{{ $t('common.status.suspended') }}</a-tag>
        </template>
        <template #action="{ record }">
          <a-space>
            <a-button type="text" size="small" @click="handleView(record)">{{ $t('hr.employees.index.详情') }}</a-button>
            <a-button type="text" size="small" @click="handleEdit(record)">{{ $t('hr.employees.index.编辑') }}</a-button>
            <a-dropdown>
              <a-button type="text" size="small">
                {{ $t('hr.employees.index.更多') }}<icon-down />
              </a-button>
              <template #content>
                <a-doption @click="handleStatusChange(record)">{{ $t('hr.employees.index.变更状态') }}</a-doption>
                <a-doption @click="handleDelete(record)" style="color: var(--color-danger)">{{ $t('common.delete') }}</a-doption>
              </template>
            </a-dropdown>
          </a-space>
        </template>
      </a-table>
    </a-card>

    <!-- 新建/编辑弹窗 -->
    <a-modal
      v-model:visible="modalVisible"
      :title="modalTitle"
      width="600px"
      @ok="handleSubmit"
      @cancel="handleCancel"
    >
      <a-form :model="formData" :rules="formRules" ref="formRef" layout="vertical">
        <a-form-item :label="$t('hr.employees.index.姓名')" field="name">
          <a-input v-model="formData.name" :placeholder="$t('hr.employees.index.请输入姓名')" />
        </a-form-item>
        <a-form-item :label="$t('hr.employees.index.工种')" field="jobType">
          <a-select v-model="formData.jobType" :placeholder="$t('hr.employees.index.请选择工种')">
            <a-option v-for="jt in jobTypeOptions" :key="jt.value" :value="jt.value" :label="jt.label" />
          </a-select>
        </a-form-item>
        <a-form-item :label="$t('hr.employees.index.工作中心')" field="workCenterId">
          <a-select v-model="formData.workCenterId" :placeholder="$t('hr.employees.index.请选择工作中心')">
            <a-option v-for="wc in workCenterOptions" :key="wc.value" :value="wc.value" :label="wc.label" />
          </a-select>
        </a-form-item>
        <a-form-item :label="$t('hr.employees.index.入职日期')" field="hireDate">
          <a-date-picker v-model="formData.hireDate" style="width: 100%" />
        </a-form-item>
        <a-form-item :label="$t('hr.employees.index.联系电话')" field="phone">
          <a-input v-model="formData.phone" :placeholder="$t('hr.employees.index.请输入联系电话')" />
        </a-form-item>
        <a-form-item :label="$t('hr.employees.index.邮箱')" field="email">
          <a-input v-model="formData.email" :placeholder="$t('hr.employees.index.请输入邮箱')" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 状态变更弹窗 -->
    <a-modal
      v-model:visible="statusModalVisible"
      :title="$t('hr.employees.index.变更员工状态')"
      @ok="handleStatusSubmit"
      @cancel="statusModalVisible = false"
    >
      <a-form :model="statusForm" layout="vertical">
        <a-form-item :label="$t('hr.employees.index.新状态')">
          <a-select v-model="statusForm.status">
            <a-option value="ACTIVE">{{ $t('common.status.onDuty') }}</a-option>
            <a-option value="INACTIVE">{{ $t('common.status.inactive') }}</a-option>
            <a-option value="SUSPENDED">{{ $t('common.status.suspended') }}</a-option>
          </a-select>
        </a-form-item>
        <a-form-item v-if="statusForm.status === 'INACTIVE'" :label="$t('hr.employees.index.离职日期')">
          <a-date-picker v-model="statusForm.terminationDate" style="width: 100%" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
import { useI18n } from 'vue-i18n'
import { ref, reactive, onMounted } from 'vue'
import { Message, Modal } from '@arco-design/web-vue'
import { IconPlus, IconDownload, IconDown } from '@arco-design/web-vue/es/icon'
import { getEmployees, createEmployee, updateEmployee, updateEmployeeStatus, deleteEmployee, exportEmployees, getJobTypes, getWorkCenters } from '@/api/hr'
import { useRouter } from 'vue-router'

const router = useRouter()

const searchForm = reactive({
  keyword: '',
  jobType: '',
  workCenterId: undefined,
  status: undefined,
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

const jobTypeOptions = ref<{ value: string; label: string }[]>([])
const workCenterOptions = ref<{ value: number; label: string }[]>([])

const columns = [
  { title: t('hr.employees.index.工号'), dataIndex: 'employeeNo', width: 120 },
  { title: t('hr.employees.index.姓名'), dataIndex: 'name', width: 100 },
  { title: t('hr.employees.index.工种'), dataIndex: 'jobType', width: 120 },
  { title: t('hr.employees.index.工作中心'), dataIndex: 'workCenter', width: 120 },
  { title: t('hr.employees.index.状态'), dataIndex: 'status', slotName: 'status', width: 80 },
  { title: t('hr.employees.index.入职日期'), dataIndex: 'hireDate', width: 120 },
  { title: t('hr.employees.index.联系电话'), dataIndex: 'phone', width: 130 },
  { title: t('hr.employees.index.操作'), slotName: 'action', width: 180, fixed: 'right' },
]

const modalVisible = ref(false)
const modalTitle = ref(t('hr.employees.index.新建员工'))
const formRef = ref()
const formData = reactive({
  id: '',
  empNo: '',
  name: '',
  jobType: '',
  workCenterId: undefined,
  hireDate: new Date().toISOString().split('T')[0],
  phone: '',
  email: '',
})

const formRules = {
  name: [{ required: true, message: t('hr.employees.index.请输入姓名') }],
  jobType: [{ required: true, message: t('hr.employees.index.请选择工种') }],
  workCenterId: [{ required: true, message: t('hr.employees.index.请选择工作中心') }],
}

const statusModalVisible = ref(false)
const statusForm = reactive({
  id: '',
  status: 'ACTIVE',
  terminationDate: '',
})

onMounted(() => {
  fetchData()
  fetchOptions()
})

async function fetchOptions() {
  try {
    const jtRes = await getJobTypes()
    const jtList = (jtRes as any).list ?? (jtRes as any).data ?? jtRes ?? []
    jobTypeOptions.value = jtList.map((item: any) => ({ value: item.name, label: item.name }))
    const wcRes = await getWorkCenters()
    const wcList = (wcRes as any).list ?? (wcRes as any).data ?? wcRes ?? []
    workCenterOptions.value = wcList.map((item: any) => ({ value: item.id, label: item.name }))
  } catch {
    // 下拉选项加载失败不影响主列表
  }
}

async function fetchData() {
  loading.value = true
  try {
    const params = {
      ...searchForm,
      page: pagination.current,
      pageSize: pagination.pageSize,
    }
    const res = await getEmployees(params)
    tableData.value = (res as any).list ?? (res as any).items ?? []
    pagination.total = (res as any).total ?? 0
  } catch (error: any) {
    Message.error(error.message || t('hr.employees.index.加载失败'))
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  pagination.current = 1
  fetchData()
}

function handleReset() {
  Object.assign(searchForm, {
    keyword: '',
    jobType: '',
    workCenterId: undefined,
    status: undefined,
  })
  handleSearch()
}

function handlePageChange(page: number) {
  pagination.current = page
  fetchData()
}

function handleCreate() {
  modalTitle.value = t('hr.employees.index.新建员工')
  Object.assign(formData, {
    id: '',
    empNo: '',
    name: '',
    jobType: '',
    workCenterId: undefined,
    hireDate: new Date().toISOString().split('T')[0],
    phone: '',
    email: '',
  })
  modalVisible.value = true
}

function handlePageSizeChange(pageSize: number) {
  pagination.pageSize = pageSize
  pagination.current = 1
  fetchData()
}

function handleEdit(record: any) {
  modalTitle.value = t('hr.employees.index.编辑员工')
  Object.assign(formData, record)
  modalVisible.value = true
}

function handleView(record: any) {
  router.push(`/hr/employees/${record.id}`)
}

async function handleSubmit() {
  try {
    await formRef.value?.validate()
    if (formData.id) {
      await updateEmployee(formData.id, formData)
      Message.success(t('common.msg.updateSuccess'))
    } else {
      await createEmployee(formData)
      Message.success(t('common.msg.createSuccess'))
    }
    modalVisible.value = false
    fetchData()
  } catch (error: any) {
    if (error.message) {
      Message.error(error.message)
    }
  }
}

function handleCancel() {
  modalVisible.value = false
  formRef.value?.clearValidate()
}

function handleStatusChange(record: any) {
  Object.assign(statusForm, {
    id: record.id,
    status: record.status,
    terminationDate: '',
  })
  statusModalVisible.value = true
}

async function handleStatusSubmit() {
  try {
    await updateEmployeeStatus(statusForm.id, statusForm.status)
    Message.success(t('common.msg.statusChangeSuccess'))
    statusModalVisible.value = false
    fetchData()
  } catch (error: any) {
    Message.error(error.message || t('common.msg.operationFail'))
  }
}

function handleDelete(record: any) {
  Modal.confirm({
    title: t('hr.employees.index.确认删除'),
    content: t('common.msg.confirmDeleteEmployee', { name: record.name }),
    onOk: async () => {
      try {
        await deleteEmployee(record.id)
        Message.success(t('common.msg.deleteSuccess'))
        fetchData()
      } catch (error: any) {
        Message.error(error.message || t('common.msg.deleteFail'))
      }
    },
  })
}

async function handleExport() {
  exportLoading.value = true
  try {
    const res = await exportEmployees(searchForm)
    const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${t('hr.employees.index.导出文件名')}_${new Date().getTime()}.xlsx`
    a.click()
    window.URL.revokeObjectURL(url)
    Message.success(t('hr.employees.index.导出成功'))
  } catch (error: any) {
    Message.error(error.message || t('hr.employees.index.导出失败'))
  } finally {
    exportLoading.value = false
  }
}
</script>

<style scoped>
.page-container {
  padding: 16px;
}

.search-form {
  margin-bottom: 16px;
}

.action-bar {
  margin-bottom: 16px;
}
</style>
