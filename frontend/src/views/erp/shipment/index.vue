<template>
  <div class="page-container">
    <a-card :bordered="false" style="margin-bottom: 16px">
      <a-space wrap>
        <a-select v-model="query.status" :placeholder="$t('common.status')" allow-clear style="width: 130px">
          <a-option value="PENDING">{{ $t('erp.shipment.lbl1235') }}</a-option><a-option value="SHIPPED">{{ $t('erp.shipment.lbl1236') }}</a-option><a-option value="DELIVERED">{{ $t('erp.shipment.lbl1237') }}</a-option>
        </a-select>
        <a-button type="primary" @click="loadData">{{ $t('common.search') }}</a-button>
        <a-button @click="resetQuery">{{ $t('common.reset') }}</a-button>
      </a-space>
      <template #extra><a-button type="primary" @click="openDrawer">{{ $t('erp.shipment.lbl1238') }}</a-button></template>
    </a-card>
    <a-card :bordered="false">
      <MTable :columns="columns" :data="tableData" :loading="loading" :total="total" :page-size="20" @change="onTableChange">
        <template #status="{ record }">
          <a-tag :color="record.status === 'DELIVERED' ? 'green' : record.status === 'SHIPPED' ? 'blue' : 'gray'">
            {{ record.status === 'DELIVERED' ? t('erp.shipment.r33024') : record.status === 'SHIPPED' ? $t('erp.shipment.lbl1239') : $t('erp.shipment.lbl1240') }}
          </a-tag>
        </template>
        <template #action="{ record }">
          <a-space>
            <a-popconfirm v-if="record.status === 'PENDING'" :content="$t('erp.shipment.index.确认发货')" @ok="handleShip(record.id as string)"><a-link>{{ $t('erp.shipment.r33025') }}</a-link></a-popconfirm>
            <a-link v-if="record.status === 'SHIPPED'" @click="openLogisticsModal(record.id as string)">{{ $t('erp.shipment.lbl1241') }}</a-link>
          </a-space>
        </template>
      </MTable>
    </a-card>
    <a-drawer v-model:visible="drawerVisible" :title="$t('erp.shipment.index.新建发货单')" :width="480" @cancel="drawerVisible = false">
      <MForm :schema="formSchema" v-model="formData" :loading="saving" :submit-text="$t('erp.shipment.index.创建')" @submit="handleCreate" @cancel="drawerVisible = false" />
    </a-drawer>
    <a-modal v-model:visible="logisticsModalVisible" :title="$t('erp.shipment.index.更新物流信息')" :ok-loading="updating" @ok="handleUpdateLogistics" @cancel="logisticsModalVisible = false">
      <a-form :model="logisticsForm" layout="vertical">
        <a-form-item :label="$t('erp.shipment.index.承运商')"><a-input v-model="logisticsForm.carrier" /></a-form-item>
        <a-form-item :label="$t('erp.shipment.index.运单号')"><a-input v-model="logisticsForm.trackingNo" /></a-form-item>
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
import MForm from '@/components/MForm/index.vue'
import type { MTableColumn } from '@/components/MTable/index.vue'
import type { MFormField } from '@/components/MForm/index.vue'
import { erpExtApi } from '@/api/erp-ext'
const loading = ref(false); const tableData = ref<any[]>([]); const total = ref(0)
const query = reactive({ status: '', page: 1, pageSize: 20 })
const columns: MTableColumn[] = [
  { key: 'code', title: t('erp.shipment.index.发货单号'), dataIndex: 'shipmentNo', width: 130 },
  { key: 'salesOrderId', title: t('erp.shipment.index.销售订单'), dataIndex: 'soId', width: 130 },
  { key: 'carrier', title: t('erp.shipment.index.承运商'), dataIndex: 'carrier', width: 120 },
  { key: 'trackingNo', title: t('erp.shipment.index.运单号'), dataIndex: 'trackingNo', width: 140 },
  { key: 'status', title: t('erp.shipment.index.状态'), slotName: 'status', width: 100 },
  { key: 'shippedAt', title: t('erp.shipment.index.发货时间'), dataIndex: 'shipDate', width: 160 },
  { key: 'action', title: t('erp.shipment.index.操作'), slotName: 'action', width: 160 },
]
const formSchema: MFormField[] = [
  { field: 'salesOrderId', label: t('erp.shipment.lbl1242'), type: 'select', required: true, placeholder: t('erp.shipment.r33026') },
  { field: 'carrier', label: t('erp.shipment.lbl1243'), type: 'input' },
  { field: 'trackingNo', label: t('erp.shipment.lbl1244'), type: 'input' },
]
async function loadData() {
  loading.value = true
  try { const res = await erpExtApi.getShipments(query); tableData.value = (res.list ?? []) as any[]; total.value = res.total ?? 0 }
  catch { tableData.value = [] } finally { loading.value = false }
}
function resetQuery() { query.status = ''; query.page = 1; loadData() }
function onTableChange(e: { page: number; pageSize: number }) { query.page = e.page; query.pageSize = e.pageSize; loadData() }
const drawerVisible = ref(false); const saving = ref(false); const formData = ref<Record<string, unknown>>({})
function openDrawer() { formData.value = {}; drawerVisible.value = true }
async function handleCreate(data: Record<string, unknown>) {
  saving.value = true
  try { await erpExtApi.createShipment(data); Message.success(t('erp.创建成功')); drawerVisible.value = false; loadData() }
  catch { /* handled */ } finally { saving.value = false }
}
async function handleShip(id: string) { try { await erpExtApi.ship(id); Message.success(t('erp.已发货')); loadData() } catch { /* handled */ } }
const logisticsModalVisible = ref(false); const updating = ref(false); const currentShipId = ref(''); const logisticsForm = reactive({ carrier: '', trackingNo: '' })
function openLogisticsModal(id: string) { currentShipId.value = id; logisticsForm.carrier = ''; logisticsForm.trackingNo = ''; logisticsModalVisible.value = true }
async function handleUpdateLogistics() {
  updating.value = true
  try { await erpExtApi.updateLogistics(currentShipId.value, logisticsForm); Message.success(t('erp.物流信息已更新')); logisticsModalVisible.value = false; loadData() }
  catch { /* handled */ } finally { updating.value = false }
}
onMounted(loadData)
</script>
<style scoped>.page-container { padding: 16px; }</style>
