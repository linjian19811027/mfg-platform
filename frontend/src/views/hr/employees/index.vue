<template>
  <div class="page-container">
    <a-card :bordered="false">
      <!-- 搜索栏 -->
      <a-form :model="searchForm" layout="inline" class="search-form" @keyup.enter="handleSearch">
        <a-form-item :label="$t('hr.employees.index.工号姓名')">
          <a-input v-model="searchForm.keyword" :placeholder="$t('hr.employees.index.请输入工号或姓名')" allow-clear style="width: 200px" />
        </a-form-item>
        <a-form-item :label="$t('hr.employees.index.工种')">
          <a-input v-model="searchForm.jobType" :placeholder="$t('hr.employees.index.请输入工种')" allow-clear style="width: 150px" />
        </a-form-item>
        <a-form-item :label="$t('hr.employees.index.工作中心')">
          <a-input v-model="searchForm.workCenter" :placeholder="$t('hr.employees.index.请输入工作中心')" allow-clear style="width: 150px" />
        </a-form-item>
        <a-form-item :label="$t('common.status')">
          <a-select v-model="searchForm.status" :placeholder="$t('hr.employees.index.全部')" allow-clear style="width: 120px">
            <a-option value="ACTIVE">在职</a-option>
            <a-option value="INACTIVE">离职</a-option>
            <a-option value="SUSPENDED">停职</a-option>
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
            新建员工
          </a-button>
          <a-button @click="handleExport" :loading="exportLoading">
            <template #icon><icon-download /></template>
            导出花名册
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
          <a-tag v-if="record.status === 'ACTIVE'" color="green">在职</a-tag>
          <a-tag v-else-if="record.status === 'INACTIVE'" color="gray">离职</a-tag>
          <a-tag v-else-if="record.status === 'SUSPENDED'" color="orange">停职</a-tag>
        </template>
        <template #action="{ record }">
          <a-space>
            <a-button type="text" size="small" @click="handleView(record)">详情</a-button>
            <a-button type="text" size="small" @click="handleEdit(record)">编辑</a-button>
            <a-dropdown>
              <a-button type="text" size="small">
                更多<icon-down />
              </a-button>
              <template #content>
                <a-doption @click="handleStatusChange(record)">变更状态</a-doption>
                <a-doption @click="handleDelete(record)" style="color: var(--color-danger)">删除</a-doption>
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
          <a-input v-model="formData.jobType" :placeholder="$t('hr.employees.index.请输入工种')" />
        </a-form-item>
        <a-form-item :label="$t('hr.employees.index.工作中心')" field="workCenter">
          <a-input v-model="formData.workCenter" :placeholder="$t('hr.employees.index.请输入工作中心')" />
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
            <a-option value="ACTIVE">在职</a-option>
            <a-option value="INACTIVE">离职</a-option>
            <a-option value="SUSPENDED">停职</a-option>
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
import { getEmployees, createEmployee, updateEmployee, updateEmployeeStatus, deleteEmployee, exportEmployees } from '@/api/hr'
import { useRouter } from 'vue-router'

const router = useRouter()

const searchForm = reactive({
  keyword: '',
  jobType: '',
  workCenter: '',
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
const modalTitle = ref('新建员工')
const formRef = ref()
const formData = reactive({
  id: '',
  name: '',
  jobType: '',
  workCenter: '',
  hireDate: '',
  phone: '',
  email: '',
})

const formRules = {
  name: [{ required: true, message: '请输入姓名' }],
  jobType: [{ required: true, message: '请输入工种' }],
  workCenter: [{ required: true, message: '请输入工作中心' }],
}

const statusModalVisible = ref(false)
const statusForm = reactive({
  id: '',
  status: 'ACTIVE',
  terminationDate: '',
})

onMounted(() => {
  fetchData()
})

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
    Message.error(error.message || '加载失败')
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
    workCenter: '',
    status: undefined,
  })
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

function handleCreate() {
  modalTitle.value = '新建员工'
  Object.assign(formData, {
    id: '',
    name: '',
    jobType: '',
    workCenter: '',
    hireDate: '',
    phone: '',
    email: '',
  })
  modalVisible.value = true
}

function handleEdit(record: any) {
  modalTitle.value = '编辑员工'
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
      Message.success('更新成功')
    } else {
      await createEmployee(formData)
      Message.success('创建成功')
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
    Message.success('状态变更成功')
    statusModalVisible.value = false
    fetchData()
  } catch (error: any) {
    Message.error(error.message || '操作失败')
  }
}

function handleDelete(record: any) {
  Modal.confirm({
    title: t('hr.employees.index.确认删除'),
    content: `确定要删除员工 ${record.name} 吗？此操作不可恢复。`,
    onOk: async () => {
      try {
        await deleteEmployee(record.id)
        Message.success('删除成功')
        fetchData()
      } catch (error: any) {
        Message.error(error.message || '删除失败')
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
    a.download = `员工花名册_${new Date().getTime()}.xlsx`
    a.click()
    window.URL.revokeObjectURL(url)
    Message.success('导出成功')
  } catch (error: any) {
    Message.error(error.message || '导出失败')
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
