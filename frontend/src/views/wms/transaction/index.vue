<template>
  <div class="page-container">
    <a-card :bordered="false" style="margin-bottom: 16px">
      <a-space wrap>
        <a-select
          v-model="query.materialId"
          :placeholder="$t('wms.transaction.index.搜索物料')"
          allow-search
          allow-clear
          :filter-option="false"
          style="width: 200px"
          @search="searchMaterials"
        >
          <a-option v-for="m in matOptions" :key="m.id" :value="m.id" :label="`${m.code} - ${m.name}`" />
        </a-select>
        <a-select
          v-model="query.warehouseId"
          :placeholder="$t('wms.transaction.index.选择仓库')"
          allow-clear
          style="width: 160px"
        >
          <a-option v-for="w in warehouseOptions" :key="w.id" :value="w.id" :label="w.name" />
        </a-select>
        <a-select v-model="query.direction" :placeholder="$t('wms.transaction.index.方向')" allow-clear style="width: 120px">
          <a-option :value="1">入库</a-option>
          <a-option :value="-1">出库</a-option>
        </a-select>
        <a-button type="primary" @click="loadData">{{ $t('common.search') }}</a-button>
        <a-button @click="resetQuery">{{ $t('common.reset') }}</a-button>
      </a-space>
    </a-card>

    <a-card :bordered="false">
      <MTable
        :columns="columns"
        :data="tableData"
        :loading="loading"
        :total="total"
        @change="onTableChange"
      >
        <template #direction="{ record }">
          <a-tag :color="record.direction === 1 ? 'green' : 'red'">
            {{ record.direction === 1 ? '入库' : '出库' }}
          </a-tag>
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
import { wmsApi } from '@/api/wms'
import { plmApi, type Material } from '@/api/plm'

const loading = ref(false)
const tableData = ref<any[]>([])
const total = ref(0)
const query = reactive({ materialId: '', warehouseId: '', direction: undefined as number | undefined, page: 1, pageSize: 20 })

const matOptions = ref<Material[]>([])
const warehouseOptions = ref<{ id: string; code: string; name: string }[]>([])
let matTimer: ReturnType<typeof setTimeout> | null = null

async function searchMaterials(kw: string) {
  if (matTimer) clearTimeout(matTimer)
  matTimer = setTimeout(async () => {
    const res = await plmApi.getMaterials({ keyword: kw, pageSize: 20 })
    matOptions.value = res.list ?? []
  }, 300)
}

const columns: MTableColumn[] = [
  { key: 'createdAt', title: t('wms.transaction.index.时间'), dataIndex: 'createdAt', width: 160 },
  { key: 'materialName', title: t('wms.transaction.index.物料名称'), dataIndex: 'materialName', width: 160 },
  { key: 'type', title: t('wms.transaction.index.类型'), dataIndex: 'type', width: 120 },
  { key: 'qty', title: t('wms.transaction.index.数量'), dataIndex: 'qty', width: 100 },
  { key: 'direction', title: t('wms.transaction.index.方向'), slotName: 'direction', width: 90 },
  { key: 'warehouseName', title: t('wms.transaction.index.仓库'), dataIndex: 'warehouseName', width: 120 },
  { key: 'batchId', title: t('wms.transaction.index.批次号'), dataIndex: 'batchId', width: 120 },
  { key: 'referenceId', title: t('wms.transaction.index.关联单据'), dataIndex: 'referenceId', width: 140 },
]

async function loadData() {
  loading.value = true
  try {
    const res = await wmsApi.getTransactions(query)
    tableData.value = (res.list ?? []) as any[]
    total.value = res.total ?? 0
  } finally {
    loading.value = false
  }
}

function resetQuery() {
  query.materialId = ''
  query.warehouseId = ''
  query.direction = undefined
  query.page = 1
  loadData()
}

function onTableChange(e: { page: number; pageSize: number }) {
  query.page = e.page
  query.pageSize = e.pageSize
  loadData()
}

onMounted(async () => {
  loadData()
  const res = await wmsApi.getWarehouses()
  warehouseOptions.value = res.list ?? []
})
</script>

<style scoped>
.page-container { padding: 16px; }
</style>
