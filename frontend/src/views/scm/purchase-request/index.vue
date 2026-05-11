<template>
  <div class="page-container">
    <a-card :bordered="false" style="margin-bottom: 16px">
      <a-space wrap>
        <a-select v-model="query.status" :placeholder="$t('common.status')" allow-clear style="width: 130px">
          <a-option value="DRAFT">草稿</a-option>
          <a-option value="PENDING">待审批</a-option>
          <a-option value="APPROVED">已批准</a-option>
          <a-option value="REJECTED">已拒绝</a-option>
        </a-select>
        <a-button type="primary" @click="loadData">{{ $t('common.search') }}</a-button>
        <a-button @click="resetQuery">{{ $t('common.reset') }}</a-button>
      </a-space>
      <template #extra>
        <a-button type="primary" @click="openDrawer(null)">新建采购申请</a-button>
      </template>
    </a-card>

    <a-card :bordered="false">
      <MTable :columns="columns" :data="tableData" :loading="loading" :total="total" :page-size="20" @change="onTableChange">
        <template #status="{ record }">
          <a-tag :color="statusColor(record.status as string)">{{ statusLabel(record.status as string) }}</a-tag>
        </template>
        <template #action="{ record }">
          <a-space>
            <a-popconfirm v-if="record.status === 'DRAFT'" :content="$t('scm.purchase-request.index.确认提交审批')" @ok="handleSubmit(record.id as string)">
              <a-link>提交</a-link>
            </a-popconfirm>
            <a-popconfirm v-if="record.status === 'PENDING'" :content="$t('scm.purchase-request.index.确认批准该申请')" @ok="handleApprove(record.id as string)">
              <a-link>批准</a-link>
            </a-popconfirm>
            <a-link v-if="record.status === 'PENDING'" @click="openRejectModal(record.id as string)">拒绝</a-link>
            <a-link v-if="record.status === 'APPROVED'" @click="convertToPo(record as unknown as PurchaseRequest)">转采购订单</a-link>
          </a-space>
        </template>
      </MTable>
    </a-card>

    <!-- 新建抽屉 -->
    <a-drawer v-model:visible="drawerVisible" :title="$t('scm.purchase-request.index.新建采购申请')" :width="520" @cancel="drawerVisible = false">
      <a-form :model="createForm" layout="vertical">
        <a-form-item :label="$t('scm.purchase-request.index.物料')" required>
          <MaterialSelect v-model="createForm.materialId" @change="(m) => { if(m) createForm.unit = m.unit }" />
        </a-form-item>
        <a-form-item :label="$t('scm.purchase-request.index.申请数量')" required>
          <a-input-number v-model="createForm.qty" :min="0.001" :precision="4" style="width: 100%" />
        </a-form-item>
        <a-form-item :label="$t('scm.purchase-request.index.单位')">
          <UomSelect v-model="createForm.unit" />
        </a-form-item>
        <a-form-item :label="$t('scm.purchase-request.index.期望到货日期')">
          <a-date-picker v-model="createForm.expectedDate" style="width: 100%" />
        </a-form-item>
        <a-form-item :label="$t('scm.purchase-request.index.申请原因')">
          <a-textarea v-model="createForm.reason" :auto-size="{ minRows: 2 }" />
        </a-form-item>
        <a-form-item style="margin-top: 24px">
          <a-space>
            <a-button type="primary" :loading="saving" @click="handleCreate">{{ $t('common.save') }}</a-button>
            <a-button @click="drawerVisible = false">{{ $t('common.cancel') }}</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-drawer>

    <!-- 拒绝弹窗 -->
    <a-modal v-model:visible="rejectModalVisible" :title="$t('scm.purchase-request.index.拒绝原因')" :ok-loading="rejecting" @ok="handleReject" @cancel="rejectModalVisible = false">
      <a-textarea v-model="rejectReason" :placeholder="$t('scm.purchase-request.index.请填写拒绝原因')" :auto-size="{ minRows: 3 }" />
    </a-modal>

    <!-- 转采购订单弹窗 -->
    <a-modal v-model:visible="convertModalVisible" :title="$t('scm.purchase-request.index.转采购订单')" :ok-loading="converting" @ok="handleConvert" @cancel="convertModalVisible = false">
      <a-form layout="vertical">
        <a-form-item :label="$t('scm.purchase-request.index.供应商')" required>
          <SupplierSelect v-model="convertForm.supplierId" />
        </a-form-item>
        <a-form-item :label="$t('scm.purchase-request.index.币种')" required><a-input v-model="convertForm.currency" placeholder="CNY" /></a-form-item>
        <a-form-item :label="$t('scm.purchase-request.index.预计到货日期')"><a-date-picker v-model="convertForm.expectedDate" style="width: 100%" /></a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Message } from '@arco-design/web-vue'
import MTable from '@/components/MTable/index.vue'
import type { MTableColumn } from '@/components/MTable/index.vue'
import { scmApi, type PurchaseRequest } from '@/api/scm'
import MaterialSelect from '@/components/BusinessSelect/MaterialSelect.vue'
import SupplierSelect from '@/components/BusinessSelect/SupplierSelect.vue'
import UomSelect from '@/components/BusinessSelect/UomSelect.vue'

const { t } = useI18n()
const loading = ref(false)
const tableData = ref<any[]>([])
const total = ref(0)
const query = reactive({ status: '', page: 1, pageSize: 20 })

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  DRAFT: { label: t('common.draft'), color: 'gray' },
  PENDING: { label: t('scm.purchase-request.status.pending'), color: 'orange' },
  APPROVED: { label: t('scm.purchase-request.status.approved'), color: 'green' },
  REJECTED: { label: t('scm.purchase-request.status.rejected'), color: 'red' },
}

const columns: MTableColumn[] = [
  { key: 'code', title: t('scm.purchase-request.index.申请编号'), dataIndex: 'code', width: 130 },
  { key: 'materialName', title: t('scm.purchase-request.index.物料名称'), dataIndex: 'materialName', width: 160 },
  { key: 'qty', title: t('scm.purchase-request.index.申请数量'), dataIndex: 'qty', width: 100 },
  { key: 'expectedDate', title: t('scm.purchase-request.index.期望到货'), dataIndex: 'expectedDate', width: 120 },
  { key: 'status', title: t('scm.purchase-request.index.状态'), slotName: 'status', width: 100 },
  { key: 'createdAt', title: t('scm.purchase-request.index.创建时间'), dataIndex: 'createdAt', width: 160 },
  { key: 'action', title: t('scm.purchase-request.index.操作'), slotName: 'action', width: 200 },
]

function statusColor(s: string) { return STATUS_MAP[s]?.color ?? 'gray' }
function statusLabel(s: string) { return STATUS_MAP[s]?.label ?? s }

async function loadData() {
  loading.value = true
  try {
    const params: Record<string, unknown> = { page: query.page, pageSize: query.pageSize }
    if (query.status) params.status = query.status
    const res = await scmApi.getPurchaseRequests(params)
    tableData.value = (res.list ?? []) as any[]
    total.value = res.total ?? 0
  } catch { tableData.value = [] } finally { loading.value = false }
}

function resetQuery() { query.status = ''; query.page = 1; loadData() }
function onTableChange(e: { page: number; pageSize: number }) { query.page = e.page; query.pageSize = e.pageSize; loadData() }

const drawerVisible = ref(false)
const saving = ref(false)
const createForm = reactive({ materialId: '', qty: undefined as number | undefined, unit: '', expectedDate: '', reason: '' })

function openDrawer(_item: null) {
  Object.assign(createForm, { materialId: '', qty: undefined, unit: '', expectedDate: '', reason: '' })
  drawerVisible.value = true
}
async function handleCreate() {
  if (!createForm.materialId) { Message.warning('请选择物料'); return }
  if (!createForm.qty) { Message.warning('请填写申请数量'); return }
  saving.value = true
  try { await scmApi.createPurchaseRequest({ ...createForm }); Message.success('创建成功'); drawerVisible.value = false; loadData() }
  catch { /* handled */ } finally { saving.value = false }
}

async function handleSubmit(id: string) {
  try { await scmApi.submitPurchaseRequest(id); Message.success('已提交审批'); loadData() }
  catch { /* handled */ }
}

async function handleApprove(id: string) {
  try { await scmApi.approvePurchaseRequest(id); Message.success('已批准'); loadData() }
  catch { /* handled */ }
}

const rejectModalVisible = ref(false)
const rejecting = ref(false)
const rejectId = ref('')
const rejectReason = ref('')
function openRejectModal(id: string) { rejectId.value = id; rejectReason.value = ''; rejectModalVisible.value = true }
async function handleReject() {
  if (!rejectReason.value.trim()) { Message.warning('请填写拒绝原因'); return }
  rejecting.value = true
  try { await scmApi.rejectPurchaseRequest(rejectId.value, rejectReason.value); Message.success('已拒绝'); rejectModalVisible.value = false; loadData() }
  catch { /* handled */ } finally { rejecting.value = false }
}

const convertModalVisible = ref(false)
const converting = ref(false)
const convertingPr = ref<PurchaseRequest | null>(null)
const convertForm = reactive({ supplierId: '', currency: 'CNY', expectedDate: '' })

function convertToPo(pr: PurchaseRequest) {
  convertingPr.value = pr
  Object.assign(convertForm, { supplierId: '', currency: 'CNY', expectedDate: pr.expectedDate ?? '' })
  convertModalVisible.value = true
}
async function handleConvert() {
  if (!convertingPr.value || !convertForm.supplierId) { Message.warning('请选择供应商'); return }
  converting.value = true
  try {
    await scmApi.createPurchaseOrder({
      supplierId: convertForm.supplierId,
      currency: convertForm.currency,
      orderDate: new Date().toISOString().slice(0, 10),
      expectedDate: convertForm.expectedDate || undefined
    })
    Message.success('采购订单已创建')
    convertModalVisible.value = false
  } catch { /* handled */ } finally { converting.value = false }
}

onMounted(loadData)
</script>

<style scoped>
.page-container { padding: 16px; }
</style>
