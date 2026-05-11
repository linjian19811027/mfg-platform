<template>
  <div class="page-container">
    <a-card :bordered="false" style="margin-bottom: 16px">
      <a-space wrap>
        <a-input v-model="query.equipmentId" :placeholder="$t('eam.inspection.index.设备ID')" allow-clear style="width: 160px" @keyup.enter="loadData" />
        <a-date-picker v-model="query.startDate" :placeholder="$t('eam.inspection.index.开始日期')" style="width: 140px" />
        <a-date-picker v-model="query.endDate" :placeholder="$t('eam.inspection.index.结束日期')" style="width: 140px" />
        <a-button type="primary" @click="loadData">{{ $t('common.search') }}</a-button>
        <a-button @click="resetQuery">{{ $t('common.reset') }}</a-button>
      </a-space>
      <template #extra><a-button type="primary" @click="openDrawer">新建点检记录</a-button></template>
    </a-card>
    <a-card :bordered="false">
      <MTable :columns="columns" :data="tableData" :loading="loading" :total="total" :page-size="20" @change="onTableChange">
        <template #status="{ record }">
          <a-tag :color="record.status === 'NORMAL' ? 'green' : record.status === 'ABNORMAL' ? 'red' : 'gray'">
            {{ record.status === 'NORMAL' ? '正常' : record.status === 'ABNORMAL' ? '异常' : '待检' }}
          </a-tag>
        </template>
        <template #action="{ record }">
          <a-link @click="openDetailDrawer(record as unknown as InspectionRecord)">{{ $t('common.view') }}</a-link>
        </template>
      </MTable>
    </a-card>

    <!-- 新建点检抽屉 -->
    <a-drawer v-model:visible="drawerVisible" :title="$t('eam.inspection.index.新建点检记录')" :width="560" @cancel="drawerVisible = false">
      <a-form :model="inspForm" layout="vertical">
        <a-form-item :label="$t('eam.inspection.index.设备ID')" required><a-input v-model="inspForm.equipmentId" /></a-form-item>
        <a-form-item :label="$t('eam.inspection.index.点检项目')">
          <div v-for="(item, idx) in inspForm.items" :key="idx" style="display:flex;gap:8px;margin-bottom:8px;align-items:center">
            <a-input v-model="item.name" :placeholder="$t('eam.inspection.index.项目名称')" style="width:140px" />
            <a-input v-model="item.value" :placeholder="$t('eam.inspection.index.检测值')" style="width:120px" />
            <a-switch v-model="item.normal" checked-text="正常" unchecked-text="异常" />
            <a-button size="mini" status="danger" @click="inspForm.items.splice(idx, 1)">删除</a-button>
          </div>
          <a-button size="small" @click="inspForm.items.push({ name: '', value: '', normal: true })">添加项目</a-button>
        </a-form-item>
      </a-form>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px;padding-top:16px;border-top:1px solid var(--color-border)">
        <a-button @click="drawerVisible = false">{{ $t('common.cancel') }}</a-button>
        <a-button type="primary" :loading="saving" @click="handleCreate">{{ $t('common.save') }}</a-button>
      </div>
    </a-drawer>

    <!-- 详情抽屉 -->
    <a-drawer v-model:visible="detailDrawerVisible" :title="$t('eam.inspection.index.点检记录详情')" :width="520" @cancel="detailDrawerVisible = false">
      <template v-if="currentRecord">
        <a-descriptions :column="2" bordered style="margin-bottom: 16px">
          <a-descriptions-item :label="$t('eam.inspection.index.设备名称')">{{ currentRecord.equipmentName }}</a-descriptions-item>
          <a-descriptions-item :label="$t('eam.inspection.index.点检时间')">{{ currentRecord.createdAt }}</a-descriptions-item>
        </a-descriptions>
        <a-table
          :columns="[{ title: t('eam.inspection.index.项目'), dataIndex: 'name' }, { title: t('eam.inspection.index.检测值'), dataIndex: 'value' }, { title: t('eam.inspection.index.状态'), dataIndex: 'normal', render: ({ record }: any) => record.normal ? '正常' : '异常' }]"
          :data="currentRecord.items ?? []"
          :pagination="false"
          row-key="name"
          size="small"
        />
      </template>
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
import { eamApi, type InspectionRecord } from '@/api/eam'
const loading = ref(false); const tableData = ref<any[]>([]); const total = ref(0)
const query = reactive({ equipmentId: '', startDate: '', endDate: '', page: 1, pageSize: 20 })
const columns: MTableColumn[] = [
  { key: 'equipmentName', title: t('eam.inspection.index.设备名称'), dataIndex: 'equipmentName', width: 150 },
  { key: 'inspectorId', title: t('eam.inspection.index.点检员'), dataIndex: 'inspectorId', width: 110 },
  { key: 'status', title: t('eam.inspection.index.状态'), slotName: 'status', width: 90 },
  { key: 'createdAt', title: t('eam.inspection.index.点检时间'), dataIndex: 'createdAt', width: 160 },
  { key: 'action', title: t('eam.inspection.index.操作'), slotName: 'action', width: 80 },
]
async function loadData() {
  loading.value = true
  try { const res = await eamApi.getInspections(query); tableData.value = (res.list ?? []) as any[]; total.value = res.total ?? 0 }
  catch { tableData.value = [] } finally { loading.value = false }
}
function resetQuery() { query.equipmentId = ''; query.startDate = ''; query.endDate = ''; query.page = 1; loadData() }
function onTableChange(e: { page: number; pageSize: number }) { query.page = e.page; query.pageSize = e.pageSize; loadData() }
const drawerVisible = ref(false); const saving = ref(false)
const inspForm = reactive({ equipmentId: '', items: [{ name: '', value: '', normal: true }] })
function openDrawer() { inspForm.equipmentId = ''; inspForm.items = [{ name: '', value: '', normal: true }]; drawerVisible.value = true }
async function handleCreate() {
  if (!inspForm.equipmentId) { Message.warning('请填写设备ID'); return }
  saving.value = true
  try {
    const hasAbnormal = inspForm.items.some(i => !i.normal)
    await eamApi.createInspection({ equipmentId: inspForm.equipmentId, items: inspForm.items, status: hasAbnormal ? 'ABNORMAL' : 'NORMAL' })
    Message.success(hasAbnormal ? '点检完成，发现异常项！' : '点检完成，一切正常')
    drawerVisible.value = false; loadData()
  } catch { /* handled */ } finally { saving.value = false }
}
const detailDrawerVisible = ref(false); const currentRecord = ref<InspectionRecord | null>(null)
function openDetailDrawer(record: InspectionRecord) { currentRecord.value = record; detailDrawerVisible.value = true }
onMounted(loadData)
</script>
<style scoped>.page-container { padding: 16px; }</style>
