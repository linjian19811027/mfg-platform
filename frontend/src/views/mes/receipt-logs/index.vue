<template>
  <div class="page-container">
    <a-card :bordered="false">
      <a-form :model="searchForm" layout="inline" class="search-form" @keyup.enter="handleSearch">
        <a-form-item :label="$t('mes.receipt-logs.index.工单编号')">
          <a-input v-model="searchForm.woId" :placeholder="$t('mes.receipt-logs.index.请输入工单编号')" allow-clear style="width: 180px" />
        </a-form-item>
        <a-form-item :label="$t('common.status')">
          <a-select v-model="searchForm.status" :placeholder="$t('mes.receipt-logs.index.全部')" allow-clear style="width: 130px">
            <a-option value="PENDING">待处理</a-option>
            <a-option value="SUCCESS">成功</a-option>
            <a-option value="FAILED">失败</a-option>
            <a-option value="RETRYING">重试中</a-option>
          </a-select>
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
        <template #status="{ record }">
          <a-tag v-if="record.status === 'SUCCESS'" color="green">成功</a-tag>
          <a-tag v-else-if="record.status === 'FAILED'" color="red">失败</a-tag>
          <a-tag v-else-if="record.status === 'RETRYING'" color="orange">重试中</a-tag>
          <a-tag v-else color="gray">待处理</a-tag>
        </template>
        <template #action="{ record }">
          <a-button v-if="record.status === 'FAILED'" type="text" size="small"
            @click="handleRetry(record)" :loading="retryingId === record.id">
            重试
          </a-button>
          <a-button type="text" size="small" @click="handleViewDetail(record)">详情</a-button>
        </template>
      </a-table>
    </a-card>

    <!-- 详情弹窗 -->
    <a-modal v-model:visible="detailVisible" :title="$t('mes.receipt-logs.index.入库日志详情')" :footer="false" width="700px">
      <a-descriptions :column="2" bordered>
        <a-descriptions-item :label="$t('mes.receipt-logs.index.工单编号')">{{ detail.woId }}</a-descriptions-item>
        <a-descriptions-item :label="$t('mes.receipt-logs.index.触发类型')">{{ detail.triggerType }}</a-descriptions-item>
        <a-descriptions-item :label="$t('common.status')">{{ detail.status }}</a-descriptions-item>
        <a-descriptions-item :label="$t('mes.receipt-logs.index.重试次数')">{{ detail.retryCount }}</a-descriptions-item>
        <a-descriptions-item :label="$t('mes.receipt-logs.index.物料ID')">{{ detail.materialId }}</a-descriptions-item>
        <a-descriptions-item :label="$t('mes.receipt-logs.index.数量')">{{ detail.quantity }}</a-descriptions-item>
        <a-descriptions-item :label="$t('mes.receipt-logs.index.创建时间')" :span="2">{{ detail.createdAt }}</a-descriptions-item>
      </a-descriptions>
      <div v-if="detail.errorMessage" style="margin-top: 16px">
        <div style="font-weight: 500; margin-bottom: 8px; color: #f53f3f">错误信息：</div>
        <a-typography-paragraph code style="white-space: pre-wrap; font-size: 12px">{{ detail.errorMessage }}</a-typography-paragraph>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
import { useI18n } from 'vue-i18n'
import { ref, reactive, onMounted } from 'vue'
import { Message } from '@arco-design/web-vue'
import { getReceiptLogs, retryReceiptLog } from '@/api/mes'

const searchForm = reactive({ woId: '', status: undefined as string | undefined })
const loading = ref(false)
const tableData = ref([])
const pagination = reactive({ current: 1, pageSize: 20, total: 0, showTotal: true })
const retryingId = ref('')
const detailVisible = ref(false)
const detail = ref<any>({})

const columns = [
  { title: t('mes.receipt-logs.index.工单编号'), dataIndex: 'woNo', width: 160 },
  { title: t('mes.receipt-logs.index.物料'), dataIndex: 'materialCode', width: 140 },
  { title: t('mes.receipt-logs.index.数量'), dataIndex: 'quantity', width: 90 },
  { title: t('mes.receipt-logs.index.触发类型'), dataIndex: 'triggerType', width: 110 },
  { title: t('mes.receipt-logs.index.状态'), dataIndex: 'status', slotName: 'status', width: 90 },
  { title: t('mes.receipt-logs.index.重试次数'), dataIndex: 'retryCount', width: 90 },
  { title: t('mes.receipt-logs.index.创建时间'), dataIndex: 'createdAt', width: 160 },
  { title: t('mes.receipt-logs.index.操作'), slotName: 'action', width: 140, fixed: 'right' },
]

onMounted(fetchData)

async function fetchData() {
  loading.value = true
  try {
    const res = await getReceiptLogs({ ...searchForm, page: pagination.current, pageSize: pagination.pageSize })
    tableData.value = (res as any).data?.items ?? []
    pagination.total = (res as any).data?.total ?? 0
  } catch (e: any) { Message.error(e.message || '加载失败') }
  finally { loading.value = false }
}

function handleSearch() { pagination.current = 1; fetchData() }
function handleReset() { Object.assign(searchForm, { woId: '', status: undefined }); handleSearch() }
function handlePageChange(page: number) { pagination.current = page; fetchData() }

async function handleRetry(record: any) {
  retryingId.value = record.id
  try {
    await retryReceiptLog(record.id)
    Message.success('重试指令已发送')
    fetchData()
  } catch (e: any) { Message.error(e.message || '重试失败') }
  finally { retryingId.value = '' }
}

function handleViewDetail(record: any) {
  detail.value = record
  detailVisible.value = true
}
</script>

<style scoped>
.page-container { padding: 16px; }
.search-form { margin-bottom: 16px; }
</style>
