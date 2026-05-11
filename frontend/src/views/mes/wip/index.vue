<template>
  <div class="page-container">
    <a-card :bordered="false" style="margin-bottom: 16px">
      <a-space wrap>
        <a-input v-model="query.keyword" :placeholder="$t('mes.wip.index.物料名称工单号搜索')" allow-clear style="width: 220px" @keyup.enter="loadData" />
        <a-button type="primary" @click="loadData">{{ $t('common.search') }}</a-button>
        <a-button @click="resetQuery">{{ $t('common.reset') }}</a-button>
      </a-space>
    </a-card>

    <a-card :bordered="false">
      <template #title>在制品（WIP）</template>
      <template #extra>
        <a-tag color="blue">共 {{ total }} 条在制工单</a-tag>
      </template>
      <MTable
        :columns="columns"
        :data="tableData"
        :loading="loading"
        :total="total"
        :page-size="20"
        @change="onTableChange"
      >
        <template #currentOp="{ record }">
          <span>{{ record.currentOp || '-' }}</span>
        </template>
        <template #wipQty="{ record }">
          <span style="font-weight: 600; color: #ff6b35">{{ record.wipQty }}</span>
        </template>
        <template #progress="{ record }">
          <a-progress :percent="record.progress as number" size="small" />
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
import { mesApi } from '@/api/mes'

const loading = ref(false)
const tableData = ref<any[]>([])
const total = ref(0)
const query = reactive({ keyword: '', page: 1, pageSize: 20 })

const columns: MTableColumn[] = [
  { key: 'code', title: t('mes.wip.index.工单号'), dataIndex: 'code', width: 140 },
  { key: 'materialName', title: t('mes.wip.index.物料名称'), dataIndex: 'materialName', width: 160 },
  { key: 'plannedQty', title: t('mes.wip.index.计划数量'), dataIndex: 'plannedQty', width: 100 },
  { key: 'completedQty', title: t('mes.wip.index.完成数量'), dataIndex: 'completedQty', width: 100 },
  { key: 'wipQty', title: t('mes.wip.index.在制数量'), slotName: 'wipQty', width: 100 },
  { key: 'currentOp', title: t('mes.wip.index.当前工序'), slotName: 'currentOp', width: 140 },
  { key: 'progress', title: t('mes.wip.index.进度'), slotName: 'progress', width: 160 },
  { key: 'plannedEndDate', title: t('mes.wip.index.计划完成'), dataIndex: 'plannedEndDate', width: 120 },
]

async function loadData() {
  loading.value = true
  try {
    const res = await mesApi.getMesWorkOrders({
      status: 'in_progress',
      keyword: query.keyword || undefined,
      page: query.page,
      pageSize: query.pageSize,
    })
    tableData.value = (res.list ?? []).map(wo => {
      const inProgressOp = wo.operations?.find(op => op.status === 'in_progress')
      const progress = wo.plannedQty > 0 ? Math.min(100, Math.round(wo.completedQty / wo.plannedQty * 100)) : 0
      return {
        ...wo,
        wipQty: Math.max(0, wo.plannedQty - wo.completedQty),
        currentOp: inProgressOp?.name ?? (wo.operations?.find(op => op.status === 'pending')?.name ?? '—'),
        progress,
      }
    }) as any[]
    total.value = res.total ?? 0
  } catch {
    tableData.value = []
  } finally {
    loading.value = false
  }
}

function resetQuery() { query.keyword = ''; query.page = 1; loadData() }
function onTableChange(e: { page: number; pageSize: number }) { query.page = e.page; query.pageSize = e.pageSize; loadData() }

onMounted(loadData)
</script>

<style scoped>
.page-container { padding: 16px; }
</style>
