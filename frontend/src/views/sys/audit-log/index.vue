<template>
  <div class="page-container">
    <a-card>
      <!-- 搜索栏 -->
      <div class="search-bar">
        <a-input
          v-model="query.operator"
          :placeholder="$t('sys.audit-log.index.操作人')"
          allow-clear
          style="width: 130px"
          @press-enter="handleSearch"
        />
        <a-select
          v-model="query.module"
          :placeholder="$t('sys.audit-log.index.操作模块')"
          allow-clear
          style="width: 140px"
        >
          <a-option v-for="m in MODULE_OPTIONS" :key="m" :value="m">{{ m }}</a-option>
        </a-select>
        <a-select
          v-model="query.actionType"
          :placeholder="$t('sys.audit-log.index.操作类型')"
          allow-clear
          style="width: 120px"
        >
          <a-option v-for="t in ACTION_TYPE_OPTIONS" :key="t.value" :value="t.value">{{ t.label }}</a-option>
        </a-select>
        <a-select
          v-model="query.result"
          :placeholder="$t('sys.audit-log.index.操作结果')"
          allow-clear
          style="width: 110px"
        >
          <a-option value="success">{{ $t('sys.audit-log.lbl1645') }}</a-option>
          <a-option value="fail">{{ $t('sys.audit-log.lbl1646') }}</a-option>
        </a-select>
        <a-range-picker
          v-model="dateRange"
          style="width: 240px"
          @press-enter="handleSearch"
        />
        <a-button type="primary" @click="handleSearch">{{ $t('common.search') }}</a-button>
        <a-button @click="resetQuery">{{ $t('common.reset') }}</a-button>
        <a-button style="margin-left: auto" @click="handleExport" :loading="exporting">
          <template #icon><icon-download /></template>
          {{ $t('sys.auditLog.exportExcel') }}
        </a-button>
      </div>

      <MTable
        :columns="columns"
        :data="list as any[]"
        :loading="loading"
        :total="total"
        @change="onTableChange"
      >
        <template #actionType="{ record }">
          <a-tag :color="actionTypeColor(record.logType as string)" size="small">
            {{ actionTypeLabel(record.logType as string) }}
          </a-tag>
        </template>
        <template #action="{ record }">
          <a-button type="text" size="small" @click="openDetail(record as unknown as AuditLog)">
            {{ $t('sys.audit-log.detail') }}
          </a-button>
        </template>
      </MTable>
    </a-card>

    <!-- 详情 Modal -->
    <a-modal
      v-model:visible="detailVisible"
      :title="$t('sys.audit-log.index.操作详情')"
      :width="640"
      :footer="false"
    >
      <template v-if="detailRecord">
        <a-descriptions :column="2" bordered size="small">
          <a-descriptions-item :label="$t('sys.audit-log.index.操作时间')">{{ detailRecord.createdAt }}</a-descriptions-item>
          <a-descriptions-item :label="$t('sys.audit-log.index.操作人')">{{ detailRecord.username }}</a-descriptions-item>
          <a-descriptions-item :label="$t('sys.audit-log.index.操作模块')">{{ detailRecord.module }}</a-descriptions-item>
          <a-descriptions-item :label="$t('sys.audit-log.index.操作类型')">
            <a-tag :color="actionTypeColor(detailRecord.logType ?? '')" size="small">
              {{ actionTypeLabel(detailRecord.logType ?? '') }}
            </a-tag>
          </a-descriptions-item>
          <a-descriptions-item :label="$t('sys.audit-log.index.操作')">{{ detailRecord.action }}</a-descriptions-item>
          <a-descriptions-item :label="$t('sys.audit-log.index.IP地址')">{{ detailRecord.ipAddress }}</a-descriptions-item>
          <a-descriptions-item label="状态码">{{ detailRecord.responseCode }}</a-descriptions-item>
          <a-descriptions-item :label="$t('sys.audit-log.index.操作结果')" :span="2">
            <a-tag :color="(detailRecord.responseCode ?? 200) < 400 ? 'green' : 'red'" size="small">
              {{ (detailRecord.responseCode ?? 200) < 400 ? $t('sys.audit-log.lbl1649') : $t('sys.audit-log.lbl1650') }}
            </a-tag>
            <span v-if="detailRecord.errorMessage" style="margin-left: 8px; color: var(--color-danger-6)">
              {{ detailRecord.errorMessage }}
            </span>
          </a-descriptions-item>
        </a-descriptions>

        <div v-if="detailRecord.requestBody" style="margin-top: 16px">
          <div class="detail-section-title">请求体</div>
          <pre class="json-block">{{ formatJson(detailRecord.requestBody) }}</pre>
        </div>

        <div v-if="detailRecord.responseBody" style="margin-top: 12px">
          <div class="detail-section-title">响应体</div>
          <pre class="json-block">{{ formatJson(detailRecord.responseBody) }}</pre>
        </div>
      </template>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
import { useI18n } from 'vue-i18n'
import { ref, reactive } from 'vue'
import { Message } from '@arco-design/web-vue'
import MTable from '@/components/MTable/index.vue'
import type { MTableColumn } from '@/components/MTable/index.vue'
import { auditLogApi, type AuditLog } from '@/api/sys'

// ---- 常量 ----
const MODULE_OPTIONS = [
  t('sys.audit-log.lbl1653'), t('sys.audit-log.lbl1654'), t('sys.audit-log.lbl1655'), t('sys.audit-log.lbl1656'), t('sys.audit-log.lbl1657'),
  t('sys.audit-log.lbl1658'), t('sys.audit-log.lbl1659'), t('sys.audit-log.lbl1660'), t('sys.audit-log.lbl1661'), t('sys.audit-log.lbl1662'), t('sys.audit-log.lbl1663'),
]

const ACTION_TYPE_OPTIONS = [
  { value: 'LOGIN', label: '登录' },
  { value: 'OPERATION', label: '操作' },
  { value: 'SYSTEM_ERROR', label: '系统错误' },
  { value: 'BIZ_ERROR', label: '业务错误' },
]

const ACTION_TYPE_COLOR: Record<string, string> = {
  LOGIN: 'purple',
  OPERATION: 'arcoblue',
  SYSTEM_ERROR: 'red',
  BIZ_ERROR: 'orange',
}

function actionTypeLabel(type: string): string {
  return ACTION_TYPE_OPTIONS.find(t => t.value === type)?.label ?? type
}

function actionTypeColor(type: string): string {
  return ACTION_TYPE_COLOR[type] ?? 'gray'
}

function formatJson(obj: unknown): string {
  if (!obj) return '—'
  try {
    return JSON.stringify(obj, null, 2)
  } catch {
    return String(obj)
  }
}

// ---- 列定义 ----
const columns: MTableColumn[] = [
  { key: 'createdAt', title: t('sys.audit-log.index.操作时间'), width: 180 },
  { key: 'username', title: t('sys.audit-log.index.操作人'), width: 100 },
  { key: 'module', title: t('sys.audit-log.index.操作模块'), width: 100 },
  { key: 'logType', title: t('sys.audit-log.index.操作类型'), width: 100, slotName: 'actionType' },
  { key: 'action', title: t('sys.audit-log.index.操作'), width: 160 },
  { key: 'requestUrl', title: t('sys.audit-log.index.操作对象'), ellipsis: true },
  { key: 'ipAddress', title: t('sys.audit-log.index.IP地址'), width: 140 },
  { key: 'responseCode', title: '状态码', width: 80 },
]

// ---- 查询状态 ----
const query = reactive({
  operator: '',
  module: '',
  actionType: '',
  result: '',
})
const dateRange = ref<string[]>([])
const list = ref<AuditLog[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const pageSize = ref(20)

// ---- 详情 ----
const detailVisible = ref(false)
const detailRecord = ref<AuditLog | null>(null)

function openDetail(record: AuditLog) {
  detailRecord.value = record
  detailVisible.value = true
}

// ---- 导出 ----
const exporting = ref(false)

async function handleExport() {
  exporting.value = true
  try {
    // 获取全量数据（不分页）
    const res = await auditLogApi.getAuditLogs({
      ...buildParams(),
      page: 1,
      pageSize: 10000,
    })
    const rows = res.list
    const headers = [t('sys.audit-log.lbl1667'), t('sys.audit-log.lbl1668'), t('sys.audit-log.lbl1669'), t('sys.audit-log.lbl1670'), t('sys.audit-log.lbl1671'), t('sys.audit-log.lbl1672'), t('sys.audit-log.lbl1673')]
    const csvLines = [
      headers.join(','),
      ...rows.map(r => [
        r.createdAt,
        r.username,
        r.module,
        actionTypeLabel(r.logType ?? ''),
        `"${r.action ?? ''}"`,
        r.ipAddress,
        (r.responseCode ?? 200) < 400 ? t('sys.audit-log.lbl1674') : t('sys.audit-log.lbl1675'),
      ].join(',')),
    ]
    const bom = '\uFEFF'
    const blob = new Blob([bom + csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${t('sys.audit-log.r33066')}_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '')}.csv`
    a.click()
    URL.revokeObjectURL(url)
    Message.success(t('sys.导出成功'))
  } catch {
    Message.error(t('sys.导出失败'))
  } finally {
    exporting.value = false
  }
}

// ---- 数据加载 ----
function buildParams() {
  return {
    operator: query.operator || undefined,
    module: query.module || undefined,
    actionType: query.actionType || undefined,
    result: query.result || undefined,
    startTime: dateRange.value?.[0] || undefined,
    endTime: dateRange.value?.[1] || undefined,
  }
}

async function loadData() {
  loading.value = true
  try {
    const res = await auditLogApi.getAuditLogs({
      ...buildParams(),
      page: page.value,
      pageSize: pageSize.value,
    })
    list.value = res.list
    total.value = res.total
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  page.value = 1
  loadData()
}

function resetQuery() {
  query.operator = ''
  query.module = ''
  query.actionType = ''
  query.result = ''
  dateRange.value = []
  page.value = 1
  loadData()
}

function onTableChange(e: { page: number; pageSize: number }) {
  page.value = e.page
  pageSize.value = e.pageSize
  loadData()
}

// ---- 初始化 ----
loadData()
</script>

<style scoped>
.page-container { padding: 16px; }
.search-bar { display: flex; gap: 8px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
.detail-section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-2);
  margin-bottom: 6px;
}
.json-block {
  background: var(--color-fill-2);
  border: 1px solid var(--color-border-2);
  border-radius: 4px;
  padding: 10px 12px;
  font-size: 12px;
  font-family: 'Consolas', 'Monaco', monospace;
  line-height: 1.6;
  max-height: 200px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
}
</style>
