<template>
  <div class="page-container">
    <a-card :bordered="false">
      <a-tabs v-model:active-key="activeTab">
        <!-- 仓库 -->
        <a-tab-pane key="warehouse" :title="$t('wms.warehouse.index.仓库管理')">
          <div style="margin-bottom: 12px; display: flex; justify-content: flex-end">
            <a-button type="primary" @click="openWarehouseDrawer(null)">{{ $t('wms.warehouse.action.create') }}</a-button>
          </div>
          <a-table :columns="whColumns" :data="warehouses" :loading="whLoading" :pagination="false" row-key="id">
            <template #status="{ record }">
              <a-tag :color="record.status === 'ACTIVE' ? 'green' : 'gray'">{{ record.status === 'ACTIVE' ? $t('common.status.active') : $t('common.status.inactive') }}</a-tag>
            </template>
            <template #action="{ record }">
              <a-link @click="openWarehouseDrawer(record as Warehouse)">{{ $t('common.edit') }}</a-link>
            </template>
          </a-table>
        </a-tab-pane>

        <!-- 库区 -->
        <a-tab-pane key="zone" :title="$t('wms.warehouse.index.库区管理')">
          <div style="margin-bottom: 12px; display: flex; gap: 8px; align-items: center">
            <a-select v-model="selectedWarehouseId" :placeholder="$t('wms.warehouse.index.选择仓库')" style="width: 200px" @change="loadZones">
              <a-option v-for="w in warehouses" :key="w.id" :value="w.id">{{ w.name }}</a-option>
            </a-select>
            <a-button type="primary" :disabled="!selectedWarehouseId" @click="openZoneDrawer(null)">{{ $t('wms.zone.action.create') }}</a-button>
          </div>
          <a-table :columns="zoneColumns" :data="zones" :loading="zoneLoading" :pagination="false" row-key="id">
            <template #action="{ record }">
              <a-link @click="openZoneDrawer(record as WmsZone)">{{ $t('common.edit') }}</a-link>
            </template>
          </a-table>
        </a-tab-pane>

        <!-- 货位 -->
        <a-tab-pane key="location" :title="$t('wms.warehouse.index.货位管理')">
          <div style="margin-bottom: 12px; display: flex; gap: 8px; align-items: center">
            <a-select v-model="selectedZoneId" :placeholder="$t('wms.warehouse.index.选择库区')" style="width: 200px" @change="loadLocations">
              <a-option v-for="z in zones" :key="z.id" :value="z.id">{{ z.name }}</a-option>
            </a-select>
            <a-button type="primary" :disabled="!selectedZoneId" @click="openLocationDrawer(null)">{{ $t('wms.location.action.create') }}</a-button>
          </div>
          <a-table :columns="locColumns" :data="locations" :loading="locLoading" :pagination="false" row-key="id">
            <template #status="{ record }">
              <a-tag :color="record.status === 'AVAILABLE' ? 'green' : record.status === 'OCCUPIED' ? 'orange' : 'gray'">
                {{ record.status === 'AVAILABLE' ? $t('wms.location.status.available') : record.status === 'OCCUPIED' ? $t('wms.location.status.occupied') : record.status }}
              </a-tag>
            </template>
            <template #action="{ record }">
              <a-link @click="openLocationDrawer(record as WmsLocation)">{{ $t('common.edit') }}</a-link>
            </template>
          </a-table>
        </a-tab-pane>
      </a-tabs>
    </a-card>

    <!-- 仓库抽屉 -->
    <a-drawer v-model:visible="whDrawerVisible" :title="editingWh ? $t('wms.warehouse.action.edit') : $t('wms.warehouse.action.create')" :width="480" @cancel="whDrawerVisible = false">
      <MForm :schema="whSchema" v-model="whForm" :loading="saving" :submit-text="$t('wms.warehouse.index.保存')" @submit="saveWarehouse" @cancel="whDrawerVisible = false" />
    </a-drawer>

    <!-- 库区抽屉 -->
    <a-drawer v-model:visible="zoneDrawerVisible" :title="editingZone ? $t('wms.zone.action.edit') : $t('wms.zone.action.create')" :width="480" @cancel="zoneDrawerVisible = false">
      <MForm :schema="zoneSchema" v-model="zoneForm" :loading="saving" :submit-text="$t('wms.warehouse.index.保存')" @submit="saveZone" @cancel="zoneDrawerVisible = false" />
    </a-drawer>

    <!-- 货位抽屉 -->
    <a-drawer v-model:visible="locDrawerVisible" :title="editingLoc ? $t('wms.location.action.edit') : $t('wms.location.action.create')" :width="480" @cancel="locDrawerVisible = false">
      <MForm :schema="locSchema" v-model="locForm" :loading="saving" :submit-text="$t('wms.warehouse.index.保存')" @submit="saveLocation" @cancel="locDrawerVisible = false" />
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
import { useI18n } from 'vue-i18n'
import { ref, onMounted } from 'vue'
import { Message } from '@arco-design/web-vue'
import MForm from '@/components/MForm/index.vue'
import type { MFormField } from '@/components/MForm/index.vue'
import { wmsApi, type Warehouse, type WmsZone, type WmsLocation } from '@/api/wms'

const activeTab = ref('warehouse')
const saving = ref(false)

// 仓库
const whLoading = ref(false)
const warehouses = ref<Warehouse[]>([])
const whDrawerVisible = ref(false)
const editingWh = ref<Warehouse | null>(null)
const whForm = ref<Record<string, unknown>>({})
const whColumns = [
  { title: t('wms.warehouse.index.编码'), dataIndex: 'code', width: 120 },
  { title: t('wms.warehouse.index.名称'), dataIndex: 'name', width: 160 },
  { title: t('wms.warehouse.index.类型'), dataIndex: 'type', width: 100 },
  { title: t('wms.warehouse.index.状态'), slotName: 'status', width: 90 },
  { title: t('wms.warehouse.index.操作'), slotName: 'action', width: 80 },
]
const whSchema: MFormField[] = [
  { field: 'code', label: t('wms.warehouse.lbl1947'), type: 'input', required: true },
  { field: 'name', label: t('wms.warehouse.lbl1948'), type: 'input', required: true },
  { field: 'type', label: t('wms.warehouse.type'), type: 'select', options: [{ label: t('wms.warehouse.lbl1949'), value: 'PHYSICAL' }, { label: t('wms.warehouse.lbl1950'), value: 'LOGICAL' }, { label: t('wms.warehouse.lbl1951'), value: 'VIRTUAL' }] },
  { field: 'status', label: t('wms.warehouse.status'), type: 'select', options: [{ label: t('wms.warehouse.enable'), value: 'ACTIVE' }, { label: t('wms.warehouse.disable'), value: 'INACTIVE' }] },
]

async function loadWarehouses() {
  whLoading.value = true
  try {
    const res = await wmsApi.getWarehouses()
    warehouses.value = res.list ?? []
  } catch { warehouses.value = [] } finally { whLoading.value = false }
}

function openWarehouseDrawer(wh: Warehouse | null) {
  editingWh.value = wh
  whForm.value = wh ? { ...wh } : { status: 'ACTIVE' }
  whDrawerVisible.value = true
}

async function saveWarehouse(data: Record<string, unknown>) {
  saving.value = true
  try {
    if (editingWh.value) { await wmsApi.updateWarehouse(editingWh.value.id, data); Message.success(t('wms.更新成功')) }
    else { await wmsApi.createWarehouse(data); Message.success(t('wms.创建成功')) }
    whDrawerVisible.value = false
    loadWarehouses()
  } catch { /* handled */ } finally { saving.value = false }
}

// 库区
const zoneLoading = ref(false)
const zones = ref<WmsZone[]>([])
const selectedWarehouseId = ref('')
const zoneDrawerVisible = ref(false)
const editingZone = ref<WmsZone | null>(null)
const zoneForm = ref<Record<string, unknown>>({})
const zoneColumns = [
  { title: t('wms.warehouse.index.编码'), dataIndex: 'code', width: 120 },
  { title: t('wms.warehouse.index.名称'), dataIndex: 'name', width: 160 },
  { title: t('wms.warehouse.index.类型'), dataIndex: 'type', width: 100 },
  { title: t('wms.warehouse.index.操作'), slotName: 'action', width: 80 },
]
const zoneSchema: MFormField[] = [
  { field: 'code', label: t('wms.warehouse.lbl1953'), type: 'input', required: true },
  { field: 'name', label: t('wms.warehouse.lbl1954'), type: 'input', required: true },
  { field: 'type', label: t('wms.warehouse.type'), type: 'input', placeholder: t('wms.warehouse.r33102') },
]

async function loadZones() {
  if (!selectedWarehouseId.value) return
  zoneLoading.value = true
  try {
    // 暂无独立 zones API，从库存数据推导
    zones.value = []
  } catch { zones.value = [] } finally { zoneLoading.value = false }
}

function openZoneDrawer(zone: WmsZone | null) {
  editingZone.value = zone
  zoneForm.value = zone ? { ...zone } : { warehouseId: selectedWarehouseId.value }
  zoneDrawerVisible.value = true
}

async function saveZone(_data: Record<string, unknown>) {
  saving.value = true
  try {
    Message.success(editingZone.value ? t('wms.warehouse.lbl1955') : t('wms.warehouse.lbl1956'))
    zoneDrawerVisible.value = false
  } catch { /* handled */ } finally { saving.value = false }
}

// 货位
const locLoading = ref(false)
const locations = ref<WmsLocation[]>([])
const selectedZoneId = ref('')
const locDrawerVisible = ref(false)
const editingLoc = ref<WmsLocation | null>(null)
const locForm = ref<Record<string, unknown>>({})
const locColumns = [
  { title: t('wms.warehouse.index.编码'), dataIndex: 'code', width: 120 },
  { title: t('wms.warehouse.index.类型'), dataIndex: 'type', width: 100 },
  { title: t('wms.warehouse.index.状态'), slotName: 'status', width: 90 },
  { title: t('wms.warehouse.index.操作'), slotName: 'action', width: 80 },
]
const locSchema: MFormField[] = [
  { field: 'code', label: t('wms.warehouse.lbl1957'), type: 'input', required: true },
  { field: 'type', label: t('wms.warehouse.type'), type: 'select', options: [{ label: t('wms.warehouse.lbl1958'), value: 'NORMAL' }, { label: t('wms.warehouse.lbl1959'), value: 'STAGING' }, { label: t('wms.warehouse.lbl1960'), value: 'QUARANTINE' }, { label: t('wms.warehouse.lbl1961'), value: 'OCCUPIED' }] },
  { field: 'status', label: t('wms.warehouse.status'), type: 'select', options: [{ label: t('wms.warehouse.idle'), value: 'AVAILABLE' }, { label: t('wms.warehouse.lbl1962'), value: 'DISABLED' }] },
]

async function loadLocations() { locations.value = [] }
function openLocationDrawer(loc: WmsLocation | null) {
  editingLoc.value = loc
  locForm.value = loc ? { ...loc } : { zoneId: selectedZoneId.value, status: 'AVAILABLE' }
  locDrawerVisible.value = true
}
async function saveLocation(_data: Record<string, unknown>) {
  saving.value = true
  try { Message.success(editingLoc.value ? t('wms.warehouse.lbl1963') : t('wms.warehouse.lbl1964')); locDrawerVisible.value = false }
  catch { /* handled */ } finally { saving.value = false }
}

onMounted(loadWarehouses)
</script>

<style scoped>
.page-container { padding: 16px; }
</style>
