<template>
  <div class="page-container">
    <a-card :bordered="false" style="margin-bottom: 16px">
      <a-space wrap>
        <a-input v-model="query.supplierId" :placeholder="$t('qms.supplier-quality.index.供应商ID')" allow-clear style="width: 180px" @keyup.enter="loadData" />
        <a-select v-model="query.result" :placeholder="$t('qms.supplier-quality.index.检验结果')" allow-clear style="width: 120px">
          <a-option value="PASS">合格</a-option>
          <a-option value="FAIL">不合格</a-option>
        </a-select>
        <a-button type="primary" @click="loadData">{{ $t('common.search') }}</a-button>
        <a-button @click="resetQuery">{{ $t('common.reset') }}</a-button>
      </a-space>
    </a-card>

    <a-card :bordered="false">
      <template #title>供应商质量记录（IQC）</template>
      <MTable :columns="columns" :data="tableData" :loading="loading" :total="total" :page-size="20" @change="onTableChange">
        <template #result="{ record }">
          <a-tag :color="record.result === 'PASS' ? 'green' : record.result === 'FAIL' ? 'red' : 'gray'">
            {{ record.result === 'PASS' ? '合格' : record.result === 'FAIL' ? '不合格' : '待检' }}
          </a-tag>
        </template>
        <template #passRate="{ record }">
          <span v-if="record.totalQty">
            {{ (((record.totalQty as number) - (record.defectQty as number || 0)) / (record.totalQty as number) * 100).toFixed(1) }}%
          </span>
          <span v-else>-</span>
        </template>
      </MTable>
    </a-card>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
import { useI18n } from 'vue-i18n'
import { ref, reactive, onMounted } from 'vue'
import MTable from '@/components/MTable/index.vue'
import type { MTableColumn } from '@/components/MTable/index.vue'
import { qmsApi } from '@/api/qms'

const loading = ref(false)
const tableData = ref<any[]>([])
const total = ref(0)
const query = reactive({ supplierId: '', result: '', page: 1, pageSize: 20 })

const columns: MTableColumn[] = [
  { key: 'supplierName', title: t('qms.supplier-quality.index.供应商'), dataIndex: 'supplierName', width: 160 },
  { key: 'materialName', title: t('qms.supplier-quality.index.物料名称'), dataIndex: 'materialName', width: 160 },
  { key: 'batchId', title: t('qms.supplier-quality.index.批次号'), dataIndex: 'batchId', width: 120 },
  { key: 'totalQty', title: t('qms.supplier-quality.index.检验数量'), dataIndex: 'totalQty', width: 100 },
  { key: 'defectQty', title: t('qms.supplier-quality.index.不合格数'), dataIndex: 'defectQty', width: 100 },
  { key: 'passRate', title: t('qms.supplier-quality.index.合格率'), slotName: 'passRate', width: 100 },
  { key: 'result', title: t('qms.supplier-quality.index.结果'), slotName: 'result', width: 90 },
  { key: 'createdAt', title: t('qms.supplier-quality.index.检验时间'), dataIndex: 'createdAt', width: 160 },
]

async function loadData() {
  loading.value = true
  try {
    const params: Record<string, unknown> = { page: query.page, pageSize: query.pageSize, inspectionType: 'IQC' }
    if (query.supplierId) params.supplierId = query.supplierId
    if (query.result) params.result = query.result
    const res = await qmsApi.getSupplierQuality(params)
    tableData.value = (res.list ?? []) as any[]
    total.value = res.total ?? 0
  } catch { tableData.value = [] } finally { loading.value = false }
}

function resetQuery() { query.supplierId = ''; query.result = ''; query.page = 1; loadData() }
function onTableChange(e: { page: number; pageSize: number }) { query.page = e.page; query.pageSize = e.pageSize; loadData() }

onMounted(loadData)
</script>

<style scoped>
.page-container { padding: 16px; }
</style>
