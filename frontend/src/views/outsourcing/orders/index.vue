<template>
  <div class="page-container">
    <!-- 看板卡片 -->
    <a-row :gutter="16" style="margin-bottom: 16px" v-if="dashboard">
      <a-col :span="4" v-for="item in dashboardCards" :key="item.key">
        <a-card :bordered="false" size="small">
          <a-statistic :title="item.label" :value="dashboard[item.key] ?? 0"
            :value-style="item.color ? { color: item.color } : {}" />
        </a-card>
      </a-col>
    </a-row>

    <a-card :bordered="false">
      <!-- 搜索栏 -->
      <a-form :model="searchForm" layout="inline" class="search-form" @keyup.enter="handleSearch">
        <a-form-item :label="$t('common.status')">
          <a-select v-model="searchForm.status" :placeholder="$t('outsourcing.orders.index.全部')" allow-clear style="width: 120px">
            <a-option value="DRAFT">草稿</a-option>
            <a-option value="CONFIRMED">已确认</a-option>
            <a-option value="ISSUED">已发料</a-option>
            <a-option value="RECEIPTED">已收货</a-option>
            <a-option value="SETTLED">已结算</a-option>
            <a-option value="CANCELLED">已取消</a-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="$t('outsourcing.orders.index.供应商')">
          <a-input v-model="searchForm.supplierId" :placeholder="$t('outsourcing.orders.index.供应商ID')" allow-clear style="width: 150px" />
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
        <a-space>
          <a-button type="primary" @click="handleCreate">
            <template #icon><icon-plus /></template>
            新建外协工单
          </a-button>
          <a-button @click="handleExport" :loading="exportLoading">
            <template #icon><icon-download /></template>
            导出
          </a-button>
        </a-space>
      </div>

      <a-table :columns="columns" :data="tableData" :loading="loading"
        :pagination="pagination" @page-change="handlePageChange" row-key="id"
        :row-class="rowClass">
        <template #ocNo="{ record }">
          <a-link @click="handleView(record)">{{ record.ocNo }}</a-link>
        </template>
        <template #status="{ record }">
          <a-tag :color="statusColor(record.status)">{{ statusLabel(record.status) }}</a-tag>
        </template>
        <template #isOverdue="{ record }">
          <a-tag v-if="record.isOverdue" color="red">逾期</a-tag>
          <a-tag v-else-if="record.isDueSoon" color="orange">即将到期</a-tag>
          <span v-else>-</span>
        </template>
        <template #action="{ record }">
          <a-space>
            <a-button type="text" size="small" @click="handleView(record)">详情</a-button>
            <a-button v-if="record.status === 'DRAFT'" type="text" size="small"
              @click="handleConfirm(record)">确认</a-button>
            <a-popconfirm v-if="['DRAFT','CONFIRMED'].includes(record.status)"
              :content="$t('outsourcing.orders.index.确定取消此外协工单')" @ok="handleCancel(record)">
              <a-button type="text" size="small" status="danger">{{ $t('common.cancel') }}</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </a-table>
    </a-card>

    <!-- 新建弹窗 -->
    <a-modal v-model:visible="createVisible" :title="$t('outsourcing.orders.index.新建外协工单')" width="600px"
      :ok-loading="submitLoading" @ok="handleSubmit" @cancel="createVisible = false">
      <a-form :model="createForm" :rules="createRules" ref="createFormRef" layout="vertical">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item :label="$t('outsourcing.orders.index.供应商ID')" field="supplierId">
              <a-input v-model="createForm.supplierId" :placeholder="$t('outsourcing.orders.index.请输入供应商ID')" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="$t('outsourcing.orders.index.工序名称')" field="processName">
              <a-input v-model="createForm.processName" :placeholder="$t('outsourcing.orders.index.请输入工序名称')" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item :label="$t('outsourcing.orders.index.物料ID')" field="materialId">
              <a-input v-model="createForm.materialId" :placeholder="$t('outsourcing.orders.index.请输入物料ID')" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="$t('outsourcing.orders.index.计划数量')" field="plannedQty">
              <a-input-number v-model="createForm.plannedQty" :min="0.01" style="width: 100%" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item :label="$t('outsourcing.orders.index.计划交期')" field="plannedDeliveryDate">
              <a-date-picker v-model="createForm.plannedDeliveryDate" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="$t('outsourcing.orders.index.单价')">
              <a-input-number v-model="createForm.unitPrice" :min="0" style="width: 100%" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item :label="$t('outsourcing.orders.index.关联MES工单ID')">
          <a-input v-model="createForm.mesWoId" :placeholder="$t('outsourcing.orders.index.可选')" />
        </a-form-item>
        <a-form-item :label="$t('common.remark')">
          <a-textarea v-model="createForm.remark" :rows="2" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
import { useI18n } from 'vue-i18n'
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Message } from '@arco-design/web-vue'
import { IconPlus, IconDownload } from '@arco-design/web-vue/es/icon'
import {
  getOutsourcingOrders, getOutsourcingDashboard, createOutsourcingOrder,
  confirmOutsourcingOrder, cancelOutsourcingOrder, exportOutsourcingOrders,
} from '@/api/outsourcing'

const router = useRouter()
const loading = ref(false)
const exportLoading = ref(false)
const tableData = ref([])
const pagination = reactive({ current: 1, pageSize: 20, total: 0, showTotal: true })
const dashboard = ref<any>(null)
const searchForm = reactive({ status: undefined as string | undefined, supplierId: '' })

const dashboardCards = [
  { key: 'draftCount', label: '草稿' },
  { key: 'confirmedCount', label: '已确认' },
  { key: 'issuedCount', label: '已发料' },
  { key: 'overdueCount', label: '逾期', color: '#f53f3f' },
  { key: 'dueSoonCount', label: '即将到期', color: '#ff7d00' },
  { key: 'monthSettlementAmount', label: '本月结算金额' },
]

const columns = [
  { title: t('outsourcing.orders.index.工单编号'), dataIndex: 'ocNo', slotName: 'ocNo', width: 160 },
  { title: t('outsourcing.orders.index.供应商'), dataIndex: 'supplierName', width: 140 },
  { title: t('outsourcing.orders.index.工序'), dataIndex: 'processName', width: 120 },
  { title: t('outsourcing.orders.index.计划数量'), dataIndex: 'plannedQty', width: 100 },
  { title: t('outsourcing.orders.index.已收货'), dataIndex: 'receivedQty', width: 90 },
  { title: t('outsourcing.orders.index.状态'), dataIndex: 'status', slotName: 'status', width: 90 },
  { title: t('outsourcing.orders.index.计划交期'), dataIndex: 'plannedDeliveryDate', width: 120 },
  { title: t('outsourcing.orders.index.逾期'), dataIndex: 'isOverdue', slotName: 'isOverdue', width: 90 },
  { title: t('outsourcing.orders.index.操作'), slotName: 'action', width: 180, fixed: 'right' },
]

const createVisible = ref(false)
const submitLoading = ref(false)
const createFormRef = ref()
const createForm = reactive({
  supplierId: '', processName: '', materialId: '', plannedQty: 1,
  plannedDeliveryDate: '', unitPrice: 0, mesWoId: '', remark: '',
})
const createRules = {
  supplierId: [{ required: true, message: '请输入供应商ID' }],
  processName: [{ required: true, message: '请输入工序名称' }],
  materialId: [{ required: true, message: '请输入物料ID' }],
  plannedQty: [{ required: true, message: '请输入计划数量' }],
  plannedDeliveryDate: [{ required: true, message: '请选择计划交期' }],
}

onMounted(() => { fetchDashboard(); fetchData() })

async function fetchDashboard() {
  try { const res = await getOutsourcingDashboard(); dashboard.value = res }
  catch {}
}

async function fetchData() {
  loading.value = true
  try {
    const res = await getOutsourcingOrders({ ...searchForm, page: pagination.current, pageSize: pagination.pageSize })
    tableData.value = (res as any).list ?? (res as any).items ?? []
    pagination.total = (res as any).total ?? 0
  } catch (e: any) { Message.error(e.message || '加载失败') }
  finally { loading.value = false }
}

function handleSearch() { pagination.current = 1; fetchData() }
function handleReset() { Object.assign(searchForm, { status: undefined, supplierId: '' }); handleSearch() }
function handlePageChange(page: number) { pagination.current = page; fetchData() }
function handleView(record: any) { router.push(`/outsourcing/orders/${record.id}`) }

function handleCreate() {
  Object.assign(createForm, { supplierId: '', processName: '', materialId: '', plannedQty: 1, plannedDeliveryDate: '', unitPrice: 0, mesWoId: '', remark: '' })
  createVisible.value = true
}

async function handleSubmit() {
  try {
    await createFormRef.value?.validate()
    submitLoading.value = true
    await createOutsourcingOrder(createForm)
    Message.success('创建成功')
    createVisible.value = false
    fetchData()
  } catch (e: any) { if (e.message) Message.error(e.message) }
  finally { submitLoading.value = false }
}

async function handleConfirm(record: any) {
  try { await confirmOutsourcingOrder(record.id); Message.success('确认成功'); fetchData() }
  catch (e: any) { Message.error(e.message || '操作失败') }
}

async function handleCancel(record: any) {
  try { await cancelOutsourcingOrder(record.id, {}); Message.success('取消成功'); fetchData() }
  catch (e: any) { Message.error(e.message || '操作失败') }
}

async function handleExport() {
  exportLoading.value = true
  try {
    const res = await exportOutsourcingOrders(searchForm)
    const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `外协工单_${Date.now()}.xlsx`; a.click()
    window.URL.revokeObjectURL(url)
    Message.success('导出成功')
  } catch (e: any) { Message.error(e.message || '导出失败') }
  finally { exportLoading.value = false }
}

function statusLabel(s: string) {
  const m: Record<string, string> = { DRAFT: '草稿', CONFIRMED: '已确认', ISSUED: '已发料', RECEIPTED: '已收货', SETTLED: '已结算', CANCELLED: '已取消' }
  return m[s] ?? s
}
function statusColor(s: string) {
  const m: Record<string, string> = { DRAFT: 'gray', CONFIRMED: 'blue', ISSUED: 'orange', RECEIPTED: 'cyan', SETTLED: 'green', CANCELLED: 'red' }
  return m[s] ?? 'gray'
}
function rowClass(record: any) {
  if (record.isOverdue) return 'row-overdue'
  if (record.isDueSoon) return 'row-due-soon'
  return ''
}
</script>

<style scoped>
.page-container { padding: 16px; }
.search-form { margin-bottom: 16px; }
.action-bar { margin-bottom: 16px; }
:deep(.row-overdue td) { background: #fff1f0 !important; }
:deep(.row-due-soon td) { background: #fff7e6 !important; }
</style>
