<template>
  <div class="history-timeline">
    <a-spin :loading="loading">
      <a-empty v-if="!loading && !list.length" :description="$t('hr.employee-history.暂无履历记录')" />
      <a-timeline v-else>
        <a-timeline-item
          v-for="item in list"
          :key="item.id"
          dot-color="var(--color-primary-6)"
        >
          <template #dot>
            <icon-idcard v-if="item.eventType === 'ONBOARD'" />
            <icon-swap v-else-if="item.eventType === 'TRANSFER'" />
            <icon-up v-else-if="item.eventType === 'PROMOTION'" />
            <icon-stop v-else-if="item.eventType === 'STATUS_CHANGE' || item.eventType === 'RESIGN'" />
            <icon-edit v-else />
          </template>
          <div class="timeline-item">
            <div class="timeline-header">
              <a-tag :color="tagColor(item.eventType)" size="small">{{ eventLabel(item.eventType) }}</a-tag>
              <span class="timeline-time">{{ formatTime(item.createdAt) }}</span>
            </div>
            <div class="timeline-desc">{{ item.description }}</div>
            <div v-if="item.remark" class="timeline-remark">{{ item.remark }}</div>
          </div>
        </a-timeline-item>
      </a-timeline>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Message } from '@arco-design/web-vue'
import { getEmployeeHistory, type HrEmployeeHistory } from '@/api/hr'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{ employeeId: string }>()

const loading = ref(false)
const list = ref<HrEmployeeHistory[]>([])

onMounted(() => load())

async function load() {
  if (!props.employeeId) return
  loading.value = true
  try {
    list.value = await getEmployeeHistory(props.employeeId)
  } catch {
    Message.error(t('hr.employee-history.加载履历失败'))
    list.value = []
  } finally {
    loading.value = false
  }
}

function tagColor(type: string): string {
  const map: Record<string, string> = {
    ONBOARD: 'green',
    TRANSFER: 'blue',
    PROMOTION: 'purple',
    STATUS_CHANGE: 'orange',
    RESIGN: 'red',
    INFO_UPDATE: 'gray',
  }
  return map[type] ?? 'gray'
}

function eventLabel(type: string): string {
  const map: Record<string, string> = {
    ONBOARD: t('hr.employee-history.ONBOARD'),
    TRANSFER: t('hr.employee-history.TRANSFER'),
    PROMOTION: t('hr.employee-history.PROMOTION'),
    STATUS_CHANGE: t('hr.employee-history.STATUS_CHANGE'),
    RESIGN: t('hr.employee-history.RESIGN'),
    INFO_UPDATE: t('hr.employee-history.INFO_UPDATE'),
  }
  return map[type] ?? type
}

function formatTime(ts: string): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
</script>

<style scoped>
.history-timeline {
  padding: 16px 0;
}
.timeline-item {
  margin-bottom: 4px;
}
.timeline-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.timeline-time {
  font-size: 12px;
  color: var(--color-text-3);
}
.timeline-desc {
  font-size: 14px;
  color: var(--color-text-1);
  line-height: 1.5;
}
.timeline-remark {
  margin-top: 4px;
  font-size: 12px;
  color: var(--color-text-3);
  background: var(--color-fill-2);
  padding: 2px 8px;
  border-radius: 4px;
  display: inline-block;
}
</style>
