<template>
  <div class="page-container">
    <a-page-header :title="$t('outsourcing.orders.detail.外协工单详情')" @back="router.back()">
      <template #extra>
        <a-space>
          <a-button v-if="order.status === 'DRAFT'" type="primary" @click="handleConfirm" :loading="actionLoading">{{ $t('outsourcing.orders.lbl1330') }}</a-button>
          <a-popconfirm v-if="['DRAFT','CONFIRMED'].includes(order.status)" :content="$t('outsourcing.orders.detail.确定取消此工单')" @ok="handleCancel">
            <a-button status="danger">{{ $t('outsourcing.orders.lbl1331') }}</a-button>
          </a-popconfirm>
        </a-space>
      </template>
    </a-page-header>

    <a-spin :loading="loading">
      <!-- 基本信息 -->
      <a-card :bordered="false" style="margin-bottom: 16px">
        <a-descriptions :column="3" bordered>
          <a-descriptions-item :label="$t('outsourcing.orders.detail.工单编号')">{{ order.ocNo }}</a-descriptions-item>
          <a-descriptions-item :label="$t('common.status')">
            <a-tag :color="statusColor(order.status)">{{ statusLabel(order.status) }}</a-tag>
          </a-descriptions-item>
          <a-descriptions-item :label="$t('outsourcing.orders.detail.供应商')">{{ order.supplierName }}</a-descriptions-item>
          <a-descriptions-item :label="$t('outsourcing.orders.detail.工序名称')">{{ order.processName }}</a-descriptions-item>
          <a-descriptions-item :label="$t('outsourcing.orders.detail.物料ID')">{{ order.materialId }}</a-descriptions-item>
          <a-descriptions-item :label="$t('outsourcing.orders.detail.计划数量')">{{ order.plannedQty }}</a-descriptions-item>
          <a-descriptions-item :label="$t('outsourcing.orders.detail.已发料')">{{ order.issuedQty ?? 0 }}</a-descriptions-item>
          <a-descriptions-item :label="$t('outsourcing.orders.detail.已收货')">{{ order.receivedQty ?? 0 }}</a-descriptions-item>
          <a-descriptions-item :label="$t('outsourcing.orders.detail.已结算')">{{ order.settledQty ?? 0 }}</a-descriptions-item>
          <a-descriptions-item :label="$t('outsourcing.orders.detail.计划交期')">{{ order.plannedDeliveryDate }}</a-descriptions-item>
          <a-descriptions-item :label="$t('outsourcing.orders.detail.单价')">{{ order.unitPrice }}</a-descriptions-item>
          <a-descriptions-item :label="$t('outsourcing.orders.detail.关联工单')">{{ order.mesWoId || '-' }}</a-descriptions-item>
        </a-descriptions>
      </a-card>

      <!-- 标签页 -->
      <a-card :bordered="false">
        <a-tabs v-model:active-key="activeTab">
          <!-- 发料记录 -->
          <a-tab-pane key="issues" :title="$t('outsourcing.orders.detail.发料记录')">
            <div style="margin-bottom: 12px">
              <a-button type="primary" size="small" @click="showIssueModal" :disabled="!['CONFIRMED','ISSUED'].includes(order.status)">
<template #icon><icon-plus /></template>{{ $t('outsourcing.orders.createIssue') }}
              </a-button>
            </div>
            <a-table :columns="issueColumns" :data="issues" :loading="issueLoading" :pagination="false" row-key="id">
              <template #status="{ record }">
                <a-tag :color="record.status === 'CONFIRMED' ? 'green' : 'gray'">{{ record.status === 'CONFIRMED' ? $t('outsourcing.orders.lbl1332') : $t('outsourcing.orders.draft') }}</a-tag>
              </template>
              <template #action="{ record }">
                <a-button v-if="record.status === 'DRAFT'" type="text" size="small" @click="handleConfirmIssue(record)">{{ $t('outsourcing.orders.lbl1333') }}</a-button>
              </template>
            </a-table>
          </a-tab-pane>

          <!-- 收货记录 -->
          <a-tab-pane key="receipts" :title="$t('outsourcing.orders.detail.收货记录')">
            <div style="margin-bottom: 12px">
              <a-button type="primary" size="small" @click="showReceiptModal" :disabled="order.status !== 'ISSUED'">
<template #icon><icon-plus /></template>{{ $t('outsourcing.orders.createReceipt') }}
              </a-button>
            </div>
            <a-table :columns="receiptColumns" :data="receipts" :loading="receiptLoading" :pagination="false" row-key="id">
              <template #status="{ record }">
                <a-tag :color="record.status === 'CONFIRMED' ? 'green' : record.status === 'FAILED' ? 'red' : 'gray'">
                  {{ ({ CONFIRMED: t('outsourcing.orders.lbl1334'), FAILED: t('outsourcing.orders.unqualified'), DRAFT: t('outsourcing.orders.draft') } as any)[record.status] ?? record.status }}
                </a-tag>
              </template>
              <template #action="{ record }">
                <a-button v-if="record.status === 'DRAFT'" type="text" size="small" @click="handleConfirmReceipt(record)">{{ $t('outsourcing.orders.lbl1335') }}</a-button>
              </template>
            </a-table>
          </a-tab-pane>

          <!-- 结算记录 -->
          <a-tab-pane key="settlements" :title="$t('outsourcing.orders.detail.结算记录')">
            <div style="margin-bottom: 12px">
              <a-button type="primary" size="small" @click="showSettlementModal" :disabled="order.status !== 'RECEIPTED'">
<template #icon><icon-plus /></template>{{ $t('outsourcing.orders.createSettlement') }}
              </a-button>
            </div>
            <a-table :columns="settlementColumns" :data="settlements" :loading="settlementLoading" :pagination="false" row-key="id">
              <template #status="{ record }">
                <a-tag :color="record.status === 'APPROVED' ? 'green' : 'gray'">{{ record.status === 'APPROVED' ? $t('outsourcing.orders.lbl1336') : $t('outsourcing.orders.lbl1337') }}</a-tag>
              </template>
              <template #action="{ record }">
                <a-button v-if="record.status === 'PENDING'" type="text" size="small" @click="handleApproveSettlement(record)">{{ $t('outsourcing.orders.lbl1338') }}</a-button>
              </template>
            </a-table>
          </a-tab-pane>

          <!-- 操作日志 -->
          <a-tab-pane key="logs" :title="$t('outsourcing.orders.detail.操作日志')">
            <a-timeline>
              <a-timeline-item v-for="log in logs" :key="log.id">
                <template #dot><icon-check-circle /></template>
                <div>{{ log.action }} — {{ log.operatorId }}</div>
                <div style="color: var(--color-text-3); font-size: 12px">{{ log.createdAt }}</div>
                <div v-if="log.remark" style="font-size: 12px">{{ log.remark }}</div>
              </a-timeline-item>
            </a-timeline>
          </a-tab-pane>
        </a-tabs>
      </a-card>
    </a-spin>

    <!-- 发料弹窗 -->
    <a-modal v-model:visible="issueModalVisible" :title="$t('outsourcing.orders.detail.新建发料单')" :ok-loading="issueSubmitLoading"
      @ok="submitIssue" @cancel="issueModalVisible = false">
      <a-form :model="issueForm" layout="vertical">
        <a-form-item :label="$t('outsourcing.orders.detail.发料数量')" required>
          <a-input-number v-model="issueForm.qty" :min="0.01" style="width: 100%" />
        </a-form-item>
        <a-form-item :label="$t('outsourcing.orders.detail.仓库ID')">
          <a-input v-model="issueForm.warehouseId" :placeholder="$t('outsourcing.orders.detail.可选')" />
        </a-form-item>
        <a-form-item :label="$t('outsourcing.orders.detail.批次ID')">
          <a-input v-model="issueForm.batchId" :placeholder="$t('outsourcing.orders.detail.可选')" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 收货弹窗 -->
    <a-modal v-model:visible="receiptModalVisible" :title="$t('outsourcing.orders.detail.新建收货单')" :ok-loading="receiptSubmitLoading"
      @ok="submitReceipt" @cancel="receiptModalVisible = false">
      <a-form :model="receiptForm" layout="vertical">
        <a-form-item :label="$t('outsourcing.orders.detail.收货数量')" required>
          <a-input-number v-model="receiptForm.qty" :min="0.01" style="width: 100%" />
        </a-form-item>
        <a-form-item :label="$t('outsourcing.orders.detail.暂存库位ID')">
          <a-input v-model="receiptForm.stagingLocationId" :placeholder="$t('outsourcing.orders.detail.可选')" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 结算弹窗 -->
    <a-modal v-model:visible="settlementModalVisible" :title="$t('outsourcing.orders.detail.新建结算单')" :ok-loading="settlementSubmitLoading"
      @ok="submitSettlement" @cancel="settlementModalVisible = false">
      <a-form :model="settlementForm" layout="vertical">
        <a-form-item :label="$t('outsourcing.orders.detail.结算数量')" required>
          <a-input-number v-model="settlementForm.settledQty" :min="0.01" style="width: 100%" />
        </a-form-item>
        <a-form-item :label="$t('outsourcing.orders.detail.税率')">
          <a-input-number v-model="settlementForm.taxRate" :min="0" :max="100" style="width: 100%" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
import { useI18n } from 'vue-i18n'
import { ref, reactive, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Message } from '@arco-design/web-vue'
import { IconPlus, IconCheckCircle } from '@arco-design/web-vue/es/icon'
import {
  getOutsourcingOrder, confirmOutsourcingOrder, cancelOutsourcingOrder,
  getOutsourcingIssues, createOutsourcingIssue, confirmOutsourcingIssue,
  getOutsourcingReceipts, createOutsourcingReceipt, confirmOutsourcingReceipt,
  getOutsourcingSettlements, createOutsourcingSettlement, approveOutsourcingSettlement,
  getOutsourcingLogs,
} from '@/api/outsourcing'

const route = useRoute()
const router = useRouter()
const id = route.params.id as string

const loading = ref(false)
const actionLoading = ref(false)
const order = ref<any>({})
const activeTab = ref('issues')

const issueLoading = ref(false)
const issues = ref([])
const receiptLoading = ref(false)
const receipts = ref([])
const settlementLoading = ref(false)
const settlements = ref([])
const logs = ref<any[]>([])

const issueColumns = [
  { title: t('outsourcing.orders.detail.发料数量'), dataIndex: 'qty', width: 100 },
  { title: t('outsourcing.orders.detail.仓库'), dataIndex: 'warehouseName', width: 120 },
  { title: t('outsourcing.orders.detail.状态'), dataIndex: 'status', slotName: 'status', width: 90 },
  { title: t('outsourcing.orders.detail.创建时间'), dataIndex: 'createdAt', width: 160 },
  { title: t('outsourcing.orders.detail.操作'), slotName: 'action', width: 100 },
]
const receiptColumns = [
  { title: t('outsourcing.orders.detail.收货数量'), dataIndex: 'qty', width: 100 },
  { title: t('outsourcing.orders.detail.状态'), dataIndex: 'status', slotName: 'status', width: 90 },
  { title: t('outsourcing.orders.detail.创建时间'), dataIndex: 'createdAt', width: 160 },
  { title: t('outsourcing.orders.detail.操作'), slotName: 'action', width: 100 },
]
const settlementColumns = [
  { title: t('outsourcing.orders.detail.结算数量'), dataIndex: 'settledQty', width: 100 },
  { title: t('outsourcing.orders.detail.含税金额'), dataIndex: 'totalAmountWithTax', width: 120 },
  { title: t('outsourcing.orders.detail.状态'), dataIndex: 'status', slotName: 'status', width: 90 },
  { title: t('outsourcing.orders.detail.创建时间'), dataIndex: 'createdAt', width: 160 },
  { title: t('outsourcing.orders.detail.操作'), slotName: 'action', width: 100 },
]

// 弹窗
const issueModalVisible = ref(false)
const issueSubmitLoading = ref(false)
const issueForm = reactive({ qty: 1, warehouseId: '', batchId: '' })

const receiptModalVisible = ref(false)
const receiptSubmitLoading = ref(false)
const receiptForm = reactive({ qty: 1, stagingLocationId: '' })

const settlementModalVisible = ref(false)
const settlementSubmitLoading = ref(false)
const settlementForm = reactive({ settledQty: 1, taxRate: 13 })

onMounted(async () => {
  loading.value = true
  try {
    const res = await getOutsourcingOrder(id)
    order.value = res
    await Promise.all([loadIssues(), loadReceipts(), loadSettlements(), loadLogs()])
  } catch (e: any) { Message.error(e.message || t('outsourcing.加载失败')) }
  finally { loading.value = false }
})

async function loadIssues() { issueLoading.value = true; try { const r = await getOutsourcingIssues(id); issues.value = (r as any).list ?? (r as any).data ?? [] } finally { issueLoading.value = false } }
async function loadReceipts() { receiptLoading.value = true; try { const r = await getOutsourcingReceipts(id); receipts.value = (r as any).list ?? (r as any).data ?? [] } finally { receiptLoading.value = false } }
async function loadSettlements() { settlementLoading.value = true; try { const r = await getOutsourcingSettlements(id); settlements.value = (r as any).list ?? (r as any).data ?? [] } finally { settlementLoading.value = false } }
async function loadLogs() { try { const r = await getOutsourcingLogs(id); logs.value = (r as any).list ?? (r as any).data ?? [] } catch {} }

async function handleConfirm() { actionLoading.value = true; try { await confirmOutsourcingOrder(id); Message.success(t('outsourcing.确认成功')); order.value.status = 'CONFIRMED' } catch (e: any) { Message.error(e.message || t('outsourcing.操作失败')) } finally { actionLoading.value = false } }
async function handleCancel() { try { await cancelOutsourcingOrder(id, {}); Message.success(t('outsourcing.取消成功')); order.value.status = 'CANCELLED' } catch (e: any) { Message.error(e.message || t('outsourcing.操作失败')) } }

function showIssueModal() { Object.assign(issueForm, { qty: 1, warehouseId: '', batchId: '' }); issueModalVisible.value = true }
async function submitIssue() { issueSubmitLoading.value = true; try { await createOutsourcingIssue(id, issueForm); Message.success(t('outsourcing.发料单创建成功')); issueModalVisible.value = false; loadIssues() } catch (e: any) { Message.error(e.message || t('outsourcing.操作失败')) } finally { issueSubmitLoading.value = false } }
async function handleConfirmIssue(record: any) { try { await confirmOutsourcingIssue(record.id); Message.success(t('outsourcing.发料确认成功')); loadIssues() } catch (e: any) { Message.error(e.message || t('outsourcing.操作失败')) } }

function showReceiptModal() { Object.assign(receiptForm, { qty: 1, stagingLocationId: '' }); receiptModalVisible.value = true }
async function submitReceipt() { receiptSubmitLoading.value = true; try { await createOutsourcingReceipt(id, receiptForm); Message.success(t('outsourcing.收货单创建成功')); receiptModalVisible.value = false; loadReceipts() } catch (e: any) { Message.error(e.message || t('outsourcing.操作失败')) } finally { receiptSubmitLoading.value = false } }
async function handleConfirmReceipt(record: any) { try { await confirmOutsourcingReceipt(record.id); Message.success(t('outsourcing.收货确认成功')); loadReceipts() } catch (e: any) { Message.error(e.message || t('outsourcing.操作失败')) } }

function showSettlementModal() { Object.assign(settlementForm, { settledQty: 1, taxRate: 13 }); settlementModalVisible.value = true }
async function submitSettlement() { settlementSubmitLoading.value = true; try { await createOutsourcingSettlement(id, settlementForm); Message.success(t('outsourcing.结算单创建成功')); settlementModalVisible.value = false; loadSettlements() } catch (e: any) { Message.error(e.message || t('outsourcing.操作失败')) } finally { settlementSubmitLoading.value = false } }
async function handleApproveSettlement(record: any) { try { await approveOutsourcingSettlement(record.id); Message.success(t('outsourcing.审核成功')); loadSettlements() } catch (e: any) { Message.error(e.message || t('outsourcing.操作失败')) } }

function statusLabel(s: string) { return ({ DRAFT: t('outsourcing.orders.draft'), CONFIRMED: t('outsourcing.orders.lbl1339'), ISSUED: t('outsourcing.orders.lbl1340'), RECEIPTED: t('outsourcing.orders.lbl1341'), SETTLED: t('outsourcing.orders.lbl1342'), CANCELLED: t('outsourcing.orders.lbl1343') } as any)[s] ?? s }
function statusColor(s: string) { return ({ DRAFT: 'gray', CONFIRMED: 'blue', ISSUED: 'orange', RECEIPTED: 'cyan', SETTLED: 'green', CANCELLED: 'red' } as any)[s] ?? 'gray' }
</script>

<style scoped>
.page-container { padding: 16px; }
</style>
