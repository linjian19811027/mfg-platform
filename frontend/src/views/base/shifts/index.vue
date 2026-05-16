<template>
  <div class="page-container">
    <a-card :bordered="false">
      <template #extra>
        <a-button type="primary" @click="openDrawer(null)">
          <template #icon><icon-plus /></template>
          {{ $t('common.create') }}
        </a-button>
      </template>

      <MTable
        :columns="columns"
        :data="tableData"
        :loading="loading"
        :total="total"
        @change="onTableChange"
      >
        <template #status="{ record }">
          <a-tag :color="record.enabled ? 'green' : 'gray'">
            {{ record.enabled ? $t('common.enable') : $t('common.disable') }}
          </a-tag>
        </template>
        <template #action="{ record }">
          <a-space>
            <a-link @click="openDrawer(record)">{{ $t('common.edit') }}</a-link>
            <a-popconfirm :content="$t('common.confirmMsg')" @ok="handleDelete(record.id)">
              <a-link status="danger">{{ $t('common.delete') }}</a-link>
            </a-popconfirm>
          </a-space>
        </template>
      </MTable>
    </a-card>

    <a-drawer
      v-model:visible="drawerVisible"
      :title="formData.id ? $t('common.edit') : $t('common.create')"
      :width="480"
      @cancel="handleCancel"
    >
      <a-form ref="formRef" :model="formData" layout="vertical" @submit="handleSave">
        <a-form-item field="code" :label="$t('common.code')" required>
          <a-input v-model="formData.code" :placeholder="$t('base.shifts.index.请输入班次编码')" />
        </a-form-item>
        <a-form-item field="name" :label="$t('common.name')" required>
          <a-input v-model="formData.name" :placeholder="$t('base.shifts.index.请输入班次名称')" />
        </a-form-item>
        <a-form-item field="startTime" :label="$t('base.shifts.index.开始时间')" required>
          <a-time-picker v-model="formData.startTime" format="HH:mm" style="width: 100%" />
        </a-form-item>
        <a-form-item field="endTime" :label="$t('base.shifts.index.结束时间')" required>
          <a-time-picker v-model="formData.endTime" format="HH:mm" style="width: 100%" />
        </a-form-item>
        <a-form-item field="enabled" :label="$t('common.status')">
          <a-switch v-model="formData.enabled" :checked-value="1" :unchecked-value="0" />
        </a-form-item>
        <a-space>
          <a-button type="primary" html-type="submit" :loading="saving">{{ $t('common.save') }}</a-button>
          <a-button @click="handleCancel">{{ $t('common.cancel') }}</a-button>
        </a-space>
      </a-form>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { Message } from '@arco-design/web-vue'
import { baseApi } from '@/api/base'
import MTable from '@/components/MTable/index.vue'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()

interface ShiftRecord {
  id: number
  code: string
  name: string
  startTime: string
  endTime: string
  enabled?: number
}

const loading = ref(false)
const saving = ref(false)
const total = ref(0)
const tableData = ref<ShiftRecord[]>([])
const query = reactive<{ page: number; pageSize: number }>({ page: 1, pageSize: 20 })

const columns = [
  { key: 'code', title: t('base.shifts.index.编码'), dataIndex: 'code', width: 120, sortable: true },
  { key: 'name', title: t('base.shifts.index.名称'), dataIndex: 'name', width: 160 },
  { key: 'startTime', title: t('base.shifts.index.开始时间'), dataIndex: 'startTime', width: 120 },
  { key: 'endTime', title: t('base.shifts.index.结束时间'), dataIndex: 'endTime', width: 120 },
  { key: 'status', title: t('common.status'), slotName: 'status', width: 100 },
  { key: 'action', title: t('common.operation'), slotName: 'action', width: 160 },
]

const drawerVisible = ref(false)
const formRef = ref()
const formData = reactive<Partial<ShiftRecord>>({})

onMounted(() => loadData())

async function loadData() {
  loading.value = true
  try {
    const res = await baseApi.getShifts() as any
    tableData.value = Array.isArray(res) ? res : res.list ?? []
    total.value = Array.isArray(res) ? res.length : res.total ?? 0
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : t('base.shifts.loadFailed')
    Message.error(msg)
  } finally {
    loading.value = false
  }
}

function onTableChange(e: any) {
  if (e.page) query.page = e.page
  if (e.pageSize) query.pageSize = e.pageSize
  loadData()
}

function openDrawer(record: ShiftRecord | null) {
  if (record) {
    Object.assign(formData, { ...record })
  } else {
    formData.id = undefined
    formData.code = ''
    formData.name = ''
    formData.startTime = ''
    formData.endTime = ''
    formData.enabled = 1
  }
  drawerVisible.value = true
}

async function handleSave() {
  const valid = await formRef.value?.validate()
  if (valid) return
  saving.value = true
  try {
    if (formData.id) {
      await baseApi.updateShift(formData.id, formData as any)
      Message.success(t('common.message.update'))
    } else {
      await baseApi.createShift(formData as any)
      Message.success(t('common.message.create'))
    }
    drawerVisible.value = false
    loadData()
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : t('common.message.delete')
    Message.error(msg)
  } finally {
    saving.value = false
  }
}

async function handleDelete(id: number) {
  try {
    await baseApi.deleteShift(id)
    Message.success(t('common.message.delete'))
    loadData()
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : t('common.message.deleteFailed')
    Message.error(msg)
  }
}

function handleCancel() {
  drawerVisible.value = false
}
</script>

<style scoped>
.page-container {
  padding: 16px;
}
</style>
