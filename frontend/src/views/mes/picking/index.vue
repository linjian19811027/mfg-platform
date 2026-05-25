<template>
  <div class="page-container">
    <!-- 工单查询 -->
    <a-card :bordered="false" style="margin-bottom: 16px">
      <a-space>
        <a-input
          v-model="woCode"
          :placeholder="$t('mes.picking.index.输入工单号查询支持扫码')"
          allow-clear
          style="width: 280px"
          @keyup.enter="searchWorkOrder"
        >
          <template #prefix><icon-scan /></template>
        </a-input>
        <a-button type="primary" :loading="woLoading" @click="searchWorkOrder">{{ $t('common.search') }}</a-button>
        <a-button @click="resetPage">{{ $t('common.reset') }}</a-button>
      </a-space>
    </a-card>

    <template v-if="currentWo">
      <!-- 工单信息 -->
      <a-card :bordered="false" style="margin-bottom: 16px">
        <a-descriptions :column="4" :data="[
          { label: t('mes.picking.workOrderCode'), value: currentWo.code },
          { label: t('mes.picking.lbl1295'), value: currentWo.materialName ?? currentWo.materialId },
          { label: t('mes.picking.lbl1296'), value: String(currentWo.plannedQty) },
          { label: t('mes.picking.status'), value: currentWo.status },
        ]" />
      </a-card>

      <!-- 物料齐套状态 -->
      <a-card :title="$t('mes.picking.index.物料需求齐套')" :bordered="false" style="margin-bottom: 16px" :loading="kitLoading">
        <a-table :columns="kitColumns" :data="kitItems" :pagination="false" row-key="materialId">
          <template #sufficient="{ record }">
            <a-tag :color="record.sufficient ? 'green' : 'red'">
              {{ record.sufficient ? t('mes.picking.lbl1297') : `${t('mes.picking.r33029')} ${record.required - record.available}` }}
            </a-tag>
          </template>
        </a-table>
      </a-card>

      <!-- 领料记录 -->
      <a-card :bordered="false">
        <template #title>{{ $t('mes.picking.lbl1298') }}</template>
        <template #extra>
          <a-space>
            <a-button type="primary" @click="openIssueModal">{{ $t('mes.picking.lbl1299') }}</a-button>
            <a-button @click="openReturnModal">{{ $t('mes.picking.lbl1300') }}</a-button>
          </a-space>
        </template>
        <MTable :columns="issueColumns" :data="issueList" :loading="issueLoading" :total="issueTotal" @change="onIssueChange" />
      </a-card>
    </template>

    <!-- 领料弹窗 -->
    <a-modal v-model:visible="issueModalVisible" :title="$t('mes.picking.index.扫码领料')" :ok-loading="issuing" @ok="handleIssue" @cancel="issueModalVisible = false">
      <a-form :model="issueForm" layout="vertical">
        <a-form-item :label="$t('mes.picking.index.物料编码扫码')">
          <a-input ref="materialInputRef" v-model="issueForm.materialCode" :placeholder="$t('mes.picking.index.扫码或输入物料编码')" @keyup.enter="focusQty" />
        </a-form-item>
        <a-form-item :label="$t('mes.picking.index.批次号可选')">
          <a-input v-model="issueForm.batchId" :placeholder="$t('mes.picking.index.批次号')" />
        </a-form-item>
        <a-form-item :label="$t('mes.picking.index.数量')" required>
          <a-input-number ref="qtyInputRef" v-model="issueForm.qty" :min="0.001" :precision="4" style="width: 100%" />
        </a-form-item>
        <a-form-item :label="$t('mes.picking.index.单位')">
          <a-input v-model="issueForm.unit" :placeholder="$t('mes.picking.index.如PCSKG')" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 退料弹窗 -->
    <a-modal v-model:visible="returnModalVisible" :title="$t('mes.picking.index.退料')" :ok-loading="returning" @ok="handleReturn" @cancel="returnModalVisible = false">
      <a-form :model="returnForm" layout="vertical">
        <a-form-item :label="$t('mes.picking.index.物料编码')" required>
          <a-input v-model="returnForm.materialCode" :placeholder="$t('mes.picking.index.物料编码')" />
        </a-form-item>
        <a-form-item :label="$t('mes.picking.index.退料数量')" required>
          <a-input-number v-model="returnForm.qty" :min="0.001" :precision="4" style="width: 100%" />
        </a-form-item>
        <a-form-item :label="$t('mes.picking.index.退料原因')">
          <a-textarea v-model="returnForm.reason" :auto-size="{ minRows: 2 }" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
import { useI18n } from 'vue-i18n'
import { ref, reactive, nextTick } from 'vue'
import { Message } from '@arco-design/web-vue'
import MTable from '@/components/MTable/index.vue'
import type { MTableColumn } from '@/components/MTable/index.vue'
import { mesApi, type WorkOrder } from '@/api/mes'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const woCode = ref('')
const woLoading = ref(false)
const currentWo = ref<WorkOrder | null>(null)

// 齐套
const kitLoading = ref(false)
const kitItems = ref<any[]>([])
const kitColumns = [
  { title: t('mes.picking.index.物料编码'), dataIndex: 'materialCode', width: 130 },
  { title: t('mes.picking.index.物料名称'), dataIndex: 'materialName' },
  { title: t('mes.picking.index.需求量'), dataIndex: 'required', width: 100 },
  { title: t('mes.picking.index.可用库存'), dataIndex: 'available', width: 100 },
  { title: t('mes.picking.index.齐套状态'), slotName: 'sufficient', width: 120 },
]

// 领料记录
const issueLoading = ref(false)
const issueList = ref<any[]>([])
const issueTotal = ref(0)
const issuePage = ref(1)
const issueColumns: MTableColumn[] = [
  { key: 'materialCode', title: t('mes.picking.index.物料编码'), dataIndex: 'materialCode', width: 130 },
  { key: 'batchId', title: t('mes.picking.index.批次号'), dataIndex: 'batchId', width: 120 },
  { key: 'qty', title: t('mes.picking.index.数量'), dataIndex: 'quantity', width: 90 },
  { key: 'issueType', title: t('mes.picking.index.类型'), dataIndex: 'issueType', width: 100 },
  { key: 'operatorId', title: t('mes.picking.index.操作员'), dataIndex: 'operatorId', width: 100 },
  { key: 'issueTime', title: t('mes.picking.index.时间'), dataIndex: 'issueTime', width: 160 },
]

async function searchWorkOrder() {
  if (!woCode.value.trim()) { Message.warning(t('mes.请输入工单号')); return }
  woLoading.value = true
  try {
    const res = await mesApi.getMesWorkOrders({ code: woCode.value.trim(), pageSize: 1 })
    const wo = res.list?.[0]
    if (!wo) { Message.warning(t('mes.未找到工单')); return }
    currentWo.value = wo
    loadKitCheck(wo.id)
    loadIssues(wo.id)
  } catch { /* handled */ } finally { woLoading.value = false }
}

async function loadKitCheck(woId: string) {
  kitLoading.value = true
  try {
    const res = await mesApi.kitCheck(woId)
    kitItems.value = res.items as any[]
  } catch { kitItems.value = [] } finally { kitLoading.value = false }
}

async function loadIssues(woId: string) {
  issueLoading.value = true
  try {
    const res = await mesApi.getMaterialIssues(woId, { page: issuePage.value, pageSize: 20 })
    issueList.value = (res.list ?? []) as any[]
    issueTotal.value = res.total ?? 0
  } catch { issueList.value = [] } finally { issueLoading.value = false }
}

function onIssueChange(e: { page: number }) { issuePage.value = e.page; if (currentWo.value) loadIssues(currentWo.value.id) }

function resetPage() { woCode.value = ''; currentWo.value = null; kitItems.value = []; issueList.value = [] }

// 领料
const issueModalVisible = ref(false)
const issuing = ref(false)
const materialInputRef = ref()
const qtyInputRef = ref()
const issueForm = reactive({ materialCode: '', batchId: '', qty: 1, unit: '' })

function openIssueModal() {
  Object.assign(issueForm, { materialCode: '', batchId: '', qty: 1, unit: '' })
  issueModalVisible.value = true
  nextTick(() => materialInputRef.value?.focus())
}

function focusQty() { nextTick(() => qtyInputRef.value?.focus()) }

async function handleIssue() {
  if (!currentWo.value) return
  if (!issueForm.materialCode || !issueForm.qty) { Message.warning(t('mes.请填写物料编码和数量')); return }
  issuing.value = true
  try {
    await mesApi.issueMaterials(currentWo.value.id, {
      items: [{ materialId: issueForm.materialCode, batchId: issueForm.batchId || undefined, qty: issueForm.qty, uomId: issueForm.unit }],
      operatorId: authStore.userId ?? 'system',
    })
    Message.success(t('mes.领料成功'))
    issueModalVisible.value = false
    loadIssues(currentWo.value.id)
  } catch { /* handled */ } finally { issuing.value = false }
}

// 退料
const returnModalVisible = ref(false)
const returning = ref(false)
const returnForm = reactive({ materialCode: '', qty: 1, reason: '' })

function openReturnModal() { Object.assign(returnForm, { materialCode: '', qty: 1, reason: '' }); returnModalVisible.value = true }

async function handleReturn() {
  if (!currentWo.value) return
  if (!returnForm.materialCode || !returnForm.qty) { Message.warning(t('mes.请填写物料编码和数量')); return }
  returning.value = true
  try {
    await mesApi.returnMaterials(currentWo.value.id, {
      items: [{ materialId: returnForm.materialCode, qty: returnForm.qty }],
      operatorId: authStore.userId ?? 'system',
    })
    Message.success(t('mes.退料成功'))
    returnModalVisible.value = false
    loadIssues(currentWo.value.id)
  } catch { /* handled */ } finally { returning.value = false }
}
</script>

<style scoped>
.page-container { padding: 16px; }
</style>
