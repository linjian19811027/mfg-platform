<template>
  <div class="page-container">
    <div class="category-layout">
      <!-- 左侧：分类树 -->
      <a-card :bordered="false" class="tree-panel">
        <div class="tree-toolbar">
          <a-input
            v-model="searchText"
            :placeholder="t('plm.category.search')"
            allow-clear
            style="flex: 1"
            @keyup.enter="filterTree"
            @clear="filterTree"
          >
            <template #prefix><icon-search /></template>
          </a-input>
          <a-button type="primary" size="small" @click="openCreateModal(null)">
            <template #icon><icon-plus /></template>
            {{ $t('plm.category.newRoot') }}
          </a-button>
        </div>

        <a-spin :loading="treeLoading" style="width: 100%">
          <a-tree
            v-if="treeData.length"
            :data="filteredTree"
            :default-expand-all="true"
            :selected-keys="selectedKeys"
            @select="onNodeSelect"
          >
            <template #title="nodeData">
              <div class="tree-node">
                <span class="node-label">{{ nodeData.code }} - {{ nodeData.title }}</span>
                <span class="node-actions" @click.stop>
                  <icon-plus
                    class="node-action-icon"
                    :title="t('plm.category.newSub')"
                    @click="openCreateModal(nodeData)"
                  />
                  <icon-edit
                    class="node-action-icon"
                    :title="t('common.edit')"
                    @click="openEditModal(nodeData)"
                  />
                  <a-popconfirm
                    :content="t('plm.category.deleteMsg')"
                    @ok="handleDelete(nodeData.key as string)"
                  >
                    <icon-delete class="node-action-icon danger" :title="t('common.delete')" />
                  </a-popconfirm>
                </span>
              </div>
            </template>
          </a-tree>
          <a-empty v-else :description="t('common.empty')" />
        </a-spin>
      </a-card>

      <!-- 右侧：物料列表 -->
      <a-card :bordered="false" class="material-panel">
        <template #title>
          <span>{{ selectedCategory ? t('plm.category.itemsIn', { code: selectedCategory.code, title: selectedCategory.title }) : t('plm.category.selectHint') }}</span>
        </template>
        <MTable
          :columns="materialColumns"
          :data="materialData"
          :loading="materialLoading"
          :total="materialTotal"
          @change="onMaterialTableChange"
        />
      </a-card>
    </div>

    <!-- 新建/编辑分类弹窗 -->
    <a-modal
      v-model:visible="modalVisible"
      :title="editingCategory ? t('common.edit') : t('common.create')"
      :width="420"
      :confirm-loading="saving"
      @ok="handleSave"
      @cancel="modalVisible = false"
    >
      <a-form ref="formRef" :model="formData" layout="vertical">
        <a-form-item :label="t('plm.category.parent')" v-if="parentCategory">
          <a-input :model-value="parentCategory ? `${parentCategory.code} - ${parentCategory.title}` : ''" disabled />
        </a-form-item>
        <a-form-item :label="t('plm.category.code')" field="code" :rules="[{ required: true, message: t('common.required', { label: t('plm.category.code') }) }]">
          <a-input v-model="formData.code" :placeholder="t('plm.category.code')" />
        </a-form-item>
        <a-form-item :label="t('plm.category.name')" field="name" :rules="[{ required: true, message: t('common.required', { label: t('plm.category.name') }) }]">
          <a-input v-model="formData.name" :placeholder="t('plm.category.name')" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Message } from '@arco-design/web-vue'
import MTable from '@/components/MTable/index.vue'
import type { MTableColumn } from '@/components/MTable/index.vue'
import { plmApi, type MaterialCategory } from '@/api/plm'

const { t } = useI18n()

// ─── 树形分类 ────────────────────────────────────────────────
const treeLoading = ref(false)
const treeData = ref<TreeNode[]>([])
const searchText = ref('')
const selectedKeys = ref<string[]>([])
const selectedCategory = ref<TreeNode | null>(null)

interface TreeNode {
  key: string
  title: string
  code: string
  parentId?: string
  children?: TreeNode[]
}

function toTreeNodes(list: MaterialCategory[]): TreeNode[] {
  return list.map(c => ({
    key: c.id,
    title: c.name,
    code: c.code,
    parentId: c.parentId,
    children: c.children?.length ? toTreeNodes(c.children) : undefined,
  }))
}

function filterNodes(nodes: TreeNode[], kw: string): TreeNode[] {
  if (!kw) return nodes
  return nodes.reduce<TreeNode[]>((acc, node) => {
    const childMatches = filterNodes(node.children ?? [], kw)
    const selfMatch = node.code.includes(kw) || node.title.includes(kw)
    if (selfMatch || childMatches.length) {
      acc.push({ ...node, children: childMatches.length ? childMatches : node.children })
    }
    return acc
  }, [])
}

const filteredTree = computed(() => filterNodes(treeData.value, searchText.value))

function filterTree() {
  // computed 自动更新
}

async function loadTree() {
  treeLoading.value = true
  try {
    const list = await plmApi.getCategories()
    treeData.value = toTreeNodes(Array.isArray(list) ? list : [])
  } catch {
    // handled
  } finally {
    treeLoading.value = false
  }
}

function onNodeSelect(keys: string[], data: { node: TreeNode }) {
  selectedKeys.value = keys
  selectedCategory.value = keys.length ? data.node : null
  if (keys.length) loadMaterials()
}

// ─── 右侧物料列表 ─────────────────────────────────────────────
const materialLoading = ref(false)
const materialData = ref<any[]>([])
const materialTotal = ref(0)
const materialPage = ref(1)

const materialColumns: MTableColumn[] = [
  { key: 'code', title: t('common.code'), dataIndex: 'code', width: 130 },
  { key: 'name', title: t('common.name'), dataIndex: 'name', width: 180 },
  { key: 'type', title: t('common.type'), dataIndex: 'type', width: 100 },
  { key: 'status', title: t('common.status'), dataIndex: 'status', width: 100 },
]

async function loadMaterials() {
  if (!selectedCategory.value) return
  materialLoading.value = true
  try {
    const res = await plmApi.getMaterials({
      categoryId: selectedCategory.value.key,
      page: materialPage.value,
      pageSize: 20,
    })
    materialData.value = (res.list ?? []) as any[]
    materialTotal.value = res.total ?? 0
  } catch {
    // handled
  } finally {
    materialLoading.value = false
  }
}

function onMaterialTableChange(e: { page: number }) {
  materialPage.value = e.page
  loadMaterials()
}

// ─── 新建/编辑弹窗 ────────────────────────────────────────────
const modalVisible = ref(false)
const saving = ref(false)
const formRef = ref()
const formData = ref({ code: '', name: '' })
const editingCategory = ref<TreeNode | null>(null)
const parentCategory = ref<TreeNode | null>(null)

function openCreateModal(parent: TreeNode | null) {
  editingCategory.value = null
  parentCategory.value = parent
  formData.value = { code: '', name: '' }
  modalVisible.value = true
}

function openEditModal(node: TreeNode) {
  editingCategory.value = node
  parentCategory.value = null
  formData.value = { code: node.code, name: node.title }
  modalVisible.value = true
}

async function handleSave() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  saving.value = true
  try {
    if (editingCategory.value) {
      await plmApi.updateCategory(editingCategory.value.key, formData.value)
      Message.success(t('common.success'))
    } else {
      await plmApi.createCategory({
        ...formData.value,
        parentId: parentCategory.value?.key,
      })
      Message.success(t('common.success'))
    }
    modalVisible.value = false
    loadTree()
  } catch {
    // handled
  } finally {
    saving.value = false
  }
}

async function handleDelete(id: string) {
  try {
    await plmApi.deleteCategory(id)
    Message.success(t('common.success'))
    selectedKeys.value = []
    selectedCategory.value = null
    materialData.value = []
    loadTree()
  } catch {
    // handled
  }
}

onMounted(loadTree)
</script>

<style scoped>
.page-container {
  padding: 16px;
  height: 100%;
}

.category-layout {
  display: flex;
  gap: 16px;
  height: 100%;
}

.tree-panel {
  width: 40%;
  min-width: 300px;
  overflow: auto;
}

.material-panel {
  flex: 1;
  overflow: auto;
}

.tree-toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
}

.tree-node {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.node-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.node-actions {
  display: none;
  align-items: center;
  gap: 6px;
  margin-left: 8px;
}

.tree-node:hover .node-actions {
  display: flex;
}

.node-action-icon {
  font-size: 14px;
  color: var(--color-text-3);
  cursor: pointer;
  padding: 2px;
  border-radius: 4px;
  transition: color 0.2s;
}

.node-action-icon:hover {
  color: rgb(var(--primary-6));
}

.node-action-icon.danger:hover {
  color: rgb(var(--danger-6));
}
</style>
