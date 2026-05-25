<template>
  <div class="page-container">
    <a-card>
      <div class="search-bar">
        <a-select v-model="query.type" allow-clear placeholder="报表类型" style="width: 130px">
          <a-option value="DASHBOARD">大屏</a-option>
          <a-option value="TABLE">表格</a-option>
          <a-option value="CHART">图表</a-option>
          <a-option value="MIXED">混合</a-option>
        </a-select>
        <a-button type="primary" @click="loadData">{{ $t('common.search') }}</a-button>
        <a-button style="margin-left: auto" type="primary" @click="openCreate">
          <template #icon><icon-plus /></template>
          新建报表
        </a-button>
      </div>

      <MTable :columns="columns" :data="list" :loading="loading" :total="total" @change="onTableChange">
        <template #type="{ record }">
          <a-tag :color="typeColor(record.type)" size="small">{{ typeLabel(record.type) }}</a-tag>
        </template>
        <template #action="{ record }">
          <a-space>
            <a-button type="text" size="small" @click="openDesigner(record)">设计</a-button>
            <a-button type="text" size="small" @click="openPreview(record)">预览</a-button>
            <a-popconfirm content="确认删除该报表？" @ok="handleDelete(record.id)">
              <a-button type="text" size="small" status="danger">删除</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </MTable>
    </a-card>

    <!-- 新建报表 -->
    <a-modal v-model:visible="createVisible" title="新建报表" :width="480">
      <a-form :model="createForm" layout="vertical">
        <a-form-item label="报表名称" required>
          <a-input v-model="createForm.name" placeholder="如：生产日报" />
        </a-form-item>
        <a-form-item label="报表类型" required>
          <a-select v-model="createForm.type">
            <a-option value="DASHBOARD">大屏</a-option>
            <a-option value="TABLE">表格</a-option>
            <a-option value="CHART">图表</a-option>
            <a-option value="MIXED">混合</a-option>
          </a-select>
        </a-form-item>
        <a-form-item label="描述">
          <a-textarea v-model="createForm.description" placeholder="报表描述" />
        </a-form-item>
      </a-form>
      <template #footer>
        <a-space>
          <a-button @click="createVisible = false">取消</a-button>
          <a-button type="primary" :loading="saving" @click="handleCreate">创建</a-button>
        </a-space>
      </template>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Message } from '@arco-design/web-vue'
import MTable from '@/components/MTable/index.vue'
import type { MTableColumn } from '@/components/MTable/index.vue'
import { request } from '@/utils/request'

interface ReportDef {
  id: string; name: string; type: string; description?: string; isTemplate?: number; status?: string
}

const router = useRouter()
const loading = ref(false)
const saving = ref(false)
const list = ref<ReportDef[]>([])
const total = ref(0)
const query = reactive({ type: '', page: 1, pageSize: 20 })
const createVisible = ref(false)
const createForm = reactive({ name: '', type: 'DASHBOARD', description: '' })

const TYPE_OPTIONS = [
  { value: 'DASHBOARD', label: '大屏', color: 'blue' },
  { value: 'TABLE', label: '表格', color: 'green' },
  { value: 'CHART', label: '图表', color: 'purple' },
  { value: 'MIXED', label: '混合', color: 'orange' },
]

function typeColor(t: string) { return TYPE_OPTIONS.find(o => o.value === t)?.color ?? 'gray' }
function typeLabel(t: string) { return TYPE_OPTIONS.find(o => o.value === t)?.label ?? t }

const columns: MTableColumn[] = [
  { key: 'name', title: '报表名称', width: 200 },
  { key: 'type', title: '类型', width: 80, slotName: 'type' },
  { key: 'description', title: '描述', ellipsis: true },
  { key: 'action', title: '操作', width: 160, slotName: 'action' },
]

async function loadData() {
  loading.value = true
  try {
    const params: Record<string, unknown> = { page: query.page, pageSize: query.pageSize }
    if (query.type) params.type = query.type
    const res = await request.get('/v1/rpt/reports', params)
    list.value = (res as any).items ?? []
    total.value = (res as any).total ?? 0
  } catch { list.value = [] } finally { loading.value = false }
}

function onTableChange(e: { page: number; pageSize: number }) {
  query.page = e.page; query.pageSize = e.pageSize; loadData()
}

function openCreate() {
  Object.assign(createForm, { name: '', type: 'DASHBOARD', description: '' })
  createVisible.value = true
}

async function handleCreate() {
  if (!createForm.name) { Message.warning('请输入报表名称'); return }
  saving.value = true
  try {
    await request.post('/v1/rpt/reports', {
      name: createForm.name,
      type: createForm.type,
      description: createForm.description,
      layout: { width: 1920, height: 1080 },
      components: [],
      dataSources: [],
    })
    Message.success('创建成功')
    createVisible.value = false
    loadData()
  } catch { Message.error('创建失败') } finally { saving.value = false }
}

function openDesigner(report: ReportDef) {
  router.push(`/rpt/designer/${report.id}`)
}

function openPreview(report: ReportDef) {
  router.push(`/rpt/preview/${report.id}`)
}

async function handleDelete(id: string) {
  try {
    await request.delete(`/v1/rpt/reports/${id}`)
    Message.success('删除成功')
    loadData()
  } catch { Message.error('删除失败') }
}

onMounted(loadData)
</script>

<style scoped>
.page-container { padding: 16px; }
.search-bar { display: flex; gap: 8px; align-items: center; margin-bottom: 16px; }
</style>
