<template>
  <div class="page-container">
    <a-card>
      <!-- 搜索栏 -->
      <a-space wrap style="margin-bottom: 16px">
        <a-input v-model="query.woId" :placeholder="$t('aps.schedule.index.工单ID')" allow-clear style="width: 180px" />
        <a-input v-model="query.resourceId" :placeholder="$t('aps.schedule.index.资源ID')" allow-clear style="width: 180px" />
        <a-button type="primary" @click="handleSearch">{{ $t('common.search') }}</a-button>
        <a-button @click="handleReset">{{ $t('common.reset') }}</a-button>
        <a-button type="outline" style="margin-left: auto" @click="scheduleModal = true">{{ $t('aps.schedule.lbl1017') }}</a-button>
      </a-space>

      <MTable
        :columns="columns"
        :data="tableData"
        :loading="loading"
        :total="total"
        @change="handleTableChange"
      >
        <template #status="{ record }">
          <a-tag :color="statusColor(record.status as string)">{{ statusLabel(record.status as string) }}</a-tag>
        </template>
      </MTable>
    </a-card>

    <!-- 触发排程弹窗 -->
    <a-modal v-model:visible="scheduleModal" :title="$t('aps.schedule.index.触发正向排程')" @ok="handleTrigger" :confirm-loading="triggering">
      <a-form :model="scheduleForm" layout="vertical">
        <a-form-item :label="$t('aps.schedule.index.开始日期')" required>
          <a-date-picker v-model="scheduleForm.startDate" style="width: 100%" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
import { useI18n } from 'vue-i18n'
import { ref, reactive, onMounted } from 'vue'
import { Message } from '@arco-design/web-vue'
import MTable from '@/components/MTable/index.vue'
import type { MTableColumn, MTableChangeEvent } from '@/components/MTable/index.vue'
import { apsApi } from '@/api/aps'
import type { ApsSchedule } from '@/api/aps'
const loading = ref(false)
const tableData = ref<ApsSchedule[]>([])
const total = ref(0)
const scheduleModal = ref(false)
const triggering = ref(false)

const query = reactive({ woId: '', resourceId: '' })
const pagination = reactive({ page: 1, pageSize: 20 })
const scheduleForm = reactive({ startDate: '' })

const columns: MTableColumn[] = [
  { key: 'woCode', title: t('aps.schedule.index.工单编号') },
  { key: 'resourceName', title: t('aps.schedule.index.资源名称') },
  { key: 'operationName', title: t('aps.schedule.index.工序名称') },
  { key: 'plannedStart', title: t('aps.schedule.index.计划开始') },
  { key: 'plannedEnd', title: t('aps.schedule.index.计划结束') },
  { key: 'status', title: t('aps.schedule.index.状态'), slotName: 'status' },
]

function statusColor(status: string) {
  const map: Record<string, string> = {
    SCHEDULED: 'blue',
    CONFIRMED: 'cyan',
    STARTED: 'orange',
    COMPLETED: 'green',
    CANCELLED: 'gray',
  }
  return map[status] ?? 'gray'
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    SCHEDULED: t('aps.schedule.lbl1018'),
    CONFIRMED: t('aps.schedule.lbl1019'),
    STARTED: t('aps.schedule.lbl1020'),
    COMPLETED: t('aps.schedule.completed'),
    CANCELLED: t('aps.schedule.lbl1021')
  }
  return map[status] ?? status
}

async function loadData() {
  loading.value = true
  try {
    const res = await apsApi.getSchedules({
      woId: query.woId || undefined,
      resourceId: query.resourceId || undefined,
      ...pagination,
    })
    tableData.value = res.list ?? []
    total.value = res.total ?? 0
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  pagination.page = 1
  loadData()
}

function handleReset() {
  query.woId = ''
  query.resourceId = ''
  pagination.page = 1
  loadData()
}

function handleTableChange(e: MTableChangeEvent) {
  pagination.page = e.page
  pagination.pageSize = e.pageSize
  loadData()
}

async function handleTrigger() {
  if (!scheduleForm.startDate) {
    Message.warning(t('aps.schedule.index.请选择开始日期'))
    return
  }
  triggering.value = true
  try {
    await apsApi.triggerForwardSchedule({
      
      startDate: scheduleForm.startDate,
    })
    Message.success(t('aps.schedule.index.排程已触发'))
    scheduleModal.value = false
    scheduleForm.startDate = ''
    loadData()
  } finally {
    triggering.value = false
  }
}

onMounted(loadData)
</script>
