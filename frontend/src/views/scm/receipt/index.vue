<template>
  <div class="page-container">
    <a-card>
      <div class="search-bar">
        <a-input v-model="query.supplierId" :placeholder="$t('scm.receipt.index.供应商ID')" allow-clear style="width:180px" />
        <a-button type="primary" @click="loadData">{{ $t('common.search') }}</a-button>
        <a-button @click="resetQuery">{{ $t('common.reset') }}</a-button>
      </div>

      <MTable :columns="columns" :data="list" :loading="loading" :total="total" @change="onTableChange">
        <template #status="{ record }">
          <a-tag :color="statusColor(record.status as string)">{{ statusLabel(record.status as string) }}</a-tag>
        </template>
      </MTable>
    </a-card>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
import { useI18n } from 'vue-i18n'
import { ref, reactive } from 'vue'
import MTable from '@/components/MTable/index.vue'
import type { MTableColumn } from '@/components/MTable/index.vue'
import { scmApi, type Receipt } from '@/api/scm'

const statusColorMap: Record<string, string> = {
  pending: 'gray', inspecting: 'orange', accepted: 'green', rejected: 'red',
}
const statusLabelMap: Record<string, string> = {
  pending: '待处理', inspecting: '检验中', accepted: '已接收', rejected: '已拒绝',
}
const statusColor = (s: string) => statusColorMap[s] ?? 'gray'
const statusLabel = (s: string) => statusLabelMap[s] ?? s

const columns: MTableColumn[] = [
  { key: 'poId', title: t('scm.receipt.index.采购订单号'), width: 140 },
  { key: 'supplierName', title: t('scm.receipt.index.供应商名称') },
  { key: 'status', title: t('scm.receipt.index.状态'), width: 100, slotName: 'status' },
  { key: 'receivedDate', title: t('scm.receipt.index.到货日期'), width: 120 },
  { key: 'materialId', title: t('scm.receipt.index.物料ID'), width: 120 },
  { key: 'qty', title: t('scm.receipt.index.数量'), width: 90 },
]

const query = reactive({ supplierId: '' })
const list = ref<Receipt[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const pageSize = ref(20)

async function loadData() {
  loading.value = true
  try {
    const res = await scmApi.getReceipts({ ...query, page: page.value, pageSize: pageSize.value })
    list.value = res.list
    total.value = res.total
  } finally { loading.value = false }
}

function resetQuery() { query.supplierId = ''; loadData() }
function onTableChange(e: { page: number; pageSize: number }) { page.value = e.page; pageSize.value = e.pageSize; loadData() }

loadData()
</script>

<style scoped>
.page-container { padding: 16px; }
.search-bar { display: flex; gap: 8px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
</style>
