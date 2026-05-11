<template>
  <div class="page-container">
    <!-- 顶部工具栏 -->
    <a-card :bordered="false" style="margin-bottom: 16px">
      <a-space wrap>
        <a-select
          v-model="query.status"
          :placeholder="$t('plm.code-rule.状态筛选')"
          allow-clear
          style="width: 130px"
        >
          <a-option value="ACTIVE">启用</a-option>
          <a-option value="INACTIVE">停用</a-option>
        </a-select>
        <a-input
          v-model="query.keyword"
          :placeholder="$t('plm.code-rule.编码名称')"
          allow-clear
          style="width: 200px"
          @keyup.enter="loadData"
        />
        <a-button type="primary" @click="loadData">{{ $t('common.search') }}</a-button>
        <a-button @click="resetQuery">{{ $t('common.reset') }}</a-button>
      </a-space>
      <template #extra>
        <a-button type="primary" @click="openDrawer(null)">
          <template #icon><icon-plus /></template>
          新建规则
        </a-button>
      </template>
    </a-card>

    <!-- 列表 -->
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
          <a-tag :color="record.status === 'ACTIVE' ? 'green' : 'gray'">
            {{ record.status === 'ACTIVE' ? '启用' : '停用' }}
          </a-tag>
        </template>
        <template #action="{ record }">
          <a-link @click="openDrawer(record as unknown as MaterialCodeRule)">{{ $t('common.edit') }}</a-link>
        </template>
      </MTable>
    </a-card>

    <!-- 新建/编辑抽屉 -->
    <a-drawer
      v-model:visible="drawerVisible"
      :title="editingRule ? $t('common.edit') : $t('common.create')"
      :width="520"
      @cancel="drawerVisible = false"
    >
      <MForm
        :schema="formSchema"
        v-model="formData"
        :loading="saving"
        :submit-text="$t('plm.code-rule.保存')"
        @submit="handleSave"
        @cancel="drawerVisible = false"
      />
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
import { plmApi, type MaterialCodeRule } from '@/api/plm'

// ─── 列表 ────────────────────────────────────────────────────
const loading = ref(false)
const tableData = ref<any[]>([])
const total = ref(0)
const query = reactive({ keyword: '', status: '', page: 1, pageSize: 20 })

const columns: MTableColumn[] = [
  { key: 'code', title: t('plm.code-rule.index.编码'), dataIndex: 'code', width: 120 },
  { key: 'name', title: t('plm.code-rule.index.名称'), dataIndex: 'name', width: 150 },
  { key: 'pattern', title: t('plm.code-rule.index.规则模板'), dataIndex: 'pattern', width: 200, ellipsis: true },
  { key: 'prefix', title: t('plm.code-rule.index.前缀'), dataIndex: 'prefix', width: 100 },
  { key: 'seqDigits', title: t('plm.code-rule.index.序号位数'), dataIndex: 'seqDigits', width: 100 },
  { key: 'status', title: t('plm.code-rule.index.状态'), slotName: 'status', width: 90 },
  { key: 'action', title: t('plm.code-rule.index.操作'), slotName: 'action', width: 80 },
]

async function loadData() {
  loading.value = true
  try {
    const params: Record<string, unknown> = { page: query.page, pageSize: query.pageSize }
    if (query.keyword) params.keyword = query.keyword
    if (query.status) params.status = query.status
    const res = await plmApi.getCodeRules(params)
    tableData.value = (res.list ?? []) as any[]
    total.value = res.total ?? 0
  } catch {
    // handled
  } finally {
    loading.value = false
  }
}

function resetQuery() {
  query.keyword = ''
  query.status = ''
  query.page = 1
  loadData()
}

function onTableChange(e: { page: number; pageSize: number }) {
  query.page = e.page
  query.pageSize = e.pageSize
  loadData()
}

// ─── 抽屉 ────────────────────────────────────────────────────
const drawerVisible = ref(false)
const saving = ref(false)
const editingRule = ref<MaterialCodeRule | null>(null)
const formData = ref<Record<string, unknown>>({})

const formSchema: MFormField[] = [
  { field: 'code', label: '编码', type: 'input', required: true, placeholder: '请输入规则编码' },
  { field: 'name', label: '名称', type: 'input', required: true, placeholder: '请输入规则名称' },
  { field: 'pattern', label: '规则模板', type: 'input', required: true, placeholder: '如 {PREFIX}-{CATEGORY}-{SEQ6}' },
  { field: 'prefix', label: '前缀', type: 'input', placeholder: '如 MAT' },
  { field: 'seqDigits', label: '序号位数', type: 'number', placeholder: '如 6', props: { min: 1, max: 10 } },
  {
    field: 'status',
    label: '状态',
    type: 'select',
    required: true,
    options: [
      { label: '启用', value: 'ACTIVE' },
      { label: '停用', value: 'INACTIVE' },
    ],
  },
  { field: 'description', label: '描述', type: 'textarea', placeholder: '请输入规则描述', props: { autoSize: { minRows: 2, maxRows: 4 } } },
]

function openDrawer(rule: MaterialCodeRule | null) {
  editingRule.value = rule
  formData.value = rule
    ? { ...rule }
    : { status: 'ACTIVE' }
  drawerVisible.value = true
}

async function handleSave(data: Record<string, unknown>) {
  saving.value = true
  try {
    if (editingRule.value) {
      await plmApi.updateCodeRule(editingRule.value.id, data)
      Message.success('更新成功')
    } else {
      await plmApi.createCodeRule(data)
      Message.success('创建成功')
    }
    drawerVisible.value = false
    loadData()
  } catch {
    // handled
  } finally {
    saving.value = false
  }
}

onMounted(loadData)
</script>

<style scoped>
.page-container {
  padding: 16px;
}
</style>
