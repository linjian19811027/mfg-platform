<template>
  <div class="page-container">
    <a-card>
      <!-- 搜索栏 -->
      <div class="search-bar">
        <a-input
          v-model="query.name"
          :placeholder="$t('sys.role.index.角色名称')"
          allow-clear
          style="width: 200px"
          @press-enter="handleSearch"
        />
        <a-button type="primary" @click="handleSearch">{{ $t('common.search') }}</a-button>
        <a-button @click="resetQuery">{{ $t('common.reset') }}</a-button>
        <a-button style="margin-left: auto" type="primary" @click="openCreate">{{ $t('sys.role.lbl1767') }}</a-button>
      </div>

      <MTable
        :columns="columns"
        :data="list as any[]"
        :loading="loading"
        :total="total"
        @change="onTableChange"
      >
        <template #status="{ record }">
          <a-tag :color="record.status === 'active' ? 'green' : ''">
            {{ record.status === 'active' ? $t('sys.role.enable') : $t('sys.role.lbl1768') }}
          </a-tag>
        </template>
        <template #action="{ record }">
          <a-space>
            <a-button type="text" size="small" @click="openEdit(record as unknown as SysRoleDetail)">{{ $t('sys.role.edit') }}</a-button>
            <a-popconfirm
              :content="record.status === 'active' ? t('sys.role.lbl1769') : t('sys.role.lbl1770')"
              @ok="toggleStatus(record as unknown as SysRoleDetail)"
            >
              <a-button
                type="text"
                size="small"
                :status="record.status === 'active' ? 'danger' : 'normal'"
                :loading="toggleLoadingId === record.id"
              >
                {{ record.status === 'active' ? $t('sys.role.lbl1771') : $t('sys.role.enable') }}
              </a-button>
            </a-popconfirm>
            <a-popconfirm
              :content="$t('sys.role.index.确认删除该角色删除后无法恢复')"
              @ok="handleDelete(record as unknown as SysRoleDetail)"
            >
              <a-button
                type="text"
                size="small"
                status="danger"
                :loading="deleteLoadingId === record.id"
              >
                {{ $t('sys.role.delete') }}
              </a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </MTable>
    </a-card>

    <!-- 新建/编辑抽屉 -->
    <a-drawer
      v-model:visible="drawerVisible"
      ::title="t('sys.role.lbl1772')"
      :width="680"
      @cancel="drawerVisible = false"
    >
      <a-form :model="formData" layout="vertical" @submit="handleSubmit">
        <a-form-item
          field="name"
          :label="$t('sys.role.index.角色名称')"
          :rules="[{ required: true, message: t('sys.role.input') }]"
        >
          <a-input v-model="formData.name" :placeholder="$t('sys.role.index.请输入角色名称')" />
        </a-form-item>

        <a-form-item
          field="code"
          :label="$t('sys.role.index.角色编码')"
          :rules="[{ required: true, message: t('sys.role.input2') }]"
        >
          <a-input
            v-model="formData.code"
            :placeholder="$t('sys.role.index.请输入角色编码如adminop')"
            :disabled="!!editingRole"
          />
        </a-form-item>

        <a-form-item
          field="type"
          :label="$t('sys.role.index.角色类型')"
          :rules="[{ required: true, message: t('sys.role.select') }]"
        >
          <a-select v-model="formData.type">
            <a-option value="CUSTOM">{{ $t('sys.role.type.CUSTOM') }}</a-option>
            <a-option value="TENANT_ADMIN">{{ $t('sys.role.type.TENANT_ADMIN') }}</a-option>
            <a-option value="SUPER_ADMIN">{{ $t('sys.role.type.SUPER_ADMIN') }}</a-option>
          </a-select>
        </a-form-item>

        <a-form-item field="description" :label="$t('common.description')">
          <a-textarea
            v-model="formData.description"
            :placeholder="$t('sys.role.index.请输入角色描述')"
            :max-length="200"
            show-word-limit
          />
        </a-form-item>

        <a-divider orientation="left">{{ $t('sys.role.lbl1773') }}</a-divider>

        <div class="permission-actions">
          <a-space>
            <a-button size="small" @click="checkAll">{{ $t('sys.role.selectAll') }}</a-button>
            <a-button size="small" @click="uncheckAll">{{ $t('sys.role.lbl1774') }}</a-button>
            <a-button size="small" @click="expandAll">{{ $t('sys.role.lbl1775') }}</a-button>
            <a-button size="small" @click="collapseAll">{{ $t('sys.role.lbl1776') }}</a-button>
          </a-space>
        </div>

        <a-tree
          ref="permissionTreeRef"
          v-model:checked-keys="checkedPermissions"
          :data="permissionTree"
          :checkable="true"
          :default-expand-all="true"
          :field-names="{ key: 'code', title: 'name', children: 'children' }"
          class="permission-tree"
        />

        <div class="drawer-footer">
          <a-space>
            <a-button @click="drawerVisible = false">{{ $t('common.cancel') }}</a-button>
            <a-button type="primary" html-type="submit" :loading="submitting">{{ $t('common.save') }}</a-button>
          </a-space>
        </div>
      </a-form>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
import { useI18n } from 'vue-i18n'
import { ref, reactive, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { Message } from '@arco-design/web-vue'
import MTable from '@/components/MTable/index.vue'
import type { MTableColumn } from '@/components/MTable/index.vue'
import { roleApi, type SysRoleDetail, type PermissionNode } from '@/api/sys'

const authStore = useAuthStore()

// ---- 列定义 ----
const columns: MTableColumn[] = [
  { key: 'name', title: t('sys.role.index.角色名称'), width: 150 },
  { key: 'code', title: t('sys.role.index.角色编码'), width: 150 },
  { key: 'type', title: t('sys.role.index.角色类型'), width: 130 },
  { key: 'description', title: t('sys.role.index.描述') },
  { key: 'userCount', title: t('sys.role.index.用户数量'), width: 100 },
  { key: 'status', title: t('sys.role.index.状态'), width: 80, slotName: 'status' },
  { key: 'createdAt', title: t('sys.role.index.创建时间'), width: 160 },
  { key: 'action', title: t('sys.role.index.操作'), width: 220, slotName: 'action' },
]

// ---- 列表状态 ----
const query = reactive({ name: '' })
const list = ref<SysRoleDetail[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const pageSize = ref(20)

// ---- 抽屉状态 ----
const drawerVisible = ref(false)
const editingRole = ref<SysRoleDetail | null>(null)
const formData = reactive({
  name: '',
  code: '',
  type: 'CUSTOM',
  description: '',
})
const submitting = ref(false)

// ---- 权限树 ----
const permissionTree = ref<PermissionNode[]>([])
const checkedPermissions = ref<string[]>([])
const permissionTreeRef = ref()

// ---- 操作 loading ----
const toggleLoadingId = ref<string | null>(null)
const deleteLoadingId = ref<string | null>(null)

// ---- 数据加载 ----
async function loadData() {
  loading.value = true
  try {
    const res = await roleApi.getRoleList({
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
  query.name = ''
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
  editingRole.value = null
  formData.name = ''
  formData.code = ''
  formData.type = 'CUSTOM'
  formData.description = ''
  checkedPermissions.value = []
  drawerVisible.value = true
}

async function openEdit(role: SysRoleDetail) {
  editingRole.value = role
  formData.name = role.name
  formData.code = role.code
  formData.type = role.type
  formData.description = role.description ?? ''
  
  // 加载角色权限
  try {
    const permissions = await roleApi.getRolePermissions(role.id)
    checkedPermissions.value = permissions
  } catch {
    checkedPermissions.value = []
  }
  
  drawerVisible.value = true
}

async function handleSubmit() {
  if (!formData.name || !formData.code) {
    Message.warning(t('sys.请填写必填项'))
    return
  }

  submitting.value = true
  try {
    const payload = {
      name: formData.name,
      code: formData.code,
      type: formData.type,
      description: formData.description,
    }

    if (editingRole.value) {
      await roleApi.updateRole(editingRole.value.id, payload)
      await roleApi.updateRolePermissions(editingRole.value.id, checkedPermissions.value)
      Message.success(t('sys.保存成功'))
    } else {
      const res = await roleApi.createRole(payload)
      await roleApi.updateRolePermissions(res.id, checkedPermissions.value)
      Message.success(t('sys.创建成功'))
    }
    drawerVisible.value = false
    loadData()
  } catch {
    Message.error(editingRole.value ? t('sys.role.lbl1777') : t('sys.role.lbl1778'))
  } finally {
    submitting.value = false
  }
}

// ---- 删除 ----
async function handleDelete(role: SysRoleDetail) {
  deleteLoadingId.value = role.id
  try {
    await roleApi.deleteRole(role.id)
    Message.success(t('sys.删除成功'))
    loadData()
  } catch (e) {
    Message.error(t('sys.删除失败'))
  } finally {
    deleteLoadingId.value = null
  }
}

// ---- 启用/禁用 ----
async function toggleStatus(role: SysRoleDetail) {
  toggleLoadingId.value = role.id
  const newStatus = role.status === 'active' ? 'disabled' : 'active'
  try {
    await roleApi.toggleRoleStatus(role.id, newStatus)
    Message.success(newStatus === 'active' ? t('sys.role.lbl1779') : t('sys.role.lbl1780'))
    loadData()
  } catch {
    Message.error(newStatus === 'active' ? t('sys.role.lbl1781') : t('sys.role.lbl1782'))
  } finally {
    toggleLoadingId.value = null
  }
}

// ---- 权限树操作 ----
function checkAll() {
  const allKeys: string[] = []
  function collectKeys(nodes: PermissionNode[]) {
    nodes.forEach(node => {
      allKeys.push(node.code)
      if (node.children) collectKeys(node.children)
    })
  }
  collectKeys(permissionTree.value)
  checkedPermissions.value = allKeys
}

function uncheckAll() {
  checkedPermissions.value = []
}

function expandAll() {
  permissionTreeRef.value?.expandAll()
}

function collapseAll() {
  permissionTreeRef.value?.collapseAll()
}

/** 按当前用户权限过滤树节点（保留祖先节点保证树结构完整） */
function filterTreeByPermissions(nodes: PermissionNode[], perms: Set<string>): PermissionNode[] {
  const result: PermissionNode[] = []
  for (const node of nodes) {
    const matched = perms.has(node.code)
    const children = node.children ? filterTreeByPermissions(node.children, perms) : undefined
    if (matched || (children && children.length > 0)) {
      result.push({ ...node, children })
    }
  }
  return result
}

// ---- 初始化 ----
onMounted(async () => {
  try {
    permissionTree.value = await roleApi.getPermissionTree()
  } catch {
    console.warn('Failed to load permission tree')
  }
  // 非 admin 用户：将树限制到自身拥有的权限范围
  if (!authStore.roles.some(r => r === 'ADMIN' || r === 'admin' || r === 'SUPER_ADMIN')) {
    const userPerms = new Set(authStore.permissions)
    permissionTree.value = filterTreeByPermissions(permissionTree.value, userPerms)
  }
  loadData()
})
</script>

<style scoped>
.page-container { padding: 16px; }
.search-bar { display: flex; gap: 8px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }

.permission-actions {
  margin-bottom: 12px;
}

.permission-tree {
  max-height: 400px;
  overflow-y: auto;
  border: 1px solid var(--color-border-2);
  border-radius: 4px;
  padding: 12px;
}

.drawer-footer {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 16px;
  background: var(--color-bg-2);
  border-top: 1px solid var(--color-border-2);
  display: flex;
  justify-content: flex-end;
}

:deep(.arco-drawer-body) {
  padding-bottom: 72px;
}
</style>
