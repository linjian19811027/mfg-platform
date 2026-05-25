<template>
  <div class="page-container">
    <a-card :bordered="false">
      <!-- 搜索栏 -->
      <a-form :model="searchForm" layout="inline" class="search-form" @keyup.enter="handleSearch">
        <a-form-item :label="$t('traceability.batches.index.追溯码')">
          <a-input
            v-model="searchForm.traceCode"
            :placeholder="$t('traceability.batches.index.扫码或输入追溯码')"
            allow-clear
            style="width: 250px"
            @pressEnter="handleSearch"
          />
        </a-form-item>
        <a-form-item :label="$t('traceability.batches.index.物料编码')">
          <a-input v-model="searchForm.materialCode" :placeholder="$t('traceability.batches.index.请输入物料编码')" allow-clear style="width: 180px" />
        </a-form-item>
        <a-form-item :label="$t('traceability.batches.index.批次号')">
          <a-input v-model="searchForm.batchNo" :placeholder="$t('traceability.batches.index.请输入批次号')" allow-clear style="width: 150px" />
        </a-form-item>
        <a-form-item :label="$t('traceability.batches.index.检验状态')">
          <a-select v-model="searchForm.inspectionStatus" :placeholder="$t('traceability.batches.index.全部')" allow-clear style="width: 120px">
            <a-option value="PASSED">{{ $t('traceability.batches.qualified') }}</a-option>
            <a-option value="FAILED">{{ $t('traceability.batches.unqualified') }}</a-option>
            <a-option value="PENDING">{{ $t('traceability.batches.uninspected') }}</a-option>
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
          <a-button type="primary" @click="handleManualCreate">
            <template #icon><icon-plus /></template>
            {{ $t('traceability.batches.manualEntry') }}
          </a-button>
          <a-button @click="handleExport" :loading="exportLoading">
            <template #icon><icon-download /></template>
            {{ $t('traceability.batches.exportExcel') }}
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
        <template #traceCode="{ record }">
          <a-link @click="handleView(record)">{{ record.traceCode }}</a-link>
        </template>
        <template #inspectionStatus="{ record }">
          <a-tag v-if="record.inspectionStatus === 'PASSED'" color="green">{{ $t('traceability.batches.qualified') }}</a-tag>
          <a-tag v-else-if="record.inspectionStatus === 'FAILED'" color="red">{{ $t('traceability.batches.unqualified') }}</a-tag>
          <a-tag v-else-if="record.inspectionStatus === 'PENDING'" color="orange">{{ $t('traceability.batches.uninspected') }}</a-tag>
        </template>
        <template #inventoryStatus="{ record }">
          <a-tag v-if="record.inventoryStatus === 'IN_STOCK'" color="blue">{{ $t('traceability.batches.lbl1821') }}</a-tag>
          <a-tag v-else-if="record.inventoryStatus === 'SHIPPED'" color="gray">{{ $t('traceability.batches.lbl1822') }}</a-tag>
          <a-tag v-else-if="record.inventoryStatus === 'CONSUMED'" color="purple">{{ $t('traceability.batches.lbl1823') }}</a-tag>
          <a-tag v-else-if="record.inventoryStatus === 'FROZEN'" color="red">{{ $t('traceability.batches.lbl1824') }}</a-tag>
        </template>
        <template #isFrozen="{ record }">
          <a-tag v-if="record.isFrozen" color="red">{{ $t('traceability.batches.r33088') }}</a-tag>
          <span v-else>{{ $t('traceability.batches.r33089') }}</span>
        </template>
        <template #action="{ record }">
          <a-space>
            <a-button type="text" size="small" @click="handleView(record)">{{ $t('traceability.batches.detail') }}</a-button>
            <a-button type="text" size="small" @click="handleForwardTrace(record)">{{ $t('traceability.batches.lbl1825') }}</a-button>
            <a-button type="text" size="small" @click="handleBackwardTrace(record)">{{ $t('traceability.batches.lbl1826') }}</a-button>
          </a-space>
        </template>
      </a-table>
    </a-card>

    <!-- 手动补录弹窗 -->
    <a-modal
      v-model:visible="modalVisible"
      :title="$t('traceability.batches.index.手动补录追溯批次')"
      width="700px"
      @ok="handleSubmit"
      @cancel="handleCancel"
    >
      <a-form :model="formData" :rules="formRules" ref="formRef" layout="vertical">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item :label="$t('traceability.batches.index.物料编码')" field="materialCode">
              <a-input v-model="formData.materialCode" :placeholder="$t('traceability.batches.index.请输入物料编码')" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="$t('traceability.batches.index.物料名称')" field="materialName">
              <a-input v-model="formData.materialName" :placeholder="$t('traceability.batches.index.请输入物料名称')" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item :label="$t('traceability.batches.index.批次号')" field="batchNo">
              <a-input v-model="formData.batchNo" :placeholder="$t('traceability.batches.index.请输入批次号')" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="$t('traceability.batches.index.实际数量')" field="actualQty">
              <a-input-number v-model="formData.actualQty" :placeholder="$t('traceability.batches.index.请输入数量')" style="width: 100%" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item :label="$t('traceability.batches.index.生产工单')">
          <a-input v-model="formData.mesWoId" :placeholder="$t('traceability.batches.index.请输入工单号可选')" />
        </a-form-item>
        <a-form-item :label="$t('traceability.batches.index.补录原因')" field="manualReason">
          <a-textarea v-model="formData.manualReason" :placeholder="$t('traceability.batches.index.请说明补录原因')" :rows="3" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
import { useI18n } from 'vue-i18n'
import { ref, reactive, onMounted } from 'vue'
import { Message } from '@arco-design/web-vue'
import { IconPlus, IconDownload } from '@arco-design/web-vue/es/icon'
import { getTraceBatches, manualCreateBatch, exportBatches } from '@/api/traceability'
import { useRouter } from 'vue-router'

const router = useRouter()

const searchForm = reactive({
  traceCode: '',
  materialCode: '',
  batchNo: '',
  inspectionStatus: undefined,
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
  { title: t('traceability.batches.index.追溯码'), dataIndex: 'traceCode', slotName: 'traceCode', width: 200 },
  { title: t('traceability.batches.index.物料编码'), dataIndex: 'materialCode', width: 150 },
  { title: t('traceability.batches.index.物料名称'), dataIndex: 'materialName', width: 180 },
  { title: t('traceability.batches.index.批次号'), dataIndex: 'batchNo', width: 150 },
  { title: t('traceability.batches.index.实际数量'), dataIndex: 'actualQty', width: 100 },
  { title: t('traceability.batches.index.检验状态'), dataIndex: 'inspectionStatus', slotName: 'inspectionStatus', width: 100 },
  { title: t('traceability.batches.index.库存状态'), dataIndex: 'inventoryStatus', slotName: 'inventoryStatus', width: 100 },
  { title: t('traceability.batches.index.是否冻结'), dataIndex: 'isFrozen', slotName: 'isFrozen', width: 90 },
{ title: t('traceability.batches.index.操作'), slotName: 'action', width: 260, fixed: 'right' as const },
]

const modalVisible = ref(false)
const formRef = ref()
const formData = reactive({
  materialCode: '',
  materialName: '',
  batchNo: '',
  actualQty: 0,
  mesWoId: '',
  manualReason: '',
})

const formRules = {
  materialCode: [{ required: true, message: t('traceability.batches.input') }],
  materialName: [{ required: true, message: t('traceability.batches.input2') }],
  batchNo: [{ required: true, message: t('traceability.batches.input3') }],
  actualQty: [{ required: true, message: t('traceability.batches.input4') }],
  manualReason: [{ required: true, message: t('traceability.batches.lbl1827') }],
}

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
    const res = await getTraceBatches(params)
    tableData.value = (res as any).list ?? (res as any).items ?? []
    pagination.total = (res as any).total ?? 0
  } catch (error: any) {
    Message.error(error.message || t('traceability.加载失败'))
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
    traceCode: '',
    materialCode: '',
    batchNo: '',
    inspectionStatus: undefined,
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

function handleManualCreate() {
  Object.assign(formData, {
    materialCode: '',
    materialName: '',
    batchNo: '',
    actualQty: 0,
    mesWoId: '',
    manualReason: '',
  })
  modalVisible.value = true
}

async function handleSubmit() {
  try {
    await formRef.value?.validate()
    await manualCreateBatch(formData)
    Message.success(t('traceability.补录成功'))
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

function handleView(record: any) {
  router.push(`/traceability/batches/${record.id}`)
}

function handleForwardTrace(record: any) {
  router.push(`/traceability/forward/${record.traceCode}`)
}

function handleBackwardTrace(record: any) {
  router.push(`/traceability/backward/${record.traceCode}`)
}

async function handleExport() {
  exportLoading.value = true
  try {
    const res = await exportBatches(searchForm)
    const blob = new Blob([new Uint8Array(res.data)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${t('traceability.batches.r33090')}_${new Date().getTime()}.xlsx`
    a.click()
    window.URL.revokeObjectURL(url)
    Message.success(t('traceability.导出成功'))
  } catch (error: any) {
    Message.error(error.message || t('traceability.导出失败'))
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
