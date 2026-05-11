<template>
  <div class="page-container">
    <a-card :bordered="false">
      <!-- 搜索栏 -->
      <a-form :model="searchForm" layout="inline" class="search-form" @keyup.enter="handleSearch">
        <a-form-item :label="$t('sys.logs.index.日志类型')">
          <a-select v-model="searchForm.logType" :placeholder="$t('sys.logs.index.全部')" allow-clear style="width: 130px">
            <a-option value="LOGIN">登录日志</a-option>
            <a-option value="OPERATION">操作日志</a-option>
            <a-option value="SYSTEM_ERROR">系统错误</a-option>
            <a-option value="BIZ_ERROR">业务错误</a-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="$t('sys.logs.index.用户名')">
          <a-input v-model="searchForm.username" :placeholder="$t('sys.logs.index.请输入用户名')" allow-clear style="width: 150px" />
        </a-form-item>
        <a-form-item :label="$t('sys.logs.index.时间范围')">
          <a-range-picker v-model="searchForm.dateRange" show-time style="width: 340px" />
        </a-form-item>
        <a-form-item :label="$t('sys.logs.index.关键词')">
          <a-input v-model="searchForm.keyword" :placeholder="$t('sys.logs.index.URL错误信息操作')" allow-clear style="width: 180px" />
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" @click="handleSearch">{{ $t('common.search') }}</a-button>
            <a-button @click="handleReset">{{ $t('common.reset') }}</a-button>
          </a-space>
        </a-form-item>
      </a-form>

      <!-- 表格 -->
      <a-table
        :columns="columns"
        :data="tableData"
        :loading="loading"
        :pagination="pagination"
        @page-change="handlePageChange"
        @page-size-change="handlePageSizeChange"
        row-key="id"
        :row-class="rowClass"
      >
        <template #logType="{ record }">
          <a-tag :color="logTypeColor(record.logType)" size="small">{{ logTypeLabel(record.logType) }}</a-tag>
        </template>
        <template #responseCode="{ record }">
          <a-tag v-if="record.responseCode" :color="record.responseCode >= 500 ? 'red' : record.responseCode >= 400 ? 'orange' : 'green'" size="small">
            {{ record.responseCode }}
          </a-tag>
        </template>
        <template #loginResult="{ record }">
          <template v-if="record.loginResult">
            <a-tag v-if="record.loginResult === 'SUCCESS'" color="green" size="small">成功</a-tag>
            <a-tag v-else-if="record.loginResult === 'FAILED'" color="red" size="small">失败</a-tag>
            <a-tag v-else color="orange" size="small">锁定</a-tag>
          </template>
          <span v-else>-</span>
        </template>
        <template #action="{ record }">
          <a-button type="text" size="small" @click="handleViewDetail(record)">详情</a-button>
        </template>
      </a-table>
    </a-card>

    <!-- 详情弹窗 -->
    <a-modal v-model:visible="detailVisible" :title="$t('sys.logs.index.日志详情')" :footer="false" width="720px">
      <a-descriptions :column="2" bordered size="small">
        <a-descriptions-item :label="$t('sys.logs.index.日志类型')">
          <a-tag :color="logTypeColor(detail.logType)" size="small">{{ logTypeLabel(detail.logType) }}</a-tag>
        </a-descriptions-item>
        <a-descriptions-item :label="$t('sys.logs.index.时间')">{{ detail.createdAt }}</a-descriptions-item>
        <a-descriptions-item :label="$t('sys.logs.index.用户')">{{ detail.username || '-' }}</a-descriptions-item>
        <a-descriptions-item label="IP">{{ detail.ipAddress || '-' }}</a-descriptions-item>
        <a-descriptions-item :label="$t('sys.logs.index.请求方法')">{{ detail.requestMethod || '-' }}</a-descriptions-item>
        <a-descriptions-item :label="$t('sys.logs.index.响应码')">{{ detail.responseCode || '-' }}</a-descriptions-item>
        <a-descriptions-item :label="$t('sys.logs.index.耗时')">{{ detail.durationMs != null ? detail.durationMs + ' ms' : '-' }}</a-descriptions-item>
        <a-descriptions-item :label="$t('sys.logs.index.登录结果')">{{ detail.loginResult || '-' }}</a-descriptions-item>
        <a-descriptions-item :label="$t('sys.logs.index.请求URL')" :span="2">{{ detail.requestUrl || '-' }}</a-descriptions-item>
      </a-descriptions>
      <div v-if="detail.requestBody" style="margin-top: 12px">
        <div style="font-weight: 500; margin-bottom: 6px">请求体：</div>
        <a-typography-paragraph code style="white-space: pre-wrap; font-size: 12px; max-height: 150px; overflow: auto">{{ formatJson(detail.requestBody) }}</a-typography-paragraph>
      </div>
      <div v-if="detail.errorMessage" style="margin-top: 12px">
        <div style="font-weight: 500; margin-bottom: 6px; color: #f53f3f">错误信息：</div>
        <a-typography-paragraph code style="white-space: pre-wrap; font-size: 12px; color: #f53f3f">{{ detail.errorMessage }}</a-typography-paragraph>
      </div>
      <div v-if="detail.errorStack" style="margin-top: 12px">
        <div style="font-weight: 500; margin-bottom: 6px; color: #8b949e">错误堆栈：</div>
        <a-typography-paragraph code style="white-space: pre-wrap; font-size: 11px; max-height: 200px; overflow: auto; color: #8b949e">{{ detail.errorStack }}</a-typography-paragraph>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
import { useI18n } from 'vue-i18n'
import { ref, reactive, onMounted } from 'vue'
import { Message } from '@arco-design/web-vue'
import { getLogs } from '@/api/monitor'

const searchForm = reactive({
  logType: undefined as string | undefined,
  username: '',
  dateRange: [] as string[],
  keyword: '',
})

const loading = ref(false)
const tableData = ref<any[]>([])
const pagination = reactive({ current: 1, pageSize: 20, total: 0, showTotal: true, showPageSize: true })
const detailVisible = ref(false)
const detail = ref<any>({})

const columns = [
  { title: t('sys.logs.index.类型'), dataIndex: 'logType', slotName: 'logType', width: 100 },
  { title: t('sys.logs.index.用户'), dataIndex: 'username', width: 120 },
  { title: t('sys.logs.index.请求方法'), dataIndex: 'requestMethod', width: 90 },
  { title: t('sys.logs.index.请求URL'), dataIndex: 'requestUrl', ellipsis: true, width: 260 },
  { title: t('sys.logs.index.响应码'), dataIndex: 'responseCode', slotName: 'responseCode', width: 80 },
  { title: t('sys.logs.index.登录结果'), dataIndex: 'loginResult', slotName: 'loginResult', width: 90 },
  { title: t('sys.logs.index.耗时ms'), dataIndex: 'durationMs', width: 90 },
  { title: 'IP', dataIndex: 'ipAddress', width: 130 },
  { title: t('sys.logs.index.时间'), dataIndex: 'createdAt', width: 160 },
  { title: t('sys.logs.index.操作'), slotName: 'action', width: 70, fixed: 'right' },
]

onMounted(fetchData)

async function fetchData() {
  loading.value = true
  try {
    const params: any = {
      page: pagination.current,
      pageSize: pagination.pageSize,
      logType: searchForm.logType || undefined,
      username: searchForm.username || undefined,
      keyword: searchForm.keyword || undefined,
    }
    if (searchForm.dateRange?.length === 2) {
      params.startTime = searchForm.dateRange[0]
      params.endTime = searchForm.dateRange[1]
    }
    const res = await getLogs(params)
    const data = (res as any).data ?? res
    tableData.value = data.items ?? []
    pagination.total = data.total ?? 0
  } catch (e: any) {
    Message.error(e.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function handleSearch() { pagination.current = 1; fetchData() }
function handleReset() {
  Object.assign(searchForm, { logType: undefined, username: '', dateRange: [], keyword: '' })
  handleSearch()
}
function handlePageChange(page: number) { pagination.current = page; fetchData() }
function handlePageSizeChange(pageSize: number) { pagination.pageSize = pageSize; pagination.current = 1; fetchData() }

function handleViewDetail(record: any) { detail.value = record; detailVisible.value = true }

function logTypeLabel(t: string) {
  return { LOGIN: '登录', OPERATION: '操作', SYSTEM_ERROR: '系统错误', BIZ_ERROR: '业务错误' }[t] ?? t
}
function logTypeColor(t: string) {
  return { LOGIN: 'blue', OPERATION: 'green', SYSTEM_ERROR: 'red', BIZ_ERROR: 'orange' }[t] ?? 'gray'
}
function rowClass(record: any) {
  if (record.logType === 'SYSTEM_ERROR') return 'row-error'
  if (record.logType === 'BIZ_ERROR') return 'row-warn'
  return ''
}
function formatJson(str: string) {
  try { return JSON.stringify(JSON.parse(str), null, 2) } catch { return str }
}
</script>

<style scoped>
.page-container { padding: 16px; }
.search-form { margin-bottom: 16px; }
:deep(.row-error td) { background: #fff1f0 !important; }
:deep(.row-warn td) { background: #fff7e6 !important; }
</style>
