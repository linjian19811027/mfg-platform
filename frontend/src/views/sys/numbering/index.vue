<template>
  <div class="page-container">
    <a-card :bordered="false" style="margin-bottom: 16px">
      <a-space wrap>
        <a-select v-model="query.businessKey" :placeholder="t('sys.numbering.lbl1708')" allow-clear style="width: 180px">
          <a-option value="PLM_MATERIAL">{{ $t('sys.numbering.lbl1709') }}</a-option>
          <a-option value="PLM_ECR">{{ $t('sys.numbering.lbl1710') }}</a-option>
          <a-option value="PLM_ECN">{{ $t('sys.numbering.lbl1711') }}</a-option>
          <a-option value="SCM_PO">{{ $t('sys.numbering.lbl1712') }}</a-option>
          <a-option value="WMS_IN">{{ $t('sys.numbering.lbl1713') }}</a-option>
        </a-select>
        <a-input v-model="query.keyword" :placeholder="t('sys.numbering.lbl1714')" allow-clear style="width: 200px" />
        <a-button type="primary" @click="loadData">{{ $t('sys.numbering.query') }}</a-button>
        <a-button @click="resetQuery">{{ $t('sys.numbering.reset') }}</a-button>
      </a-space>
      <template #extra>
        <a-button type="primary" @click="openDrawer(null)">
          <template #icon><icon-plus /></template>
          {{ $t('sys.numbering.createGlobalRule') }}
        </a-button>
      </template>
    </a-card>

    <a-card :bordered="false">
      <MTable
        :columns="columns"
        :data="tableData"
        :loading="loading"
        :total="total"
        :page-size="query.pageSize"
        @change="onTableChange"
      >
        <template #mode="{ record }">
          <a-tag :color="record.mode === 'AUTO' ? 'arcoblue' : 'orange'">{{ record.mode }}</a-tag>
        </template>
        <template #status="{ record }">
          <a-badge :status="record.status === 'ACTIVE' ? 'success' : 'normal'" :text="record.status" />
        </template>
        <template #action="{ record }">
          <a-space>
            <a-link @click="openDrawer(record)">{{ $t('sys.numbering.edit') }}</a-link>
            <a-popconfirm :content="t('sys.numbering.r22015')" @ok="handleDelete(record.id)">
              <a-link status="danger">{{ $t('sys.numbering.delete') }}</a-link>
            </a-popconfirm>
          </a-space>
        </template>
      </MTable>
    </a-card>

    <a-drawer v-model:visible="drawerVisible" :title="t('sys.numbering.lbl1715')" :width="600">
      <a-form :model="formData" layout="vertical" @submit="handleSave">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item field="businessKey" :label="t('sys.numbering.r33072')" required>
              <a-select v-model="formData.businessKey">
                <a-option value="PLM_MATERIAL">{{ $t('sys.numbering.lbl1716') }}</a-option>
                <a-option value="PLM_ECR">{{ $t('sys.numbering.lbl1717') }}</a-option>
                <a-option value="PLM_ECN">{{ $t('sys.numbering.lbl1718') }}</a-option>
                <a-option value="SCM_PO">{{ $t('sys.numbering.lbl1719') }}</a-option>
                <a-option value="WMS_IN">{{ $t('sys.numbering.lbl1720') }}</a-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item field="code" :label="t('sys.numbering.r33073')" required>
              <a-input v-model="formData.code" :placeholder="t('sys.numbering.lbl1721')" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item field="name" :label="t('sys.numbering.r33074')" required>
          <a-input v-model="formData.name" :placeholder="t('sys.numbering.lbl1722')" />
        </a-form-item>
        
        <a-divider orientation="left">{{ $t('sys.numbering.lbl1723') }}</a-divider>
        
        <div v-for="(seg, index) in formData.segments" :key="index" class="segment-item">
          <a-row :gutter="8" align="center">
            <a-col :span="6">
              <a-select v-model="seg.type" :placeholder="t('sys.numbering.type')">
                <a-option value="CONST">{{ $t('sys.numbering.lbl1724') }}</a-option>
                <a-option value="DATE">{{ $t('sys.numbering.lbl1725') }}</a-option>
                <a-option value="SERIAL">{{ $t('sys.numbering.lbl1726') }}</a-option>
                <a-option value="FIELD">{{ $t('sys.numbering.lbl1727') }}</a-option>
              </a-select>
            </a-col>
            <a-col :span="14">
              <a-input v-if="seg.type === 'CONST'" v-model="seg.value" :placeholder="t('sys.numbering.lbl1728')" />
              <a-select v-else-if="seg.type === 'DATE'" v-model="seg.format" :placeholder="t('sys.numbering.lbl1729')">
                <a-option value="YYYY">{{ $t('sys.numbering.lbl1730') }}</a-option>
                <a-option value="YYYYMM">{{ $t('sys.numbering.lbl1731') }}</a-option>
                <a-option value="YYYYMMDD">{{ $t('sys.numbering.lbl1732') }}</a-option>
              </a-select>
              <a-input-number v-else-if="seg.type === 'SERIAL'" v-model="seg.length" :placeholder="t('sys.numbering.lbl1733')" :min="1" :max="10" />
              <a-input v-else-if="seg.type === 'FIELD'" v-model="seg.value" :placeholder="t('sys.numbering.lbl1734')" />
            </a-col>
            <a-col :span="4">
              <a-button type="text" status="danger" @click="removeSegment(index)"><icon-delete /></a-button>
            </a-col>
          </a-row>
        </div>
        <a-button type="outline" long @click="addSegment" style="margin-top: 8px">
          <template #icon><icon-plus /></template> {{ $t('sys.numbering.addSegment') }}
        </a-button>

        <a-form-item style="margin-top: 24px">
          <a-space>
            <a-button type="primary" html-type="submit" :loading="saving">{{ $t('sys.numbering.submit') }}</a-button>
            <a-button @click="drawerVisible = false">{{ $t('sys.numbering.cancel') }}</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { Message } from '@arco-design/web-vue'
import { baseApi } from '@/api/base'
import MTable from '@/components/MTable/index.vue'
import type { MTableColumn } from '@/components/MTable/index.vue'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()

const loading = ref(false)
const total = ref(0)
const saving = ref(false)
const drawerVisible = ref(false)
const tableData = ref<any[]>([])
const query = reactive({ businessKey: '', keyword: '', page: 1, pageSize: 20 })

const columns: MTableColumn[] = [
  { key: 'businessKey', title: t('sys.numbering.lbl1735'), dataIndex: 'businessKey', width: 150 },
  { key: 'code', title: t('sys.numbering.lbl1736'), dataIndex: 'code', width: 150 },
  { key: 'name', title: t('sys.numbering.lbl1737'), dataIndex: 'name', width: 180 },
  { key: 'mode', title: t('sys.numbering.lbl1738'), slotName: 'mode', width: 100 },
  { key: 'currentSerial', title: t('sys.numbering.lbl1739'), dataIndex: 'currentSerial', width: 100 },
  { key: 'status', title: t('sys.numbering.status'), slotName: 'status', width: 100 },
  { key: 'action', title: t('sys.numbering.action'), slotName: 'action', width: 120 },
]

const formData = ref<any>({
  businessKey: '',
  code: '',
  name: '',
  mode: 'AUTO',
  segments: [],
  isDefault: true,
  status: 'ACTIVE'
})

async function loadData() {
  loading.value = true
  try {
    const res = await baseApi.getNumberingRules(query)
    tableData.value = res.list
    total.value = res.total
  } finally {
    loading.value = false
  }
}

function resetQuery() {
  query.businessKey = ''
  query.keyword = ''
  loadData()
}

function onTableChange(e: any) {
  query.page = e.page
  query.pageSize = e.pageSize
  loadData()
}

function openDrawer(rule: any) {
  if (rule) {
    formData.value = { ...rule }
  } else {
    formData.value = {
      businessKey: 'PLM_ECR',
      code: '',
      name: '',
      mode: 'AUTO',
      segments: [{ type: 'CONST', value: 'ECR-' }, { type: 'DATE', format: 'YYYY' }, { type: 'CONST', value: '-' }, { type: 'SERIAL', length: 4 }],
      isDefault: true,
      status: 'ACTIVE'
    }
  }
  drawerVisible.value = true
}

function addSegment() {
  formData.value.segments.push({ type: 'CONST', value: '' })
}

function removeSegment(index: number) {
  formData.value.segments.splice(index, 1)
}

async function handleSave() {
  saving.value = true
  try {
    if (formData.value.id) {
      await baseApi.updateNumberingRule(formData.value.id, formData.value)
      Message.success(t('sys.更新成功'))
    } else {
      await baseApi.createNumberingRule(formData.value)
      Message.success(t('sys.创建成功'))
    }
    drawerVisible.value = false
    loadData()
  } catch {
    Message.error(t('sys.操作失败'))
  } finally {
    saving.value = false
  }
}

async function handleDelete(id: string) {
  try {
    await baseApi.deleteNumberingRule(id)
    Message.success(t('sys.删除成功'))
    loadData()
  } catch {
    Message.error(t('sys.删除失败'))
  }
}

onMounted(loadData)
</script>

<style scoped>
.page-container { padding: 16px; }
.segment-item { 
  margin-bottom: 12px; 
  padding: 12px; 
  background: var(--color-fill-1); 
  border-radius: 4px;
}
</style>
