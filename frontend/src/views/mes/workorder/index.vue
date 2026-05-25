<template>
  <div class="page-container">
    <!-- 搜索栏 -->
    <a-card :bordered="false" style="margin-bottom: 16px">
      <a-space wrap>
        <a-input v-model="query.keyword" :placeholder="$t('common.keyword')" allow-clear style="width: 200px" @press-enter="loadData" />
        <a-select v-model="query.status" :placeholder="$t('common.status')" allow-clear style="width: 140px">
          <a-option value="RELEASED">{{ $t('mes.workorder.status.released') }}</a-option>
          <a-option value="IN_PROGRESS">{{ $t('mes.workorder.status.inProgress') }}</a-option>
          <a-option value="COMPLETED">{{ $t('mes.workorder.status.completed') }}</a-option>
          <a-option value="CLOSED">{{ $t('mes.workorder.status.closed') }}</a-option>
        </a-select>
        <a-button type="primary" @click="loadData">{{ $t('common.search') }}</a-button>
        <a-button @click="resetQuery">{{ $t('common.reset') }}</a-button>
      </a-space>
      <template #extra>
        <a-space>
          <a-button
            v-if="selectedKeys.length > 1"
            status="warning"
            :loading="mergeLoading"
            @click="openMergeModal"
          >{{ $t('mes.workorder.action.merge') }}（{{ selectedKeys.length }}）</a-button>
          <a-button type="primary" @click="openDrawer">{{ $t('common.create') }}</a-button>
        </a-space>
      </template>
    </a-card>

    <a-card :bordered="false">
      <MTable
        :columns="columns"
        :data="tableData"
        :loading="loading"
        :total="total"
        :page-size="query.pageSize"
        row-key="id"
        @change="onTableChange"
      >
        <template #selection="{ record }">
          <a-checkbox
            :model-value="selectedKeys.includes(record.id as string)"
            :disabled="!['RELEASED'].includes(record.status as string)"
            @change="(val: boolean | (string | number | boolean)[]) => toggleSelect(record.id as string, val as boolean)"
          />
        </template>
        <template #status="{ record }">
          <a-tag :color="statusColor(record.status as string)">{{ statusLabel(record.status as string) }}</a-tag>
        </template>
        <template #action="{ record }">
          <a-space>
            <a-link @click="viewDetail(record.id as string)">{{ $t('common.view') }}</a-link>
            <a-dropdown>
              <a-link>{{ $t('mes.workorder.action.flow') }}</a-link>
              <template #content>
                <a-doption
                  v-for="s in nextStatuses(record.status as string)"
                  :key="s.value"
                  @click="doTransition(record.id as string, s.value)"
                >{{ s.label }}</a-doption>
              </template>
            </a-dropdown>
            <a-link
              v-if="['RELEASED'].includes(record.status as string)"
              @click="openSplitModal(record)"
            >{{ $t('mes.workorder.action.split') }}</a-link>
          </a-space>
        </template>
      </MTable>
    </a-card>

    <!-- 新建工单抽屉 -->
    <a-drawer
      v-model:visible="drawerVisible"
      :title="$t('common.create')"
      :width="520"
      @cancel="drawerVisible = false"
    >
      <a-form :model="createForm" layout="vertical">
        <a-form-item :label="$t('mes.workorder.index.物料')" required>
          <a-select
            v-model="createForm.materialId"
            :placeholder="$t('mes.workorder.index.输入编码或名称搜索物料')"
            allow-search
            allow-clear
            :filter-option="false"
            style="width: 100%"
            @search="searchMaterials"
          >
            <a-option v-for="m in matOptions" :key="m.id" :value="m.id" :label="`${m.code} - ${m.name}`" />
          </a-select>
        </a-form-item>
        <a-form-item :label="$t('mes.workorder.index.计划数量')" required>
          <a-input-number v-model="createForm.plannedQty" :min="1" style="width: 100%" />
        </a-form-item>
        <a-form-item :label="$t('mes.workorder.index.计划开始日期')">
          <a-date-picker v-model="createForm.plannedStartDate" style="width: 100%" />
        </a-form-item>
        <a-form-item :label="$t('mes.workorder.index.计划结束日期')">
          <a-date-picker v-model="createForm.plannedEndDate" style="width: 100%" />
        </a-form-item>
        <a-form-item style="margin-top: 24px">
          <a-space>
            <a-button type="primary" :loading="submitting" @click="handleSubmit">{{ $t('common.save') }}</a-button>
            <a-button @click="drawerVisible = false">{{ $t('common.cancel') }}</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-drawer>

    <!-- 拆分弹窗 -->
    <a-modal
      v-model:visible="splitVisible"
      :title="$t('mes.workorder.action.split')"
      :width="520"
      :confirm-loading="splitLoading"
      @ok="handleSplit"
      @cancel="splitVisible = false"
    >
      <template v-if="splitTarget">
        <a-descriptions :column="2" size="small" style="margin-bottom:16px">
          <a-descriptions-item :label="$t('mes.workorder.index.工单号')">{{ splitTarget.code }}</a-descriptions-item>
          <a-descriptions-item :label="$t('mes.workorder.index.计划数量')">{{ splitTarget.plannedQty }}</a-descriptions-item>
        </a-descriptions>
        <div class="split-rows">
          <div v-for="(_row, idx) in splitQtys" :key="idx" class="split-row">
            <span class="split-row-label">{{ $t('mes.workorder.r22010', {idx: idx + 1}) }}</span>
            <a-input-number
              v-model="splitQtys[idx]"
              :min="1"
              ::placeholder="t('mes.workorder.lbl1329')"
              style="width: 140px"
            />
            <a-button
              v-if="splitQtys.length > 2"
              type="text"
              status="danger"
              size="mini"
              @click="splitQtys.splice(idx, 1)"
            >{{ $t('mes.workorder.delete') }}</a-button>
          </div>
        </div>
        <div class="split-actions">
          <a-button type="dashed" size="small" @click="splitQtys.push(undefined as unknown as number)">
            + {{ $t('common.add') }}
          </a-button>
          <span class="split-sum" :class="splitSumOk ? 'sum-ok' : 'sum-err'">
            {{ $t('mes.workorder.msg.allocated') }}：{{ splitSum }} / {{ splitTarget.plannedQty }}
            {{ splitSumOk ? '✓' : $t('mes.workorder.msg.splitSum') }}
          </span>
        </div>
        <a-form-item :label="$t('mes.workorder.index.拆分原因')" style="margin-top:12px">
          <a-textarea v-model="splitReason" :placeholder="$t('mes.workorder.index.可选')" :max-length="200" :auto-size="{ minRows: 2 }" />
        </a-form-item>
      </template>
    </a-modal>

    <!-- 合并弹窗 -->
    <a-modal
      v-model:visible="mergeVisible"
      :title="$t('mes.workorder.action.merge')"
      :width="520"
      :confirm-loading="mergeLoading"
      @ok="handleMerge"
      @cancel="mergeVisible = false"
    >
      <p style="color:#8B949E;margin-bottom:12px">{{ $t('mes.workorder.r22011', {length: selectedKeys.length}) }}</p>
      <a-tag v-for="id in selectedKeys" :key="id" style="margin:2px">
        {{ tableData.find(r => r.id === id)?.code ?? id }}
      </a-tag>
      <a-form-item :label="$t('mes.workorder.index.合并原因')" style="margin-top:16px">
        <a-textarea v-model="mergeReason" :placeholder="$t('mes.workorder.index.可选')" :max-length="200" :auto-size="{ minRows: 2 }" />
      </a-form-item>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Message } from '@arco-design/web-vue'

const { t } = useI18n()
import MTable from '@/components/MTable/index.vue'
import type { MTableColumn } from '@/components/MTable/index.vue'
import { mesApi } from '@/api/mes'
import { plmApi, type Material } from '@/api/plm'

const router = useRouter()
const loading = ref(false)
const submitting = ref(false)
const splitLoading = ref(false)
const mergeLoading = ref(false)
const tableData = ref<any[]>([])
const total = ref(0)
const drawerVisible = ref(false)

// 多选
const selectedKeys = ref<string[]>([])

// 拆分
const splitVisible = ref(false)
const splitTarget = ref<Record<string, unknown> | null>(null)
const splitQtys = ref<number[]>([])
const splitReason = ref('')

// 合并
const mergeVisible = ref(false)
const mergeReason = ref('')

const query = reactive({ keyword: '', status: '', page: 1, pageSize: 20 })

const STATUS_MAP = computed<Record<string, { label: string; color: string }>>(() => ({
  RELEASED: { label: t('mes.workorder.status.released'), color: 'blue' },
  IN_PROGRESS: { label: t('mes.workorder.status.inProgress'), color: 'orange' },
  COMPLETED: { label: t('mes.workorder.status.completed'), color: 'green' },
  CLOSED: { label: t('mes.workorder.status.closed'), color: 'gray' },
}))

const TRANSITIONS = computed<Record<string, { label: string; value: string }[]>>(() => ({
  RELEASED: [{ label: t('mes.workorder.action.start'), value: 'IN_PROGRESS' }],
  IN_PROGRESS: [{ label: t('mes.workorder.action.finish'), value: 'COMPLETED' }],
  COMPLETED: [{ label: t('mes.workorder.action.close'), value: 'CLOSED' }],
  CLOSED: [],
}))

const columns = computed<MTableColumn[]>(() => [
  { key: 'selection', title: '', slotName: 'selection', width: 40 },
  { key: 'woNo', title: t('mes.workorder.woNo'), dataIndex: 'woNo', width: 140 },
  { key: 'materialName', title: t('common.name'), dataIndex: 'materialName', width: 160 },
  { key: 'plannedQty', title: t('mes.workorder.plannedQty'), dataIndex: 'plannedQty', width: 100 },
  { key: 'completedQty', title: t('mes.workorder.completedQty'), dataIndex: 'completedQty', width: 100 },
  { key: 'status', title: t('common.status'), slotName: 'status', width: 100 },
  { key: 'plannedStart', title: t('common.name'), dataIndex: 'plannedStart', width: 120 }, // Should be date
  { key: 'plannedEnd', title: t('common.name'), dataIndex: 'plannedEnd', width: 120 },
  { key: 'action', title: t('common.operation'), slotName: 'action', width: 160 },
])

// 物料搜索
const matOptions = ref<Material[]>([])
const createForm = reactive({ materialId: '', plannedQty: undefined as number | undefined, plannedStartDate: '', plannedEndDate: '' })
let matTimer: ReturnType<typeof setTimeout> | null = null
async function searchMaterials(kw: string) {
  if (!kw) { matOptions.value = []; return }
  if (matTimer) clearTimeout(matTimer)
  matTimer = setTimeout(async () => {
    const res = await plmApi.getMaterials({ keyword: kw, pageSize: 20 })
    matOptions.value = res.list ?? []
  }, 300)
}

const statusColor = (s: string) => (STATUS_MAP.value as any)[s]?.color ?? 'gray'
const statusLabel = (s: string) => (STATUS_MAP.value as any)[s]?.label ?? s
const nextStatuses = (s: string) => (TRANSITIONS.value as any)[s] ?? []

// 拆分合计计算
const splitSum = computed(() => splitQtys.value.reduce((s, v) => s + (v || 0), 0))
const splitSumOk = computed(() => splitTarget.value && splitSum.value === (splitTarget.value.plannedQty as number))

async function loadData() {
  loading.value = true
  try {
    const res = await mesApi.getMesWorkOrders(query)
    tableData.value = (res.list ?? []) as any[]
    total.value = res.total ?? 0
  } finally {
    loading.value = false
  }
}

function resetQuery() {
  query.keyword = ''
  query.status = ''
  query.page = 1
  selectedKeys.value = []
  loadData()
}

function onTableChange(e: { page: number; pageSize: number }) {
  query.page = e.page
  query.pageSize = e.pageSize
  loadData()
}

function viewDetail(id: string) {
  router.push(`/mes/workorder/${id}`)
}

function toggleSelect(id: string, checked: boolean) {
  if (checked) {
    if (!selectedKeys.value.includes(id)) selectedKeys.value.push(id)
  } else {
    selectedKeys.value = selectedKeys.value.filter(k => k !== id)
  }
}

function openDrawer() {
  createForm.materialId = ''
  createForm.plannedQty = undefined
  createForm.plannedStartDate = ''
  createForm.plannedEndDate = ''
  matOptions.value = []
  drawerVisible.value = true
}

async function handleSubmit() {
  if (!createForm.materialId) { Message.warning(t('mes.请选择物料')); return }
  if (!createForm.plannedQty) { Message.warning(t('mes.请输入计划数量')); return }
  submitting.value = true
  try {
    // 冗余物料信息到工单（避免跨模块查询 PLM）
    const selectedMat = matOptions.value.find(m => m.id === createForm.materialId)
    await mesApi.createMesWorkOrder({
      ...createForm,
      materialCode: selectedMat?.code ?? '',
      materialName: selectedMat?.name ?? '',
    })
    Message.success(t('common.success'))
    drawerVisible.value = false
    loadData()
  } finally {
    submitting.value = false
  }
}

async function doTransition(id: string, status: string) {
  try {
    await mesApi.transitionWorkOrder(id, status)
    Message.success(t('common.success'))
    loadData()
  } catch {
    Message.error(t('common.error')) // Using generic error or specific if needed
  }
}

// ── 拆分 ────────────────────────────────────────────────────────────────────
function openSplitModal(record: Record<string, unknown>) {
  splitTarget.value = record
  const planned = (record.plannedQty as number) || 0
  const half = Math.floor(planned / 2)
  splitQtys.value = [half, planned - half]
  splitReason.value = ''
  splitVisible.value = true
}

async function handleSplit() {
  if (!splitSumOk.value) {
    Message.warning(t('mes.workorder.msg.splitSum'))
    return
  }
  const validQtys = splitQtys.value.filter(q => q > 0)
  if (validQtys.length < 2) {
    Message.warning(t('mes.workorder.msg.splitMin'))
    return
  }
  splitLoading.value = true
  try {
    await mesApi.splitWorkOrder(splitTarget.value!.id as string, {
      splitQtys: validQtys,
      reason: splitReason.value || undefined,
    })
    Message.success(t('common.success'))
    splitVisible.value = false
    loadData()
  } catch {
    // unified error
  } finally {
    splitLoading.value = false
  }
}

// ── 合并 ────────────────────────────────────────────────────────────────────
function openMergeModal() {
  mergeReason.value = ''
  mergeVisible.value = true
}

async function handleMerge() {
  if (selectedKeys.value.length < 2) {
    Message.warning(t('mes.workorder.msg.mergeMin'))
    return
  }
  mergeLoading.value = true
  try {
    await mesApi.mergeWorkOrders({
      sourceIds: selectedKeys.value,
      reason: mergeReason.value || undefined,
    })
    Message.success(t('common.success'))
    mergeVisible.value = false
    selectedKeys.value = []
    loadData()
  } catch {
    // unified error
  } finally {
    mergeLoading.value = false
  }
}

onMounted(loadData)
</script>

<style scoped>
.page-container { padding: 16px; }

.split-rows { display: flex; flex-direction: column; gap: 8px; margin-bottom: 8px; }
.split-row { display: flex; align-items: center; gap: 10px; }
.split-row-label { width: 70px; font-size: 13px; color: #8B949E; }
.split-actions { display: flex; align-items: center; gap: 16px; margin: 8px 0; }
.split-sum { font-size: 12px; }
.sum-ok { color: #00B578; }
.sum-err { color: #F53F3F; }
</style>
