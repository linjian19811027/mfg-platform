<template>
  <div class="page-container">
    <a-card :bordered="false">
      <a-form :model="searchForm" layout="inline" class="search-form" @keyup.enter="handleSearch">
        <a-form-item :label="$t('plm.ecn-execution-plans.ECN编号')">
          <a-input v-model="searchForm.ecnNo" :placeholder="$t('plm.ecn-execution-plans.请输入ECN编号')" allow-clear style="width: 180px" />
        </a-form-item>
        <a-form-item :label="$t('common.status')">
          <a-select v-model="searchForm.status" :placeholder="$t('plm.ecn-execution-plans.全部')" allow-clear style="width: 130px">
            <a-option value="PENDING">待执行</a-option>
            <a-option value="IN_PROGRESS">执行中</a-option>
            <a-option value="COMPLETED">已完成</a-option>
            <a-option value="FAILED">失败</a-option>
            <a-option value="CANCELLED">已取消</a-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="$t('plm.ecn-execution-plans.生效日期')">
          <a-range-picker v-model="searchForm.dateRange" style="width: 240px" />
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" @click="handleSearch">{{ $t('common.search') }}</a-button>
            <a-button @click="handleReset">{{ $t('common.reset') }}</a-button>
          </a-space>
        </a-form-item>
      </a-form>

      <a-table :columns="columns" :data="tableData" :loading="loading"
        :pagination="pagination" @page-change="handlePageChange" row-key="id">
        <template #planNo="{ record }">
          <a-link @click="handleView(record)">{{ record.planNo }}</a-link>
        </template>
        <template #status="{ record }">
          <a-tag :color="statusColor(record.status)">{{ statusLabel(record.status) }}</a-tag>
        </template>
        <template #action="{ record }">
          <a-space>
            <a-button type="text" size="small" @click="handleView(record)">详情</a-button>
            <a-button v-if="record.status === 'PENDING'" type="text" size="small"
              @click="handleTrigger(record)" :loading="triggeringId === record.id">
              手动触发
            </a-button>
            <a-button v-if="record.status === 'FAILED'" type="text" size="small"
              @click="handleRetry(record)">重试</a-button>
            <a-popconfirm v-if="record.status === 'PENDING'" :content="$t('plm.ecn-execution-plans.确定取消此执行计划')" @ok="handleCancel(record)">
              <a-button type="text" size="small" status="danger">{{ $t('common.cancel') }}</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </a-table>
    </a-card>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
import { useI18n } from 'vue-i18n'
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Message } from '@arco-design/web-vue'
import { getEcnExecutionPlans, triggerEcnExecutionPlan, retryEcnExecutionPlan, cancelEcnExecutionPlan } from '@/api/plm'

const router = useRouter()
const loading = ref(false)
const tableData = ref([])
const pagination = reactive({ current: 1, pageSize: 20, total: 0, showTotal: true })
const triggeringId = ref('')
const searchForm = reactive({ ecnNo: '', status: undefined as string | undefined, dateRange: [] as string[] })

const columns = [
  { title: t('plm.ecn-execution-plans.index.计划编号'), dataIndex: 'planNo', slotName: 'planNo', width: 160 },
  { title: t('plm.ecn-execution-plans.index.ECN编号'), dataIndex: 'ecnNo', width: 160 },
  { title: t('plm.ecn-execution-plans.index.生效日期'), dataIndex: 'effectiveDate', width: 120 },
  { title: t('plm.ecn-execution-plans.index.状态'), dataIndex: 'status', slotName: 'status', width: 100 },
  { title: t('plm.ecn-execution-plans.index.触发方式'), dataIndex: 'triggerType', width: 100 },
  { title: t('plm.ecn-execution-plans.index.受影响BOM数'), dataIndex: 'affectedBomCount', width: 110 },
  { title: t('plm.ecn-execution-plans.index.受影响工艺数'), dataIndex: 'affectedRoutingCount', width: 110 },
  { title: t('plm.ecn-execution-plans.index.创建时间'), dataIndex: 'createdAt', width: 160 },
  { title: t('plm.ecn-execution-plans.index.操作'), slotName: 'action', width: 200, fixed: 'right' },
]

onMounted(fetchData)

async function fetchData() {
  loading.value = true
  try {
    const params: any = { ...searchForm, page: pagination.current, pageSize: pagination.pageSize }
    if (searchForm.dateRange?.length === 2) {
      params.effectiveDateFrom = searchForm.dateRange[0]
      params.effectiveDateTo = searchForm.dateRange[1]
    }
    delete params.dateRange
    const res = await getEcnExecutionPlans(params)
    tableData.value = (res as any).data?.items ?? []
    pagination.total = (res as any).data?.total ?? 0
  } catch (e: any) { Message.error(e.message || '加载失败') }
  finally { loading.value = false }
}

function handleSearch() { pagination.current = 1; fetchData() }
function handleReset() { Object.assign(searchForm, { ecnNo: '', status: undefined, dateRange: [] }); handleSearch() }
function handlePageChange(page: number) { pagination.current = page; fetchData() }
function handleView(record: any) { router.push(`/plm/ecn-execution-plans/${record.id}`) }

async function handleTrigger(record: any) {
  triggeringId.value = record.id
  try { await triggerEcnExecutionPlan(record.id); Message.success('触发成功'); fetchData() }
  catch (e: any) { Message.error(e.message || '触发失败') }
  finally { triggeringId.value = '' }
}

async function handleRetry(record: any) {
  try { await retryEcnExecutionPlan(record.id); Message.success('重试已发起'); fetchData() }
  catch (e: any) { Message.error(e.message || '操作失败') }
}

async function handleCancel(record: any) {
  try { await cancelEcnExecutionPlan(record.id); Message.success('取消成功'); fetchData() }
  catch (e: any) { Message.error(e.message || '操作失败') }
}

function statusLabel(s: string) {
  return { PENDING: '待执行', IN_PROGRESS: '执行中', COMPLETED: '已完成', FAILED: '失败', CANCELLED: '已取消' }[s] ?? s
}
function statusColor(s: string) {
  return { PENDING: 'gray', IN_PROGRESS: 'orange', COMPLETED: 'green', FAILED: 'red', CANCELLED: 'gray' }[s] ?? 'gray'
}
</script>

<style scoped>
.page-container { padding: 16px; }
.search-form { margin-bottom: 16px; }
</style>
