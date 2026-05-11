<template>
  <div class="page-container">
    <a-card>
      <div class="search-bar">
        <a-select v-model="query.status" :placeholder="$t('common.status')" allow-clear style="width:130px">
          <a-option v-for="s in statusOptions" :key="s.value" :value="s.value">{{ s.label }}</a-option>
        </a-select>
        <a-button type="primary" @click="loadData">{{ $t('common.search') }}</a-button>
        <a-button @click="resetQuery">{{ $t('common.reset') }}</a-button>
        <a-button style="margin-left:auto" type="primary" @click="openCreate">新建设备</a-button>
      </div>

      <MTable :columns="columns" :data="list" :loading="loading" :total="total" @change="onTableChange">
        <template #status="{ record }">
          <a-tag :color="statusColorMap[record.status as string] ?? 'gray'">{{ statusLabelMap[record.status as string] ?? record.status }}</a-tag>
        </template>
        <template #action="{ record }">
          <a-button type="text" size="small" @click="openDetail(record as Equipment)">查看</a-button>
        </template>
      </MTable>
    </a-card>

    <!-- 新建设备 -->
    <a-drawer v-model:visible="createVisible" :title="$t('eam.equipment.index.新建设备')" :width="480" @cancel="createVisible=false">
      <MForm :schema="createSchema" v-model="createForm" :loading="submitting" @submit="handleCreate" @cancel="createVisible=false" />
    </a-drawer>

    <!-- 设备详情 -->
    <a-drawer v-model:visible="detailVisible" :title="`设备详情 - ${currentDetail?.name ?? ''}`" :width="720" @cancel="detailVisible=false">
      <a-tabs default-active-key="basic">
        <a-tab-pane key="basic" :title="$t('eam.equipment.index.基本信息')">
          <a-descriptions :data="detailItems" bordered :column="1" />
        </a-tab-pane>
        
        <a-tab-pane key="techspec" :title="$t('eam.equipment.index.技术规格')">
          <a-spin :loading="techSpecLoading">
            <div v-if="techSpec">
              <div style="margin-bottom:16px;text-align:right">
                <a-button v-if="!techSpecEditing" type="primary" size="small" @click="techSpecEditing=true">编辑</a-button>
                <a-space v-else>
                  <a-button size="small" @click="cancelTechSpecEdit">{{ $t('common.cancel') }}</a-button>
                  <a-button type="primary" size="small" :loading="techSpecSaving" @click="saveTechSpec">{{ $t('common.save') }}</a-button>
                </a-space>
              </div>
              <a-descriptions v-if="!techSpecEditing" :data="techSpecItems" bordered :column="1" />
              <a-form v-else :model="techSpecForm" layout="vertical">
                <a-form-item :label="$t('eam.equipment.index.额定功率kW')">
                  <a-input-number v-model="techSpecForm.ratedPower" :precision="2" style="width:100%" />
                </a-form-item>
                <a-form-item :label="$t('eam.equipment.index.额定电压V')">
                  <a-input-number v-model="techSpecForm.ratedVoltage" :precision="0" style="width:100%" />
                </a-form-item>
                <a-form-item :label="$t('eam.equipment.index.额定电流A')">
                  <a-input-number v-model="techSpecForm.ratedCurrent" :precision="2" style="width:100%" />
                </a-form-item>
                <a-form-item :label="$t('eam.equipment.index.转速rpm')">
                  <a-input-number v-model="techSpecForm.speed" :precision="0" style="width:100%" />
                </a-form-item>
                <a-form-item :label="$t('eam.equipment.index.精度等级')">
                  <a-input v-model="techSpecForm.accuracyGrade" :placeholder="$t('eam.equipment.index.如001mm')" />
                </a-form-item>
                <a-form-item :label="$t('eam.equipment.index.工作温度范围')">
                  <a-input v-model="techSpecForm.tempRange" :placeholder="$t('eam.equipment.index.如1050')" />
                </a-form-item>
                <a-form-item :label="$t('eam.equipment.index.防护等级')">
                  <a-input v-model="techSpecForm.protectionLevel" :placeholder="$t('eam.equipment.index.如IP65')" />
                </a-form-item>
              </a-form>
            </div>
            <a-empty v-else :description="$t('eam.equipment.index.暂无技术规格数据')" />
          </a-spin>
        </a-tab-pane>
        
        <a-tab-pane key="finance" :title="$t('eam.equipment.index.财务信息')">
          <a-spin :loading="financeLoading">
            <div v-if="finance">
              <div style="margin-bottom:16px;text-align:right">
                <a-button v-if="!financeEditing" type="primary" size="small" @click="financeEditing=true">编辑</a-button>
                <a-space v-else>
                  <a-button size="small" @click="cancelFinanceEdit">{{ $t('common.cancel') }}</a-button>
                  <a-button type="primary" size="small" :loading="financeSaving" @click="saveFinance">{{ $t('common.save') }}</a-button>
                </a-space>
              </div>
              <a-descriptions v-if="!financeEditing" :data="financeItems" bordered :column="1" />
              <a-form v-else :model="financeForm" layout="vertical">
                <a-form-item :label="$t('eam.equipment.index.原值元')">
                  <a-input-number v-model="financeForm.originalValue" :precision="2" style="width:100%" />
                </a-form-item>
                <a-form-item :label="$t('eam.equipment.index.净值元')">
                  <a-input-number v-model="financeForm.netValue" :precision="2" style="width:100%" />
                </a-form-item>
                <a-form-item :label="$t('eam.equipment.index.折旧方法')">
                  <a-select v-model="financeForm.depreciationMethod" style="width:100%">
                    <a-option value="straight">直线法</a-option>
                    <a-option value="double_declining">双倍余额递减法</a-option>
                  </a-select>
                </a-form-item>
                <a-form-item :label="$t('eam.equipment.index.折旧年限年')">
                  <a-input-number v-model="financeForm.depreciationYears" :precision="0" :min="1" style="width:100%" />
                </a-form-item>
                <a-form-item :label="$t('eam.equipment.index.累计折旧元')">
                  <a-input-number v-model="financeForm.accumulatedDepreciation" :precision="2" style="width:100%" />
                </a-form-item>
                <a-form-item :label="$t('eam.equipment.index.残值率')">
                  <a-input-number v-model="financeForm.residualRate" :precision="2" :min="0" :max="100" style="width:100%" />
                </a-form-item>
                <a-form-item :label="$t('eam.equipment.index.购置日期')">
                  <a-date-picker v-model="financeForm.purchaseDate" style="width:100%" />
                </a-form-item>
                <a-form-item :label="$t('eam.equipment.index.资产编号')">
                  <a-input v-model="financeForm.assetCode" />
                </a-form-item>
              </a-form>
            </div>
            <a-empty v-else :description="$t('eam.equipment.index.暂无财务信息')" />
          </a-spin>
        </a-tab-pane>
        
        <a-tab-pane key="history" :title="$t('eam.equipment.index.变更历史')">
          <div style="margin-bottom:16px">
            <a-select v-model="historyFilter" :placeholder="$t('eam.equipment.index.变更类型')" allow-clear style="width:150px" @change="filterHistory">
              <a-option value="location">位置变更</a-option>
              <a-option value="status">状态变更</a-option>
              <a-option value="maintenance">维修记录</a-option>
              <a-option value="param">参数修改</a-option>
            </a-select>
          </div>
          <a-table :columns="historyColumns" :data="filteredHistory" :pagination="false" :loading="historyLoading">
            <template #changeType="{ record }">
              <a-tag :color="changeTypeColorMap[record.changeType]">{{ changeTypeLabelMap[record.changeType] }}</a-tag>
            </template>
          </a-table>
          <a-empty v-if="!historyLoading && filteredHistory.length === 0" :description="$t('eam.equipment.index.暂无变更记录')" />
        </a-tab-pane>
      </a-tabs>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
import { useI18n } from 'vue-i18n'
import { ref, reactive, computed } from 'vue'
import { Message } from '@arco-design/web-vue'
import MTable from '@/components/MTable/index.vue'
import MForm from '@/components/MForm/index.vue'
import type { MTableColumn } from '@/components/MTable/index.vue'
import type { MFormField } from '@/components/MForm/index.vue'
import { eamApi, type Equipment } from '@/api/eam'

// ---- 状态映射 ----
const statusOptions = [
  { label: '运行中', value: 'running' }, { label: '空闲', value: 'idle' },
  { label: '维保中', value: 'maintenance' }, { label: '故障', value: 'fault' }, { label: '报废', value: 'scrapped' },
]
const statusColorMap: Record<string, string> = { running: 'green', idle: 'blue', maintenance: 'orange', fault: 'red', scrapped: 'gray' }
const statusLabelMap: Record<string, string> = { running: '运行中', idle: '空闲', maintenance: '维保中', fault: '故障', scrapped: '报废' }

// ---- 变更历史类型映射 ----
const changeTypeColorMap: Record<string, string> = { location: 'blue', status: 'orange', maintenance: 'green', param: 'purple' }
const changeTypeLabelMap: Record<string, string> = { location: '位置变更', status: '状态变更', maintenance: '维修记录', param: '参数修改' }

// ---- 列表列定义 ----
const columns: MTableColumn[] = [
  { key: 'code', title: t('eam.equipment.index.编码'), width: 120 },
  { key: 'name', title: t('eam.equipment.index.名称') },
  { key: 'type', title: t('eam.equipment.index.类型'), width: 100 },
  { key: 'status', title: t('eam.equipment.index.状态'), width: 90, slotName: 'status' },
  { key: 'workshopId', title: t('eam.equipment.index.车间'), width: 100 },
  { key: 'model', title: t('eam.equipment.index.型号'), width: 120 },
  { key: 'manufacturer', title: t('eam.equipment.index.厂商'), width: 120 },
  { key: 'installDate', title: t('eam.equipment.index.安装日期'), width: 120 },
  { key: 'action', title: t('eam.equipment.index.操作'), width: 70, slotName: 'action' },
]

// ---- 变更历史表格列 ----
const historyColumns = [
  { dataIndex: 'changedAt', title: t('eam.equipment.index.变更时间'), width: 160 },
  { dataIndex: 'changeType', title: t('eam.equipment.index.变更类型'), width: 110, slotName: 'changeType' },
  { dataIndex: 'beforeValue', title: t('eam.equipment.index.变更前'), ellipsis: true },
  { dataIndex: 'afterValue', title: t('eam.equipment.index.变更后'), ellipsis: true },
  { dataIndex: 'operator', title: t('eam.equipment.index.操作人'), width: 90 },
]

// ---- 新建表单 ----
const createSchema: MFormField[] = [
  { field: 'code', label: '编码', type: 'input', required: true },
  { field: 'name', label: '名称', type: 'input', required: true },
  { field: 'type', label: '类型', type: 'input', required: true },
  { field: 'model', label: '型号', type: 'input' },
  { field: 'manufacturer', label: '厂商', type: 'input' },
  { field: 'installDate', label: '安装日期', type: 'date' },
]

// ---- 列表状态 ----
const query = reactive({ status: '' })
const list = ref<Equipment[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const pageSize = ref(20)
const createVisible = ref(false)
const detailVisible = ref(false)
const submitting = ref(false)
const createForm = ref<Record<string, unknown>>({})
const currentDetail = ref<Equipment | null>(null)

// ---- 技术规格 ----
interface TechSpecData {
  ratedPower?: number; ratedVoltage?: number; ratedCurrent?: number
  speed?: number; accuracyGrade?: string; tempRange?: string; protectionLevel?: string
}
const techSpec = ref<TechSpecData | null>(null)
const techSpecLoading = ref(false)
const techSpecEditing = ref(false)
const techSpecSaving = ref(false)
const techSpecForm = ref<TechSpecData>({})

const techSpecItems = computed(() => {
  const s = techSpec.value
  if (!s) return []
  return [
    { label: '额定功率 (kW)', value: s.ratedPower != null ? String(s.ratedPower) : '-' },
    { label: '额定电压 (V)', value: s.ratedVoltage != null ? String(s.ratedVoltage) : '-' },
    { label: '额定电流 (A)', value: s.ratedCurrent != null ? String(s.ratedCurrent) : '-' },
    { label: '转速 (rpm)', value: s.speed != null ? String(s.speed) : '-' },
    { label: '精度等级', value: s.accuracyGrade ?? '-' },
    { label: '工作温度范围 (℃)', value: s.tempRange ?? '-' },
    { label: '防护等级', value: s.protectionLevel ?? '-' },
  ]
})

function cancelTechSpecEdit() {
  techSpecEditing.value = false
  techSpecForm.value = { ...techSpec.value }
}

async function saveTechSpec() {
  if (!currentDetail.value) return
  techSpecSaving.value = true
  try {
    await new Promise(r => setTimeout(r, 600)) // mock 保存延迟
    techSpec.value = { ...techSpecForm.value }
    techSpecEditing.value = false
    Message.success('技术规格已保存')
  } finally {
    techSpecSaving.value = false
  }
}

// ---- 财务信息 ----
interface FinanceData {
  originalValue?: number; netValue?: number; depreciationMethod?: string
  depreciationYears?: number; accumulatedDepreciation?: number
  residualRate?: number; purchaseDate?: string; assetCode?: string
}
const depreciationMethodLabel: Record<string, string> = { straight: '直线法', double_declining: '双倍余额递减法' }
const finance = ref<FinanceData | null>(null)
const financeLoading = ref(false)
const financeEditing = ref(false)
const financeSaving = ref(false)
const financeForm = ref<FinanceData>({})

const financeItems = computed(() => {
  const f = finance.value
  if (!f) return []
  return [
    { label: '资产编号', value: f.assetCode ?? '-' },
    { label: '原值 (元)', value: f.originalValue != null ? f.originalValue.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) : '-' },
    { label: '净值 (元)', value: f.netValue != null ? f.netValue.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) : '-' },
    { label: '折旧方法', value: f.depreciationMethod ? (depreciationMethodLabel[f.depreciationMethod] ?? f.depreciationMethod) : '-' },
    { label: '折旧年限 (年)', value: f.depreciationYears != null ? String(f.depreciationYears) : '-' },
    { label: '累计折旧 (元)', value: f.accumulatedDepreciation != null ? f.accumulatedDepreciation.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) : '-' },
    { label: '残值率 (%)', value: f.residualRate != null ? String(f.residualRate) : '-' },
    { label: '购置日期', value: f.purchaseDate ?? '-' },
  ]
})

function cancelFinanceEdit() {
  financeEditing.value = false
  financeForm.value = { ...finance.value }
}

async function saveFinance() {
  if (!currentDetail.value) return
  financeSaving.value = true
  try {
    await new Promise(r => setTimeout(r, 600)) // mock 保存延迟
    finance.value = { ...financeForm.value }
    financeEditing.value = false
    Message.success('财务信息已保存')
  } finally {
    financeSaving.value = false
  }
}

// ---- 变更历史 ----
interface ChangeRecord {
  id: string; changedAt: string; changeType: string
  beforeValue: string; afterValue: string; operator: string
}
const historyAll = ref<ChangeRecord[]>([])
const historyFilter = ref('')
const historyLoading = ref(false)

const filteredHistory = computed(() =>
  historyFilter.value ? historyAll.value.filter(r => r.changeType === historyFilter.value) : historyAll.value
)

function filterHistory() { /* computed 自动响应 */ }

// ---- Mock 数据生成 ----
function mockTechSpec(id: string): TechSpecData {
  const seed = id.charCodeAt(0) || 1
  return {
    ratedPower: parseFloat((seed * 3.7 % 100 + 5).toFixed(2)),
    ratedVoltage: [220, 380, 660][seed % 3],
    ratedCurrent: parseFloat((seed * 1.3 % 50 + 2).toFixed(2)),
    speed: [750, 1000, 1500, 3000][seed % 4],
    accuracyGrade: ['±0.01mm', '±0.05mm', 'IT6', 'IT7'][seed % 4],
    tempRange: ['-10~50', '0~40', '-20~60'][seed % 3],
    protectionLevel: ['IP54', 'IP65', 'IP67'][seed % 3],
  }
}

function mockFinance(id: string): FinanceData {
  const seed = id.charCodeAt(0) || 1
  const original = Math.round((seed * 12345 % 900000 + 50000) * 100) / 100
  const years = [5, 8, 10, 15][seed % 4]
  const accumulated = Math.round(original * 0.3 * 100) / 100
  return {
    assetCode: `FA-${id.slice(0, 6).toUpperCase()}`,
    originalValue: original,
    netValue: Math.round((original - accumulated) * 100) / 100,
    depreciationMethod: seed % 2 === 0 ? 'straight' : 'double_declining',
    depreciationYears: years,
    accumulatedDepreciation: accumulated,
    residualRate: 5,
    purchaseDate: `202${seed % 4}-0${(seed % 9) + 1}-15`,
  }
}

function mockHistory(id: string): ChangeRecord[] {
  const types = ['location', 'status', 'maintenance', 'param']
  const operators = ['张三', '李四', '王五', '赵六']
  const locationPairs = [['车间A-01', '车间B-03'], ['车间C-02', '车间A-01']]
  const statusPairs = [['idle', 'running'], ['running', 'maintenance'], ['maintenance', 'running']]
  const seed = id.charCodeAt(0) || 1
  return Array.from({ length: 8 }, (_, i) => {
    const type = types[(seed + i) % 4]
    let before = '', after = ''
    if (type === 'location') { const p = locationPairs[i % 2]; before = p[0]; after = p[1] }
    else if (type === 'status') { const p = statusPairs[i % 3]; before = statusLabelMap[p[0]]; after = statusLabelMap[p[1]] }
    else if (type === 'maintenance') { before = '待维修'; after = '已完成' }
    else { before = `额定功率: ${(seed * 2 + i).toFixed(1)}kW`; after = `额定功率: ${(seed * 2 + i + 1).toFixed(1)}kW` }
    const d = new Date(2024, (seed + i) % 12, (i * 3 + 1) % 28 + 1)
    return {
      id: `${id}-h${i}`,
      changedAt: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(8 + i).padStart(2, '0')}:30`,
      changeType: type,
      beforeValue: before,
      afterValue: after,
      operator: operators[(seed + i) % 4],
    }
  }).reverse()
}

// ---- 详情项 ----
const detailItems = computed(() => {
  const d = currentDetail.value
  if (!d) return []
  return [
    { label: '编码', value: d.code }, { label: '名称', value: d.name },
    { label: '类型', value: d.type }, { label: '状态', value: statusLabelMap[d.status] ?? d.status },
    { label: '车间', value: d.workshopId ?? '-' }, { label: '型号', value: d.model ?? '-' },
    { label: '厂商', value: d.manufacturer ?? '-' }, { label: '安装日期', value: d.installDate ?? '-' },
  ]
})

// ---- 数据加载 ----
async function loadData() {
  loading.value = true
  try {
    const res = await eamApi.getEquipments({ ...query, page: page.value, pageSize: pageSize.value })
    list.value = res.list
    total.value = res.total
  } finally { loading.value = false }
}

function onTableChange(e: { page: number; pageSize: number }) {
  page.value = e.page; pageSize.value = e.pageSize; loadData()
}

function resetQuery() { query.status = ''; loadData() }
function openCreate() { createForm.value = {}; createVisible.value = true }

function openDetail(record: Equipment) {
  currentDetail.value = record
  detailVisible.value = true
  techSpecEditing.value = false
  financeEditing.value = false
  historyFilter.value = ''

  // 技术规格：先尝试 API，失败则用 mock
  techSpec.value = null
  techSpecLoading.value = true
  eamApi.getTechSpecs(record.id)
    .then(res => {
      const data = res as TechSpecData
      techSpec.value = Object.keys(data).length ? data : mockTechSpec(record.id)
    })
    .catch(() => { techSpec.value = mockTechSpec(record.id) })
    .finally(() => {
      techSpecForm.value = { ...techSpec.value }
      techSpecLoading.value = false
    })

  // 财务信息：先尝试 API，失败则用 mock
  finance.value = null
  financeLoading.value = true
  eamApi.getFinance(record.id)
    .then(res => {
      const data = res as FinanceData
      finance.value = Object.keys(data).length ? data : mockFinance(record.id)
    })
    .catch(() => { finance.value = mockFinance(record.id) })
    .finally(() => {
      financeForm.value = { ...finance.value }
      financeLoading.value = false
    })

  // 变更历史：mock 数据
  historyLoading.value = true
  setTimeout(() => {
    historyAll.value = mockHistory(record.id)
    historyLoading.value = false
  }, 400)
}

async function handleCreate(data: Record<string, unknown>) {
  submitting.value = true
  try {
    await eamApi.createEquipment(data as Parameters<typeof eamApi.createEquipment>[0])
    Message.success('创建成功')
    createVisible.value = false
    loadData()
  } finally { submitting.value = false }
}

loadData()
</script>

<style scoped>
.page-container { padding: 16px; }
.search-bar { display: flex; gap: 8px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
</style>
