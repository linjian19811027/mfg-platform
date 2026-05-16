<template>
  <div class="page-container">
    <a-card :bordered="false" style="margin-bottom: 16px">
      <a-space wrap>
        <a-button type="primary" :loading="calculating" @click="openCalcModal">{{ $t('aps.mrp.lbl1006') }}</a-button>
        <a-button @click="loadData">{{ $t('aps.mrp.lbl1007') }}</a-button>
      </a-space>
    </a-card>
    <a-card :bordered="false">
      <MTable :columns="columns" :data="tableData" :loading="loading" :total="total" :page-size="20" @change="onTableChange">
        <template #status="{ record }">
          <a-tag :color="record.status === 'COMPLETED' ? 'green' : record.status === 'RUNNING' ? 'orange' : record.status === 'FAILED' ? 'red' : 'gray'">
            {{ { RUNNING: t('aps.mrp.lbl1008'), COMPLETED: t('aps.mrp.completed'), FAILED: t('aps.mrp.lbl1009'), PENDING: t('aps.mrp.lbl1010') }[record.status as string] ?? record.status }}
          </a-tag>
        </template>
        <template #action="{ record }">
          <a-space>
            <a-link v-if="record.status === 'COMPLETED'" @click="openDetailDrawer(record.id as string)">{{ $t('aps.mrp.lbl1011') }}</a-link>
            <a-popconfirm v-if="record.status === 'COMPLETED'" :content="$t('aps.mrp.index.确认发布MRP计划将自动生成采')" @ok="handleRelease(record.id as string)">
              <a-link>{{ $t('aps.mrp.lbl1012') }}</a-link>
            </a-popconfirm>
          </a-space>
        </template>
      </MTable>
    </a-card>

    <!-- 触发计算弹窗 -->
    <a-modal v-model:visible="calcModalVisible" :title="$t('aps.mrp.index.触发MRP计算')" :ok-loading="calculating" @ok="handleCalculate" @cancel="calcModalVisible = false">
      <a-form layout="vertical">
        <a-form-item :label="$t('aps.mrp.index.计划周期天')"><a-input-number v-model="calcForm.planDays" :min="1" :max="365" style="width:100%" /></a-form-item>
        <a-form-item :label="$t('aps.mrp.index.需求来源')">
          <a-checkbox-group v-model="calcForm.sources">
            <a-checkbox value="SALES_ORDER">{{ $t('aps.mrp.lbl1013') }}</a-checkbox>
            <a-checkbox value="FORECAST">{{ $t('aps.mrp.lbl1014') }}</a-checkbox>
          </a-checkbox-group>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- MRP 结果抽屉 -->
    <a-drawer v-model:visible="detailDrawerVisible" :title="$t('aps.mrp.index.MRP计算结果')" :width="760" @cancel="detailDrawerVisible = false">
      <a-table :columns="lineColumns" :data="mrpLines" :loading="linesLoading" :pagination="false" row-key="id" />
    </a-drawer>
  </div>
</template>
<script setup lang="ts">
const { t } = useI18n()
import { useI18n } from 'vue-i18n'
import { ref, reactive, onMounted } from 'vue'
import { Message } from '@arco-design/web-vue'
import MTable from '@/components/MTable/index.vue'
import type { MTableColumn } from '@/components/MTable/index.vue'
import { apsApi } from '@/api/aps'
const loading = ref(false); const tableData = ref<any[]>([]); const total = ref(0)
const query = reactive({ page: 1, pageSize: 20 })
const columns: MTableColumn[] = [
  { key: 'code', title: t('aps.mrp.index.批次号'), dataIndex: 'code', width: 130 },
  { key: 'planPeriod', title: t('aps.mrp.index.计划周期'), dataIndex: 'planPeriod', width: 120 },
  { key: 'status', title: t('aps.mrp.index.状态'), slotName: 'status', width: 100 },
  { key: 'createdAt', title: t('aps.mrp.index.触发时间'), dataIndex: 'createdAt', width: 160 },
  { key: 'completedAt', title: t('aps.mrp.index.完成时间'), dataIndex: 'completedAt', width: 160 },
  { key: 'action', title: t('aps.mrp.index.操作'), slotName: 'action', width: 160 },
]
const lineColumns = [
  { title: t('aps.mrp.index.物料名称'), dataIndex: 'materialName', width: 160 },
  { title: t('aps.mrp.index.需求量'), dataIndex: 'requiredQty', width: 100 },
  { title: t('aps.mrp.index.可用库存'), dataIndex: 'availableQty', width: 100 },
  { title: t('aps.mrp.index.建议采购量'), dataIndex: 'suggestedPurchaseQty', width: 120 },
  { title: t('aps.mrp.index.建议生产量'), dataIndex: 'suggestedProductionQty', width: 120 },
  { title: t('aps.mrp.index.单位'), dataIndex: 'uomCode', width: 80 },
]
async function loadData() {
  loading.value = true
  try { const res = await apsApi.getMrpList(query); tableData.value = (res.list ?? []) as any[]; total.value = res.total ?? 0 }
  catch { tableData.value = [] } finally { loading.value = false }
}
function onTableChange(e: { page: number; pageSize: number }) { query.page = e.page; query.pageSize = e.pageSize; loadData() }
const calcModalVisible = ref(false); const calculating = ref(false)
const calcForm = reactive({ planDays: 30, sources: ['SALES_ORDER'] })
function openCalcModal() { calcModalVisible.value = true }
async function handleCalculate() {
  calculating.value = true
  try {
    await apsApi.calculateMrp({ planDays: calcForm.planDays, sources: calcForm.sources })
    Message.success(t('aps.mrp.lbl1015'))
    calcModalVisible.value = false; loadData()
  } catch { /* handled */ } finally { calculating.value = false }
}
async function handleRelease(id: string) {
  try { await apsApi.releaseMrp(id); Message.success(t('aps.mrp.lbl1016')); loadData() }
  catch { /* handled */ }
}
const detailDrawerVisible = ref(false); const linesLoading = ref(false); const mrpLines = ref<any[]>([])
async function openDetailDrawer(id: string) {
  detailDrawerVisible.value = true; linesLoading.value = true
  try { const res = await apsApi.getMrpLines(id); mrpLines.value = (res.list ?? []) as any[] }
  catch { mrpLines.value = [] } finally { linesLoading.value = false }
}
onMounted(loadData)
</script>
<style scoped>.page-container { padding: 16px; }</style>

