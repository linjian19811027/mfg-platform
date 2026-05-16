<template>
  <div class="page-container">
    <!-- 搜索栏 -->
    <a-card :bordered="false" style="margin-bottom: 16px">
      <a-space wrap>
        <a-input v-model="query.materialId" :placeholder="$t('wms.reports.ledger.物料ID')" allow-clear style="width: 160px" @keyup.enter="loadLedger" />
        <a-input v-model="query.warehouseId" :placeholder="$t('wms.reports.ledger.仓库ID')" allow-clear style="width: 160px" @keyup.enter="loadLedger" />
        <a-button type="primary" @click="loadLedger">{{ $t('wms.reports.queryLedger') }}</a-button>
        <a-button @click="loadMovement">{{ $t('wms.reports.queryMovement') }}</a-button>
        <a-button @click="resetQuery">{{ $t('common.reset') }}</a-button>
      </a-space>
    </a-card>

    <!-- 标签页切换 -->
    <a-card :bordered="false">
      <a-tabs v-model:active-key="activeTab">
        <!-- 库存台账 -->
        <a-tab-pane key="ledger" :title="$t('wms.reports.ledger.库存台账')">
          <MTable :columns="ledgerColumns" :data="ledgerData" :loading="ledgerLoading" :total="ledgerTotal" :page-size="20" @change="onLedgerChange" />
        </a-tab-pane>

        <!-- 收发存报表 -->
        <a-tab-pane key="movement" :title="$t('wms.reports.ledger.收发存报表')">
          <a-space wrap style="margin-bottom: 12px">
            <a-date-picker v-model="movQuery.startDate" :placeholder="$t('wms.reports.ledger.开始日期')" style="width: 140px" />
            <a-date-picker v-model="movQuery.endDate" :placeholder="$t('wms.reports.ledger.结束日期')" style="width: 140px" />
            <a-button type="primary" @click="loadMovement">{{ $t('common.search') }}</a-button>
          </a-space>
          <MTable :columns="movColumns" :data="movData" :loading="movLoading" :total="movTotal" :page-size="20" @change="onMovChange" />
        </a-tab-pane>
      </a-tabs>
    </a-card>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
import { useI18n } from 'vue-i18n'
import { ref, reactive, onMounted } from 'vue'
import MTable from '@/components/MTable/index.vue'
import type { MTableColumn } from '@/components/MTable/index.vue'
import { wmsApi } from '@/api/wms'

const activeTab = ref('ledger')

// 台账
const ledgerLoading = ref(false)
const ledgerData = ref<any[]>([])
const ledgerTotal = ref(0)
const query = reactive({ materialId: '', warehouseId: '', page: 1, pageSize: 20 })

const ledgerColumns: MTableColumn[] = [
  { key: 'materialCode', title: t('wms.reports.ledger.物料编码'), dataIndex: 'materialCode', width: 130 },
  { key: 'materialName', title: t('wms.reports.ledger.物料名称'), dataIndex: 'materialName', width: 160 },
  { key: 'warehouseName', title: t('wms.reports.ledger.仓库'), dataIndex: 'warehouseName', width: 120 },
  { key: 'locationCode', title: t('wms.reports.ledger.货位'), dataIndex: 'locationCode', width: 110 },
  { key: 'batchNo', title: t('wms.reports.ledger.批次号'), dataIndex: 'batchNo', width: 120 },
  { key: 'quantity', title: t('wms.reports.ledger.库存数量'), dataIndex: 'quantity', width: 100 },
  { key: 'availableQty', title: t('wms.reports.ledger.可用数量'), dataIndex: 'availableQty', width: 100 },
  { key: 'frozenQty', title: t('wms.reports.ledger.冻结数量'), dataIndex: 'lockedQty', width: 100 },
  { key: 'unit', title: t('wms.reports.ledger.单位'), dataIndex: 'uomCode', width: 80 },
  { key: 'updatedAt', title: t('wms.reports.ledger.更新时间'), dataIndex: 'updatedAt', width: 160 },
]

async function loadLedger() {
  ledgerLoading.value = true
  try {
    const params: Record<string, unknown> = { page: query.page, pageSize: query.pageSize }
    if (query.materialId) params.materialId = query.materialId
    if (query.warehouseId) params.warehouseId = query.warehouseId
    const res = await wmsApi.getLedger(params)
    ledgerData.value = (res.list ?? []) as any[]
    ledgerTotal.value = res.total ?? 0
  } catch { ledgerData.value = [] } finally { ledgerLoading.value = false }
}

function onLedgerChange(e: { page: number; pageSize: number }) { query.page = e.page; query.pageSize = e.pageSize; loadLedger() }

// 收发存
const movLoading = ref(false)
const movData = ref<any[]>([])
const movTotal = ref(0)
const movQuery = reactive({ startDate: '', endDate: '', page: 1, pageSize: 20 })

const movColumns: MTableColumn[] = [
  { key: 'materialCode', title: t('wms.reports.ledger.物料编码'), dataIndex: 'materialCode', width: 130 },
  { key: 'materialName', title: t('wms.reports.ledger.物料名称'), dataIndex: 'materialName', width: 160 },
  { key: 'openingQty', title: t('wms.reports.ledger.期初库存'), dataIndex: 'openingQty', width: 100 },
  { key: 'inQty', title: t('wms.reports.ledger.本期入库'), dataIndex: 'inQty', width: 100 },
  { key: 'outQty', title: t('wms.reports.ledger.本期出库'), dataIndex: 'outQty', width: 100 },
  { key: 'closingQty', title: t('wms.reports.ledger.期末库存'), dataIndex: 'closingQty', width: 100 },
  { key: 'unit', title: t('wms.reports.ledger.单位'), dataIndex: 'uomCode', width: 80 },
]

async function loadMovement() {
  movLoading.value = true
  activeTab.value = 'movement'
  try {
    const params: Record<string, unknown> = { page: movQuery.page, pageSize: movQuery.pageSize }
    if (movQuery.startDate) params.startDate = movQuery.startDate
    if (movQuery.endDate) params.endDate = movQuery.endDate
    const res = await wmsApi.getMovement(params)
    movData.value = (res.list ?? []) as any[]
    movTotal.value = (res as unknown as { total?: number }).total ?? movData.value.length
  } catch { movData.value = [] } finally { movLoading.value = false }
}

function onMovChange(e: { page: number; pageSize: number }) { movQuery.page = e.page; movQuery.pageSize = e.pageSize; loadMovement() }

function resetQuery() { query.materialId = ''; query.warehouseId = ''; query.page = 1; loadLedger() }

onMounted(loadLedger)
</script>

<style scoped>
.page-container { padding: 16px; }
</style>
