<template>
  <div class="page-container">
    <a-card :bordered="false" style="margin-bottom: 16px">
      <a-space wrap>
        <a-input
          v-model="query.keyword"
          :placeholder="$t('eam.knowledge.index.搜索故障现象解决方案')"
          allow-clear
          style="width: 280px"
          @keyup.enter="handleSearch"
        >
          <template #prefix><icon-search /></template>
        </a-input>
        <a-button type="primary" @click="handleSearch">{{ $t('eam.knowledge.search') }}</a-button>
        <a-button @click="resetQuery">{{ $t('common.reset') }}</a-button>
      </a-space>
      <template #extra><a-button type="primary" @click="openDrawer(null)">{{ $t('eam.knowledge.lbl1119') }}</a-button></template>
    </a-card>

    <a-card :bordered="false">
      <MTable :columns="columns" :data="tableData" :loading="loading" :total="total" :page-size="20" @change="onTableChange">
        <template #symptom="{ record }">
          <span v-html="highlight(record.symptom as string)" />
        </template>
        <template #solution="{ record }">
          <span v-html="highlight(record.solution as string)" style="max-width:300px;display:inline-block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" />
        </template>
        <template #action="{ record }">
          <a-space>
            <a-link @click="openDetailDrawer(record as unknown as FaultKnowledge)">{{ $t('common.view') }}</a-link>
            <a-link @click="openDrawer(record as unknown as FaultKnowledge)">{{ $t('common.edit') }}</a-link>
          </a-space>
        </template>
      </MTable>
    </a-card>

    <!-- 新建/编辑抽屉 -->
    <a-drawer v-model:visible="drawerVisible" :title="editing ? $t('eam.knowledge.index.编辑知识条目') : $t('eam.knowledge.index.新建知识条目')" :width="560" @cancel="drawerVisible = false">
      <MForm :schema="formSchema" v-model="formData" :loading="saving" :submit-text="$t('eam.knowledge.index.保存')" @submit="handleSave" @cancel="drawerVisible = false" />
    </a-drawer>

    <!-- 详情抽屉 -->
    <a-drawer v-model:visible="detailDrawerVisible" :title="$t('eam.knowledge.index.知识条目详情')" :width="560" @cancel="detailDrawerVisible = false">
      <template v-if="currentItem">
        <a-descriptions :column="1" bordered>
          <a-descriptions-item :label="$t('eam.knowledge.index.设备类型')">{{ currentItem.equipmentType ?? '-' }}</a-descriptions-item>
          <a-descriptions-item :label="$t('eam.knowledge.index.故障现象')">{{ currentItem.symptom }}</a-descriptions-item>
          <a-descriptions-item :label="$t('eam.knowledge.index.原因分析')">{{ currentItem.cause ?? '-' }}</a-descriptions-item>
          <a-descriptions-item :label="$t('eam.knowledge.index.解决方案')">{{ currentItem.solution }}</a-descriptions-item>
          <a-descriptions-item :label="$t('eam.knowledge.index.预防措施')">{{ currentItem.preventionMeasure ?? '-' }}</a-descriptions-item>
        </a-descriptions>
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
import MForm from '@/components/MForm/index.vue'
import type { MTableColumn } from '@/components/MTable/index.vue'
import type { MFormField } from '@/components/MForm/index.vue'
import { eamApi, type FaultKnowledge } from '@/api/eam'

const loading = ref(false)
const tableData = ref<any[]>([])
const total = ref(0)
const query = reactive({ keyword: '', page: 1, pageSize: 20 })

const columns: MTableColumn[] = [
  { key: 'equipmentType', title: t('eam.knowledge.index.设备类型'), dataIndex: 'equipmentType', width: 120 },
  { key: 'symptom', title: t('eam.knowledge.index.故障现象'), slotName: 'symptom', width: 200 },
  { key: 'solution', title: t('eam.knowledge.index.解决方案'), slotName: 'solution', width: 240 },
  { key: 'createdAt', title: t('eam.knowledge.index.创建时间'), dataIndex: 'createdAt', width: 160 },
  { key: 'action', title: t('eam.knowledge.index.操作'), slotName: 'action', width: 120 },
]

const formSchema: MFormField[] = [
  { field: 'equipmentType', label: t('eam.knowledge.lbl1120'), type: 'input', props: { placeholder: t('eam.knowledge.r33014') } },
  { field: 'symptom', label: t('eam.knowledge.lbl1121'), type: 'textarea', required: true, props: { autoSize: { minRows: 2 } } },
  { field: 'cause', label: t('eam.knowledge.lbl1122'), type: 'textarea', props: { autoSize: { minRows: 2 } } },
  { field: 'solution', label: t('eam.knowledge.lbl1123'), type: 'textarea', required: true, props: { autoSize: { minRows: 3 } } },
  { field: 'preventionMeasure', label: t('eam.knowledge.lbl1124'), type: 'textarea', props: { autoSize: { minRows: 2 } } },
]

function highlight(text: string): string {
  if (!query.keyword || !text) return text
  const escaped = query.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return text.replace(new RegExp(escaped, 'gi'), m => `<mark style="background:#FF6B35;color:#fff;padding:0 2px;border-radius:2px">${m}</mark>`)
}

async function loadData() {
  loading.value = true
  try {
    const res = await eamApi.getKnowledge(query)
    tableData.value = (res.list ?? []) as any[]
    total.value = res.total ?? 0
  } catch { tableData.value = [] } finally { loading.value = false }
}

async function handleSearch() {
  query.page = 1
  if (query.keyword.trim()) {
    loading.value = true
    try {
      const res = await eamApi.searchKnowledge(query.keyword.trim())
      tableData.value = (res.list ?? []) as any[]
      total.value = tableData.value.length
    } catch { tableData.value = [] } finally { loading.value = false }
  } else {
    loadData()
  }
}

function resetQuery() { query.keyword = ''; query.page = 1; loadData() }
function onTableChange(e: { page: number; pageSize: number }) { query.page = e.page; query.pageSize = e.pageSize; loadData() }

const drawerVisible = ref(false)
const saving = ref(false)
const editing = ref<FaultKnowledge | null>(null)
const formData = ref<Record<string, unknown>>({})

function openDrawer(item: FaultKnowledge | null) {
  editing.value = item
  formData.value = item ? { ...item } : {}
  drawerVisible.value = true
}

async function handleSave(data: Record<string, unknown>) {
  saving.value = true
  try {
    await eamApi.createKnowledge(data)
    Message.success(editing.value ? t('eam.knowledge.lbl1125') : t('eam.knowledge.lbl1126'))
    drawerVisible.value = false
    loadData()
  } catch { /* handled */ } finally { saving.value = false }
}

const detailDrawerVisible = ref(false)
const currentItem = ref<FaultKnowledge | null>(null)
function openDetailDrawer(item: FaultKnowledge) { currentItem.value = item; detailDrawerVisible.value = true }

onMounted(loadData)
</script>

<style scoped>
.page-container { padding: 16px; }
</style>
