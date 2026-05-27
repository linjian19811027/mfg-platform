<template>
  <div class="page-container">
    <!-- 顶部工具栏 -->
    <a-card :bordered="false" style="margin-bottom: 16px">
      <a-space wrap>
        <a-input
          v-model="query.keyword"
          :placeholder="t('plm.standard-operation.lbl1430')"
          allow-clear
          style="width: 200px"
          @keyup.enter="loadData"
        />
        <a-select v-model="query.status" :placeholder="t('plm.standard-operation.status')" allow-clear style="width: 120px">
          <a-option value="ACTIVE">{{ $t('plm.standard-operation.enable') }}</a-option>
          <a-option value="INACTIVE">{{ $t('plm.standard-operation.disable') }}</a-option>
        </a-select>
        <a-button type="primary" @click="loadData">{{ $t('common.search') }}</a-button>
        <a-button @click="resetQuery">{{ $t('common.reset') }}</a-button>
      </a-space>
      <template #extra>
        <a-button type="primary" @click="openDrawer('create')">{{ $t('plm.standard-operation.lbl1431') }}</a-button>
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
          <a-tag :color="record.status === 'ACTIVE' ? 'green' : 'gray'">
            {{ record.status === 'ACTIVE' ? $t('plm.standard-operation.enable') : $t('plm.standard-operation.disable') }}
          </a-tag>
        </template>
        <template #stdHours="{ record }">
          <span>{{ record.stdHours != null ? `${record.stdHours} min` : '-' }}</span>
        </template>
        <template #setupTime="{ record }">
          <span>{{ record.setupTime != null ? `${record.setupTime} min` : '-' }}</span>
        </template>
        <template #action="{ record }">
          <a-space>
            <a-link @click="openDrawer('edit', record)">{{ $t('common.edit') }}</a-link>
            <a-link
              v-if="record.status === 'ACTIVE'"
              status="warning"
              @click="handleToggleStatus(record, 'INACTIVE')"
            >{{ $t('plm.standard-operation.disable') }}</a-link>
            <a-link
              v-if="record.status === 'INACTIVE'"
              @click="handleToggleStatus(record, 'ACTIVE')"
            >{{ $t('plm.standard-operation.enable') }}</a-link>
            <a-popconfirm
              :content="t('plm.standard-operation.r22012')"
              @ok="handleDelete(record.id as string)"
            >
              <a-link status="danger">{{ $t('common.delete') }}</a-link>
            </a-popconfirm>
          </a-space>
        </template>
      </MTable>
    </a-card>

    <!-- 新建/编辑抽屉 -->
    <a-drawer
      v-model:visible="drawerVisible"
      :title="t('plm.standard-operation.lbl1432')"
      :width="520"
      @cancel="drawerVisible = false"
    >
      <a-form :model="formData" layout="vertical">
        <a-form-item :label="t('plm.standard-operation.opCode')" required>
          <a-input v-model="formData.code" :placeholder="t('plm.standard-operation.lbl1433')" />
        </a-form-item>
        <a-form-item :label="t('plm.standard-operation.opName')" required>
          <a-input v-model="formData.name" :placeholder="t('plm.standard-operation.lbl1434')" />
        </a-form-item>
        <a-form-item :label="t('plm.standard-operation.defaultWorkCenter')">
          <WorkCenterSelect v-model="formData.workCenterId" @change="(node) => formData.workCenterName = node?.name" />
        </a-form-item>
        <a-form-item :label="t('plm.standard-operation.standardDuration')">
          <a-input-number v-model="formData.stdHours" :min="0" :precision="1" style="width: 100%" :placeholder="t('plm.standard-operation.lbl1435')" />
        </a-form-item>
        <a-form-item :label="t('plm.standard-operation.r33041')">
          <a-input-number v-model="formData.setupTime" :min="0" :precision="1" style="width: 100%" :placeholder="t('plm.standard-operation.lbl1436')" />
        </a-form-item>
        <a-form-item :label="t('plm.standard-operation.r33042')">
          <a-textarea v-model="formData.description" :placeholder="t('plm.standard-operation.lbl1437')" :max-length="500" />
        </a-form-item>
        <a-form-item style="margin-top: 24px">
          <a-space>
            <a-button type="primary" :loading="submitting" @click="handleSubmit">{{ $t('common.save') }}</a-button>
            <a-button @click="drawerVisible = false">{{ $t('common.cancel') }}</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { Message } from '@arco-design/web-vue'
import MTable from '@/components/MTable/index.vue'
import type { MTableColumn } from '@/components/MTable/index.vue'
import { plmApi, type StandardOperation } from '@/api/plm'
import WorkCenterSelect from '@/components/BusinessSelect/WorkCenterSelect.vue'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()



// ─── 列表 ─────────────────────────────────────────────────────
const loading = ref(false)
const tableData = ref<any[]>([])
const total = ref(0)
const query = reactive({ keyword: '', status: '', page: 1, pageSize: 20 })

const columns: MTableColumn[] = [
  { key: 'code', title: t('plm.standard-operation.lbl1438'), dataIndex: 'code', width: 130 },
  { key: 'name', title: t('plm.standard-operation.lbl1439'), dataIndex: 'name', width: 160 },
  { key: 'workCenterName', title: t('plm.standard-operation.lbl1440'), dataIndex: 'workCenterName', width: 140 },
  { key: 'stdHours', title: t('plm.standard-operation.lbl1441'), slotName: 'stdHours', width: 110 },
  { key: 'setupTime', title: t('plm.standard-operation.lbl1442'), slotName: 'setupTime', width: 110 },
  { key: 'description', title: t('plm.standard-operation.description'), dataIndex: 'description', width: 200, ellipsis: true },
  { key: 'status', title: t('plm.standard-operation.status'), slotName: 'status', width: 80 },
  { key: 'action', title: t('plm.standard-operation.action'), slotName: 'action', width: 180 },
]

async function loadData() {
  loading.value = true
  try {
    const params: Record<string, unknown> = { page: query.page, pageSize: query.pageSize }
    if (query.keyword) params.keyword = query.keyword
    if (query.status) params.status = query.status
    const res = await plmApi.getStandardOperations(params)
    tableData.value = (res.items ?? []) as any[]
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

// ─── 新建/编辑 ─────────────────────────────────────────────────
const drawerVisible = ref(false)
const drawerMode = ref<'create' | 'edit'>('create')
const submitting = ref(false)
const editId = ref('')
const formData = reactive<Partial<StandardOperation>>({
  code: '', name: '', workCenterId: '', workCenterName: '', stdHours: undefined, setupTime: undefined, description: '',
})

function openDrawer(mode: 'create' | 'edit', record?: any) {
  drawerMode.value = mode
  if (mode === 'edit' && record) {
    editId.value = record.id
    Object.assign(formData, {
      code: record.code,
      name: record.name,
      workCenterId: record.workCenterId ?? '',
      workCenterName: record.workCenterName ?? '',
      stdHours: record.stdHours != null ? Number(record.stdHours) : undefined,
      setupTime: record.setupTime != null ? Number(record.setupTime) : undefined,
      description: record.description ?? '',
    })
  } else {
    editId.value = ''
    Object.assign(formData, {
      code: '', name: '', workCenterId: '', workCenterName: '', stdHours: undefined, setupTime: undefined, description: '',
    })
  }
  drawerVisible.value = true
}

async function handleSubmit() {
  if (!formData.code) { Message.warning(t('plm.请输入工序编码')); return }
  if (!formData.name) { Message.warning(t('plm.请输入工序名称')); return }
  submitting.value = true
  try {
    if (drawerMode.value === 'create') {
      await plmApi.createStandardOperation({ ...formData })
      Message.success(t('plm.新建成功'))
    } else {
      await plmApi.updateStandardOperation(editId.value, { ...formData })
      Message.success(t('plm.保存成功'))
    }
    drawerVisible.value = false
    loadData()
  } catch {
    // handled
  } finally {
    submitting.value = false
  }
}

// ─── 状态切换 ──────────────────────────────────────────────────
async function handleToggleStatus(record: any, newStatus: string) {
  try {
    await plmApi.updateStandardOperation(record.id, { status: newStatus })
    Message.success(newStatus === 'ACTIVE' ? t('plm.standard-operation.lbl1443') : t('plm.standard-operation.lbl1444'))
    loadData()
  } catch {
    // handled
  }
}

// ─── 删除 ──────────────────────────────────────────────────────
async function handleDelete(id: string) {
  try {
    await plmApi.deleteStandardOperation(id)
    Message.success(t('plm.删除成功'))
    loadData()
  } catch {
    // handled
  }
}

onMounted(loadData)
</script>

<style scoped>
.page-container {
  padding: 16px;
}
</style>
