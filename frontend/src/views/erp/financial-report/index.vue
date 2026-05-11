<template>
  <div class="page-container">
    <a-card :bordered="false" style="margin-bottom: 16px">
      <a-space wrap>
        <a-date-picker v-model="query.period" :placeholder="$t('erp.financial-report.index.会计期间')" picker="month" style="width: 140px" />
        <a-button type="primary" :loading="loading" @click="loadData">生成报表</a-button>
      </a-space>
    </a-card>
    <a-card :bordered="false">
      <a-tabs v-model:active-key="activeTab">
        <a-tab-pane key="balance" :title="$t('erp.financial-report.index.资产负债表')">
          <a-empty v-if="!balanceData" :description="$t('erp.financial-report.index.请选择会计期间并生成报表')" />
          <a-descriptions v-else :data="balanceItems" :column="2" bordered />
        </a-tab-pane>
        <a-tab-pane key="income" :title="$t('erp.financial-report.index.利润表')">
          <a-empty v-if="!incomeData" :description="$t('erp.financial-report.index.请选择会计期间并生成报表')" />
          <a-descriptions v-else :data="incomeItems" :column="2" bordered />
        </a-tab-pane>
        <a-tab-pane key="cashflow" :title="$t('erp.financial-report.index.现金流量表')">
          <a-empty v-if="!cashflowData" :description="$t('erp.financial-report.index.请选择会计期间并生成报表')" />
          <a-descriptions v-else :data="cashflowItems" :column="2" bordered />
        </a-tab-pane>
      </a-tabs>
    </a-card>
  </div>
</template>
<script setup lang="ts">

import { ref, reactive, computed, onMounted } from 'vue'
import { erpExtApi } from '@/api/erp-ext'
const loading = ref(false); const activeTab = ref('balance'); const query = reactive({ period: '' })
const balanceData = ref<Record<string, unknown> | null>(null)
const incomeData = ref<Record<string, unknown> | null>(null)
const cashflowData = ref<Record<string, unknown> | null>(null)
const balanceItems = computed(() => {
  if (!balanceData.value) return []
  return Object.entries(balanceData.value).map(([k, v]) => ({ label: k, value: String(v) }))
})
const incomeItems = computed(() => {
  if (!incomeData.value) return []
  return Object.entries(incomeData.value).map(([k, v]) => ({ label: k, value: String(v) }))
})
const cashflowItems = computed(() => {
  if (!cashflowData.value) return []
  return Object.entries(cashflowData.value).map(([k, v]) => ({ label: k, value: String(v) }))
})
async function loadData() {
  if (!query.period) return
  loading.value = true
  try {
    const [b, i, c] = await Promise.all([erpExtApi.getBalanceSheet(query), erpExtApi.getIncomeStatement(query), erpExtApi.getCashFlow(query)])
    balanceData.value = b; incomeData.value = i; cashflowData.value = c
  } catch { /* handled */ } finally { loading.value = false }
}
onMounted(() => {})
</script>
<style scoped>.page-container { padding: 16px; }</style>
