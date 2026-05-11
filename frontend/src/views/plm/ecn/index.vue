<template>
  <div class="page-container">
    <!-- 顶部工具栏 -->
    <a-card :bordered="false" style="margin-bottom: 16px">
      <a-space wrap>
        <a-input
          v-model="query.ecrId"
          :placeholder="$t('plm.ecn.关联ECR编号')"
          allow-clear
          style="width: 180px"
          @keyup.enter="loadData"
        />
        <a-select
          v-model="query.status"
          :placeholder="$t('plm.ecn.状态筛选')"
          allow-clear
          style="width: 130px"
        >
          <a-option value="ISSUED">已签发</a-option>
          <a-option value="COMPLETED">已完成</a-option>
        </a-select>
        <a-button type="primary" @click="loadData">{{ $t('common.search') }}</a-button>
        <a-button @click="resetQuery">{{ $t('common.reset') }}</a-button>
      </a-space>
      <template #extra>
        <a-button type="primary" @click="openIssueDrawer">签发 ECN</a-button>
      </template>
    </a-card>

    <!-- ECN 列表 -->
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
            <a-link @click="openDetailDrawer(record as unknown as Ecn)">{{ $t('common.view') }}</a-link>
            <a-popconfirm
              v-if="record.status === 'ISSUED'"
              :content="$t('plm.ecn.确认完成该ECN')"
              @ok="handleComplete(record as unknown as Ecn)"
            >
              <a-link :loading="completingId === record.id">完成</a-link>
            </a-popconfirm>
          </a-space>
        </template>
      </MTable>
    </a-card>

    <!-- 详情抽屉 -->
    <a-drawer
      v-model:visible="detailDrawerVisible"
      :title="$t('plm.ecn.ECN详情')"
      :width="520"
      @cancel="detailDrawerVisible = false"
    >
      <template v-if="currentEcn">
        <a-descriptions :column="2" bordered>
          <a-descriptions-item :label="$t('plm.ecn.ECN编号')">{{ currentEcn.ecnNo }}</a-descriptions-item>
          <a-descriptions-item :label="$t('common.status')">
            <a-tag :color="statusColor(currentEcn.status)">
              {{ statusLabel(currentEcn.status) }}
            </a-tag>
          </a-descriptions-item>
          <a-descriptions-item :label="$t('plm.ecn.关联ECR')">{{ currentEcn.ecrNo || currentEcn.ecrId }}</a-descriptions-item>
          <a-descriptions-item :label="$t('plm.ecn.签发时间')">{{ currentEcn.issuedAt }}</a-descriptions-item>
          <a-descriptions-item :label="$t('plm.ecn.生效日期')">{{ currentEcn.effectiveDate || '-' }}</a-descriptions-item>
          <a-descriptions-item :label="$t('common.description')" :span="2">{{ currentEcn.description }}</a-descriptions-item>
        </a-descriptions>
      </template>
    </a-drawer>

    <!-- 签发 ECN 抽屉 -->
    <a-drawer
      v-model:visible="issueDrawerVisible"
      :title="$t('plm.ecn.签发ECN')"
      :width="520"
      @cancel="issueDrawerVisible = false"
    >
      <a-form :model="issueForm" layout="vertical">
        <a-form-item :label="$t('plm.ecn.关联ECR')" required>
          <a-select
            v-model="issueForm.ecrId"
            :placeholder="$t('plm.ecn.搜索已审批的ECR')"
            allow-search
            allow-clear
            :filter-option="false"
            style="width: 100%"
            @search="searchEcrs"
          >
            <a-option
              v-for="e in ecrOptions"
              :key="e.id"
              :value="e.id"
              :label="`${e.ecrNo} - ${e.title}`"
            />
          </a-select>
        </a-form-item>
        <a-form-item :label="$t('common.description')" required>
          <a-textarea v-model="issueForm.description" :placeholder="$t('plm.ecn.请输入变更通知描述')" :auto-size="{ minRows: 3, maxRows: 6 }" />
        </a-form-item>
        <a-form-item :label="$t('plm.ecn.生效日期')">
          <a-date-picker v-model="issueForm.effectiveDate" style="width: 100%" />
        </a-form-item>
        <a-form-item style="margin-top: 24px">
          <a-space>
            <a-button type="primary" :loading="issuing" @click="handleIssue">签发</a-button>
            <a-button @click="issueDrawerVisible = false">{{ $t('common.cancel') }}</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
import { useI18n } from 'vue-i18n'
import { ref, reactive, onMounted } from 'vue'
import { Message } from '@arco-design/web-vue'
import MTable from '@/components/MTable/index.vue'
import type { MTableColumn } from '@/components/MTable/index.vue'
import { plmApi, type Ecn, type Ecr } from '@/api/plm'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()

// ─── 列表 ────────────────────────────────────────────────────
const loading = ref(false)
const tableData = ref<any[]>([])
const total = ref(0)
const query = reactive({ ecrId: '', status: '', page: 1, pageSize: 20 })

const columns: MTableColumn[] = [
  { key: 'ecnNo', title: t('plm.ecn.index.ECN编号'), dataIndex: 'ecnNo', width: 130 },
  { key: 'ecrNo', title: t('plm.ecn.index.关联ECR编号'), dataIndex: 'ecrNo', width: 130 },
  { key: 'description', title: t('plm.ecn.index.描述'), dataIndex: 'description', width: 220, ellipsis: true },
  { key: 'status', title: t('plm.ecn.index.状态'), slotName: 'status', width: 100 },
  { key: 'issuedAt', title: t('plm.ecn.index.签发时间'), dataIndex: 'issuedAt', width: 160 },
  { key: 'action', title: t('plm.ecn.index.操作'), slotName: 'action', width: 140 },
]

function statusColor(status: string) {
  if (status === 'ISSUED') return 'blue'
  if (status === 'COMPLETED') return 'green'
  return 'gray'
}

function statusLabel(status: string) {
  if (status === 'ISSUED') return '已签发'
  if (status === 'COMPLETED') return '已完成'
  return status
}

async function loadData() {
  loading.value = true
  try {
    const params: Record<string, unknown> = { page: query.page, pageSize: query.pageSize }
    if (query.ecrId) params.ecrId = query.ecrId
    if (query.status) params.status = query.status
    const res = await plmApi.getEcns(params)
    tableData.value = (res.list ?? []) as any[]
    total.value = res.total ?? 0
  } catch {
    // handled by interceptor
  } finally {
    loading.value = false
  }
}

function resetQuery() {
  query.ecrId = ''
  query.status = ''
  query.page = 1
  loadData()
}

function onTableChange(e: { page: number; pageSize: number }) {
  query.page = e.page
  query.pageSize = e.pageSize
  loadData()
}

// ─── 完成 ECN ─────────────────────────────────────────────────
const completingId = ref<string | null>(null)

async function handleComplete(ecn: Ecn) {
  completingId.value = ecn.id
  try {
    await plmApi.completeEcn(ecn.id)
    Message.success('ECN 已完成')
    loadData()
  } catch {
    // handled
  } finally {
    completingId.value = null
  }
}

// ─── 详情抽屉 ─────────────────────────────────────────────────
const detailDrawerVisible = ref(false)
const currentEcn = ref<Ecn | null>(null)

function openDetailDrawer(ecn: Ecn) {
  currentEcn.value = ecn
  detailDrawerVisible.value = true
}

// ─── 签发 ECN ─────────────────────────────────────────────────
const issueDrawerVisible = ref(false)
const issuing = ref(false)
const issueForm = reactive({ ecrId: '', description: '', effectiveDate: '' })

// ECR 搜索（只显示已审批的）
const ecrOptions = ref<Ecr[]>([])
let ecrTimer: ReturnType<typeof setTimeout> | null = null
async function searchEcrs(kw: string) {
  if (ecrTimer) clearTimeout(ecrTimer)
  ecrTimer = setTimeout(async () => {
    const res = await plmApi.getEcrs({ status: 'APPROVED', keyword: kw || undefined, pageSize: 20 })
    ecrOptions.value = res.list ?? []
  }, 300)
}

function openIssueDrawer() {
  Object.assign(issueForm, { ecrId: '', description: '', effectiveDate: '' })
  // 预加载已审批 ECR
  searchEcrs('')
  issueDrawerVisible.value = true
}

async function handleIssue() {
  if (!issueForm.ecrId) { Message.warning('请选择关联 ECR'); return }
  if (!issueForm.description) { Message.warning('请填写描述'); return }
  issuing.value = true
  try {
    await plmApi.issueEcn({
      ecrId: issueForm.ecrId,
      description: issueForm.description,
      effectiveDate: issueForm.effectiveDate || undefined,
      issuedBy: authStore.userId ?? 'system',
    })
    Message.success('签发成功')
    issueDrawerVisible.value = false
    loadData()
  } catch { /* handled */ } finally {
    issuing.value = false
  }
}

onMounted(loadData)
</script>

<style scoped>
.page-container {
  padding: 16px;
}
</style>
