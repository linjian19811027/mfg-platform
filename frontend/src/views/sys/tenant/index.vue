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
          <a-option value="trial">试用</a-option>
          <a-option value="formal">正式</a-option>
          <a-option value="expired">已过期</a-option>
          <a-option value="disabled">已停用</a-option>
        </a-select>
        <a-button type="primary" @click="handleSearch">{{ $t('common.search') }}</a-button>
        <a-button @click="resetQuery">{{ $t('common.reset') }}</a-button>
        <a-button style="margin-left: auto" type="primary" @click="openCreate">
          <template #icon><icon-plus /></template>
          新建租户
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
              {{ record.expireAt }} 已过期
            </a-tag>
            <a-tag
              v-else-if="isExpiringSoon(record.expireAt as string)"
              color="orangered"
              size="small"
            >
              {{ record.expireAt }} 即将到期
            </a-tag>
            <span v-else>{{ record.expireAt }}</span>
          </template>
        </template>

        <template #action="{ record }">
          <a-space>
            <a-button type="text" size="small" @click="openEdit(record as unknown as Tenant)">编辑</a-button>
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
                停用
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
                启用
              </a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </MTable>
    </a-card>

    <!-- 新建/编辑抽屉 -->
    <a-drawer
      v-model:visible="drawerVisible"
      :title="editingTenant ? '编辑租户' : '新建租户'"
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
          :rules="[{ required: true, message: '请输入租户名称' }]"
          validate-trigger="blur"
        >
          <a-input v-model="formData.name" :placeholder="$t('sys.tenant.index.请输入租户名称')" />
        </a-form-item>

        <a-form-item
          field="code"
          :label="$t('sys.tenant.index.租户编码')"
          :rules="[{ required: true, message: '请输入租户编码' }]"
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
          :rules="[{ required: true, message: '请输入联系人' }]"
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

        <a-form-item field="status" :label="$t('common.status')">
          <a-select v-model="formData.status">
            <a-option value="trial">试用</a-option>
            <a-option value="formal">正式</a-option>
            <a-option value="expired">已过期</a-option>
            <a-option value="disabled">已停用</a-option>
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
import { tenantApi, type Tenant, type TenantStatus, type TenantFormData } from '@/api/sys'

// ---- 状态映射 ----
const STATUS_COLOR: Record<TenantStatus, string> = {
  formal: 'green',
  trial: 'arcoblue',
  expired: 'red',
  disabled: 'gray',
}

const STATUS_LABEL: Record<TenantStatus, string> = {
  formal: '正式',
  trial: '试用',
  expired: '已过期',
  disabled: '已停用',
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
  { key: 'action', title: t('sys.tenant.index.操作'), width: 140, slotName: 'action' },
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

const formData = reactive<TenantFormData>({
  name: '',
  code: '',
  contact: '',
  phone: '',
  email: '',
  expireAt: '',
  status: 'trial',
  remark: '',
})

function openCreate() {
  editingTenant.value = null
  Object.assign(formData, {
    name: '', code: '', contact: '', phone: '',
    email: '', expireAt: '', status: 'trial', remark: '',
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
    const payload: TenantFormData = { ...formData }
    if (!payload.expireAt) delete payload.expireAt
    if (editingTenant.value) {
      await tenantApi.updateTenant(editingTenant.value.id, payload)
      Message.success('保存成功')
    } else {
      await tenantApi.createTenant(payload)
      Message.success('创建成功')
    }
    drawerVisible.value = false
    loadData()
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
    Message.success(status === 'disabled' ? '已停用' : '已启用')
    loadData()
  } finally {
    toggleLoadingId.value = null
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
