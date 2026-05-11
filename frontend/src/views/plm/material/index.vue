<template>
  <div class="page-container">
    <!-- 搜索栏 -->
    <a-card :bordered="false" style="margin-bottom: 16px">
      <a-space wrap>
        <a-input v-model="query.keyword" :placeholder="$t('common.keyword')" allow-clear style="width: 200px" />
        <a-select v-model="query.type" :placeholder="$t('common.type')" allow-clear style="width: 140px">
          <a-option value="RAW">{{ $t('plm.material.type.raw') }}</a-option>
          <a-option value="SEMI">{{ $t('plm.material.type.semi') }}</a-option>
          <a-option value="FINISHED">{{ $t('plm.material.type.finished') }}</a-option>
        </a-select>
        <CategorySelect v-model="query.categoryId" style="width: 180px" @change="loadData" />
        <a-select v-model="query.status" :placeholder="$t('common.status')" allow-clear style="width: 120px">
          <a-option value="ACTIVE">{{ $t('plm.material.status.active') }}</a-option>
          <a-option value="DESIGN">{{ $t('plm.material.status.design') }}</a-option>
          <a-option value="TRIAL">{{ $t('plm.material.status.trial') }}</a-option>
          <a-option value="INACTIVE">{{ $t('plm.material.status.inactive') }}</a-option>
          <a-option value="OBSOLETE">{{ $t('plm.material.status.obsolete') }}</a-option>
        </a-select>
        <a-button type="primary" @click="loadData">{{ $t('common.search') }}</a-button>
        <a-button @click="resetQuery">{{ $t('common.reset') }}</a-button>
      </a-space>
      <template #extra>
        <a-button type="primary" @click="openDrawer('create')">{{ $t('plm.material.create') }}</a-button>
      </template>
    </a-card>

    <!-- 表格 -->
    <a-card :bordered="false">
      <MTable
        :columns="columns"
        :data="tableData"
        :loading="loading"
        :total="total"
        :page-size="query.pageSize"
        @change="onTableChange"
      >
        <template #status="{ record }">
          <a-tag :color="statusColor(record.status as string)">{{ statusLabel(record.status as string) }}</a-tag>
        </template>
        <template #type="{ record }">
          <span>{{ typeLabel(record.type as string) }}</span>
        </template>
        <template #uomId="{ record }">
          <span>{{ uomLabel(record.uomId as string) }}</span>
        </template>
        <template #action="{ record }">
          <a-space>
            <a-link @click="viewDetail(record.id as string)">{{ $t('common.view') }}</a-link>
            <a-link @click="openDrawer('edit', record)">{{ $t('common.edit') }}</a-link>
            <!-- 状态流转按钮 -->
            <a-popconfirm
              v-if="record.status === 'DESIGN'"
              :content="$t('plm.material.msg.toTrial')"
              @ok="handleChangeMaterialStatus(record.id as string, 'TRIAL')"
            >
              <a-link :loading="statusLoadingId === record.id">{{ $t('plm.material.action.toTrial') }}</a-link>
            </a-popconfirm>
            <a-popconfirm
              v-if="record.status === 'TRIAL'"
              :content="$t('plm.material.msg.toActive')"
              @ok="handleChangeMaterialStatus(record.id as string, 'ACTIVE')"
            >
              <a-link :loading="statusLoadingId === record.id">{{ $t('plm.material.action.activate') }}</a-link>
            </a-popconfirm>
            <a-popconfirm
              v-if="record.status === 'ACTIVE'"
              :content="$t('plm.material.msg.toInactive')"
              @ok="handleChangeMaterialStatus(record.id as string, 'INACTIVE')"
            >
              <a-link status="warning" :loading="statusLoadingId === record.id">{{ $t('plm.material.action.deactivate') }}</a-link>
            </a-popconfirm>
            <a-popconfirm
              v-if="record.status === 'INACTIVE'"
              :content="$t('plm.material.msg.toActive')"
              @ok="handleChangeMaterialStatus(record.id as string, 'ACTIVE')"
            >
              <a-link :loading="statusLoadingId === record.id">{{ $t('plm.material.action.reActivate') }}</a-link>
            </a-popconfirm>
            <a-popconfirm
              v-if="record.status === 'INACTIVE'"
              :content="$t('plm.material.msg.toObsolete')"
              @ok="handleChangeMaterialStatus(record.id as string, 'OBSOLETE')"
            >
              <a-link status="danger" :loading="statusLoadingId === record.id">{{ $t('plm.material.action.obsolete') }}</a-link>
            </a-popconfirm>
          </a-space>
        </template>
      </MTable>
    </a-card>

    <!-- 新建/编辑抽屉 -->
    <a-drawer
      v-model:visible="drawerVisible"
      :title="drawerMode === 'create' ? $t('plm.material.create') : $t('plm.material.edit')"
      :width="520"
      @cancel="drawerVisible = false"
    >
      <MForm
        :schema="formSchema"
        v-model="formData"
        :loading="submitting"
        :submit-text="$t('plm.material.保存')"
        @submit="handleSubmit"
        @cancel="drawerVisible = false"
      />
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Message } from '@arco-design/web-vue'
import MTable from '@/components/MTable/index.vue'
import MForm from '@/components/MForm/index.vue'
import CategorySelect from '@/components/BusinessSelect/CategorySelect.vue'
import type { MTableColumn } from '@/components/MTable/index.vue'
import type { MFormField } from '@/components/MForm/index.vue'
import { plmApi } from '@/api/plm'
const router = useRouter()
const { t } = useI18n()

const loading = ref(false)
const submitting = ref(false)
const tableData = ref<any[]>([])
const total = ref(0)

const query = reactive({ keyword: '', type: '', categoryId: '', status: '', page: 1, pageSize: 20 })

const drawerVisible = ref(false)
const drawerMode = ref<'create' | 'edit'>('create')
const editId = ref('')
const formData = ref<Record<string, unknown>>({})

const columns = computed<MTableColumn[]>(() => [
  { key: 'code', title: t('common.code'), dataIndex: 'code', width: 120 },
  { key: 'name', title: t('common.name'), dataIndex: 'name', width: 160 },
  { key: 'type', title: t('common.type'), slotName: 'type', width: 100 },
  { key: 'uomId', title: t('common.unit'), slotName: 'uomId', width: 80 },
  { key: 'specification', title: t('common.specification'), dataIndex: 'specification', width: 140, ellipsis: true },
  { key: 'status', title: t('common.status'), slotName: 'status', width: 90 },
  { key: 'action', title: t('common.operation'), slotName: 'action', width: 220 },
])

const formSchema = computed<MFormField[]>(() => [
  { field: 'categoryId', label: t('plm.material.category'), type: 'category-select', required: true },
  { field: 'code', label: t('common.code'), type: 'input', required: false, placeholder: t('plm.material.placeholder.codeAuto') },
  { field: 'name', label: t('common.name'), type: 'input', required: true, placeholder: t('common.keyword') },
  {
    field: 'type', label: t('common.type'), type: 'select', required: true,
    options: [
      { label: t('plm.material.type.raw'), value: 'RAW' },
      { label: t('plm.material.type.semi'), value: 'SEMI' },
      { label: t('plm.material.type.finished'), value: 'FINISHED' },
    ],
  },
  {
    field: 'uomId', label: t('common.unit'), type: 'uom-select', required: true,
  },
  { field: 'specification', label: t('common.specification'), type: 'input', placeholder: t('common.keyword') },
])

function statusColor(status: string) {
  const map: Record<string, string> = { ACTIVE: 'green', DESIGN: 'arcoblue', TRIAL: 'orange', INACTIVE: 'red', OBSOLETE: 'gray' }
  return map[status] ?? 'gray'
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    ACTIVE: t('plm.material.status.active'),
    DESIGN: t('plm.material.status.design'),
    TRIAL: t('plm.material.status.trial'),
    INACTIVE: t('plm.material.status.inactive'),
    OBSOLETE: t('plm.material.status.obsolete')
  }
  return map[status] ?? status
}

function typeLabel(type: string) {
  const map: Record<string, string> = {
    RAW: t('plm.material.type.raw'),
    SEMI: t('plm.material.type.semi'),
    FINISHED: t('plm.material.type.finished')
  }
  return map[type] ?? type
}

function uomLabel(uomId: string) {
  const map: Record<string, string> = {
    '1': t('plm.material.uom.piece'),
    '2': t('plm.material.uom.unit'),
    '3': t('plm.material.uom.kg'),
    '4': t('plm.material.uom.m')
  }
  return map[uomId] ?? uomId
}

async function loadData() {
  loading.value = true
  try {
    const res = await plmApi.getMaterials(query)
    tableData.value = (res.list ?? []) as any[]
    total.value = res.total ?? 0
  } finally {
    loading.value = false
  }
}

function resetQuery() {
  query.keyword = ''
  query.type = ''
  query.categoryId = ''
  query.status = ''
  query.page = 1
  loadData()
}

function onTableChange(e: { page: number; pageSize: number }) {
  query.page = e.page
  query.pageSize = e.pageSize
  loadData()
}

function viewDetail(id: string) {
  router.push(`/plm/material/${id}`)
}

function openDrawer(mode: 'create' | 'edit', record?: Record<string, unknown>) {
  drawerMode.value = mode
  if (mode === 'edit' && record) {
    editId.value = record.id as string
    formData.value = { ...record }
  } else {
    editId.value = ''
    formData.value = {}
  }
  drawerVisible.value = true
}

async function handleSubmit(data: Record<string, unknown>) {
  submitting.value = true
  try {
    if (drawerMode.value === 'create') {
      await plmApi.createMaterial(data)
      Message.success(t('common.success'))
    } else {
      await plmApi.updateMaterial(editId.value, data)
      Message.success(t('common.success'))
    }
    drawerVisible.value = false
    loadData()
  } finally {
    submitting.value = false
  }
}

// ─── 状态变更 ─────────────────────────────────────────────────
const statusLoadingId = ref<string | null>(null)


async function handleChangeMaterialStatus(id: string, status: string) {
  statusLoadingId.value = id
  try {
    await plmApi.changeMaterialStatus(id, status)
    Message.success(t('common.success'))
    loadData()
  } catch { /* handled by interceptor */ } finally {
    statusLoadingId.value = null
  }
}

onMounted(loadData)
</script>

<style scoped>
.page-container {
  padding: 16px;
}
</style>
