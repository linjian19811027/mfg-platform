<template>
  <div class="page-container">
    <a-card :bordered="false" style="margin-bottom: 16px">
      <a-space wrap>
        <a-input v-model="query.equipmentId" :placeholder="$t('eam.lubrication.index.设备ID')" allow-clear style="width: 160px" @keyup.enter="loadData" />
        <a-select v-model="query.status" :placeholder="$t('common.status')" allow-clear style="width: 130px">
          <a-option value="NORMAL">{{ $t('eam.lubrication.normal') }}</a-option>
          <a-option value="DUE_SOON">{{ $t('eam.lubrication.expiring') }}</a-option>
          <a-option value="OVERDUE">{{ $t('eam.lubrication.lbl1127') }}</a-option>
        </a-select>
        <a-button type="primary" @click="loadData">{{ $t('common.search') }}</a-button>
        <a-button @click="resetQuery">{{ $t('common.reset') }}</a-button>
      </a-space>
    </a-card>

    <!-- 逾期预警统计 -->
    <a-row :gutter="16" style="margin-bottom: 16px">
      <a-col :span="8">
        <div class="stat-card">
          <div class="stat-label">{{ $t('eam.lubrication.lbl1128') }}</div>
          <div class="stat-value danger">{{ overdueCount }}</div>
        </div>
      </a-col>
      <a-col :span="8">
        <div class="stat-card">
          <div class="stat-label">{{ $t('eam.lubrication.lbl1129') }}</div>
          <div class="stat-value warning">{{ dueSoonCount }}</div>
        </div>
      </a-col>
      <a-col :span="8">
        <div class="stat-card">
          <div class="stat-label">{{ $t('eam.lubrication.normal') }}</div>
          <div class="stat-value success">{{ normalCount }}</div>
        </div>
      </a-col>
    </a-row>

    <a-card :bordered="false">
      <MTable :columns="columns" :data="tableData" :loading="loading" :total="total" :page-size="20" @change="onTableChange">
        <template #status="{ record }">
          <a-tag :color="record.status === 'NORMAL' ? 'green' : record.status === 'DUE_SOON' ? 'orange' : 'red'">
            {{ { NORMAL: t('eam.lubrication.normal'), DUE_SOON: t('eam.lubrication.expiring'), OVERDUE: t('eam.lubrication.lbl1130') }[record.status as string] ?? record.status }}
          </a-tag>
        </template>
        <template #action="{ record }">
          <a-link @click="openRecordModal(record as unknown as LubricationPoint)">{{ $t('eam.lubrication.lbl1131') }}</a-link>
        </template>
      </MTable>
    </a-card>

    <!-- 记录润滑弹窗 -->
    <a-modal v-model:visible="recordModalVisible" :title="$t('eam.lubrication.index.记录润滑操作')" :ok-loading="recording" @ok="handleRecord" @cancel="recordModalVisible = false">
      <a-form :model="recordForm" layout="vertical">
        <a-form-item :label="$t('eam.lubrication.index.润滑点')">
          <a-input :model-value="currentPoint?.pointName" disabled />
        </a-form-item>
        <a-form-item :label="$t('eam.lubrication.index.润滑油型号')" required>
          <a-input v-model="recordForm.lubricantType" :placeholder="$t('eam.lubrication.index.如ShellOmalaS2G2')" />
        </a-form-item>
        <a-form-item :label="$t('eam.lubrication.index.用量ml')">
          <a-input-number v-model="recordForm.amount" :min="0" style="width:100%" />
        </a-form-item>
        <a-form-item :label="$t('eam.lubrication.index.操作员ID')">
          <a-input v-model="recordForm.operatorId" />
        </a-form-item>
      </a-form>
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
import { eamApi, type LubricationPoint } from '@/api/eam'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const loading = ref(false)
const tableData = ref<any[]>([])
const total = ref(0)
const query = reactive({ equipmentId: '', status: '', page: 1, pageSize: 20 })

const overdueCount = computed(() => tableData.value.filter(r => r.status === 'OVERDUE').length)
const dueSoonCount = computed(() => tableData.value.filter(r => r.status === 'DUE_SOON').length)
const normalCount = computed(() => tableData.value.filter(r => r.status === 'NORMAL').length)

const columns: MTableColumn[] = [
  { key: 'equipmentName', title: t('eam.lubrication.index.设备名称'), dataIndex: 'equipmentName', width: 150 },
  { key: 'pointName', title: t('eam.lubrication.index.润滑点位'), dataIndex: 'pointName', width: 140 },
  { key: 'lubricantType', title: t('eam.lubrication.index.润滑油型号'), dataIndex: 'lubricantType', width: 150 },
  { key: 'cycleDays', title: t('eam.lubrication.index.润滑周期天'), dataIndex: 'cycleDays', width: 120 },
  { key: 'lastDate', title: t('eam.lubrication.index.上次润滑'), dataIndex: 'lastDate', width: 120 },
  { key: 'nextDate', title: t('eam.lubrication.index.下次到期'), dataIndex: 'nextDate', width: 120 },
  { key: 'status', title: t('eam.lubrication.index.状态'), slotName: 'status', width: 100 },
  { key: 'action', title: t('eam.lubrication.index.操作'), slotName: 'action', width: 100 },
]

async function loadData() {
  loading.value = true
  try {
    const res = await eamApi.getLubricationPoints(query)
    tableData.value = (res.list ?? []) as any[]
    total.value = res.total ?? 0
  } catch { tableData.value = [] } finally { loading.value = false }
}

function resetQuery() { query.equipmentId = ''; query.status = ''; query.page = 1; loadData() }
function onTableChange(e: { page: number; pageSize: number }) { query.page = e.page; query.pageSize = e.pageSize; loadData() }

const recordModalVisible = ref(false)
const recording = ref(false)
const currentPoint = ref<LubricationPoint | null>(null)
const recordForm = reactive({ lubricantType: '', amount: 0, operatorId: '' })

function openRecordModal(point: LubricationPoint) {
  currentPoint.value = point
  recordForm.lubricantType = point.lubricantType ?? ''
  recordForm.amount = 0
  recordForm.operatorId = authStore.userId ?? ''
  recordModalVisible.value = true
}

async function handleRecord() {
  if (!currentPoint.value || !recordForm.lubricantType) { Message.warning(t('eam.请填写润滑油型号')); return }
  recording.value = true
  try {
    await eamApi.recordLubrication(currentPoint.value.id, recordForm)
    Message.success(t('eam.润滑记录已保存，下次到期日已更新'))
    recordModalVisible.value = false
    loadData()
  } catch { /* handled */ } finally { recording.value = false }
}

onMounted(loadData)
</script>

<style scoped>
.page-container { padding: 16px; }
.stat-card { background: #161B22; border: 1px solid #21262D; border-radius: 8px; padding: 16px 20px; text-align: center; }
.stat-label { font-size: 13px; color: #8B949E; margin-bottom: 6px; }
.stat-value { font-size: 28px; font-weight: 700; }
.stat-value.danger { color: #F53F3F; }
.stat-value.warning { color: #FF6B35; }
.stat-value.success { color: #00B578; }
</style>
