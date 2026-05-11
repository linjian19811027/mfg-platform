<template>
  <div class="page-container">
    <a-card :bordered="false" style="margin-bottom: 16px">
      <a-space wrap>
        <a-select v-model="query.status" :placeholder="$t('common.status')" allow-clear style="width: 140px">
          <a-option value="OPEN">开放</a-option>
          <a-option value="IN_PROGRESS">进行中</a-option>
          <a-option value="PENDING_VERIFY">待验证</a-option>
          <a-option value="CLOSED">已关闭</a-option>
        </a-select>
        <a-input v-model="query.keyword" :placeholder="$t('qms.capa.index.标题搜索')" allow-clear style="width: 200px" @keyup.enter="loadData" />
        <a-button type="primary" @click="loadData">{{ $t('common.search') }}</a-button>
        <a-button @click="resetQuery">{{ $t('common.reset') }}</a-button>
      </a-space>
      <template #extra>
        <a-button type="primary" @click="openDrawer(null)">新建 CAPA</a-button>
      </template>
    </a-card>

    <a-card :bordered="false">
      <MTable :columns="columns" :data="tableData" :loading="loading" :total="total" :page-size="20" @change="onTableChange">
        <template #status="{ record }">
          <a-tag :color="statusColor(record.status as string)">{{ statusLabel(record.status as string) }}</a-tag>
        </template>
        <template #overdue="{ record }">
          <a-tag v-if="isOverdue(record.targetDate as string, record.status as string)" color="red">
            逾期 {{ overdueDays(record.targetDate as string) }} 天
          </a-tag>
        </template>
        <template #action="{ record }">
          <a-space>
            <a-link @click="openDetailDrawer(record as unknown as CorrectiveAction)">详情</a-link>
            <a-link v-if="record.status !== 'CLOSED'" @click="openDrawer(record as unknown as CorrectiveAction)">{{ $t('common.edit') }}</a-link>
            <a-link v-if="record.status === 'IN_PROGRESS'" @click="openVerifyDrawer(record as unknown as CorrectiveAction)">验证</a-link>
          </a-space>
        </template>
      </MTable>
    </a-card>

    <!-- 新建/编辑抽屉 -->
    <a-drawer v-model:visible="drawerVisible" :title="editing ? '编辑 CAPA' : '新建 CAPA'" :width="560" @cancel="drawerVisible = false">
      <MForm :schema="formSchema" v-model="formData" :loading="saving" :submit-text="$t('qms.capa.index.保存')" @submit="handleSave" @cancel="drawerVisible = false" />
    </a-drawer>

    <!-- 详情抽屉 -->
    <a-drawer v-model:visible="detailDrawerVisible" :title="`CAPA 详情 - ${currentCapa?.title ?? ''}`" :width="600" @cancel="detailDrawerVisible = false">
      <template v-if="currentCapa">
        <a-descriptions :column="2" bordered>
          <a-descriptions-item :label="$t('common.status')">
            <a-tag :color="statusColor(currentCapa.status)">{{ statusLabel(currentCapa.status) }}</a-tag>
          </a-descriptions-item>
          <a-descriptions-item :label="$t('qms.capa.index.目标完成日')">{{ currentCapa.targetDate ?? '-' }}</a-descriptions-item>
          <a-descriptions-item :label="$t('qms.capa.index.问题描述')" :span="2">{{ currentCapa.description }}</a-descriptions-item>
          <a-descriptions-item :label="$t('qms.capa.index.根本原因')" :span="2">{{ currentCapa.rootCause ?? '-' }}</a-descriptions-item>
          <a-descriptions-item :label="$t('qms.capa.index.纠正措施')" :span="2">{{ currentCapa.action }}</a-descriptions-item>
          <a-descriptions-item :label="$t('qms.capa.index.验证结果')" :span="2">{{ currentCapa.verifyResult ?? '-' }}</a-descriptions-item>
        </a-descriptions>
      </template>
    </a-drawer>

    <!-- 效果验证弹窗 -->
    <a-modal v-model:visible="verifyModalVisible" :title="$t('qms.capa.index.效果验证')" :ok-loading="verifying" @ok="handleVerify" @cancel="verifyModalVisible = false">
      <a-form layout="vertical">
        <a-form-item :label="$t('qms.capa.index.验证结果')" required>
          <a-radio-group v-model="verifyForm.result">
            <a-radio value="EFFECTIVE">有效</a-radio>
            <a-radio value="INEFFECTIVE">无效</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item :label="$t('qms.capa.index.验证说明')">
          <a-textarea v-model="verifyForm.description" :auto-size="{ minRows: 3 }" />
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
import MTable from '@/components/MTable/index.vue'
import MForm from '@/components/MForm/index.vue'
import type { MTableColumn } from '@/components/MTable/index.vue'
import type { MFormField } from '@/components/MForm/index.vue'
import { qmsApi, type CorrectiveAction } from '@/api/qms'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const loading = ref(false)
const tableData = ref<any[]>([])
const total = ref(0)
const query = reactive({ keyword: '', status: '', page: 1, pageSize: 20 })

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  OPEN: { label: '开放', color: 'red' },
  IN_PROGRESS: { label: '进行中', color: 'orange' },
  PENDING_VERIFY: { label: '待验证', color: 'blue' },
  CLOSED: { label: '已关闭', color: 'green' },
}

const columns: MTableColumn[] = [
  { key: 'title', title: t('qms.capa.index.标题'), dataIndex: 'title', width: 200, ellipsis: true },
  { key: 'status', title: t('qms.capa.index.状态'), slotName: 'status', width: 100 },
  { key: 'responsibleId', title: t('qms.capa.index.责任人'), dataIndex: 'responsibleId', width: 110 },
  { key: 'targetDate', title: t('qms.capa.index.目标完成日'), dataIndex: 'targetDate', width: 120 },
  { key: 'overdue', title: t('qms.capa.index.逾期'), slotName: 'overdue', width: 120 },
  { key: 'createdAt', title: t('qms.capa.index.创建时间'), dataIndex: 'createdAt', width: 160 },
  { key: 'action', title: t('qms.capa.index.操作'), slotName: 'action', width: 160 },
]

const formSchema: MFormField[] = [
  { field: 'title', label: '标题', type: 'input', required: true },
  { field: 'description', label: '问题描述', type: 'textarea', required: true, props: { autoSize: { minRows: 2 } } },
  { field: 'rootCause', label: '根本原因', type: 'textarea', props: { autoSize: { minRows: 2 } } },
  { field: 'action', label: '纠正措施', type: 'textarea', required: true, props: { autoSize: { minRows: 2 } } },
  { field: 'responsibleId', label: '责任人ID' , type: 'input' },
  { field: 'targetDate', label: '目标完成日', type: 'date' },
]

function statusColor(s: string) { return STATUS_MAP[s]?.color ?? 'gray' }
function statusLabel(s: string) { return STATUS_MAP[s]?.label ?? s }

function isOverdue(date: string, status: string) {
  if (!date || status === 'CLOSED') return false
  return new Date(date) < new Date()
}

function overdueDays(date: string) {
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000)
}

async function loadData() {
  loading.value = true
  try {
    const params: Record<string, unknown> = { page: query.page, pageSize: query.pageSize }
    if (query.keyword) params.keyword = query.keyword
    if (query.status) params.status = query.status
    const res = await qmsApi.getCapas(params)
    tableData.value = (res.list ?? []) as any[]
    total.value = res.total ?? 0
  } catch { tableData.value = [] } finally { loading.value = false }
}

function resetQuery() { query.keyword = ''; query.status = ''; query.page = 1; loadData() }
function onTableChange(e: { page: number; pageSize: number }) { query.page = e.page; query.pageSize = e.pageSize; loadData() }

const drawerVisible = ref(false)
const saving = ref(false)
const editing = ref<CorrectiveAction | null>(null)
const formData = ref<Record<string, unknown>>({})

function openDrawer(capa: CorrectiveAction | null) {
  editing.value = capa
  formData.value = capa ? { ...capa } : {}
  drawerVisible.value = true
}

async function handleSave(data: Record<string, unknown>) {
  saving.value = true
  try {
    if (editing.value) { await qmsApi.updateCapa(editing.value.id, data); Message.success('更新成功') }
    else { await qmsApi.createCapa(data); Message.success('创建成功') }
    drawerVisible.value = false
    loadData()
  } catch { /* handled */ } finally { saving.value = false }
}

const detailDrawerVisible = ref(false)
const currentCapa = ref<CorrectiveAction | null>(null)
function openDetailDrawer(capa: CorrectiveAction) { currentCapa.value = capa; detailDrawerVisible.value = true }

const verifyModalVisible = ref(false)
const verifying = ref(false)
const verifyForm = reactive({ result: 'EFFECTIVE', description: '' })

function openVerifyDrawer(capa: CorrectiveAction) { currentCapa.value = capa; verifyForm.result = 'EFFECTIVE'; verifyForm.description = ''; verifyModalVisible.value = true }

async function handleVerify() {
  if (!currentCapa.value) return
  verifying.value = true
  try {
    await qmsApi.verifyCapa(currentCapa.value.id, { result: verifyForm.result, verifiedBy: authStore.userId ?? 'system' })
    Message.success('验证结果已提交')
    verifyModalVisible.value = false
    loadData()
  } catch { /* handled */ } finally { verifying.value = false }
}

onMounted(loadData)
</script>

<style scoped>
.page-container { padding: 16px; }
</style>
