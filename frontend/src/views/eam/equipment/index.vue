<template>
  <div class="page-container">
    <a-card>
      <div class="search-bar">
        <a-select v-model="query.status" :placeholder="$t('common.status')" allow-clear style="width:130px">
          <a-option v-for="s in statusOptions" :key="s.value" :value="s.value">{{ s.label }}</a-option>
        </a-select>
        <a-button type="primary" @click="loadData">{{ $t('common.search') }}</a-button>
        <a-button @click="resetQuery">{{ $t('common.reset') }}</a-button>
        <a-button style="margin-left:auto" type="primary" @click="openCreate">{{ $t('eam.equipment.lbl1052') }}</a-button>
      </div>

      <MTable :columns="columns" :data="list" :loading="loading" :total="total" @change="onTableChange">
        <template #status="{ record }">
          <a-tag :color="statusColorMap[record.status as string] ?? 'gray'">{{ statusLabelMap[record.status as string] ?? record.status }}</a-tag>
        </template>
        <template #action="{ record }">
          <a-button type="text" size="small" @click="openDetail(record as Equipment)">{{ $t('eam.equipment.view') }}</a-button>
        </template>
      </MTable>
    </a-card>

    <!-- 新建设备 -->
    <a-drawer v-model:visible="createVisible" :title="$t('eam.equipment.index.新建设备')" :width="480" @cancel="createVisible=false">
      <MForm :schema="createSchema" v-model="createForm" :loading="submitting" @submit="handleCreate" @cancel="createVisible=false" />
    </a-drawer>

    <!-- 设备详情 -->
    <a-drawer v-model:visible="detailVisible" :title="`${$t('eam.equipment.index.设备详情')} - ${currentDetail?.equipmentName ?? ''}`" :width="720" @cancel="detailVisible=false">
      <a-tabs default-active-key="basic">
        <a-tab-pane key="basic" :title="$t('eam.equipment.index.基本信息')">
          <a-descriptions :data="detailItems" bordered :column="1" />
        </a-tab-pane>
        
        <a-tab-pane key="techspec" :title="$t('eam.equipment.index.技术规格')">
          <a-spin :loading="techSpecLoading">
            <div v-if="techSpec">
              <div style="margin-bottom:16px;text-align:right">
                <a-button v-if="!techSpecEditing" type="primary" size="small" @click="techSpecEditing=true">{{ $t('common.edit') }}</a-button>
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
                <a-button v-if="!financeEditing" type="primary" size="small" @click="financeEditing=true">{{ $t('common.edit') }}</a-button>
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
                    <a-option value="straight">{{ $t('eam.equipment.lbl1053') }}</a-option>
                    <a-option value="double_declining">{{ $t('eam.equipment.lbl1054') }}</a-option>
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
          <a-empty :description="t('eam.equipment.lbl1055')" />
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
  { label: t('eam.equipment.running'), value: 'running' }, { label: t('eam.equipment.idle'), value: 'idle' },
  { label: t('eam.equipment.inMaintenance'), value: 'maintenance' }, { label: t('eam.equipment.fault'), value: 'fault' }, { label: t('eam.equipment.scrapped'), value: 'scrapped' },
]
const statusColorMap: Record<string, string> = { running: 'green', idle: 'blue', maintenance: 'orange', fault: 'red', scrapped: 'gray' }
const statusLabelMap: Record<string, string> = { running: t('eam.equipment.running'), idle: t('eam.equipment.idle'), maintenance: t('eam.equipment.inMaintenance'), fault: t('eam.equipment.fault'), scrapped: t('eam.equipment.scrapped') }

// ---- 列表列定义 ----
const columns: MTableColumn[] = [
  { key: 'equipmentCode', title: t('eam.equipment.index.编码'), width: 120 },
  { key: 'equipmentName', title: t('eam.equipment.index.名称') },
  { key: 'equipmentType', title: t('eam.equipment.index.类型'), width: 100 },
  { key: 'status', title: t('eam.equipment.index.状态'), width: 90, slotName: 'status' },
  { key: 'workshopId', title: t('eam.equipment.index.车间'), width: 100 },
  { key: 'model', title: t('eam.equipment.index.型号'), width: 120 },
  { key: 'manufacturer', title: t('eam.equipment.index.厂商'), width: 120 },
  { key: 'installDate', title: t('eam.equipment.index.安装日期'), width: 120 },
  { key: 'action', title: t('eam.equipment.index.操作'), width: 70, slotName: 'action' },
]

// ---- 新建表单 ----
const createSchema: MFormField[] = [
  { field: 'equipmentCode', label: t('eam.equipment.lbl1056'), type: 'input', required: true },
  { field: 'equipmentName', label: t('eam.equipment.lbl1057'), type: 'input', required: true },
  { field: 'equipmentType', label: t('eam.equipment.lbl1058'), type: 'select', required: true, options: [{ label: t('eam.equipment.lbl1059'), value: t('eam.equipment.r33001') }, { label: t('eam.equipment.lbl1060'), value: t('eam.equipment.r33002') }, { label: t('eam.equipment.lbl1061'), value: t('eam.equipment.r33003') }, { label: t('eam.equipment.lbl1062'), value: t('eam.equipment.r33004') }, { label: t('eam.equipment.lbl1063'), value: t('eam.equipment.r33005') }, { label: t('eam.equipment.lbl1064'), value: t('eam.equipment.r33006') }, { label: t('eam.equipment.lbl1065'), value: t('eam.equipment.r33007') }] },
  { field: 'category', label: t('eam.equipment.lbl1066'), type: 'select', required: true, options: [{ label: t('eam.equipment.lbl1067'), value: 'A' }, { label: t('eam.equipment.lbl1068'), value: 'B' }, { label: t('eam.equipment.lbl1069'), value: 'C' }] },
  { field: 'model', label: t('eam.equipment.lbl1070'), type: 'input' },
  { field: 'manufacturer', label: t('eam.equipment.lbl1071'), type: 'input' },
  { field: 'installDate', label: t('eam.equipment.lbl1072'), type: 'date' },
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
    { label: t('eam.equipment.lbl1073'), value: s.ratedPower != null ? String(s.ratedPower) : '-' },
    { label: t('eam.equipment.lbl1074'), value: s.ratedVoltage != null ? String(s.ratedVoltage) : '-' },
    { label: t('eam.equipment.lbl1075'), value: s.ratedCurrent != null ? String(s.ratedCurrent) : '-' },
    { label: t('eam.equipment.lbl1076'), value: s.speed != null ? String(s.speed) : '-' },
    { label: t('eam.equipment.lbl1077'), value: s.accuracyGrade ?? '-' },
    { label: t('eam.equipment.lbl1078'), value: s.tempRange ?? '-' },
    { label: t('eam.equipment.lbl1079'), value: s.protectionLevel ?? '-' },
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
    await eamApi.saveTechSpecs(currentDetail.value.id, techSpecForm.value)
    techSpecEditing.value = false
    Message.success(t('eam.技术规格已保存'))
  } catch {
    Message.error(t('eam.保存失败'))
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
const depreciationMethodLabel: Record<string, string> = { straight: t('eam.equipment.lbl1080'), double_declining: t('eam.equipment.lbl1081') }
const finance = ref<FinanceData | null>(null)
const financeLoading = ref(false)
const financeEditing = ref(false)
const financeSaving = ref(false)
const financeForm = ref<FinanceData>({})

const financeItems = computed(() => {
  const f = finance.value
  if (!f) return []
  return [
    { label: t('eam.equipment.lbl1082'), value: f.assetCode ?? '-' },
    { label: t('eam.equipment.lbl1083'), value: f.originalValue != null ? f.originalValue.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) : '-' },
    { label: t('eam.equipment.lbl1084'), value: f.netValue != null ? f.netValue.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) : '-' },
    { label: t('eam.equipment.lbl1085'), value: f.depreciationMethod ? (depreciationMethodLabel[f.depreciationMethod] ?? f.depreciationMethod) : '-' },
    { label: t('eam.equipment.lbl1086'), value: f.depreciationYears != null ? String(f.depreciationYears) : '-' },
    { label: t('eam.equipment.lbl1087'), value: f.accumulatedDepreciation != null ? f.accumulatedDepreciation.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) : '-' },
    { label: t('eam.equipment.lbl1088'), value: f.residualRate != null ? String(f.residualRate) : '-' },
    { label: t('eam.equipment.lbl1089'), value: f.purchaseDate ?? '-' },
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
    await eamApi.saveFinance(currentDetail.value.id, financeForm.value)
    financeEditing.value = false
    Message.success(t('eam.财务信息已保存'))
  } catch {
    Message.error(t('eam.保存失败'))
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

// ---- 详情项 ----
const detailItems = computed(() => {
  const d = currentDetail.value
  if (!d) return []
  return [
    { label: t('eam.equipment.code'), value: d.equipmentCode }, { label: t('eam.equipment.name'), value: d.equipmentName },
    { label: t('eam.equipment.type'), value: d.equipmentType }, { label: t('eam.equipment.status'), value: statusLabelMap[d.status] ?? d.status },
    { label: t('eam.equipment.lbl1090'), value: d.workshopId ?? '-' }, { label: t('eam.equipment.lbl1091'), value: d.model ?? '-' },
    { label: t('eam.equipment.lbl1092'), value: d.manufacturer ?? '-' }, { label: t('eam.equipment.lbl1093'), value: d.installDate ?? '-' },
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

async function openDetail(record: Equipment) {
  currentDetail.value = record
  detailVisible.value = true
  techSpecEditing.value = false
  financeEditing.value = false
  historyFilter.value = ''

  // 技术规格
  techSpec.value = null
  techSpecLoading.value = true
  try {
    const data = await eamApi.getTechSpecs(record.id)
    techSpec.value = data
  } catch {
    techSpec.value = null
  } finally {
    techSpecForm.value = { ...techSpec.value }
    techSpecLoading.value = false
  }

  // 财务信息
  finance.value = null
  financeLoading.value = true
  try {
    const data = await eamApi.getFinance(record.id)
    finance.value = data
  } catch {
    finance.value = null
  } finally {
    financeForm.value = { ...finance.value }
    financeLoading.value = false
  }

  // 变更历史
  historyLoading.value = true
  try {
    historyAll.value = await eamApi.getEquipmentHistory(record.id)
  } catch {
    historyAll.value = []
  } finally {
    historyLoading.value = false
  }
}

async function handleCreate(data: Record<string, unknown>) {
  submitting.value = true
  try {
    await eamApi.createEquipment(data as Parameters<typeof eamApi.createEquipment>[0])
    Message.success(t('eam.创建成功'))
    createVisible.value = false
    loadData()
  } catch {
    Message.error(t('eam.创建失败'))
  } finally { submitting.value = false }
}

loadData()
</script>

<style scoped>
.page-container { padding: 16px; }
.search-bar { display: flex; gap: 8px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
</style>
