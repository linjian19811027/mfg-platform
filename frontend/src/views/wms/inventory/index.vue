<template>
  <div class="page-container">
    <a-card :bordered="false" style="margin-bottom: 16px">
      <a-space wrap>
        <a-input v-model="query.materialId" :placeholder="$t('wms.inventory.index.物料ID')" allow-clear style="width: 160px" @keyup.enter="loadData" />
        <a-input v-model="query.warehouseId" :placeholder="$t('wms.inventory.index.仓库ID')" allow-clear style="width: 160px" @keyup.enter="loadData" />
        <a-input v-model="query.batchId" :placeholder="$t('wms.inventory.index.批次号')" allow-clear style="width: 160px" @keyup.enter="loadData" />
        <a-button type="primary" @click="loadData">{{ $t('common.search') }}</a-button>
        <a-button @click="resetQuery">{{ $t('common.reset') }}</a-button>
      </a-space>
      <template #extra>
        <a-space>
          <a-button type="primary" @click="openReceipt">入库</a-button>
          <a-button status="warning" @click="openIssue">出库</a-button>
          <a-button @click="openAdjust">库存调整</a-button>
        </a-space>
      </template>
    </a-card>

    <a-card :bordered="false">
      <MTable
        :columns="columns"
        :data="tableData"
        :loading="loading"
        :total="total"
        @change="onTableChange"
      >
        <template #frozenQty="{ record }">
          <span :style="{ color: (record.lockedQty as number) > 0 ? '#ff6b35' : '#e6edf3' }">
            {{ record.lockedQty ?? 0 }}
          </span>
        </template>
        <template #uomId="{ record }">
          <span>{{ ({ '1': '个', '2': '件', '3': 'kg', '4': 'm' } as Record<string,string>)[record.uomId as string] ?? record.uomId }}</span>
        </template>
        <template #action="{ record }">
          <a-space>
            <a-popconfirm
              v-if="!(record.frozenQty as number)"
              :content="$t('wms.inventory.index.确认冻结该库存')"
              @ok="handleLock(record)"
            >
              <a-link>冻结</a-link>
            </a-popconfirm>
            <a-popconfirm
              v-else
              :content="$t('wms.inventory.index.确认解冻该库存')"
              @ok="handleUnlock(record)"
            >
              <a-link>解冻</a-link>
            </a-popconfirm>
          </a-space>
        </template>
      </MTable>
    </a-card>

    <!-- 入库抽屉 -->
    <a-drawer v-model:visible="receiptVisible" :title="$t('wms.inventory.index.入库操作')" :width="480" @cancel="receiptVisible = false">
      <a-form :model="receiptFormData" layout="vertical">
        <a-form-item :label="$t('wms.inventory.index.物料')" required>
          <a-select v-model="receiptFormData.materialId" :placeholder="$t('wms.inventory.index.搜索物料')" allow-search allow-clear :filter-option="false" style="width:100%" @search="searchMaterials">
            <a-option v-for="m in matOptions" :key="m.id" :value="m.id" :label="`${m.code} - ${m.name}`" />
          </a-select>
        </a-form-item>
        <a-form-item :label="$t('wms.inventory.index.仓库')" required>
          <a-select v-model="receiptFormData.warehouseId" :placeholder="$t('wms.inventory.index.选择仓库')" allow-clear style="width:100%" @change="onWarehouseChange('receipt')">
            <a-option v-for="w in warehouseOptions" :key="w.id" :value="w.id" :label="w.name" />
          </a-select>
        </a-form-item>
        <a-form-item :label="$t('wms.inventory.index.库位')">
          <a-select v-model="receiptFormData.locationId" :placeholder="$t('wms.inventory.index.选择库位')" allow-clear style="width:100%">
            <a-option v-for="l in locationOptions" :key="l.id" :value="l.id" :label="l.code" />
          </a-select>
        </a-form-item>
        <a-form-item :label="$t('wms.inventory.index.数量')" required>
          <a-input-number v-model="receiptFormData.qty" :min="0.001" :precision="4" style="width:100%" />
        </a-form-item>
        <a-form-item :label="$t('wms.inventory.index.入库类型')" required>
          <a-select v-model="receiptFormData.type" style="width:100%">
            <a-option value="PURCHASE">采购入库</a-option>
            <a-option value="PRODUCTION">生产入库</a-option>
            <a-option value="RETURN">退货入库</a-option>
            <a-option value="OTHER">其他</a-option>
          </a-select>
        </a-form-item>
        <a-form-item style="margin-top:24px">
          <a-space>
            <a-button type="primary" :loading="submitting" @click="handleReceipt">确认入库</a-button>
            <a-button @click="receiptVisible = false">{{ $t('common.cancel') }}</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-drawer>

    <!-- 出库抽屉 -->
    <a-drawer v-model:visible="issueVisible" :title="$t('wms.inventory.index.出库操作')" :width="480" @cancel="issueVisible = false">
      <a-form :model="issueFormData" layout="vertical">
        <a-form-item :label="$t('wms.inventory.index.物料')" required>
          <a-select v-model="issueFormData.materialId" :placeholder="$t('wms.inventory.index.搜索物料')" allow-search allow-clear :filter-option="false" style="width:100%" @search="searchMaterials">
            <a-option v-for="m in matOptions" :key="m.id" :value="m.id" :label="`${m.code} - ${m.name}`" />
          </a-select>
        </a-form-item>
        <a-form-item :label="$t('wms.inventory.index.仓库')" required>
          <a-select v-model="issueFormData.warehouseId" :placeholder="$t('wms.inventory.index.选择仓库')" allow-clear style="width:100%" @change="onWarehouseChange('issue')">
            <a-option v-for="w in warehouseOptions" :key="w.id" :value="w.id" :label="w.name" />
          </a-select>
        </a-form-item>
        <a-form-item :label="$t('wms.inventory.index.库位')">
          <a-select v-model="issueFormData.locationId" :placeholder="$t('wms.inventory.index.选择库位')" allow-clear style="width:100%">
            <a-option v-for="l in locationOptions" :key="l.id" :value="l.id" :label="l.code" />
          </a-select>
        </a-form-item>
        <a-form-item :label="$t('wms.inventory.index.数量')" required>
          <a-input-number v-model="issueFormData.qty" :min="0.001" :precision="4" style="width:100%" />
        </a-form-item>
        <a-form-item :label="$t('wms.inventory.index.出库类型')" required>
          <a-select v-model="issueFormData.type" style="width:100%">
            <a-option value="PRODUCTION">生产领料</a-option>
            <a-option value="SALES">销售出库</a-option>
            <a-option value="TRANSFER">调拨出库</a-option>
            <a-option value="OTHER">其他</a-option>
          </a-select>
        </a-form-item>
        <a-form-item style="margin-top:24px">
          <a-space>
            <a-button type="primary" :loading="submitting" @click="handleIssue">确认出库</a-button>
            <a-button @click="issueVisible = false">{{ $t('common.cancel') }}</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-drawer>

    <!-- 库存调整弹窗 -->
    <a-modal v-model:visible="adjustVisible" :title="$t('wms.inventory.index.库存调整盘盈盘亏')" :ok-loading="submitting" @ok="handleAdjust" @cancel="adjustVisible = false">
      <a-form :model="adjustForm" layout="vertical">
        <a-form-item :label="$t('wms.inventory.index.物料')" required>
          <a-select v-model="adjustForm.materialId" :placeholder="$t('wms.inventory.index.搜索物料')" allow-search allow-clear :filter-option="false" style="width:100%" @search="searchMaterials">
            <a-option v-for="m in matOptions" :key="m.id" :value="m.id" :label="`${m.code} - ${m.name}`" />
          </a-select>
        </a-form-item>
        <a-form-item :label="$t('wms.inventory.index.仓库')" required>
          <a-select v-model="adjustForm.warehouseId" :placeholder="$t('wms.inventory.index.选择仓库')" allow-clear style="width:100%">
            <a-option v-for="w in warehouseOptions" :key="w.id" :value="w.id" :label="w.name" />
          </a-select>
        </a-form-item>
        <a-form-item :label="$t('wms.inventory.index.调整类型')" required>
          <a-select v-model="adjustForm.adjustType">
            <a-option value="GAIN">盘盈（增加）</a-option>
            <a-option value="LOSS">盘亏（减少）</a-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="$t('wms.inventory.index.调整数量')" required>
          <a-input-number v-model="adjustForm.qty" :min="0.001" :precision="4" style="width: 100%" />
        </a-form-item>
        <a-form-item :label="$t('wms.inventory.index.调整原因')" required>
          <a-textarea v-model="adjustForm.reason" :auto-size="{ minRows: 2 }" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
import { useI18n } from 'vue-i18n'
import { ref, reactive, onMounted } from 'vue'
import { Message } from '@arco-design/web-vue'
import MTable from '@/components/MTable/index.vue'
import type { MTableColumn } from '@/components/MTable/index.vue'
import { wmsApi } from '@/api/wms'
import { plmApi, type Material } from '@/api/plm'

const loading = ref(false)
const submitting = ref(false)
const tableData = ref<any[]>([])
const total = ref(0)
const query = reactive({ materialId: '', warehouseId: '', batchId: '', page: 1, pageSize: 20 })

const columns: MTableColumn[] = [
  { key: 'materialCode', title: t('wms.inventory.index.物料编码'), dataIndex: 'materialCode', width: 130 },
  { key: 'materialName', title: t('wms.inventory.index.物料名称'), dataIndex: 'materialName', width: 160 },
  { key: 'warehouseName', title: t('wms.inventory.index.仓库'), dataIndex: 'warehouseName', width: 120 },
  { key: 'locationCode', title: t('wms.inventory.index.库位'), dataIndex: 'locationCode', width: 100 },
  { key: 'batchNo', title: t('wms.inventory.index.批次号'), dataIndex: 'batchNo', width: 120 },
  { key: 'qty', title: t('wms.inventory.index.可用数量'), dataIndex: 'availableQty', width: 100 },
  { key: 'frozenQty', title: t('wms.inventory.index.冻结数量'), slotName: 'frozenQty', width: 100 },
  { key: 'unit', title: t('wms.inventory.index.单位'), slotName: 'uomId', width: 80 },
  { key: 'action', title: t('wms.inventory.index.操作'), slotName: 'action', width: 100 },
]

async function loadData() {
  loading.value = true
  try {
    const res = await wmsApi.getInventory(query)
    tableData.value = (res.list ?? []) as any[]
    total.value = res.total ?? 0
  } finally { loading.value = false }
}

function resetQuery() { query.materialId = ''; query.warehouseId = ''; query.batchId = ''; query.page = 1; loadData() }
function onTableChange(e: { page: number; pageSize: number }) { query.page = e.page; query.pageSize = e.pageSize; loadData() }

// 物料/仓库/库位搜索
const matOptions = ref<Material[]>([])
const warehouseOptions = ref<{ id: string; code: string; name: string }[]>([])
const locationOptions = ref<{ id: string; code: string; name: string; warehouseId: string }[]>([])
let matTimer: ReturnType<typeof setTimeout> | null = null

async function searchMaterials(kw: string) {
  if (matTimer) clearTimeout(matTimer)
  matTimer = setTimeout(async () => {
    const res = await plmApi.getMaterials({ keyword: kw, pageSize: 20 })
    matOptions.value = res.list ?? []
  }, 300)
}

async function loadWarehouses() {
  const res = await wmsApi.getWarehouses()
  warehouseOptions.value = res.list ?? []
}

async function onWarehouseChange(form: 'receipt' | 'issue') {
  const whId = form === 'receipt' ? receiptFormData.warehouseId : issueFormData.warehouseId
  if (!whId) { locationOptions.value = []; return }
  const res = await wmsApi.getLocations({ warehouseId: whId, pageSize: 200 })
  locationOptions.value = res.list ?? []
}

// 入库/出库
const receiptVisible = ref(false)
const issueVisible = ref(false)
const receiptFormData = reactive({ materialId: '', warehouseId: '', locationId: '', qty: undefined as number | undefined, type: 'PURCHASE' })
const issueFormData = reactive({ materialId: '', warehouseId: '', locationId: '', qty: undefined as number | undefined, type: 'PRODUCTION' })

function openReceipt() {
  Object.assign(receiptFormData, { materialId: '', warehouseId: '', locationId: '', qty: undefined, type: 'PURCHASE' })
  matOptions.value = []; locationOptions.value = []
  receiptVisible.value = true
}
function openIssue() {
  Object.assign(issueFormData, { materialId: '', warehouseId: '', locationId: '', qty: undefined, type: 'PRODUCTION' })
  matOptions.value = []; locationOptions.value = []
  issueVisible.value = true
}

async function handleReceipt() {
  if (!receiptFormData.materialId || !receiptFormData.warehouseId || !receiptFormData.qty) { Message.warning('请填写完整信息'); return }
  submitting.value = true
  try { await wmsApi.receipt({ ...receiptFormData }); Message.success('入库成功'); receiptVisible.value = false; loadData() }
  catch { /* handled */ } finally { submitting.value = false }
}

async function handleIssue() {
  if (!issueFormData.materialId || !issueFormData.warehouseId || !issueFormData.qty) { Message.warning('请填写完整信息'); return }
  submitting.value = true
  try { await wmsApi.issue({ ...issueFormData }); Message.success('出库成功'); issueVisible.value = false; loadData() }
  catch { /* handled */ } finally { submitting.value = false }
}

// 冻结/解冻
async function handleLock(record: Record<string, unknown>) {
  try {
    await wmsApi.lockInventory({ inventoryId: record.id, reason: '手动冻结' })
    Message.success('冻结成功')
    loadData()
  } catch { /* handled */ }
}

async function handleUnlock(record: Record<string, unknown>) {
  try {
    await wmsApi.unlockInventory({ inventoryId: record.id })
    Message.success('解冻成功')
    loadData()
  } catch { /* handled */ }
}

// 库存调整
const adjustVisible = ref(false)
const adjustForm = reactive({ materialId: '', warehouseId: '', adjustType: 'GAIN', qty: 0, reason: '' })

function openAdjust() {
  Object.assign(adjustForm, { materialId: '', warehouseId: '', adjustType: 'GAIN', qty: 0, reason: '' })
  matOptions.value = []
  adjustVisible.value = true
}

async function handleAdjust() {
  if (!adjustForm.materialId || !adjustForm.warehouseId || !adjustForm.qty || !adjustForm.reason) {
    Message.warning('请填写完整信息')
    return
  }
  submitting.value = true
  try {
    await wmsApi.adjustInventory({ ...adjustForm })
    Message.success('库存调整成功')
    adjustVisible.value = false
    loadData()
  } catch { /* handled */ } finally { submitting.value = false }
}

onMounted(() => { loadData(); loadWarehouses() })
</script>

<style scoped>
.page-container { padding: 16px; }
</style>
