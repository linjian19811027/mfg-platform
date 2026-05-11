<template>
  <div class="page-container">
    <a-card>
      <!-- 搜索栏 -->
      <a-space wrap style="margin-bottom: 16px">
        <a-input v-model="resourceId" :placeholder="$t('aps.calendar.index.资源ID')" allow-clear style="width: 200px" />
        <a-button type="primary" @click="handleSearch">{{ $t('common.search') }}</a-button>
        <a-button type="outline" style="margin-left: auto" @click="openDrawer">新增日历</a-button>
      </a-space>

      <MTable
        :columns="columns"
        :data="tableData"
        :loading="loading"
        :total="total"
        @change="handleTableChange"
      >
        <template #shiftType="{ record }">
          <a-tag>{{ record.shiftType }}</a-tag>
        </template>
        <template #isWorkday="{ record }">
          <a-tag :color="record.isWorkday ? 'green' : 'red'">{{ record.isWorkday ? '是' : '否' }}</a-tag>
        </template>
      </MTable>
    </a-card>

    <!-- 新增日历抽屉 -->
    <a-drawer v-model:visible="drawerVisible" :title="$t('aps.calendar.index.新增日历')" :width="480" @ok="handleSubmit" :confirm-loading="submitting">
      <MForm
        :schema="formSchema"
        v-model="formData"
        :loading="submitting"
        :show-actions="false"
      />
      <template #footer>
        <a-space>
          <a-button @click="drawerVisible = false">{{ $t('common.cancel') }}</a-button>
          <a-button type="primary" :loading="submitting" @click="handleSubmit">{{ $t('common.save') }}</a-button>
        </a-space>
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
import type { MTableColumn, MTableChangeEvent } from '@/components/MTable/index.vue'
import type { MFormField } from '@/components/MForm/index.vue'
import { apsApi } from '@/api/aps'
import type { ApsCalendar } from '@/api/aps'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const loading = ref(false)
const tableData = ref<ApsCalendar[]>([])
const total = ref(0)
const resourceId = ref('')
const drawerVisible = ref(false)
const submitting = ref(false)
const pagination = reactive({ page: 1, pageSize: 20 })

const formData = ref<Record<string, unknown>>({
  resourceId: '', date: '', shiftType: 'MORNING', startTime: '', endTime: '',
})

const columns: MTableColumn[] = [
  { key: 'date', title: t('aps.calendar.index.日期') },
  { key: 'shiftType', title: t('aps.calendar.index.班次类型'), slotName: 'shiftType' },
  { key: 'startTime', title: t('aps.calendar.index.开始时间') },
  { key: 'endTime', title: t('aps.calendar.index.结束时间') },
  { key: 'isWorkday', title: t('aps.calendar.index.是否工作日'), slotName: 'isWorkday' },
]

const formSchema: MFormField[] = [
  { field: 'resourceId', label: '资源ID', type: 'input', required: true },
  { field: 'date', label: '日期', type: 'date', required: true },
  {
    field: 'shiftType', label: '班次类型', type: 'select', required: true,
    options: [
      { label: 'MORNING', value: 'MORNING' },
      { label: 'AFTERNOON', value: 'AFTERNOON' },
      { label: 'NIGHT', value: 'NIGHT' },
      { label: 'HOLIDAY', value: 'HOLIDAY' },
    ],
  },
  { field: 'startTime', label: '开始时间', type: 'input', placeholder: 'HH:mm', required: true },
  { field: 'endTime', label: '结束时间', type: 'input', placeholder: 'HH:mm', required: true },
]

async function loadData() {
  loading.value = true
  try {
    const res = await apsApi.getCalendars({
      resourceId: resourceId.value || undefined,
      tenantId: auth.tenantId ?? undefined,
    })
    tableData.value = res.list ?? []
    total.value = (res as any).total ?? 0
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  pagination.page = 1
  loadData()
}

function handleTableChange(e: MTableChangeEvent) {
  pagination.page = e.page
  pagination.pageSize = e.pageSize
  loadData()
}

function openDrawer() {
  formData.value = { resourceId: '', date: '', shiftType: 'MORNING', startTime: '', endTime: '' }
  drawerVisible.value = true
}

async function handleSubmit() {
  submitting.value = true
  try {
    await apsApi.createCalendar({
      resourceId: formData.value.resourceId as string,
      date: formData.value.date as string,
      shiftType: formData.value.shiftType as string,
      startTime: formData.value.startTime as string,
      endTime: formData.value.endTime as string,
      tenantId: auth.tenantId ?? '',
    })
    Message.success('创建成功')
    drawerVisible.value = false
    loadData()
  } finally {
    submitting.value = false
  }
}

onMounted(loadData)
</script>
