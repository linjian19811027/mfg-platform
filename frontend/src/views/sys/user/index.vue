<template>
  <div class="page-container">
    <a-card>
      <!-- 搜索栏 -->
      <div class="search-bar">
        <a-input
          v-model="query.username"
          :placeholder="$t('sys.user.username')"
          allow-clear
          style="width: 150px"
          @press-enter="handleSearch"
        />
        <a-input
          v-model="query.realName"
          :placeholder="$t('sys.user.realName')"
          allow-clear
          style="width: 150px"
          @press-enter="handleSearch"
        />
        <a-select
          v-model="query.status"
          :placeholder="$t('common.status')"
          allow-clear
          style="width: 120px"
        >
          <a-option value="ACTIVE">{{ $t('sys.user.status.active') }}</a-option>
          <a-option value="DISABLED">{{ $t('sys.user.status.disabled') }}</a-option>
        </a-select>
        <a-button type="primary" @click="handleSearch">{{ $t('common.search') }}</a-button>
        <a-button @click="resetQuery">{{ $t('common.reset') }}</a-button>
        <a-button style="margin-left: auto" type="primary" @click="openCreate">{{ $t('common.add') }}</a-button>
      </div>

      <MTable
        :columns="columns"
        :data="list as any[]"
        :loading="loading"
        :total="total"
        @change="onTableChange"
      >
        <template #status="{ record }">
          <a-tag :color="record.status === 'active' ? 'green' : 'red'">
            {{ record.status === 'active' ? $t('sys.user.status.active') : $t('sys.user.status.disabled') }}
          </a-tag>
        </template>
        <template #roles="{ record }">
          <a-space wrap>
            <a-tag
              v-for="roleId in (record.roles as string[])"
              :key="roleId"
              color="arcoblue"
              size="small"
            >
              {{ getRoleName(roleId) }}
            </a-tag>
            <span v-if="!(record.roles as string[])?.length" style="color: var(--color-text-3)">—</span>
          </a-space>
        </template>
        <template #action="{ record }">
          <a-space>
            <a-button type="text" size="small" @click="openEdit(record as unknown as SysUser)">{{ $t('common.edit') }}</a-button>
            <a-popconfirm
              :content="record.status === 'active' ? $t('common.confirmMsg') : $t('common.confirmMsg')"
              @ok="toggleStatus(record as unknown as SysUser)"
            >
              <a-button
                type="text"
                size="small"
                :status="record.status === 'active' ? 'danger' : 'normal'"
                :loading="toggleLoadingId === record.id"
              >
                {{ record.status === 'active' ? $t('sys.user.status.disabled') : $t('sys.user.status.active') }}
              </a-button>
            </a-popconfirm>
            <a-popconfirm :content="$t('sys.user.msg.pwdReset')" @ok="resetPassword(record as unknown as SysUser)">
              <a-button type="text" size="small" :loading="resetLoadingId === record.id">{{ $t('common.reset') + $t('sys.user.password') }}</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </MTable>
    </a-card>

    <!-- 新建/编辑抽屉 -->
    <a-drawer
      v-model:visible="drawerVisible"
      :title="editingUser ? $t('common.edit') : $t('common.add')"
      :width="520"
      @cancel="drawerVisible = false"
    >
      <MForm
        :schema="formSchema"
        v-model="formData"
        :loading="submitting"
        @submit="handleSubmit"
        @cancel="drawerVisible = false"
      >
        <template #passwordSlot="{ value, update }">
          <a-input-password
            :model-value="value as string"
            :placeholder="editingUser ? $t('sys.user.placeholder.pwd') : $t('sys.user.placeholder.inputPwd')"
            allow-clear
            @update:model-value="update($event)"
          />
        </template>
        <template #rolesSlot="{ value, update }">
          <a-checkbox-group
            :model-value="value as string[]"
            @update:model-value="update($event)"
          >
            <a-checkbox v-for="role in roleList" :key="role.id" :value="role.id">
              {{ role.name }}
            </a-checkbox>
          </a-checkbox-group>
        </template>
      </MForm>
    </a-drawer>

    <!-- 重置密码结果弹窗 -->
    <a-modal
      v-model:visible="tempPwdVisible"
      :title="$t('sys.user.msg.pwdResetSuccess')"
      :footer="false"
      :width="360"
    >
      <div style="text-align: center; padding: 16px 0">
        <p style="margin-bottom: 8px; color: var(--color-text-2)">{{ $t('sys.user.msg.tempPwd') }}</p>
        <a-typography-text copyable code style="font-size: 18px">{{ tempPassword }}</a-typography-text>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Message } from '@arco-design/web-vue'
import MTable from '@/components/MTable/index.vue'
import MForm from '@/components/MForm/index.vue'
import type { MTableColumn } from '@/components/MTable/index.vue'
import type { MFormField } from '@/components/MForm/index.vue'
import { sysApi, type SysUser, type SysRole } from '@/api/sys'

const { t } = useI18n()

// ---- 角色列表 ----
const roleList = ref<SysRole[]>([])
const orgList = ref<{ id: string; name: string }[]>([])

function getRoleName(roleId: string) {
  return roleList.value.find(r => r.id === roleId)?.name ?? roleId
}

// ---- 列定义 ----
const columns = computed<MTableColumn[]>(() => [
  { key: 'username', title: t('sys.user.username'), width: 120 },
  { key: 'realName', title: t('sys.user.realName'), width: 100 },
  { key: 'email', title: t('sys.user.email'), width: 180 },
  { key: 'phone', title: t('sys.user.phone'), width: 130 },
  { key: 'roles', title: t('sys.user.role'), slotName: 'roles' },
  { key: 'status', title: t('common.status'), width: 80, slotName: 'status' },
  { key: 'createdAt', title: t('common.name'), width: 160 }, // Using common.name for now or adding createdAt
  { key: 'action', title: t('common.operation'), width: 200, slotName: 'action' },
])

// ---- 表单 schema ----
const formSchema = computed<MFormField[]>(() => [
  { field: 'username', label: t('sys.user.username'), type: 'input', required: true, placeholder: t('sys.user.username'), disabled: !!editingUser.value },
  { field: 'realName', label: t('sys.user.realName'), type: 'input', required: true, placeholder: t('sys.user.realName') },
  { field: 'email', label: t('sys.user.email'), type: 'input', placeholder: t('sys.user.email'), rules: [{ type: 'email', message: t('sys.user.msg.emailInvalid') }] },
  { field: 'phone', label: t('sys.user.phone'), type: 'input', placeholder: t('sys.user.phone') },
  {
    field: 'password',
    label: t('sys.user.password'),
    type: 'slot',
    slotName: 'passwordSlot',
    required: !editingUser.value,
  },
  {
    field: 'orgId',
    label: t('sys.user.org'),
    type: 'select',
    placeholder: t('sys.user.org'),
    options: orgList.value.map(o => ({ label: o.name, value: o.id })),
  },
  {
    field: 'roles',
    label: t('sys.user.role'),
    type: 'slot',
    slotName: 'rolesSlot',
  },
])

// ---- 列表状态 ----
const query = reactive({ username: '', realName: '', status: '' })
const list = ref<SysUser[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const pageSize = ref(20)

// ---- 抽屉状态 ----
const drawerVisible = ref(false)
const editingUser = ref<SysUser | null>(null)
const formData = ref<Record<string, unknown>>({})
const submitting = ref(false)

// ---- 操作 loading ----
const toggleLoadingId = ref<string | null>(null)
const resetLoadingId = ref<string | null>(null)

// ---- 临时密码弹窗 ----
const tempPwdVisible = ref(false)
const tempPassword = ref('')

// ---- 数据加载 ----
async function loadData() {
  loading.value = true
  try {
    const res = await sysApi.getUsers({
      ...query,
      page: page.value,
      pageSize: pageSize.value,
    })
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
  query.username = ''
  query.realName = ''
  query.status = ''
  page.value = 1
  loadData()
}

function onTableChange(e: { page: number; pageSize: number }) {
  page.value = e.page
  pageSize.value = e.pageSize
  loadData()
}

// ---- 新建/编辑 ----
function openCreate() {
  editingUser.value = null
  formData.value = { roles: [] }
  drawerVisible.value = true
}

function openEdit(user: SysUser) {
  editingUser.value = user
  formData.value = {
    username: user.username,
    realName: user.realName,
    email: user.email ?? '',
    phone: user.phone ?? '',
    orgId: user.orgId ?? '',
    roles: user.roles ? [...user.roles] : [],
    password: '',
  }
  drawerVisible.value = true
}

async function handleSubmit(data: Record<string, unknown>) {
  submitting.value = true
  try {
    const payload = { ...data }
    // 编辑时密码为空则不传
    if (editingUser.value && !payload.password) delete payload.password

    if (editingUser.value) {
      await sysApi.updateUser(editingUser.value.id, payload)
      Message.success(t('common.success'))
    } else {
      await sysApi.createUser(payload)
      Message.success(t('common.success'))
    }
    drawerVisible.value = false
    loadData()
  } catch {
    Message.error(t('common.error') || t('sys.user.r33084'))
  } finally {
    submitting.value = false
  }
}

// ---- 启用/禁用 ----
async function toggleStatus(user: SysUser) {
  toggleLoadingId.value = user.id
  try {
    const newStatus = user.status === 'active' ? 'disabled' : 'active'
    await sysApi.toggleUserStatus(user.id, newStatus)
    Message.success(t('common.success'))
    loadData()
  } catch {
    Message.error(t('common.error') || t('sys.user.r33085'))
  } finally {
    toggleLoadingId.value = null
  }
}

// ---- 重置密码 ----
async function resetPassword(user: SysUser) {
  resetLoadingId.value = user.id
  try {
    const res = await sysApi.resetPassword(user.id)
    tempPassword.value = res.tempPassword
    tempPwdVisible.value = true
  } catch {
    Message.error(t('common.error') || t('sys.user.r33086'))
  } finally {
    resetLoadingId.value = null
  }
}

// ---- 初始化 ----
onMounted(async () => {
  const [roles, orgs] = await Promise.all([sysApi.getRoles(), sysApi.getOrgs()])
  roleList.value = roles
  orgList.value = orgs
  loadData()
})
</script>

<style scoped>
.page-container { padding: 16px; }
.search-bar { display: flex; gap: 8px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
</style>
