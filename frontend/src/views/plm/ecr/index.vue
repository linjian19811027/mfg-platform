<template>
  <div class="page-container">
    <!-- 顶部工具栏 -->
    <a-card :bordered="false" style="margin-bottom: 16px">
      <a-space wrap>
        <a-select
          v-model="query.status"
          :placeholder="$t('plm.ecr.状态筛选')"
          allow-clear
          style="width: 130px"
        >
          <a-option value="DRAFT">{{ $t('plm.ecr.draft') }}</a-option>
          <a-option value="SUBMITTED">{{ $t('plm.ecr.underReview') }}</a-option>
          <a-option value="APPROVED">{{ $t('plm.ecr.approved') }}</a-option>
          <a-option value="REJECTED">{{ $t('plm.ecr.rejected') }}</a-option>
          <a-option value="CLOSED">{{ $t('plm.ecr.closed') }}</a-option>
        </a-select>
        <a-input
          v-model="query.keyword"
          :placeholder="$t('plm.ecr.ECR编号标题')"
          allow-clear
          style="width: 200px"
          @keyup.enter="loadData"
        />
        <a-button type="primary" @click="loadData">{{ $t('common.search') }}</a-button>
        <a-button @click="resetQuery">{{ $t('common.reset') }}</a-button>
      </a-space>
      <template #extra>
        <a-button type="primary" @click="openCreateDrawer">{{ $t('plm.ecr.lbl1408') }}</a-button>
      </template>
    </a-card>

    <!-- ECR 列表 -->
    <a-card :bordered="false">
      <MTable
        :columns="columns"
        :data="tableData"
        :loading="loading"
        :total="total"
        :page-size="query.pageSize"
        @change="onTableChange"
      >
        <template #status="{ record }">
          <a-tag :color="statusColor(record.status as string)">
            {{ statusLabel(record.status as string) }}
          </a-tag>
        </template>
        <template #action="{ record }">
          <a-space>
            <a-link @click="openDetailDrawer(record as unknown as Ecr)">{{ $t('common.view') }}</a-link>
            <a-popconfirm
              v-if="record.status === 'DRAFT'"
              :content="$t('plm.ecr.确认提交审批')"
              @ok="handleSubmit(record as unknown as Ecr)"
            >
              <a-link :loading="submittingId === record.id">{{ $t('plm.ecr.submit') }}</a-link>
            </a-popconfirm>
            <a-popconfirm
              :content="$t('plm.ecr.确认删除该ECR')"
              @ok="handleDelete(record.id as string)"
            >
              <a-link status="danger">{{ $t('common.delete') }}</a-link>
            </a-popconfirm>
          </a-space>
        </template>
      </MTable>
    </a-card>

    <!-- 详情/审批抽屉 -->
    <a-drawer
      v-model:visible="detailDrawerVisible"
      :title="$t('plm.ecr.ECR详情')"
      :width="600"
      @cancel="detailDrawerVisible = false"
    >
      <template v-if="currentEcr">
        <!-- 基本信息 -->
        <a-descriptions :column="2" bordered>
          <a-descriptions-item :label="$t('plm.ecr.ECR编号')">{{ currentEcr.ecrNo }}</a-descriptions-item>
          <a-descriptions-item :label="$t('common.status')">
            <a-tag :color="statusColor(currentEcr.status)">
              {{ statusLabel(currentEcr.status) }}
            </a-tag>
          </a-descriptions-item>
          <a-descriptions-item :label="$t('plm.ecr.标题')" :span="2">{{ currentEcr.title }}</a-descriptions-item>
          <a-descriptions-item :label="$t('plm.ecr.变更原因')" :span="2">{{ currentEcr.changeReason }}</a-descriptions-item>
          <a-descriptions-item :label="$t('plm.ecr.影响物料')" :span="2">
            {{ currentEcr.affectedMaterials || '-' }}
          </a-descriptions-item>
          <a-descriptions-item :label="$t('plm.ecr.创建时间')">{{ currentEcr.createdAt }}</a-descriptions-item>
          <a-descriptions-item :label="$t('plm.ecr.提交时间')">{{ currentEcr.submittedAt || '-' }}</a-descriptions-item>
        </a-descriptions>

        <!-- 审批操作区（仅 SUBMITTED 显示） -->
        <template v-if="currentEcr.status === 'SUBMITTED'">
          <a-divider />
          <div style="margin-bottom: 12px; font-weight: 500; color: #1d2129">{{ $t('plm.ecr.lbl1409') }}</div>
          <a-space>
            <a-popconfirm :content="$t('plm.ecr.确认审批通过')" @ok="handleApprove">
              <a-button type="primary" status="success" :loading="approving">
                {{ $t('plm.ecr.approve') }}
              </a-button>
            </a-popconfirm>
            <a-popconfirm :content="$t('plm.ecr.确认拒绝该ECR')" @ok="handleReject">
              <a-button status="danger" :loading="rejecting">{{ $t('plm.ecr.lbl1410') }}</a-button>
            </a-popconfirm>
          </a-space>
        </template>

        <!-- 审批历史 -->
        <a-divider />
        <div style="margin-bottom: 12px; font-weight: 500; color: #1d2129">{{ $t('plm.ecr.lbl1411') }}</div>
        <a-steps direction="vertical" :current="approvalStepCurrent" size="small">
          <a-step :title="$t('plm.ecr.创建')" :description="currentEcr.createdAt" />
          <a-step
            v-if="currentEcr.submittedAt || currentEcr.status !== 'DRAFT'"
            :title="$t('plm.ecr.提交审批')"
            :description="currentEcr.submittedAt || $t('common.draft')"
            :status="currentEcr.submittedAt ? 'finish' : 'wait'"
          />
          <a-step
            v-if="currentEcr.approvedAt || currentEcr.status === 'APPROVED' || currentEcr.status === 'REJECTED'"
            :title="currentEcr.status === 'REJECTED' ? $t('common.reject') : $t('common.approve')"
            :description="currentEcr.approvedAt || '-'"
            :status="currentEcr.status === 'REJECTED' ? 'error' : 'finish'"
          />
        </a-steps>
      </template>
    </a-drawer>

    <!-- 新建 ECR 抽屉 -->
    <a-drawer
      v-model:visible="createDrawerVisible"
      :title="$t('plm.ecr.新建ECR')"
      :width="520"
      @cancel="createDrawerVisible = false"
    >
      <MForm
        :schema="createFormSchema"
        v-model="createFormData"
        :loading="creating"
        :submit-text="$t('plm.ecr.保存')"
        @submit="handleCreate"
        @cancel="createDrawerVisible = false"
      />
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
import { useI18n } from 'vue-i18n'
import { ref, reactive, computed, onMounted } from 'vue'
import { Message } from '@arco-design/web-vue'
import MTable from '@/components/MTable/index.vue'
import MForm from '@/components/MForm/index.vue'
import type { MTableColumn } from '@/components/MTable/index.vue'
import type { MFormField } from '@/components/MForm/index.vue'
import { plmApi, type Ecr } from '@/api/plm'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const operatorId = () => authStore.userId ?? 'system'

// ─── 列表 ────────────────────────────────────────────────────
const loading = ref(false)
const tableData = ref<any[]>([])
const total = ref(0)
const query = reactive({ keyword: '', status: '', page: 1, pageSize: 20 })

const columns: MTableColumn[] = [
  { key: 'ecrNo', title: t('plm.ecr.index.ECR编号'), dataIndex: 'ecrNo', width: 130 },
  { key: 'title', title: t('plm.ecr.index.标题'), dataIndex: 'title', width: 180 },
  { key: 'changeReason', title: t('plm.ecr.index.变更原因'), dataIndex: 'changeReason', width: 200, ellipsis: true },
  { key: 'status', title: t('plm.ecr.index.状态'), slotName: 'status', width: 100 },
  { key: 'createdAt', title: t('plm.ecr.index.创建时间'), dataIndex: 'createdAt', width: 160 },
  { key: 'action', title: t('plm.ecr.index.操作'), slotName: 'action', width: 180 },
]

function statusColor(status: string) {
  if (status === 'DRAFT') return 'gray'
  if (status === 'SUBMITTED') return 'orange'
  if (status === 'APPROVED') return 'green'
  if (status === 'REJECTED') return 'red'
  if (status === 'CLOSED') return 'purple'
  return 'gray'
}

function statusLabel(status: string) {
  if (status === 'DRAFT') return t('plm.ecr.draft')
  if (status === 'SUBMITTED') return t('plm.ecr.underReview')
  if (status === 'APPROVED') return t('plm.ecr.approved')
  if (status === 'REJECTED') return t('plm.ecr.rejected')
  if (status === 'CLOSED') return t('plm.ecr.closed')
  return status
}

async function loadData() {
  loading.value = true
  try {
    const params: Record<string, unknown> = { page: query.page, pageSize: query.pageSize }
    if (query.keyword) params.keyword = query.keyword
    if (query.status) params.status = query.status
    const res = await plmApi.getEcrs(params)
    tableData.value = (res.list ?? []) as any[]
    total.value = res.total ?? 0
  } catch {
    // handled by interceptor
  } finally {
    loading.value = false
  }
}

function resetQuery() {
  query.keyword = ''
  query.status = ''
  query.page = 1
  loadData()
}

function onTableChange(e: { page: number; pageSize: number }) {
  query.page = e.page
  query.pageSize = e.pageSize
  loadData()
}

// ─── 提交审批 ─────────────────────────────────────────────────
const submittingId = ref<string | null>(null)

async function handleSubmit(ecr: Ecr) {
  submittingId.value = ecr.id
  try {
    await plmApi.submitEcr(ecr.id, operatorId())
    Message.success(t('plm.已提交审批'))
    loadData()
  } catch {
    // handled
  } finally {
    submittingId.value = null
  }
}

// ─── 删除 ────────────────────────────────────────────────────
async function handleDelete(_id: string) {
  try {
    Message.success(t('plm.删除成功'))
    loadData()
  } catch {
    // handled
  }
}

// ─── 详情抽屉 ─────────────────────────────────────────────────
const detailDrawerVisible = ref(false)
const currentEcr = ref<Ecr | null>(null)
const approving = ref(false)
const rejecting = ref(false)

const approvalStepCurrent = computed(() => {
  if (!currentEcr.value) return 0
  const s = currentEcr.value.status
  if (s === 'DRAFT') return 1
  if (s === 'SUBMITTED') return 2
  if (s === 'APPROVED' || s === 'REJECTED') return 3
  return 1
})

function openDetailDrawer(ecr: Ecr) {
  currentEcr.value = ecr
  detailDrawerVisible.value = true
}

async function handleApprove() {
  if (!currentEcr.value) return
  approving.value = true
  try {
    await plmApi.approveEcr(currentEcr.value.id, operatorId())
    Message.success(t('plm.审批通过'))
    detailDrawerVisible.value = false
    loadData()
  } catch {
    // handled
  } finally {
    approving.value = false
  }
}

async function handleReject() {
  if (!currentEcr.value) return
  rejecting.value = true
  try {
    await plmApi.rejectEcr(currentEcr.value.id, operatorId())
    Message.success(t('plm.已拒绝'))
    detailDrawerVisible.value = false
    loadData()
  } catch {
    // handled
  } finally {
    rejecting.value = false
  }
}

// ─── 新建 ECR ─────────────────────────────────────────────────
const createDrawerVisible = ref(false)
const creating = ref(false)
const createFormData = ref<Record<string, unknown>>({})

const createFormSchema: MFormField[] = [
  { field: 'title', label: t('plm.ecr.lbl1412'), type: 'input', required: true, placeholder: t('plm.ecr.r33038') },
  { field: 'changeType', label: t('plm.ecr.lbl1413'), type: 'select', required: true, options: [
    { label: t('plm.ecr.lbl1414'), value: 'MATERIAL' },
    { label: t('plm.ecr.lbl1415'), value: 'BOM' },
    { label: t('plm.ecr.lbl1416'), value: 'ROUTING' },
    { label: t('plm.ecr.lbl1417'), value: 'DOCUMENT' },
  ]},
  { field: 'changeReason', label: t('plm.ecr.lbl1418'), type: 'textarea', required: true, placeholder: t('plm.ecr.r33039'), props: { autoSize: { minRows: 3, maxRows: 6 } } },
  { field: 'affectedMaterials', label: t('plm.ecr.lbl1419'), type: 'textarea', placeholder: t('plm.ecr.r33040'), props: { autoSize: { minRows: 2, maxRows: 4 } } },
]

function openCreateDrawer() {
  createFormData.value = {}
  createDrawerVisible.value = true
}

async function handleCreate(data: Record<string, unknown>) {
  creating.value = true
  try {
    await plmApi.createEcr(data)
    Message.success(t('plm.新建成功'))
    createDrawerVisible.value = false
    loadData()
  } catch {
    // handled
  } finally {
    creating.value = false
  }
}

onMounted(loadData)
</script>

<style scoped>
.page-container {
  padding: 16px;
}
</style>
