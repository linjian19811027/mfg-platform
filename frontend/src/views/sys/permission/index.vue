<template>
  <div class="page-container">
    <a-row :gutter="16">
      <!-- 左侧：权限树 -->
      <a-col :span="10">
        <a-card :title="$t('sys.permission.index.权限树')" :body-style="{ padding: '16px' }">
          <!-- 工具栏 -->
          <div class="toolbar">
            <a-select
              v-model="selectedModule"
              :placeholder="$t('sys.permission.index.全部模块')"
              allow-clear
              style="width: 160px"
              @change="onModuleChange"
            >
              <a-option v-for="m in modules" :key="m.key" :value="m.key">{{ m.title }}</a-option>
            </a-select>
            <a-input-search
              v-model="searchKeyword"
              :placeholder="$t('sys.permission.index.权限名称编码')"
              allow-clear
              style="flex: 1"
              @search="onSearch"
              @clear="onSearch"
              @input="onSearch"
            />
          </div>
          <div class="expand-actions">
            <a-space>
              <a-button size="small" @click="expandAll">{{ $t('sys.permission.lbl1751') }}</a-button>
              <a-button size="small" @click="collapseAll">{{ $t('sys.permission.lbl1752') }}</a-button>
            </a-space>
          </div>

          <div v-if="treeLoading" class="tree-loading">
            <a-spin />
          </div>
          <div v-else-if="filteredTree.length === 0" class="tree-empty">
            <a-empty :description="$t('sys.permission.index.暂无匹配的权限')" />
          </div>
          <a-tree
            v-else
            ref="treeRef"
            :data="filteredTree"
            v-model:expanded-keys="expandedKeys"
            :field-names="{ key: 'code', title: 'name', children: 'children' }"
            :selected-keys="selectedKeys"
            class="perm-tree"
            @select="onNodeSelect"
          >
            <template #title="nodeData">
              <span v-html="highlightTitle(nodeData.name, nodeData.code)" />
            </template>
          </a-tree>
        </a-card>
      </a-col>

      <!-- 右侧：权限详情 -->
      <a-col :span="14">
        <a-card :title="$t('sys.permission.index.权限详情')" :body-style="{ padding: '24px' }">
          <div v-if="!selectedNode" class="detail-empty">
            <a-empty :description="$t('sys.permission.index.请点击左侧权限节点查看详情')" />
          </div>
          <template v-else>
            <a-descriptions :column="1" bordered>
              <a-descriptions-item :label="$t('sys.permission.index.权限编码')">
                <a-tag color="arcoblue">{{ selectedNode.code }}</a-tag>
              </a-descriptions-item>
              <a-descriptions-item :label="$t('sys.permission.index.权限名称')">
                {{ selectedNode.name }}
              </a-descriptions-item>
              <a-descriptions-item :label="$t('sys.permission.index.所属模块')">
                <a-tag>{{ getModuleTitle(selectedNode.code) }}</a-tag>
              </a-descriptions-item>
              <a-descriptions-item :label="$t('sys.permission.index.节点类型')">
                <a-tag :color="isLeafNode(selectedNode) ? 'green' : 'orange'">
                  {{ isLeafNode(selectedNode) ? $t('sys.permission.lbl1753') : $t('sys.permission.lbl1754') }}
                </a-tag>
              </a-descriptions-item>
              <a-descriptions-item :label="$t('common.description')">
                {{ getDescription(selectedNode) }}
              </a-descriptions-item>
              <a-descriptions-item :label="$t('sys.permission.index.关联角色数量')">
                <a-spin v-if="roleCountLoading" :size="14" />
                <span v-else>
                  <a-tag color="purple">{{ $t('sys.permission.r33079', {roleCount: roleCount}) }}</a-tag>
                </span>
              </a-descriptions-item>
            </a-descriptions>

            <div v-if="associatedRoles.length > 0" class="associated-roles">
              <div class="section-title">{{ $t('sys.permission.lbl1755') }}</div>
              <a-space wrap>
                <a-tag v-for="role in associatedRoles" :key="role" color="arcoblue">{{ role }}</a-tag>
              </a-space>
            </div>
          </template>
        </a-card>
      </a-col>
    </a-row>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { ref, computed, onMounted } from 'vue'
import { roleApi, type PermissionNode } from '@/api/sys'
const { t } = useI18n()

// ---- 状态 ----
const treeLoading = ref(false)
const allTree = ref<PermissionNode[]>([])
const selectedModule = ref<string | undefined>(undefined)
const searchKeyword = ref('')
const selectedKeys = ref<string[]>([])
const selectedNode = ref<PermissionNode | null>(null)
const roleCountLoading = ref(false)
const roleCount = ref(0)
const associatedRoles = ref<string[]>([])
const treeRef = ref()
const expandedKeys = ref<string[]>([])

// ---- 收集树中所有节点 key（用于展开全部）----
function collectAllKeys(nodes: PermissionNode[]): string[] {
  const keys: string[] = []
  for (const node of nodes) {
    keys.push(node.code)
    if (node.children && node.children.length > 0) {
      keys.push(...collectAllKeys(node.children))
    }
  }
  return keys
}

// ---- 模块列表（从树数据动态生成）----
const modules = computed(() =>
  allTree.value.map(n => ({ key: n.code, title: n.name }))
)

// ---- 过滤后的树 ----
const filteredTree = computed(() => {
  let tree = allTree.value

  // 按模块筛选
  if (selectedModule.value) {
    tree = tree.filter(n => n.code === selectedModule.value)
  }

  // 按关键词搜索（前端过滤）
  const kw = searchKeyword.value.trim().toLowerCase()
  if (!kw) return tree

  function filterNode(node: PermissionNode): PermissionNode | null {
    const matched =
      node.name.toLowerCase().includes(kw) || node.code.toLowerCase().includes(kw)

    if (node.children && node.children.length > 0) {
      const filteredChildren = node.children
        .map(c => filterNode(c))
        .filter(Boolean) as PermissionNode[]

      if (filteredChildren.length > 0 || matched) {
        return { ...node, children: filteredChildren.length > 0 ? filteredChildren : node.children }
      }
      return null
    }

    return matched ? node : null
  }

  return tree.map(n => filterNode(n)).filter(Boolean) as PermissionNode[]
})

// ---- 高亮匹配文字 ----
function highlightTitle(title: string, _key: string): string {
  const kw = searchKeyword.value.trim()
  if (!kw) return title

  const escapedKw = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const reg = new RegExp(`(${escapedKw})`, 'gi')

  // 高亮 title 或 key 中匹配的部分
  const highlightedTitle = title.replace(reg, '<mark class="highlight">$1</mark>')
  return highlightedTitle
}

// ---- 模块标题 ----
function getModuleTitle(key: string): string {
  const moduleKey = key.split(':')[0]
  const module = allTree.value.find(n => n.code === moduleKey)
  return module?.name ?? moduleKey.toUpperCase()
}

// ---- 是否叶子节点 ----
function isLeafNode(node: PermissionNode): boolean {
  return !node.children || node.children.length === 0
}

// ---- 权限描述 ----
const ACTION_DESC: Record<string, string> = {
  view: t('sys.permission.lbl1756'),
  create: t('sys.permission.lbl1757'),
  edit: t('sys.permission.lbl1758'),
  delete: t('sys.permission.lbl1759'),
  approve: t('sys.permission.lbl1760'),
  manage: t('sys.permission.lbl1761')
}

function getDescription(node: PermissionNode): string {
  if (!isLeafNode(node)) {
    return `${node.name} ${t('sys.permission.r33080')}`
  }
  const action = node.code.split(':').pop() ?? ''
  return ACTION_DESC[action] ?? `${node.name} ${t('sys.permission.r33081')}`
}

// ---- 事件处理 ----
function onModuleChange() {
  selectedNode.value = null
  selectedKeys.value = []
}

function onSearch() {
  // 搜索时自动展开树
  if (searchKeyword.value.trim()) {
    expandAll()
  }
}

function expandAll() {
  if (allTree.value.length > 0) {
    expandedKeys.value = collectAllKeys(allTree.value)
  }
}

function collapseAll() {
  expandedKeys.value = []
}

function onNodeSelect(keys: string[], data: { node: PermissionNode }) {
  if (!keys.length) return
  selectedKeys.value = keys
  selectedNode.value = data.node
  loadRoleCount(data.node.code)
}

// ---- 加载关联角色数量（mock：统计哪些角色包含该权限）----
async function loadRoleCount(permKey: string) {
  roleCountLoading.value = true
  associatedRoles.value = []
  try {
    // mock：遍历角色权限数据统计
    const roleNames = [t('sys.permission.lbl1762'), t('sys.permission.lbl1763'), t('sys.permission.lbl1764'), t('sys.permission.lbl1765'), t('sys.permission.lbl1766')]
    const roleIds = ['1', '2', '3', '4', '5']
    const matched: string[] = []

    for (let i = 0; i < roleIds.length; i++) {
      const perms = await roleApi.getRolePermissions(roleIds[i])
      if (perms.includes(permKey)) {
        matched.push(roleNames[i])
      }
    }

    associatedRoles.value = matched
    roleCount.value = matched.length
  } finally {
    roleCountLoading.value = false
  }
}

// ---- 初始化 ----
onMounted(async () => {
  treeLoading.value = true
  try {
    allTree.value = await roleApi.getPermissionTree()
  } finally {
    treeLoading.value = false
  }
  // 加载完成后默认展开全部
  expandAll()
})
</script>

<style scoped>
.page-container {
  padding: 16px;
}

.toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.expand-actions {
  margin-bottom: 10px;
}

.tree-loading,
.tree-empty {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
}

.perm-tree {
  max-height: calc(100vh - 280px);
  overflow-y: auto;
  border: 1px solid var(--color-border-2);
  border-radius: 4px;
  padding: 8px;
}

.detail-empty {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
}

.associated-roles {
  margin-top: 20px;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-2);
  margin-bottom: 10px;
}
</style>

<style>
/* 全局样式：高亮搜索匹配文字 */
.highlight {
  background-color: #ffe58f;
  padding: 0 2px;
  border-radius: 2px;
  font-style: normal;
}
</style>
