<template>
  <div class="page-container">
    <a-card>
      <!-- 搜索栏 -->
      <div class="search-bar">
        <a-input
          v-model="query.batchNo"
          :placeholder="$t('base.batch.index.批次号')"
          allow-clear
          style="width: 180px"
          @press-enter="handleSearch"
        />
        <a-input
          v-model="query.materialCode"
          :placeholder="$t('base.batch.index.物料编码名称')"
          allow-clear
          style="width: 180px"
          @press-enter="handleSearch"
        />
        <a-select
          v-model="query.qualityStatus"
          :placeholder="$t('base.batch.index.质量状态')"
          allow-clear
          style="width: 140px"
        >
          <a-option v-for="s in QUALITY_STATUS_OPTIONS" :key="s.value" :value="s.value">
            {{ s.label }}
          </a-option>
        </a-select>
        <a-button type="primary" @click="handleSearch">{{ $t('common.search') }}</a-button>
        <a-button @click="resetQuery">{{ $t('common.reset') }}</a-button>
      </div>

      <MTable
        :columns="columns"
        :data="list as any[]"
        :loading="loading"
        :total="total"
        @change="onTableChange"
      >
        <template #qualityStatus="{ record }">
          <a-tag :color="getStatusColor(record.qualityStatus as QualityStatus)" size="small">
            {{ getStatusLabel(record.qualityStatus as QualityStatus) }}
          </a-tag>
        </template>
        <template #qty="{ record }">
          <span>{{ record.currentQty }} / {{ record.initialQty }} {{ record.uomName }}</span>
        </template>
        <template #action="{ record }">
          <a-space>
            <a-button type="text" size="small" @click="openDetail(record as unknown as MaterialBatch)">
              详情
            </a-button>
            <a-button
              type="text"
              size="small"
              status="warning"
              @click="openChangeStatus(record as unknown as MaterialBatch)"
            >
              变更状态
            </a-button>
          </a-space>
        </template>
      </MTable>
    </a-card>

    <!-- 详情抽屉 -->
    <a-drawer
      v-model:visible="detailVisible"
      :title="$t('base.batch.index.批次详情')"
      :width="760"
      :footer="false"
    >
      <div v-if="detailLoading" class="drawer-loading">
        <a-spin />
      </div>
      <template v-else-if="detailBatch">
        <!-- 基本信息 -->
        <div class="detail-section-title">基本信息</div>
        <a-descriptions :column="2" bordered size="small">
          <a-descriptions-item :label="$t('base.batch.index.批次号')">{{ detailBatch.batchNo }}</a-descriptions-item>
          <a-descriptions-item :label="$t('base.batch.index.质量状态')">
            <a-tag :color="getStatusColor(detailBatch.qualityStatus)" size="small">
              {{ getStatusLabel(detailBatch.qualityStatus) }}
            </a-tag>
          </a-descriptions-item>
          <a-descriptions-item :label="$t('base.batch.index.物料编码')">{{ detailBatch.materialCode }}</a-descriptions-item>
          <a-descriptions-item :label="$t('base.batch.index.物料名称')">{{ detailBatch.materialName }}</a-descriptions-item>
          <a-descriptions-item :label="$t('base.batch.index.初始数量')">{{ detailBatch.initialQty }} {{ detailBatch.uomName }}</a-descriptions-item>
          <a-descriptions-item :label="$t('base.batch.index.当前数量')">{{ detailBatch.currentQty }} {{ detailBatch.uomName }}</a-descriptions-item>
          <a-descriptions-item :label="$t('base.batch.index.供应商')">{{ detailBatch.supplierName ?? '—' }}</a-descriptions-item>
          <a-descriptions-item :label="$t('base.batch.index.供应商批次号')">{{ detailBatch.supplierBatchNo ?? '—' }}</a-descriptions-item>
          <a-descriptions-item :label="$t('base.batch.index.合格证编号')">{{ detailBatch.certificateNo ?? '—' }}</a-descriptions-item>
          <a-descriptions-item :label="$t('base.batch.index.来源类型')">{{ SOURCE_TYPE_MAP[detailBatch.sourceType] ?? detailBatch.sourceType }}</a-descriptions-item>
          <a-descriptions-item :label="$t('base.batch.index.生产日期')">{{ detailBatch.producedAt ?? '—' }}</a-descriptions-item>
          <a-descriptions-item :label="$t('base.batch.index.有效期至')">{{ detailBatch.expireAt ?? '—' }}</a-descriptions-item>
          <a-descriptions-item :label="$t('base.batch.index.入库时间')" :span="2">{{ detailBatch.createdAt }}</a-descriptions-item>
        </a-descriptions>

        <!-- 质量检验记录 -->
        <div class="detail-section-title" style="margin-top: 24px">质量检验记录</div>
        <a-table
          :columns="inspectionColumns"
          :data="inspections"
          :loading="inspectionLoading"
          :pagination="false"
          size="small"
          :bordered="{ cell: false }"
        >
          <template #result="{ record }">
            <a-tag :color="record.result === 'QUALIFIED' ? 'green' : 'red'" size="small">
              {{ record.result === 'QUALIFIED' ? '合格' : '不合格' }}
            </a-tag>
          </template>
        </a-table>

        <!-- 库存流水 -->
        <div class="detail-section-title" style="margin-top: 24px">库存流水</div>
        <a-table
          :columns="ledgerColumns"
          :data="ledgers"
          :loading="ledgerLoading"
          :pagination="false"
          size="small"
          :bordered="{ cell: false }"
        >
          <template #qty="{ record }">
            <span :style="{ color: (record.qty as number) >= 0 ? 'var(--color-success-6)' : 'var(--color-danger-6)' }">
              {{ (record.qty as number) >= 0 ? '+' : '' }}{{ record.qty }}
            </span>
          </template>
        </a-table>
      </template>
    </a-drawer>

    <!-- 变更质量状态 Modal -->
    <a-modal
      v-model:visible="changeStatusVisible"
      :title="$t('base.batch.index.变更质量状态')"
      :width="440"
      @cancel="changeStatusVisible = false"
    >
      <a-form ref="statusFormRef" :model="statusForm" layout="vertical">
        <a-form-item :label="$t('base.batch.index.当前状态')">
          <a-tag v-if="changingBatch" :color="getStatusColor(changingBatch.qualityStatus)" size="small">
            {{ getStatusLabel(changingBatch.qualityStatus) }}
          </a-tag>
        </a-form-item>
        <a-form-item
          field="newStatus"
          :label="$t('base.batch.index.变更为')"
          :rules="[{ required: true, message: '请选择新状态' }]"
        >
          <a-select v-model="statusForm.newStatus" :placeholder="$t('base.batch.index.请选择目标状态')">
            <a-option
              v-for="s in availableStatuses"
              :key="s.value"
              :value="s.value"
            >
              <a-tag :color="s.color" size="small" style="margin-right: 6px">{{ s.label }}</a-tag>
            </a-option>
          </a-select>
        </a-form-item>
        <a-form-item
          field="reason"
          :label="$t('base.batch.index.变更原因')"
          :rules="[{ required: true, message: '请填写变更原因' }]"
          validate-trigger="blur"
        >
          <a-textarea
            v-model="statusForm.reason"
            :placeholder="$t('base.batch.index.请说明变更原因')"
            :max-length="200"
            show-word-limit
            :auto-size="{ minRows: 3 }"
          />
        </a-form-item>
      </a-form>
      <template #footer>
        <a-button @click="changeStatusVisible = false">{{ $t('common.cancel') }}</a-button>
        <a-popconfirm
          :content="`确认将批次 ${changingBatch?.batchNo} 的质量状态变更为「${getStatusLabel(statusForm.newStatus as QualityStatus)}」？`"
          @ok="handleChangeStatus"
        >
          <a-button type="primary" :loading="statusSubmitting">确认变更</a-button>
        </a-popconfirm>
      </template>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
import { useI18n } from 'vue-i18n'
import { ref, reactive, computed, onMounted } from 'vue'
import { Message } from '@arco-design/web-vue'
import MTable from '@/components/MTable/index.vue'
import type { MTableColumn } from '@/components/MTable/index.vue'
import {
  batchApi,
  type MaterialBatch,
  type QualityStatus,
  type QualityInspection,
  type BatchLedger,
} from '@/api/base'

// ---- 常量 ----

const QUALITY_STATUS_OPTIONS = [
  { value: 'UNINSPECTED', label: '待检', color: 'orange' },
  { value: 'QUALIFIED', label: '合格', color: 'green' },
  { value: 'UNQUALIFIED', label: '不合格', color: 'red' },
  { value: 'FROZEN', label: '冻结', color: 'gray' },
]

const SOURCE_TYPE_MAP: Record<string, string> = {
  PURCHASE: '采购入库',
  PRODUCTION: '生产入库',
  RETURN: '退货入库',
  ADJUST: '调整',
}

function getStatusColor(status: QualityStatus): string {
  const map: Record<QualityStatus, string> = {
    UNINSPECTED: 'orange',
    QUALIFIED: 'green',
    UNQUALIFIED: 'red',
    FROZEN: 'gray',
  }
  return map[status] ?? 'gray'
}

function getStatusLabel(status: QualityStatus | string): string {
  return QUALITY_STATUS_OPTIONS.find(s => s.value === status)?.label ?? status
}

// ---- 列定义 ----

const columns: MTableColumn[] = [
  { key: 'batchNo', title: t('base.batch.index.批次号'), width: 160 },
  { key: 'materialCode', title: t('base.batch.index.物料编码'), width: 120 },
  { key: 'materialName', title: t('base.batch.index.物料名称'), width: 160, ellipsis: true },
  { key: 'qty', title: t('base.batch.index.数量当前初始'), width: 180, slotName: 'qty' },
  { key: 'supplierName', title: t('base.batch.index.供应商'), width: 160, ellipsis: true },
  { key: 'producedAt', title: t('base.batch.index.生产日期'), width: 110 },
  { key: 'expireAt', title: t('base.batch.index.有效期至'), width: 110 },
  { key: 'qualityStatus', title: t('base.batch.index.质量状态'), width: 100, slotName: 'qualityStatus' },
  { key: 'createdAt', title: t('base.batch.index.入库时间'), width: 160 },
  { key: 'action', title: t('base.batch.index.操作'), width: 140, slotName: 'action' },
]

const inspectionColumns = [
  { title: t('base.batch.index.检验单号'), dataIndex: 'inspectionNo', width: 160 },
  { title: t('base.batch.index.检验时间'), dataIndex: 'inspectedAt', width: 160 },
  { title: t('base.batch.index.检验员'), dataIndex: 'inspector', width: 100 },
  { title: t('base.batch.index.检验结果'), dataIndex: 'result', slotName: 'result', width: 100 },
  { title: t('base.batch.index.备注'), dataIndex: 'remark', ellipsis: true },
]

const ledgerColumns = [
  { title: t('base.batch.index.业务类型'), dataIndex: 'txType', width: 100 },
  { title: t('base.batch.index.发生时间'), dataIndex: 'occurredAt', width: 160 },
  { title: t('base.batch.index.变动数量'), dataIndex: 'qty', slotName: 'qty', width: 120 },
  { title: t('base.batch.index.变动前'), dataIndex: 'beforeQty', width: 100 },
  { title: t('base.batch.index.变动后'), dataIndex: 'afterQty', width: 100 },
  { title: t('base.batch.index.关联单号'), dataIndex: 'refNo', width: 160 },
  { title: t('base.batch.index.操作人'), dataIndex: 'operator', width: 100 },
  { title: t('base.batch.index.备注'), dataIndex: 'remark', ellipsis: true },
]

// ---- 列表状态 ----

const query = reactive({ batchNo: '', materialCode: '', qualityStatus: '' })
const list = ref<MaterialBatch[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const pageSize = ref(20)

async function loadData() {
  loading.value = true
  try {
    const params = {
      ...query,
      page: page.value,
      pageSize: pageSize.value,
    }
    const res = await batchApi.getBatches(params)
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
  query.batchNo = ''
  query.materialCode = ''
  query.qualityStatus = ''
  page.value = 1
  loadData()
}

function onTableChange(e: { page: number; pageSize: number }) {
  page.value = e.page
  pageSize.value = e.pageSize
  loadData()
}

// ---- 详情抽屉 ----

const detailVisible = ref(false)
const detailLoading = ref(false)
const detailBatch = ref<MaterialBatch | null>(null)
const inspections = ref<QualityInspection[]>([])
const ledgers = ref<BatchLedger[]>([])
const inspectionLoading = ref(false)
const ledgerLoading = ref(false)

async function openDetail(batch: MaterialBatch) {
  detailVisible.value = true
  detailLoading.value = true
  inspectionLoading.value = true
  ledgerLoading.value = true
  try {
    detailBatch.value = await batchApi.getBatch(batch.id)
  } finally {
    detailLoading.value = false
  }
  batchApi.getInspections(batch.id).then(data => {
    inspections.value = data
  }).finally(() => {
    inspectionLoading.value = false
  })
  batchApi.getLedgers(batch.id).then(data => {
    ledgers.value = data
  }).finally(() => {
    ledgerLoading.value = false
  })
}

// ---- 变更质量状态 ----

const changeStatusVisible = ref(false)
const changingBatch = ref<MaterialBatch | null>(null)
const statusFormRef = ref()
const statusForm = reactive<{ newStatus: string; reason: string }>({
  newStatus: '',
  reason: '',
})
const statusSubmitting = ref(false)

const availableStatuses = computed(() =>
  QUALITY_STATUS_OPTIONS.filter(s => s.value !== changingBatch.value?.qualityStatus)
)

function openChangeStatus(batch: MaterialBatch) {
  changingBatch.value = batch
  statusForm.newStatus = ''
  statusForm.reason = ''
  changeStatusVisible.value = true
}

async function handleChangeStatus() {
  const valid = await statusFormRef.value?.validate()
  if (valid) return
  if (!changingBatch.value) return
  statusSubmitting.value = true
  try {
    await batchApi.changeQualityStatus(changingBatch.value.id, {
      newStatus: statusForm.newStatus as QualityStatus,
      reason: statusForm.reason,
    })
    Message.success('质量状态已变更')
    changeStatusVisible.value = false
    loadData()
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '操作失败'
    Message.error(msg)
  } finally {
    statusSubmitting.value = false
  }
}

// ---- 初始化 ----

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.page-container {
  padding: 16px;
}

.search-bar {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.drawer-loading {
  display: flex;
  justify-content: center;
  padding: 60px 0;
}

.detail-section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-1);
  margin-bottom: 12px;
  padding-left: 8px;
  border-left: 3px solid var(--color-primary-6);
}
</style>
