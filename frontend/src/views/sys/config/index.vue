<template>
  <div class="page-container">
    <a-card>
      <div class="search-bar">
        <a-select v-model="query.group" allow-clear placeholder="按分组筛选" style="width: 160px">
          <a-option v-for="g in groups" :key="g" :value="g">{{ g }}</a-option>
        </a-select>
        <a-button type="primary" @click="loadData">{{ $t('common.search') }}</a-button>
        <a-button style="margin-left: auto" type="primary" @click="openCreate">
          <template #icon><icon-plus /></template>
          新增配置
        </a-button>
      </div>

      <MTable :columns="columns" :data="list" :loading="loading" :total="total" @change="onTableChange">
        <template #action="{ record }">
          <a-space>
            <a-button type="text" size="small" @click="openEdit(record)">编辑</a-button>
            <a-popconfirm content="确认删除该配置项？" @ok="handleDelete(record.id)">
              <a-button type="text" size="small" status="danger">删除</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </MTable>
    </a-card>

    <a-drawer v-model:visible="drawerVisible" :title="editingId ? '编辑配置' : '新增配置'" :width="480">
      <a-form :model="formData" layout="vertical">
        <a-form-item label="配置键" required>
          <a-input v-model="formData.key" placeholder="如 SMTP_HOST" :disabled="!!editingId" />
        </a-form-item>
        <a-form-item label="配置值" required>
          <a-textarea v-model="formData.value" placeholder="配置值" :auto-size="{ minRows: 2 }" />
        </a-form-item>
        <a-form-item label="分组">
          <a-input v-model="formData.group" placeholder="如 email, system" />
        </a-form-item>
        <a-form-item label="说明">
          <a-input v-model="formData.description" placeholder="配置项说明" />
        </a-form-item>
      </a-form>
      <template #footer>
        <a-space>
          <a-button @click="drawerVisible = false">取消</a-button>
          <a-button type="primary" :loading="saving" @click="handleSave">保存</a-button>
        </a-space>
      </template>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { Message } from '@arco-design/web-vue'
import MTable from '@/components/MTable/index.vue'
import type { MTableColumn } from '@/components/MTable/index.vue'
import { request } from '@/utils/request'

interface ConfigItem {
  id: string; key: string; value?: string; group?: string; description?: string
}

const loading = ref(false)
const saving = ref(false)
const list = ref<ConfigItem[]>([])
const total = ref(0)
const query = reactive({ group: '' })
const drawerVisible = ref(false)
const editingId = ref<string | null>(null)
const formData = reactive({ key: '', value: '', group: '', description: '' })

const columns: MTableColumn[] = [
  { key: 'key', title: '配置键', width: 200 },
  { key: 'value', title: '配置值', width: 300 },
  { key: 'group', title: '分组', width: 100 },
  { key: 'description', title: '说明' },
  { key: 'action', title: '操作', width: 140, slotName: 'action' },
]

const groups = computed(() => [...new Set(list.value.map(c => c.group).filter(Boolean))] as string[])

async function loadData() {
  loading.value = true
  try {
    const params: Record<string, unknown> = {}
    if (query.group) params.group = query.group
    const res = await request.get<ConfigItem[]>('/v1/sys/configs', params)
    list.value = Array.isArray(res) ? res : []
    total.value = list.value.length
  } catch { list.value = [] } finally { loading.value = false }
}

function onTableChange() { loadData() }

function openCreate() {
  editingId.value = null
  Object.assign(formData, { key: '', value: '', group: '', description: '' })
  drawerVisible.value = true
}

function openEdit(item: ConfigItem) {
  editingId.value = item.id
  Object.assign(formData, { key: item.key, value: item.value ?? '', group: item.group ?? '', description: item.description ?? '' })
  drawerVisible.value = true
}

async function handleSave() {
  if (!formData.key) { Message.warning('请输入配置键'); return }
  saving.value = true
  try {
    await request.post('/v1/sys/configs', { ...formData })
    Message.success('保存成功')
    drawerVisible.value = false
    loadData()
  } catch { Message.error('保存失败') } finally { saving.value = false }
}

async function handleDelete(id: string) {
  try {
    await request.delete(`/v1/sys/configs/${id}`)
    Message.success('删除成功')
    loadData()
  } catch { Message.error('删除失败') }
}

onMounted(loadData)
</script>

<style scoped>
.page-container { padding: 16px; }
.search-bar { display: flex; gap: 8px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
</style>
