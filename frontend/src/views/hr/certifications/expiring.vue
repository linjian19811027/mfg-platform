<template>
  <div class="page-container">
    <!-- 顶部统计卡片 -->
    <a-row :gutter="16" style="margin-bottom: 16px">
      <a-col :span="6">
        <a-card :bordered="false" :loading="alertLoading">
          <a-statistic
            :title="$t('hr.certifications.expiring.即将到期30天内')"
            :value="alertData.expiringSoonCount"
            :value-style="{ color: '#ff7d00' }"
          >
            <template #suffix>
              <icon-clock-circle style="color: #ff7d00" />
            </template>
          </a-statistic>
        </a-card>
      </a-col>
      <a-col :span="6">
        <a-card :bordered="false" :loading="alertLoading">
          <a-statistic
            :title="$t('hr.certifications.expiring.已过期')"
            :value="alertData.expiredCount"
            :value-style="{ color: '#f53f3f' }"
          >
            <template #suffix>
              <icon-close-circle style="color: #f53f3f" />
            </template>
          </a-statistic>
        </a-card>
      </a-col>
    </a-row>

    <a-card :bordered="false">
      <!-- 操作栏 -->
      <div class="action-bar">
        <a-button @click="handleExport" :loading="exportLoading">
          <template #icon><icon-download /></template>
          {{ $t('hr.certifications.exportList') }}
        </a-button>
      </div>

      <!-- Tab 切换 -->
      <a-tabs v-model:active-key="activeTab" @change="handleTabChange">
        <!-- 即将到期 -->
        <a-tab-pane key="expiring" :title="$t('hr.certifications.expiring.即将到期')">
          <a-table
            :columns="expiringColumns"
            :data="expiringList"
            :loading="loading"
            :pagination="expiringPagination"
            @page-change="(p: any) => handlePageChange(p, 'expiring')"
            row-key="id"
          >
            <template #daysLeft="{ record }">
              <a-tag color="orange">{{ $t('hr.certifications.days', {daysLeft: record.daysLeft}) }}</a-tag>
            </template>
            <template #action="{ record }">
              <a-button type="text" size="small" @click="handleRenew(record)">{{ $t('hr.certifications.lbl1265') }}</a-button>
            </template>
          </a-table>
        </a-tab-pane>

        <!-- 已过期 -->
        <a-tab-pane key="expired" :title="$t('hr.certifications.expiring.已过期')">
          <a-table
            :columns="expiredColumns"
            :data="expiredList"
            :loading="loading"
            :pagination="expiredPagination"
            @page-change="(p: any) => handlePageChange(p, 'expired')"
            row-key="id"
          >
            <template #expireDate="{ record }">
              <a-tag color="red">{{ record.expireDate }}</a-tag>
            </template>
            <template #action="{ record }">
              <a-button type="text" size="small" @click="handleRenew(record)">{{ $t('hr.certifications.lbl1266') }}</a-button>
            </template>
          </a-table>
        </a-tab-pane>
      </a-tabs>
    </a-card>

    <!-- 续期弹窗 -->
    <a-modal
      v-model:visible="renewModalVisible"
      :title="$t('hr.certifications.expiring.续期认证')"
      :ok-loading="renewLoading"
      @ok="handleRenewSubmit"
      @cancel="renewModalVisible = false"
    >
      <a-descriptions :column="1" style="margin-bottom: 16px">
        <a-descriptions-item :label="$t('hr.certifications.expiring.员工')">{{ renewTarget.empName }}（{{ renewTarget.empNo }}）</a-descriptions-item>
        <a-descriptions-item :label="$t('hr.certifications.expiring.认证类型')">{{ renewTarget.certTypeName }}</a-descriptions-item>
        <a-descriptions-item :label="$t('hr.certifications.expiring.当前有效期')">{{ renewTarget.expireDate }}</a-descriptions-item>
      </a-descriptions>
      <a-form :model="renewForm" layout="vertical">
        <a-form-item :label="$t('hr.certifications.expiring.新有效期至')" required>
          <a-date-picker v-model="renewForm.newExpireDate" style="width: 100%" />
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
import { IconDownload, IconClockCircle, IconCloseCircle } from '@arco-design/web-vue/es/icon'
import { getExpiringCertifications, exportCertifications, renewCertification } from '@/api/hr'

const activeTab = ref('expiring')
const alertLoading = ref(false)
const loading = ref(false)
const exportLoading = ref(false)

const alertData = reactive({ expiringSoonCount: 0, expiredCount: 0 })

const expiringList = ref([])
const expiredList = ref([])

const expiringPagination = reactive({ current: 1, pageSize: 20, total: 0, showTotal: true })
const expiredPagination = reactive({ current: 1, pageSize: 20, total: 0, showTotal: true })

const expiringColumns = [
  { title: t('hr.certifications.expiring.员工工号'), dataIndex: 'empNo', width: 120 },
  { title: t('hr.certifications.expiring.员工姓名'), dataIndex: 'empName', width: 100 },
  { title: t('hr.certifications.expiring.认证类型'), dataIndex: 'certTypeName', width: 150 },
  { title: t('hr.certifications.expiring.证书编号'), dataIndex: 'certNo', width: 150 },
  { title: t('hr.certifications.expiring.有效期至'), dataIndex: 'expireDate', width: 120 },
  { title: t('hr.certifications.expiring.剩余天数'), dataIndex: 'daysLeft', slotName: 'daysLeft', width: 100 },
  { title: t('hr.certifications.expiring.操作'), slotName: 'action', width: 100, fixed: 'right' },
]

const expiredColumns = [
  { title: t('hr.certifications.expiring.员工工号'), dataIndex: 'empNo', width: 120 },
  { title: t('hr.certifications.expiring.员工姓名'), dataIndex: 'empName', width: 100 },
  { title: t('hr.certifications.expiring.认证类型'), dataIndex: 'certTypeName', width: 150 },
  { title: t('hr.certifications.expiring.证书编号'), dataIndex: 'certNo', width: 150 },
  { title: t('hr.certifications.expiring.过期日期'), dataIndex: 'expireDate', slotName: 'expireDate', width: 120 },
  { title: t('hr.certifications.expiring.操作'), slotName: 'action', width: 100, fixed: 'right' },
]

const renewModalVisible = ref(false)
const renewLoading = ref(false)
const renewTarget = reactive<any>({})
const renewForm = reactive({ newExpireDate: '' })

onMounted(() => {
  fetchAlert()
  fetchList()
})

async function fetchAlert() {
  alertLoading.value = true
  try {
    const res = await getExpiringCertifications({})
    alertData.expiringSoonCount = (res as any).expiringSoonCount ?? 0
    alertData.expiredCount = (res as any).expiredCount ?? 0
  } catch (e: any) {
    Message.error(e.message || t('hr.certifications.expiring.加载统计失败'))
  } finally {
    alertLoading.value = false
  }
}

async function fetchList() {
  loading.value = true
  try {
    if (activeTab.value === 'expiring') {
      const res = await getExpiringCertifications({
        page: expiringPagination.current,
        pageSize: expiringPagination.pageSize,
      })
      expiringList.value = (res as any).list ?? (res as any).items ?? []
      expiringPagination.total = (res as any).total ?? 0
    } else {
      const res = await getExpiringCertifications({
        page: expiredPagination.current,
        pageSize: expiredPagination.pageSize,
      })
      expiredList.value = (res as any).list ?? (res as any).items ?? []
      expiredPagination.total = (res as any).total ?? 0
    }
  } catch (e: any) {
    Message.error(e.message || t('hr.certifications.expiring.加载失败'))
  } finally {
    loading.value = false
  }
}

function handleTabChange() {
  fetchList()
}

function handlePageChange(page: number, tab: string) {
  if (tab === 'expiring') expiringPagination.current = page
  else expiredPagination.current = page
  fetchList()
}

function handleRenew(record: any) {
  Object.assign(renewTarget, record)
  renewForm.newExpireDate = ''
  renewModalVisible.value = true
}

async function handleRenewSubmit() {
  if (!renewForm.newExpireDate) {
    Message.warning(t('hr.certifications.expiring.请选择新有效期'))
    return
  }
  renewLoading.value = true
  try {
    await renewCertification(renewTarget.id, { expireDate: renewForm.newExpireDate })
    Message.success(t('hr.certifications.expiring.续期成功'))
    renewModalVisible.value = false
    fetchAlert()
    fetchList()
  } catch (e: any) {
    Message.error(e.message || t('hr.certifications.expiring.续期失败'))
  } finally {
    renewLoading.value = false
  }
}

async function handleExport() {
  exportLoading.value = true
  try {
    const res = await exportCertifications(activeTab.value === 'expiring' ? { expiringSoon: 1 } : { expired: 1 })
    const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${t('hr.certifications.certExpiringList')}_${new Date().getTime()}.xlsx`
    a.click()
    window.URL.revokeObjectURL(url)
    Message.success(t('hr.certifications.expiring.导出成功'))
  } catch (e: any) {
    Message.error(e.message || t('hr.certifications.expiring.导出失败'))
  } finally {
    exportLoading.value = false
  }
}
</script>

<style scoped>
.page-container { padding: 16px; }
.action-bar { margin-bottom: 16px; }
</style>
