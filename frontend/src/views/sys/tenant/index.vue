<template>
  <div class="page-container">
    <a-card>
      <!-- 搜索栏 -->
      <div class="search-bar">
        <a-input
          v-model="query.name"
          :placeholder="$t('sys.tenant.index.租户名称编码')"
          allow-clear
          style="width: 200px"
          @press-enter="handleSearch"
        />
        <a-select
          v-model="query.status"
          :placeholder="$t('common.status')"
          allow-clear
          style="width: 140px"
        >
          <a-option value="trial">{{ $t('sys.tenant.lbl1783') }}</a-option>
          <a-option value="formal">{{ $t('sys.tenant.lbl1784') }}</a-option>
          <a-option value="expired">{{ $t('sys.tenant.expired') }}</a-option>
          <a-option value="disabled">{{ $t('sys.tenant.lbl1785') }}</a-option>
        </a-select>
        <a-button type="primary" @click="handleSearch">{{ $t('common.search') }}</a-button>
        <a-button @click="resetQuery">{{ $t('common.reset') }}</a-button>
        <a-button style="margin-left: auto" type="primary" @click="openCreate">
          <template #icon><icon-plus /></template>
          {{ $t('sys.tenant.createTenant') }}
        </a-button>
      </div>

      <MTable
        :columns="columns"
        :data="list as any[]"
        :loading="loading"
        :total="total"
        @change="onTableChange"
      >
        <template #status="{ record }">
          <a-tag :color="statusColor(record.status as TenantStatus)" size="small">
            {{ statusLabel(record.status as TenantStatus) }}
          </a-tag>
        </template>

        <template #expireAt="{ record }">
          <span v-if="!record.expireAt" style="color: var(--color-text-3)">—</span>
          <template v-else>
            <a-tag
              v-if="isExpired(record.expireAt as string)"
              color="red"
              size="small"
            >
              {{ $t('sys.tenant.r33082', {expireAt: record.expireAt}) }}
            </a-tag>
            <a-tag
              v-else-if="isExpiringSoon(record.expireAt as string)"
              color="orangered"
              size="small"
            >
              {{ $t('sys.tenant.r33083', {expireAt: record.expireAt}) }}
            </a-tag>
            <span v-else>{{ record.expireAt }}</span>
          </template>
        </template>

        <template #action="{ record }">
          <a-space>
            <a-button type="text" size="small" @click="handleEnterTenant(record as unknown as Tenant)">进入</a-button>
            <a-button type="text" size="small" @click="openEdit(record as unknown as Tenant)">{{ $t('sys.tenant.edit') }}</a-button>
            <a-popconfirm
              v-if="record.status !== 'disabled'"
              :content="$t('sys.tenant.index.确认停用该租户停用后租户将无法')"
              @ok="handleToggleStatus(record as unknown as Tenant, 'disabled')"
            >
              <a-button
                type="text"
                size="small"
                status="danger"
                :loading="toggleLoadingId === record.id"
              >
                {{ $t('sys.tenant.disable') }}
              </a-button>
            </a-popconfirm>
            <a-popconfirm
              v-else
              :content="$t('sys.tenant.index.确认启用该租户')"
              @ok="handleToggleStatus(record as unknown as Tenant, 'formal')"
            >
              <a-button
                type="text"
                size="small"
                status="success"
                :loading="toggleLoadingId === record.id"
              >
                {{ $t('sys.tenant.enable') }}
              </a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </MTable>
    </a-card>

    <!-- 新建/编辑抽屉 -->
    <a-drawer
      v-model:visible="drawerVisible"
      ::title="t('sys.tenant.lbl1786')"
      :width="520"
      @cancel="drawerVisible = false"
    >
      <a-form
        ref="formRef"
        :model="formData"
        layout="vertical"
        @submit="handleSubmit"
      >
        <a-form-item
          field="name"
          :label="$t('sys.tenant.index.租户名称')"
          :rules="[{ required: true, message: t('sys.tenant.input') }]"
          validate-trigger="blur"
        >
          <a-input v-model="formData.name" :placeholder="$t('sys.tenant.index.请输入租户名称')" />
        </a-form-item>

        <a-form-item
          field="code"
          :label="$t('sys.tenant.index.租户编码')"
          :rules="[{ required: true, message: t('sys.tenant.input2') }]"
          validate-trigger="blur"
        >
          <a-input
            v-model="formData.code"
            :placeholder="$t('sys.tenant.index.请输入租户编码唯一标识')"
            :disabled="!!editingTenant"
          />
        </a-form-item>

        <a-form-item
          field="contact"
          :label="$t('sys.tenant.index.联系人')"
          :rules="[{ required: true, message: t('sys.tenant.input3') }]"
          validate-trigger="blur"
        >
          <a-input v-model="formData.contact" :placeholder="$t('sys.tenant.index.请输入联系人姓名')" />
        </a-form-item>

        <a-form-item field="phone" :label="$t('sys.tenant.index.联系电话')">
          <a-input v-model="formData.phone" :placeholder="$t('sys.tenant.index.请输入联系电话')" />
        </a-form-item>

        <a-form-item field="email" :label="$t('sys.tenant.index.邮箱')">
          <a-input v-model="formData.email" :placeholder="$t('sys.tenant.index.请输入邮箱地址')" />
        </a-form-item>

        <a-form-item field="expireAt" :label="$t('sys.tenant.index.到期时间')">
          <a-date-picker
            v-model="formData.expireAt"
            :placeholder="$t('sys.tenant.index.请选择到期时间')"
            style="width: 100%"
            value-format="YYYY-MM-DD"
          />
        </a-form-item>

        <a-form-item field="plan" label="套餐">
          <a-select v-model="formData.plan" @change="onPlanChange">
            <a-option value="BASIC">基础版（MES + WMS）</a-option>
            <a-option value="STANDARD">标准版（+ PLM + QMS + HR）</a-option>
            <a-option value="PROFESSIONAL">专业版（+ SCM + ERP + APS）</a-option>
            <a-option value="ENTERPRISE">旗舰版（全部模块）</a-option>
          </a-select>
        </a-form-item>

        <a-form-item label="启用模块">
          <a-checkbox-group v-model="formData.enabledModules" :options="moduleOptions" />

        </a-form-item>

        <a-form-item field="status" :label="$t('common.status')">
          <a-select v-model="formData.status">
            <a-option value="trial">{{ $t('sys.tenant.lbl1787') }}</a-option>
            <a-option value="formal">{{ $t('sys.tenant.lbl1788') }}</a-option>
            <a-option value="expired">{{ $t('sys.tenant.expired') }}</a-option>
            <a-option value="disabled">{{ $t('sys.tenant.lbl1789') }}</a-option>
          </a-select>
        </a-form-item>

        <a-form-item field="remark" :label="$t('common.remark')">
          <a-textarea
            v-model="formData.remark"
            :placeholder="$t('sys.tenant.index.可选备注')"
            :max-length="300"
            show-word-limit
            :auto-size="{ minRows: 2, maxRows: 4 }"
          />
        </a-form-item>

        <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px">
          <a-button @click="drawerVisible = false">{{ $t('common.cancel') }}</a-button>
          <a-button type="primary" html-type="submit" :loading="submitting">{{ $t('common.save') }}</a-button>
        </div>
      </a-form>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
import { useI18n } from 'vue-i18n'
import { ref, reactive, onMounted } from 'vue'
import { Message } from '@arco-design/web-vue'
import MTable from '@/components/MTable/index.vue'
import type { MTableColumn } from '@/components/MTable/index.vue'
import { tenantApi, type Tenant, type TenantStatus } from '@/api/sys'

// ---- 状态映射 ----
const STATUS_COLOR: Record<TenantStatus, string> = {
  formal: 'green',
  trial: 'arcoblue',
  expired: 'red',
  disabled: 'gray',
}

const STATUS_LABEL: Record<TenantStatus, string> = {
  formal: t('sys.tenant.lbl1790'),
  trial: t('sys.tenant.lbl1791'),
  expired: t('sys.tenant.expired'),
  disabled: t('sys.tenant.lbl1792')
}

function statusColor(s: TenantStatus) { return STATUS_COLOR[s] ?? 'gray' }
function statusLabel(s: TenantStatus) { return STATUS_LABEL[s] ?? s }

function isExpired(dateStr: string): boolean {
  return new Date(dateStr) < new Date()
}

function isExpiringSoon(dateStr: string): boolean {
  const diff = new Date(dateStr).getTime() - Date.now()
  return diff >= 0 && diff <= 30 * 24 * 60 * 60 * 1000
}

// ---- 列定义 ----
const columns: MTableColumn[] = [
  { key: 'name', title: t('sys.tenant.index.租户名称'), width: 160 },
  { key: 'code', title: t('sys.tenant.index.租户编码'), width: 120 },
  { key: 'contact', title: t('sys.tenant.index.联系人'), width: 100 },
  { key: 'phone', title: t('sys.tenant.index.联系电话'), width: 130 },
  { key: 'email', title: t('sys.tenant.index.邮箱'), ellipsis: true },
  { key: 'expireAt', title: t('sys.tenant.index.到期时间'), width: 200, slotName: 'expireAt' },
  { key: 'status', title: t('sys.tenant.index.状态'), width: 90, slotName: 'status' },
  { key: 'createdAt', title: t('sys.tenant.index.创建时间'), width: 160 },
  { key: 'action', title: t('sys.tenant.index.操作'), width: 200, slotName: 'action' },
]

// ---- 列表状态 ----
const query = reactive({ name: '', status: '' })
const list = ref<Tenant[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const pageSize = ref(20)

async function loadData() {
  loading.value = true
  try {
    const params: Record<string, unknown> = { page: page.value, pageSize: pageSize.value }
    if (query.name) params.name = query.name
    if (query.status) params.status = query.status
    const res = await tenantApi.getTenants(params as Parameters<typeof tenantApi.getTenants>[0])
    list.value = res.list
    total.value = res.total
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  page.value = 1
  loadData()
}

function resetQuery() {
  query.name = ''
  query.status = ''
  page.value = 1
  loadData()
}

function onTableChange(e: { page: number; pageSize: number }) {
  page.value = e.page
  pageSize.value = e.pageSize
  loadData()
}

// ---- 新建/编辑抽屉 ----
const drawerVisible = ref(false)
const editingTenant = ref<Tenant | null>(null)
const formRef = ref()
const submitting = ref(false)

const moduleOptions = [
  { label: 'PLM 产品管理', value: 'PLM' },
  { label: 'MES 生产执行', value: 'MES' },
  { label: 'WMS 仓储管理', value: 'WMS' },
  { label: 'QMS 质量管理', value: 'QMS' },
  { label: 'SCM 供应链', value: 'SCM' },
  { label: 'ERP 财务', value: 'ERP' },
  { label: 'APS 排程', value: 'APS' },
  { label: 'EAM 设备', value: 'EAM' },
  { label: 'HR 人力', value: 'HR' },
]

const PLAN_MODULES: Record<string, string[]> = {
  BASIC: ['MES', 'WMS'],
  STANDARD: ['MES', 'WMS', 'PLM', 'QMS', 'HR'],
  PROFESSIONAL: ['MES', 'WMS', 'PLM', 'QMS', 'HR', 'SCM', 'ERP', 'APS'],
  ENTERPRISE: ['PLM', 'MES', 'WMS', 'QMS', 'SCM', 'ERP', 'APS', 'EAM', 'HR'],
}

function onPlanChange(plan: string) {
  formData.enabledModules = PLAN_MODULES[plan] ?? []
}

const formData = reactive({
  name: '',
  code: '',
  contact: '',
  phone: '',
  email: '',
  expireAt: '',
  plan: 'STANDARD',
  enabledModules: ['MES', 'WMS', 'PLM', 'QMS', 'HR'] as string[],
  status: 'trial',
  remark: '',
})

function openCreate() {
  editingTenant.value = null
  Object.assign(formData, {
    name: '', code: '', contact: '', phone: '',
    email: '', expireAt: '', plan: 'STANDARD',
    enabledModules: ['MES', 'WMS', 'PLM', 'QMS', 'HR'],
    status: 'trial', remark: '',
  })
  drawerVisible.value = true
}

function openEdit(tenant: Tenant) {
  editingTenant.value = tenant
  Object.assign(formData, {
    name: tenant.name,
    code: tenant.code,
    contact: tenant.contact,
    phone: tenant.phone ?? '',
    email: tenant.email ?? '',
    expireAt: tenant.expireAt ?? '',
    status: tenant.status,
    remark: tenant.remark ?? '',
  })
  drawerVisible.value = true
}

async function handleSubmit() {
  const valid = await formRef.value?.validate()
  if (valid) return
  submitting.value = true
  try {
    const payload: Record<string, unknown> = { ...formData }
    if (!payload.expireAt) delete payload.expireAt
    if (editingTenant.value) {
      await tenantApi.updateTenant(editingTenant.value.id, payload as any)
      Message.success(t('sys.保存成功'))
    } else {
      await tenantApi.createTenant(payload as any)
      Message.success(t('sys.创建成功'))
    }
    drawerVisible.value = false
    loadData()
  } catch {
    Message.error(t('sys.保存失败'))
  } finally {
    submitting.value = false
  }
}

// ---- 状态切换 ----
const toggleLoadingId = ref<string | null>(null)

async function handleToggleStatus(tenant: Tenant, status: TenantStatus) {
  toggleLoadingId.value = tenant.id
  try {
    await tenantApi.toggleTenantStatus(tenant.id, status)
    Message.success(status === 'disabled' ? t('sys.已停用') : t('sys.已启用'))
    loadData()
  } catch {
    Message.error(t('sys.操作失败'))
  } finally {
    toggleLoadingId.value = null
  }
}

// ---- 进入租户 ----
async function handleEnterTenant(tenant: Tenant) {
  try {
    const { useAuthStore } = await import('@/stores/auth')
    const authStore = useAuthStore()
    await authStore.switchTenant(tenant.code)
  } catch (e: any) {
    Message.error(e.message || '切换租户失败')
  }
}

// ---- 初始化 ----
onMounted(() => {
  loadData()
})
</script>

<style scoped>
.page-container {
  padding: 16px;
}

.search-bar {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
</style>
