<template>
  <div class="page-container">
    <a-card>
      <div class="search-bar">
        <a-select v-model="query.status" :placeholder="$t('common.status')" allow-clear style="width:120px">
          <a-option value="ACTIVE">启用</a-option>
          <a-option value="INACTIVE">停用</a-option>
          <a-option value="PENDING">待审</a-option>
        </a-select>
        <a-select v-model="query.grade" :placeholder="$t('scm.supplier.index.等级')" allow-clear style="width:100px">
          <a-option v-for="g in ['A','B','C','D']" :key="g" :value="g">{{ g }}</a-option>
        </a-select>
        <a-button type="primary" @click="loadData">{{ $t('common.search') }}</a-button>
        <a-button @click="resetQuery">{{ $t('common.reset') }}</a-button>
        <a-button style="margin-left:auto" type="primary" @click="openCreate">新建供应商</a-button>
      </div>

      <MTable :columns="columns" :data="list" :loading="loading" :total="total" @change="onTableChange">
        <template #grade="{ record }">
          <a-tag :color="gradeColor(record.grade as string)">{{ record.grade }}</a-tag>
        </template>
        <template #status="{ record }">
          <a-tag :color="statusColor(record.status as string)">{{ statusLabel(record.status as string) }}</a-tag>
        </template>
        <template #action="{ record }">
          <a-button type="text" size="small" @click="viewDetail(record as Supplier)">查看</a-button>
        </template>
      </MTable>
    </a-card>

    <a-drawer v-model:visible="createVisible" :title="$t('scm.supplier.index.新建供应商')" :width="480" @cancel="createVisible=false">
      <MForm :schema="createSchema" v-model="createForm" :loading="submitting" @submit="handleCreate" @cancel="createVisible=false" />
    </a-drawer>

    <a-drawer v-model:visible="detailVisible" :title="`供应商：${currentSupplier?.name}`" :width="480" @cancel="detailVisible=false">
      <a-descriptions :data="detailItems" layout="inline-vertical" bordered />
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
import { useI18n } from 'vue-i18n'
import { ref, reactive, computed } from 'vue'
import { Message } from '@arco-design/web-vue'
import MTable from '@/components/MTable/index.vue'
import MForm from '@/components/MForm/index.vue'
import type { MTableColumn } from '@/components/MTable/index.vue'
import type { MFormField } from '@/components/MForm/index.vue'
import { scmApi, type Supplier } from '@/api/scm'

const gradeColorMap: Record<string, string> = { A: 'green', B: 'blue', C: 'orange', D: 'red' }
const statusColorMap: Record<string, string> = { ACTIVE: 'green', INACTIVE: 'gray', PENDING: 'orange' }
const statusLabelMap: Record<string, string> = { ACTIVE: '启用', INACTIVE: '停用', PENDING: '待审' }
const gradeColor = (g: string) => gradeColorMap[g] ?? 'gray'
const statusColor = (s: string) => statusColorMap[s] ?? 'gray'
const statusLabel = (s: string) => statusLabelMap[s] ?? s

const columns: MTableColumn[] = [
  { key: 'code', title: t('scm.supplier.index.编码'), width: 120 },
  { key: 'name', title: t('scm.supplier.index.名称') },
  { key: 'grade', title: t('scm.supplier.index.等级'), width: 80, slotName: 'grade' },
  { key: 'status', title: t('scm.supplier.index.状态'), width: 90, slotName: 'status' },
  { key: 'contactName', title: t('scm.supplier.index.联系人'), width: 100 },
  { key: 'contactPhone', title: t('scm.supplier.index.联系电话'), width: 130 },
  { key: 'action', title: t('scm.supplier.index.操作'), width: 80, slotName: 'action' },
]

const createSchema: MFormField[] = [
  { field: 'code', label: '编码', type: 'input', required: true },
  { field: 'name', label: '名称', type: 'input', required: true },
  { field: 'grade', label: '等级', type: 'select', required: true, options: ['A','B','C','D'].map(v => ({ label: v, value: v })) },
  { field: 'contactName', label: '联系人', type: 'input' },
  { field: 'contactPhone', label: '联系电话', type: 'input' },
  { field: 'email', label: '邮箱', type: 'input' },
]

const query = reactive({ status: '', grade: '' })
const list = ref<Supplier[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const pageSize = ref(20)
const createVisible = ref(false)
const detailVisible = ref(false)
const submitting = ref(false)
const createForm = ref<Record<string, unknown>>({})
const currentSupplier = ref<Supplier | null>(null)

const detailItems = computed(() => {
  const s = currentSupplier.value
  if (!s) return []
  return [
    { label: '编码', value: s.code }, { label: '名称', value: s.name },
    { label: '等级', value: s.grade }, { label: '状态', value: statusLabel(s.status) },
    { label: '联系人', value: s.contactName }, { label: '联系电话', value: s.contactPhone },
    { label: '邮箱', value: s.email },
  ]
})

async function loadData() {
  loading.value = true
  try {
    const res = await scmApi.getSuppliers({ ...query, page: page.value, pageSize: pageSize.value })
    list.value = res.list
    total.value = res.total
  } finally { loading.value = false }
}

function resetQuery() { query.status = ''; query.grade = ''; loadData() }
function onTableChange(e: { page: number; pageSize: number }) { page.value = e.page; pageSize.value = e.pageSize; loadData() }
function openCreate() { createForm.value = {}; createVisible.value = true }
function viewDetail(s: Supplier) { currentSupplier.value = s; detailVisible.value = true }

async function handleCreate(data: Record<string, unknown>) {
  submitting.value = true
  try {
    await scmApi.createSupplier(data as Parameters<typeof scmApi.createSupplier>[0])
    Message.success('创建成功')
    createVisible.value = false
    loadData()
  } finally { submitting.value = false }
}

loadData()
</script>

<style scoped>
.page-container { padding: 16px; }
.search-bar { display: flex; gap: 8px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
</style>
