<template>
  <div class="page-container">
    <a-card :bordered="false">
      <template #title>应付账款</template>
      <template #extra>
        <a-select v-model="query.status" :placeholder="$t('common.status')" allow-clear style="width: 120px" @change="loadData">
          <a-option value="OPEN">未付</a-option><a-option value="PARTIAL">部分付</a-option><a-option value="PAID">已付</a-option>
        </a-select>
      </template>
      <MTable :columns="columns" :data="tableData" :loading="loading" :total="total" :page-size="20" @change="onTableChange">
        <template #status="{ record }">
          <a-tag :color="record.status === 'PAID' ? 'green' : record.status === 'PARTIAL' ? 'orange' : 'blue'">
            {{ { OPEN: '未付', PARTIAL: '部分付', PAID: '已付' }[record.status as string] ?? record.status }}
          </a-tag>
        </template>
        <template #action="{ record }">
          <a-link v-if="record.status !== 'PAID'" @click="openPaymentModal(record.id as string)">付款</a-link>
        </template>
      </MTable>
    </a-card>
    <a-modal v-model:visible="paymentModalVisible" :title="$t('erp.payable.index.记录付款')" :ok-loading="paying" @ok="handlePayment" @cancel="paymentModalVisible = false">
      <a-form layout="vertical">
        <a-form-item :label="$t('erp.payable.index.付款金额')" required><a-input-number v-model="paymentForm.amount" :min="0.01" :precision="2" style="width:100%" /></a-form-item>
        <a-form-item :label="$t('erp.payable.index.付款日期')" required><a-date-picker v-model="paymentForm.paymentDate" style="width:100%" /></a-form-item>
        <a-form-item :label="$t('erp.payable.index.付款方式')"><a-select v-model="paymentForm.method"><a-option value="BANK_TRANSFER">银行转账</a-option><a-option value="CHECK">支票</a-option><a-option value="CASH">现金</a-option></a-select></a-form-item>
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
import { erpExtApi } from '@/api/erp-ext'
const loading = ref(false); const tableData = ref<any[]>([]); const total = ref(0)
const query = reactive({ status: '', page: 1, pageSize: 20 })
const columns: MTableColumn[] = [
  { key: 'supplierName', title: t('erp.payable.index.供应商'), dataIndex: 'supplierName', width: 150 },
  { key: 'amount', title: t('erp.payable.index.应付金额'), dataIndex: 'amount', width: 120 },
  { key: 'paidAmount', title: t('erp.payable.index.已付金额'), dataIndex: 'paidAmount', width: 120 },
  { key: 'currency', title: t('erp.payable.index.币种'), dataIndex: 'currency', width: 80 },
  { key: 'dueDate', title: t('erp.payable.index.到期日'), dataIndex: 'dueDate', width: 120 },
  { key: 'status', title: t('erp.payable.index.状态'), slotName: 'status', width: 100 },
  { key: 'action', title: t('erp.payable.index.操作'), slotName: 'action', width: 80 },
]
async function loadData() {
  loading.value = true
  try { const res = await erpExtApi.getPayables(query); tableData.value = (res.list ?? []) as any[]; total.value = res.total ?? 0 }
  catch { tableData.value = [] } finally { loading.value = false }
}
function onTableChange(e: { page: number; pageSize: number }) { query.page = e.page; query.pageSize = e.pageSize; loadData() }
const paymentModalVisible = ref(false); const paying = ref(false); const currentId = ref(''); const paymentForm = reactive({ amount: 0, paymentDate: '', method: 'BANK_TRANSFER' })
function openPaymentModal(id: string) { currentId.value = id; paymentForm.amount = 0; paymentForm.paymentDate = ''; paymentModalVisible.value = true }
async function handlePayment() {
  if (!paymentForm.amount || !paymentForm.paymentDate) { Message.warning('请填写付款金额和日期'); return }
  paying.value = true
  try { await erpExtApi.recordPayablePayment(currentId.value, paymentForm); Message.success('付款记录成功'); paymentModalVisible.value = false; loadData() }
  catch { /* handled */ } finally { paying.value = false }
}
onMounted(loadData)
</script>
<style scoped>.page-container { padding: 16px; }</style>
