<template>
  <div class="page-container">
    <a-card :bordered="false" style="margin-bottom: 16px">
      <a-space wrap>
        <a-input v-model="query.accountCode" :placeholder="$t('erp.ledger.general.科目编码')" allow-clear style="width: 160px" @keyup.enter="loadData" />
        <a-date-picker v-model="query.startDate" :placeholder="$t('erp.ledger.general.开始日期')" style="width: 140px" />
        <a-date-picker v-model="query.endDate" :placeholder="$t('erp.ledger.general.结束日期')" style="width: 140px" />
        <a-button type="primary" @click="loadData">{{ $t('common.search') }}</a-button>
        <a-button @click="resetQuery">{{ $t('common.reset') }}</a-button>
      </a-space>
    </a-card>
    <a-card :bordered="false">
      <a-tabs v-model:active-key="activeTab">
        <a-tab-pane key="general" :title="$t('erp.ledger.general.总账')">
          <a-table :columns="generalColumns" :data="generalData" :loading="loading" :pagination="false" row-key="accountCode" />
        </a-tab-pane>
        <a-tab-pane key="detail" :title="$t('erp.ledger.general.明细账')">
          <MTable :columns="detailColumns" :data="detailData" :loading="loading" :total="detailTotal" :page-size="20" @change="onDetailChange" />
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
import { erpExtApi } from '@/api/erp-ext'
const loading = ref(false); const activeTab = ref('general')
const query = reactive({ accountCode: '', startDate: '', endDate: '', page: 1, pageSize: 20 })
const generalData = ref<any[]>([]); const detailData = ref<any[]>([]); const detailTotal = ref(0)
const generalColumns = [
  { title: t('erp.ledger.general.科目编码'), dataIndex: 'accountCode', width: 130 },
  { title: t('erp.ledger.general.科目名称'), dataIndex: 'accountName', width: 180 },
  { title: t('erp.ledger.general.期初余额'), dataIndex: 'openingBalance', width: 120 },
  { title: t('erp.ledger.general.借方发生额'), dataIndex: 'debitAmount', width: 120 },
  { title: t('erp.ledger.general.贷方发生额'), dataIndex: 'creditAmount', width: 120 },
  { title: t('erp.ledger.general.期末余额'), dataIndex: 'closingBalance', width: 120 },
]
const detailColumns: MTableColumn[] = [
  { key: 'voucherCode', title: t('erp.ledger.general.凭证号'), dataIndex: 'voucherCode', width: 130 },
  { key: 'accountCode', title: t('erp.ledger.general.科目'), dataIndex: 'accountCode', width: 120 },
  { key: 'description', title: t('erp.ledger.general.摘要'), dataIndex: 'description', width: 200, ellipsis: true },
  { key: 'debitAmount', title: t('erp.ledger.general.借方金额'), dataIndex: 'debitAmount', width: 120 },
  { key: 'creditAmount', title: t('erp.ledger.general.贷方金额'), dataIndex: 'creditAmount', width: 120 },
  { key: 'voucherDate', title: t('erp.ledger.general.凭证日期'), dataIndex: 'voucherDate', width: 120 },
]
async function loadData() {
  loading.value = true
  try {
    const [genRes, detRes] = await Promise.all([
      erpExtApi.getGeneralLedger(query),
      erpExtApi.getDetailLedger(query),
    ])
    generalData.value = (genRes.list ?? []) as any[]
    detailData.value = (detRes.list ?? []) as any[]
    detailTotal.value = detRes.total ?? 0
  } catch { generalData.value = []; detailData.value = [] } finally { loading.value = false }
}
function resetQuery() { query.accountCode = ''; query.startDate = ''; query.endDate = ''; query.page = 1; loadData() }
function onDetailChange(e: { page: number; pageSize: number }) { query.page = e.page; query.pageSize = e.pageSize; loadData() }
onMounted(loadData)
</script>
<style scoped>.page-container { padding: 16px; }</style>
