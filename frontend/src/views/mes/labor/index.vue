<template>
  <div class="page-container">
    <a-card :bordered="false" style="margin-bottom: 16px">
      <a-space wrap>
        <a-select
          v-model="query.woId"
          :placeholder="$t('mes.labor.index.搜索工单号')"
          allow-search
          allow-clear
          :filter-option="false"
          style="width: 200px"
          @search="searchWorkOrders"
          @keyup.enter="loadData"
        >
          <a-option v-for="w in woOptions" :key="w.id" :value="w.id" :label="w.woNo" />
        </a-select>
        <a-select
          v-model="query.operatorId"
          :placeholder="$t('mes.labor.index.搜索操作员')"
          allow-search
          allow-clear
          :filter-option="false"
          style="width: 160px"
          @search="searchOperators"
        >
          <a-option v-for="u in operatorOptions" :key="u.id" :value="u.id" :label="u.realName" />
        </a-select>
        <a-date-picker v-model="query.startDate" :placeholder="$t('mes.labor.index.开始日期')" style="width: 140px" />
        <a-date-picker v-model="query.endDate" :placeholder="$t('mes.labor.index.结束日期')" style="width: 140px" />
        <a-button type="primary" @click="loadData">{{ $t('common.search') }}</a-button>
        <a-button @click="resetQuery">{{ $t('common.reset') }}</a-button>
      </a-space>
    </a-card>

    <a-card :bordered="false">
      <template #title>{{ $t('mes.labor.lbl1283') }}</template>
      <MTable
        :columns="columns"
        :data="tableData"
        :loading="loading"
        :total="total"
        :page-size="query.pageSize"
        @change="onTableChange"
      </MTable>

      <!-- 汇总统计 -->
      <div v-if="tableData.length" style="margin-top: 12px; padding: 12px; background: #161b22; border-radius: 6px; display: flex; gap: 32px;">
        <span style="color: #8b949e">{{ $t('mes.labor.lbl1284') }}<span style="color: #00b578; font-weight: 600">{{ directHours }}</span></span>
        <span style="color: #8b949e">{{ $t('mes.labor.lbl1285') }}<span style="color: #f53f3f; font-weight: 600">{{ indirectHours }}</span></span>
        <span style="color: #8b949e">{{ $t('mes.labor.lbl1286') }}<span style="color: #e6edf3; font-weight: 600">{{ total }}</span></span>
      </div>
    </a-card>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
import { useI18n } from 'vue-i18n'
import { ref, reactive, computed, onMounted } from 'vue'
import MTable from '@/components/MTable/index.vue'
import type { MTableColumn } from '@/components/MTable/index.vue'
import { mesApi } from '@/api/mes'
import { sysApi } from '@/api/sys'

interface WorkOrderOption { id: string; woNo: string }

const loading = ref(false)
const tableData = ref<any[]>([])
const total = ref(0)
const query = reactive({ woId: '', operatorId: '', startDate: '', endDate: '', page: 1, pageSize: 20 })

// 工单搜索
const woOptions = ref<WorkOrderOption[]>([])
let woTimer: ReturnType<typeof setTimeout> | null = null
async function searchWorkOrders(kw: string) {
  if (!kw) { woOptions.value = []; return }
  if (woTimer) clearTimeout(woTimer)
  woTimer = setTimeout(async () => {
    const res = await mesApi.getMesWorkOrders({ keyword: kw, pageSize: 20 })
    woOptions.value = (res.list ?? []).map((w: any) => ({ id: w.id, woNo: w.woNo }))
  }, 300)
}

// 操作员搜索
const operatorOptions = ref<any[]>([])
let opTimer: ReturnType<typeof setTimeout> | null = null
async function searchOperators(kw: string) {
  if (opTimer) clearTimeout(opTimer)
  opTimer = setTimeout(async () => {
    const res = await sysApi.getUsers({ realName: kw, pageSize: 20 })
    operatorOptions.value = res.list ?? []
  }, 300)
}

const columns: MTableColumn[] = [
  { key: 'woId', title: t('mes.labor.index.工单编号'), dataIndex: 'woNo', width: 140 },
  { key: 'operatorId', title: t('mes.labor.index.操作员'), dataIndex: 'operatorName', width: 110 },
  { key: 'laborType', title: t('mes.labor.index.工时类型'), dataIndex: 'laborType', width: 100 },
  { key: 'startTime', title: t('mes.labor.index.开始时间'), dataIndex: 'startTime', width: 170 },
  { key: 'endTime', title: t('mes.labor.index.结束时间'), dataIndex: 'endTime', width: 170 },
  { key: 'directHours', title: t('mes.labor.index.直接工时(h)'), dataIndex: 'directHours', width: 130 },
  { key: 'indirectHours', title: t('mes.labor.index.间接工时(h)'), dataIndex: 'indirectHours', width: 130 },
]

// 合计工时（分钟→小时）
const directHours = computed(() => tableData.value.reduce((s, r) => s + Number(r.directHours ?? 0), 0))
const indirectHours = computed(() => tableData.value.reduce((s, r) => s + Number(r.indirectHours ?? 0), 0))

async function loadData() {
  loading.value = true
  try {
    const params: Record<string, unknown> = { page: query.page, pageSize: query.pageSize }
    if (query.woId) params.woId = query.woId
    if (query.operatorId) params.operatorId = query.operatorId
    if (query.startDate) params.startDate = query.startDate
    if (query.endDate) params.endDate = query.endDate
    const res = await mesApi.getLaborRecords(params)
    tableData.value = (res.list ?? []) as any[]
    total.value = res.total ?? 0
  } catch { tableData.value = [] } finally { loading.value = false }
}

function resetQuery() { Object.assign(query, { woId: '', operatorId: '', startDate: '', endDate: '', page: 1 }); loadData() }
function onTableChange(e: { page: number; pageSize: number }) { query.page = e.page; query.pageSize = e.pageSize; loadData() }

onMounted(loadData)
</script>

<style scoped>
.page-container { padding: 16px; }
</style>
