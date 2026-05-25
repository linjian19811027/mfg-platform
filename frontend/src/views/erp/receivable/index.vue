<template>
  <div class="page-container">
    <a-row :gutter="16" style="margin-bottom: 16px">
      <a-col :span="24">
        <a-card :title="$t('erp.receivable.index.账龄分析')" :bordered="false">
          <div ref="agingRef" class="chart-container" />
        </a-card>
      </a-col>
    </a-row>
    <a-card :bordered="false">
      <template #title>{{ $t('erp.receivable.lbl1208') }}</template>
      <template #extra>
        <a-space>
          <a-select v-model="query.status" :placeholder="$t('common.status')" allow-clear style="width: 120px" @change="loadData">
            <a-option value="OPEN">{{ $t('erp.receivable.lbl1209') }}</a-option><a-option value="PARTIAL">{{ $t('erp.receivable.lbl1210') }}</a-option>
            <a-option value="PAID">{{ $t('erp.receivable.lbl1211') }}</a-option><a-option value="OVERDUE">{{ $t('erp.receivable.lbl1212') }}</a-option>
          </a-select>
          <a-button type="primary" @click="loadData">{{ $t('common.search') }}</a-button>
        </a-space>
      </template>
      <MTable :columns="columns" :data="tableData" :loading="loading" :total="total" :page-size="20" @change="onTableChange">
        <template #status="{ record }">
          <a-tag :color="record.status === 'PAID' ? 'green' : record.status === 'OVERDUE' ? 'red' : record.status === 'PARTIAL' ? 'orange' : 'blue'">
            {{ { OPEN: t('erp.receivable.lbl1213'), PARTIAL: t('erp.receivable.lbl1214'), PAID: t('erp.receivable.lbl1215'), OVERDUE: t('erp.receivable.lbl1216') }[record.status as string] ?? record.status }}
          </a-tag>
        </template>
        <template #action="{ record }">
          <a-link v-if="record.status !== 'PAID'" @click="openPaymentModal(record.id as string)">{{ $t('erp.receivable.lbl1217') }}</a-link>
        </template>
      </MTable>
    </a-card>
    <a-modal v-model:visible="paymentModalVisible" :title="$t('erp.receivable.index.记录收款')" :ok-loading="paying" @ok="handlePayment" @cancel="paymentModalVisible = false">
      <a-form :model="paymentForm" layout="vertical">
        <a-form-item :label="$t('erp.receivable.index.收款金额')" required><a-input-number v-model="paymentForm.amount" :min="0.01" :precision="2" style="width:100%" /></a-form-item>
        <a-form-item :label="$t('erp.receivable.index.收款日期')" required><a-date-picker v-model="paymentForm.paymentDate" style="width:100%" /></a-form-item>
        <a-form-item :label="$t('erp.receivable.index.银行账户')"><a-input v-model="paymentForm.bankAccount" /></a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>
<script setup lang="ts">
const { t } = useI18n()
import { useI18n } from 'vue-i18n'
import { ref, reactive, onMounted, onUnmounted, nextTick } from 'vue'
import { Message } from '@arco-design/web-vue'
import * as echarts from 'echarts/core'
import { BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import MTable from '@/components/MTable/index.vue'
import type { MTableColumn } from '@/components/MTable/index.vue'
import { erpExtApi } from '@/api/erp-ext'
echarts.use([BarChart, GridComponent, TooltipComponent, CanvasRenderer])
const loading = ref(false); const tableData = ref<any[]>([]); const total = ref(0)
const query = reactive({ status: '', page: 1, pageSize: 20 })
const agingRef = ref<HTMLElement | null>(null); let agingChart: echarts.ECharts | null = null
const columns: MTableColumn[] = [
  { key: 'customerName', title: t('erp.receivable.index.客户'), dataIndex: 'customerName', width: 150 },
  { key: 'amount', title: t('erp.receivable.index.应收金额'), dataIndex: 'amount', width: 120 },
  { key: 'paidAmount', title: t('erp.receivable.index.已收金额'), dataIndex: 'paidAmount', width: 120 },
  { key: 'currency', title: t('erp.receivable.index.币种'), dataIndex: 'currency', width: 80 },
  { key: 'dueDate', title: t('erp.receivable.index.到期日'), dataIndex: 'dueDate', width: 120 },
  { key: 'status', title: t('erp.receivable.index.状态'), slotName: 'status', width: 100 },
  { key: 'action', title: t('erp.receivable.index.操作'), slotName: 'action', width: 80 },
]
async function loadData() {
  loading.value = true
  try {
    const [listRes, agingRes] = await Promise.all([erpExtApi.getReceivables(query), erpExtApi.getAgingAnalysis()])
    tableData.value = (listRes.list ?? []) as any[]; total.value = listRes.total ?? 0
    await nextTick()
    if (agingRef.value) {
      agingChart?.dispose(); agingChart = echarts.init(agingRef.value)
      agingChart.setOption({ backgroundColor: 'transparent', tooltip: { trigger: 'axis', backgroundColor: '#161B22', borderColor: '#30363D', textStyle: { color: '#E6EDF3' } }, grid: { top: 20, right: 20, bottom: 30, left: 60 }, xAxis: { type: 'category', data: agingRes.buckets.map(b => b.range), axisLabel: { color: '#8B949E' }, axisLine: { lineStyle: { color: '#30363D' } } }, yAxis: { type: 'value', axisLabel: { color: '#8B949E' }, splitLine: { lineStyle: { color: '#21262D' } } }, series: [{ type: 'bar', data: agingRes.buckets.map(b => b.amount), itemStyle: { color: '#1B4FD8', borderRadius: [4, 4, 0, 0] } }] })
    }
  } catch { tableData.value = [] } finally { loading.value = false }
}
function onTableChange(e: { page: number; pageSize: number }) { query.page = e.page; query.pageSize = e.pageSize; loadData() }
const paymentModalVisible = ref(false); const paying = ref(false); const currentId = ref(''); const paymentForm = reactive({ amount: 0, paymentDate: '', bankAccount: '' })
function openPaymentModal(id: string) { currentId.value = id; paymentForm.amount = 0; paymentForm.paymentDate = ''; paymentForm.bankAccount = ''; paymentModalVisible.value = true }
async function handlePayment() {
  if (!paymentForm.amount || !paymentForm.paymentDate) { Message.warning(t('erp.请填写收款金额和日期')); return }
  paying.value = true
  try { await erpExtApi.recordReceivablePayment(currentId.value, paymentForm); Message.success(t('erp.收款记录成功')); paymentModalVisible.value = false; loadData() }
  catch { /* handled */ } finally { paying.value = false }
}
onMounted(loadData); onUnmounted(() => agingChart?.dispose())
</script>
<style scoped>.page-container { padding: 16px; } .chart-container { height: 220px; width: 100%; }</style>
