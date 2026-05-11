<template>
  <div class="page-container">
    <a-row :gutter="16">
      <!-- 左侧树 -->
      <a-col :span="10">
        <a-card>
          <div class="search-bar">
            <a-input-search
              v-model="searchKeyword"
              :placeholder="$t('sys.organization.index.搜索组织名称编码')"
              allow-clear
              style="flex:1"
              @search="handleSearch"
              @press-enter="handleSearch"
            />
            <a-button @click="expandAll">展开</a-button>
            <a-button @click="collapseAll">折叠</a-button>
            <a-button type="primary" @click="openCreateRoot">
              <template #icon><icon-plus /></template>
              新建顶级
            </a-button>
          </div>

          <a-spin :loading="treeLoading">
            <a-empty v-if="!treeLoading && filteredTree.length === 0" :description="$t('sys.organization.index.暂无组织数据')" />
            <a-tree
              v-else
              ref="treeRef"
              :data="filteredTree"
              :field-names="{ title: 'name', key: 'id', children: 'children' }"
              :default-expand-all="true"
              :selected-keys="selectedKeys"
              @select="handleSelect"
            >
              <template #title="nodeData">
                <div class="tree-node">
                  <div class="node-info">
                    <span class="node-name" :class="{ highlight: isHighlight(nodeData) }">
                      {{ nodeData.name }}
                    </span>
                    <span class="node-meta">{{ nodeData.code }}</span>
                    <span v-if="nodeData.manager" class="node-meta">· {{ nodeData.manager }}</span>
                  </div>
                  <div class="node-actions" @click.stop>
                    <a-tooltip :content="$t('sys.organization.index.新建子组织')">
                      <a-button type="text" size="mini" @click="openCreateChild(nodeData)">
                        <template #icon><icon-plus /></template>
                      </a-button>
                    </a-tooltip>
                    <a-tooltip :content="$t('sys.organization.index.编辑')">
                      <a-button type="text" size="mini" @click="openEdit(nodeData)">
                        <template #icon><icon-edit /></template>
                      </a-button>
                    </a-tooltip>
                    <a-popconfirm :content="$t('sys.organization.index.确认删除该组织及其所有子组织')" @ok="handleDelete(nodeData.id)">
                      <a-tooltip :content="$t('sys.organization.index.删除')">
                        <a-button type="text" size="mini" status="danger">
                          <template #icon><icon-delete /></template>
                        </a-button>
                      </a-tooltip>
                    </a-popconfirm>
                  </div>
                </div>
              </template>
            </a-tree>
          </a-spin>
        </a-card>
      </a-col>

      <!-- 右侧详情 -->
      <a-col :span="14">
        <a-card :title="selectedOrg ? '组织详情' : '请选择组织'">
          <a-empty v-if="!selectedOrg" :description="$t('sys.organization.index.点击左侧树节点查看详情')" style="margin-top:60px" />
          <template v-else>
            <a-descriptions :column="2" bordered>
              <a-descriptions-item :label="$t('sys.organization.index.组织名称')" :span="2">
                <span style="font-weight:600;font-size:15px">{{ selectedOrg.name }}</span>
              </a-descriptions-item>
              <a-descriptions-item :label="$t('sys.organization.index.组织编码')">{{ selectedOrg.code }}</a-descriptions-item>
              <a-descriptions-item :label="$t('sys.organization.index.层级')">
                <a-tag :color="levelColor(selectedOrg.level)">第 {{ selectedOrg.level }} 层</a-tag>
              </a-descriptions-item>
              <a-descriptions-item :label="$t('sys.organization.index.负责人')">{{ selectedOrg.manager || '—' }}</a-descriptions-item>
              <a-descriptions-item :label="$t('sys.organization.index.联系电话')">{{ selectedOrg.phone || '—' }}</a-descriptions-item>
              <a-descriptions-item :label="$t('sys.organization.index.上级组织')" :span="2">{{ parentName(selectedOrg.parentId) }}</a-descriptions-item>
              <a-descriptions-item :label="$t('common.description')" :span="2">{{ selectedOrg.description || '—' }}</a-descriptions-item>
            </a-descriptions>

            <div v-if="selectedOrg.children?.length" style="margin-top:20px">
              <div style="font-weight:600;margin-bottom:10px">子组织（{{ selectedOrg.children.length }}）</div>
              <a-table :columns="childColumns" :data="selectedOrg.children" :pagination="false" size="small">
                <template #action="{ record }">
                  <a-button type="text" size="small" @click="openEdit(record)">编辑</a-button>
                  <a-popconfirm :content="$t('sys.organization.index.确认删除')" @ok="handleDelete(record.id)">
                    <a-button type="text" size="small" status="danger">删除</a-button>
                  </a-popconfirm>
                </template>
              </a-table>
            </div>

            <div style="margin-top:20px;display:flex;gap:8px">
              <a-button type="primary" @click="openEdit(selectedOrg)">
                <template #icon><icon-edit /></template>编辑
              </a-button>
              <a-button @click="openCreateChild(selectedOrg)">
                <template #icon><icon-plus /></template>新建子组织
              </a-button>
              <a-popconfirm :content="$t('sys.organization.index.确认删除该组织')" @ok="handleDelete(selectedOrg.id)">
                <a-button status="danger">
                  <template #icon><icon-delete /></template>删除
                </a-button>
              </a-popconfirm>
            </div>
          </template>
        </a-card>
      </a-col>
    </a-row>

    <!-- 表单抽屉 -->
    <a-drawer
      v-model:visible="drawerVisible"
      :title="drawerTitle"
      :width="480"
      :mask-closable="false"
      @cancel="drawerVisible = false"
    >
      <a-form ref="formRef" :model="formData" layout="vertical">
        <a-form-item :label="$t('sys.organization.index.上级组织')">
          <a-input :model-value="parentLabel" disabled />
        </a-form-item>
        <a-form-item :label="$t('sys.organization.index.组织名称')" field="name" :rules="[{ required: true, message: '请输入组织名称' }]" validate-trigger="blur">
          <a-input v-model="formData.name" :placeholder="$t('sys.organization.index.请输入组织名称')" allow-clear />
        </a-form-item>
        <a-form-item :label="$t('sys.organization.index.组织编码')" field="code" :rules="[{ required: true, message: '请输入组织编码' }, { match: /^[A-Za-z0-9\-_]+$/, message: '只能包含字母、数字、横线和下划线' }]" validate-trigger="blur">
          <a-input v-model="formData.code" :placeholder="$t('sys.organization.index.如PRODW1')" allow-clear />
        </a-form-item>
        <a-form-item :label="$t('sys.organization.index.负责人')" field="manager">
          <a-input v-model="formData.manager" :placeholder="$t('sys.organization.index.请输入负责人姓名')" allow-clear />
        </a-form-item>
        <a-form-item :label="$t('sys.organization.index.联系电话')" field="phone">
          <a-input v-model="formData.phone" :placeholder="$t('sys.organization.index.请输入联系电话')" allow-clear />
        </a-form-item>
        <a-form-item :label="$t('common.description')" field="description">
          <a-textarea v-model="formData.description" :placeholder="$t('sys.organization.index.请输入描述')" :max-length="200" show-word-limit />
        </a-form-item>
      </a-form>
      <template #footer>
        <div style="display:flex;justify-content:flex-end;gap:8px">
          <a-button @click="drawerVisible = false">{{ $t('common.cancel') }}</a-button>
          <a-button type="primary" :loading="submitLoading" @click="handleSubmit">
            {{ editingId ? '保存' : '创建' }}
          </a-button>
        </div>
      </template>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
import { useI18n } from 'vue-i18n'
import { ref, computed, onMounted } from 'vue'
import { Message } from '@arco-design/web-vue'
import { orgApi, type OrgNode, type OrgFormData } from '@/api/sys'

const treeLoading = ref(false)
const submitLoading = ref(false)
const orgTree = ref<OrgNode[]>([])
const selectedKeys = ref<string[]>([])
const selectedOrg = ref<OrgNode | null>(null)
const searchKeyword = ref('')
const treeRef = ref()

const drawerVisible = ref(false)
const editingId = ref<string | null>(null)
const parentLabel = ref('无（顶级组织）')
const formRef = ref()
const formData = ref<OrgFormData>({
  name: '', code: '', parentId: null, manager: '', phone: '', description: '',
})

const drawerTitle = computed(() =>
  editingId.value ? '编辑组织' : `新建${formData.value.parentId ? '子' : '顶级'}组织`
)

function flattenTree(nodes: OrgNode[]): OrgNode[] {
  const result: OrgNode[] = []
  function walk(list: OrgNode[]) {
    for (const n of list) { result.push(n); if (n.children?.length) walk(n.children) }
  }
  walk(nodes)
  return result
}

const allNodes = computed(() => flattenTree(orgTree.value))

function parentName(parentId: string | null): string {
  if (!parentId) return '无（顶级组织）'
  return allNodes.value.find(n => n.id === parentId)?.name ?? parentId
}

const filteredTree = computed(() => {
  if (!searchKeyword.value.trim()) return orgTree.value
  return filterTree(orgTree.value, searchKeyword.value.trim())
})

function filterTree(nodes: OrgNode[], kw: string): OrgNode[] {
  const result: OrgNode[] = []
  for (const node of nodes) {
    const matched = node.name.includes(kw) || node.code.includes(kw)
    const filteredChildren = node.children ? filterTree(node.children, kw) : []
    if (matched || filteredChildren.length) result.push({ ...node, children: filteredChildren })
  }
  return result
}

function isHighlight(node: OrgNode): boolean {
  if (!searchKeyword.value.trim()) return false
  return node.name.includes(searchKeyword.value) || node.code.includes(searchKeyword.value)
}

function levelColor(level: number): string {
  return ['blue', 'green', 'orange', 'purple'][level - 1] ?? 'gray'
}

const childColumns = [
  { title: t('sys.organization.index.名称'), dataIndex: 'name' },
  { title: t('sys.organization.index.编码'), dataIndex: 'code' },
  { title: t('sys.organization.index.负责人'), dataIndex: 'manager' },
  { title: t('sys.organization.index.操作'), slotName: 'action', width: 120 },
]

async function loadTree() {
  treeLoading.value = true
  try {
    orgTree.value = await orgApi.getOrgTree()
  } finally {
    treeLoading.value = false
  }
}

function handleSelect(keys: string[]) {
  selectedKeys.value = keys
  selectedOrg.value = keys.length ? (allNodes.value.find(n => n.id === keys[0]) ?? null) : null
}

function handleSearch() {
  if (searchKeyword.value.trim()) treeRef.value?.expandAll?.()
}

function expandAll() { treeRef.value?.expandAll?.() }
function collapseAll() { treeRef.value?.collapseAll?.() }

function openCreateRoot() {
  editingId.value = null
  formData.value = { name: '', code: '', parentId: null, manager: '', phone: '', description: '' }
  parentLabel.value = '无（顶级组织）'
  drawerVisible.value = true
}

function openCreateChild(parent: OrgNode) {
  editingId.value = null
  formData.value = { name: '', code: '', parentId: parent.id, manager: '', phone: '', description: '' }
  parentLabel.value = parent.name
  drawerVisible.value = true
}

function openEdit(node: OrgNode) {
  editingId.value = node.id
  formData.value = {
    name: node.name, code: node.code, parentId: node.parentId,
    manager: node.manager ?? '', phone: node.phone ?? '', description: node.description ?? '',
  }
  parentLabel.value = parentName(node.parentId)
  drawerVisible.value = true
}

async function handleSubmit() {
  const err = await formRef.value?.validate()
  if (err) return
  submitLoading.value = true
  try {
    if (editingId.value) {
      await orgApi.updateOrg(editingId.value, formData.value)
      Message.success('更新成功')
    } else {
      await orgApi.createOrg(formData.value)
      Message.success('创建成功')
    }
    drawerVisible.value = false
    const prevId = selectedOrg.value?.id
    await loadTree()
    if (prevId) {
      const found = allNodes.value.find(n => n.id === prevId)
      if (found) { selectedKeys.value = [prevId]; selectedOrg.value = found }
    }
  } catch (e: unknown) {
    Message.error((e as { message?: string })?.message ?? '操作失败')
  } finally {
    submitLoading.value = false
  }
}

async function handleDelete(id: string) {
  try {
    await orgApi.deleteOrg(id)
    Message.success('删除成功')
    if (selectedOrg.value?.id === id) { selectedOrg.value = null; selectedKeys.value = [] }
    await loadTree()
  } catch (e: unknown) {
    Message.error((e as { message?: string })?.message ?? '删除失败')
  }
}

onMounted(loadTree)
</script>

<style scoped>
.page-container { padding: 16px; }
.search-bar { display: flex; gap: 8px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
.tree-node { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 2px 0; }
.node-info { display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0; }
.node-name { font-weight: 500; }
.node-name.highlight { color: rgb(var(--primary-6)); background: var(--color-primary-light-1); padding: 0 4px; border-radius: 2px; }
.node-meta { font-size: 12px; color: var(--color-text-3); white-space: nowrap; }
.node-actions { display: flex; align-items: center; opacity: 0; transition: opacity 0.2s; flex-shrink: 0; }
.tree-node:hover .node-actions { opacity: 1; }
</style>
