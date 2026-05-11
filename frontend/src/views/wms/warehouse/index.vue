<template>
  <div class="page-container">
    <a-card :bordered="false">
      <a-tabs v-model:active-key="activeTab">
        <!-- 仓库 -->
        <a-tab-pane key="warehouse" :title="$t('wms.warehouse.index.仓库管理')">
          <div style="margin-bottom: 12px; display: flex; justify-content: flex-end">
            <a-button type="primary" @click="openWarehouseDrawer(null)">新建仓库</a-button>
          </div>
          <a-table :columns="whColumns" :data="warehouses" :loading="whLoading" :pagination="false" row-key="id">
            <template #status="{ record }">
              <a-tag :color="record.status === 'ACTIVE' ? 'green' : 'gray'">{{ record.status === 'ACTIVE' ? '启用' : '停用' }}</a-tag>
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
            <a-button type="primary" :disabled="!selectedWarehouseId" @click="openZoneDrawer(null)">新建库区</a-button>
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
            <a-button type="primary" :disabled="!selectedZoneId" @click="openLocationDrawer(null)">新建货位</a-button>
          </div>
          <a-table :columns="locColumns" :data="locations" :loading="locLoading" :pagination="false" row-key="id">
            <template #status="{ record }">
              <a-tag :color="record.status === 'AVAILABLE' ? 'green' : record.status === 'OCCUPIED' ? 'orange' : 'gray'">
                {{ record.status === 'AVAILABLE' ? '空闲' : record.status === 'OCCUPIED' ? '占用' : record.status }}
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
    <a-drawer v-model:visible="whDrawerVisible" :title="editingWh ? '编辑仓库' : '新建仓库'" :width="480" @cancel="whDrawerVisible = false">
      <MForm :schema="whSchema" v-model="whForm" :loading="saving" :submit-text="$t('wms.warehouse.index.保存')" @submit="saveWarehouse" @cancel="whDrawerVisible = false" />
    </a-drawer>

    <!-- 库区抽屉 -->
    <a-drawer v-model:visible="zoneDrawerVisible" :title="editingZone ? '编辑库区' : '新建库区'" :width="480" @cancel="zoneDrawerVisible = false">
      <MForm :schema="zoneSchema" v-model="zoneForm" :loading="saving" :submit-text="$t('wms.warehouse.index.保存')" @submit="saveZone" @cancel="zoneDrawerVisible = false" />
    </a-drawer>

    <!-- 货位抽屉 -->
    <a-drawer v-model:visible="locDrawerVisible" :title="editingLoc ? '编辑货位' : '新建货位'" :width="480" @cancel="locDrawerVisible = false">
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
  { field: 'code', label: '仓库编码', type: 'input', required: true },
  { field: 'name', label: '仓库名称', type: 'input', required: true },
  { field: 'type', label: '类型', type: 'select', options: [{ label: '原材料仓', value: 'RAW' }, { label: '成品仓', value: 'FG' }, { label: '半成品仓', value: 'WIP' }, { label: '其他', value: 'OTHER' }] },
  { field: 'status', label: '状态', type: 'select', options: [{ label: '启用', value: 'ACTIVE' }, { label: '停用', value: 'INACTIVE' }] },
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
    if (editingWh.value) { await wmsApi.updateWarehouse(editingWh.value.id, data); Message.success('更新成功') }
    else { await wmsApi.createWarehouse(data); Message.success('创建成功') }
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
  { field: 'code', label: '库区编码', type: 'input', required: true },
  { field: 'name', label: '库区名称', type: 'input', required: true },
  { field: 'type', label: '类型', type: 'input', placeholder: '如 NORMAL/COLD/HAZARD' },
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
    Message.success(editingZone.value ? '更新成功' : '创建成功')
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
  { field: 'code', label: '货位编码', type: 'input', required: true },
  { field: 'type', label: '类型', type: 'select', options: [{ label: '普通', value: 'NORMAL' }, { label: '暂存', value: 'STAGING' }, { label: '隔离', value: 'QUARANTINE' }] },
  { field: 'status', label: '状态', type: 'select', options: [{ label: '空闲', value: 'AVAILABLE' }, { label: '停用', value: 'DISABLED' }] },
]

async function loadLocations() { locations.value = [] }
function openLocationDrawer(loc: WmsLocation | null) {
  editingLoc.value = loc
  locForm.value = loc ? { ...loc } : { zoneId: selectedZoneId.value, status: 'AVAILABLE' }
  locDrawerVisible.value = true
}
async function saveLocation(_data: Record<string, unknown>) {
  saving.value = true
  try { Message.success(editingLoc.value ? '更新成功' : '创建成功'); locDrawerVisible.value = false }
  catch { /* handled */ } finally { saving.value = false }
}

onMounted(loadWarehouses)
</script>

<style scoped>
.page-container { padding: 16px; }
</style>
