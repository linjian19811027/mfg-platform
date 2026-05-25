<template>
  <div class="page-container">
    <a-card>
      <div class="search-bar">
        <a-input
          v-model="query.name"
          :placeholder="$t('base.work-center.index.请输入名称')"
          style="width: 200px"
          allow-clear
        />
        <a-button type="primary" @click="handleSearch">{{ $t('common.search') }}</a-button>
        <a-button @click="resetQuery">{{ $t('common.reset') }}</a-button>
        <a-button style="margin-left: auto" type="primary" @click="openCreate">
          {{ $t('common.create') }}
        </a-button>
      </div>

      <a-table
        :data="list"
        :loading="loading"
        :pagination="{
          total,
          current: page,
          pageSize,
          showTotal: true,
          showPageSize: true,
        }"
        @page-change="onPageChange"
        @page-size-change="onPageSizeChange"
      >
        <template #columns>
          <a-table-column :title="$t('base.work-center.index.名称')" data-index="name" />
          <a-table-column :title="$t('base.work-center.index.编码')" data-index="code" />
          <a-table-column :title="$t('base.work-center.index.类型')" data-index="type" />
          <a-table-column :title="$t('base.work-center.index.描述')" data-index="description">
            <template #cell="{ record }">
              {{ record.description || '-' }}
            </template>
          </a-table-column>
          <a-table-column :title="$t('base.work-center.index.状态')" data-index="enabled" :width="80">
            <template #cell="{ record }">
              <a-tag :color="record.enabled ? 'green' : 'red'">
                {{ record.enabled ? $t('common.enabled') : $t('common.disabled') }}
              </a-tag>
            </template>
          </a-table-column>
          <a-table-column :title="$t('base.work-center.index.创建时间')" data-index="createdAt" :width="160" />
          <a-table-column :title="$t('common.action')" :width="200">
            <template #cell="{ record }">
              <a-space>
                <a-button type="text" size="small" @click="openEdit(record)">
                  {{ $t('common.edit') }}
                </a-button>
                <a-popconfirm
                  :content="$t('common.confirmDelete')"
                  @ok="handleDelete(record)"
                >
                  <a-button type="text" size="small" status="danger">
                    {{ $t('common.delete') }}
                  </a-button>
                </a-popconfirm>
              </a-space>
            </template>
          </a-table-column>
        </template>
      </a-table>
    </a-card>

    <a-drawer
      v-model:visible="drawerVisible"
      :title="editingItem ? $t('common.edit') : $t('common.create')"
      :width="540"
      @cancel="drawerVisible = false"
    >
      <a-form :model="formData" layout="vertical" @submit="handleSubmit">
        <a-form-item
          field="name"
          :label="$t('base.work-center.index.名称')"
          :rules="[{ required: true, message: t('base.work-center.inputName') }]"
        >
          <a-input v-model="formData.name" :placeholder="$t('base.work-center.index.请输入名称')" />
        </a-form-item>

        <a-form-item
          field="code"
          :label="$t('base.work-center.index.编码')"
        >
          <a-input v-model="formData.code" :placeholder="$t('base.work-center.index.请输入编码')" />
        </a-form-item>

        <a-form-item
          field="type"
          :label="$t('base.work-center.index.类型')"
        >
          <a-select v-model="formData.type" allow-clear>
            <a-option value="MACHINE">{{ $t('base.work-center.type.MACHINE') }}</a-option>
            <a-option value="ASSEMBLY">{{ $t('base.work-center.type.ASSEMBLY') }}</a-option>
            <a-option value="QUALITY">{{ $t('base.work-center.type.QUALITY') }}</a-option>
            <a-option value="PACKAGING">{{ $t('base.work-center.type.PACKAGING') }}</a-option>
            <a-option value="STORAGE">{{ $t('base.work-center.type.STORAGE') }}</a-option>
          </a-select>
        </a-form-item>

        <a-form-item
          field="description"
          :label="$t('common.description')"
        >
          <a-textarea
            v-model="formData.description"
            :placeholder="$t('base.work-center.index.请输入描述')"
            :max-length="500"
            show-word-limit
          />
        </a-form-item>

        <a-form-item field="enabled" :label="$t('base.work-center.index.状态')">
          <a-switch v-model="formData.enabled" :checked-value="1" :unchecked-value="0" />
        </a-form-item>

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
import { ref, reactive, onMounted } from 'vue'
import { Message } from '@arco-design/web-vue'
import { baseApi, type WorkCenter, type WorkCenterFormData } from '@/api/base'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()

// ---- 列表状态 ----
const query = reactive({ name: '' })
const list = ref<WorkCenter[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const pageSize = ref(20)

// ---- 抽屉状态 ----
const drawerVisible = ref(false)
const editingItem = ref<WorkCenter | null>(null)
const formData = reactive<WorkCenterFormData & { enabled: number }>({
  name: '',
  code: '',
  type: '',
  description: '',
  enabled: 1,
})
const submitting = ref(false)

// ---- 数据加载 ----
async function loadData() {
  loading.value = true
  try {
    const res = await baseApi.getWorkCenters()
    list.value = res
    total.value = res.length
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

function onPageChange(p: number) {
  page.value = p
  loadData()
}

function onPageSizeChange(size: number) {
  pageSize.value = size
  loadData()
}

// ---- 新建/编辑 ----
function openCreate() {
  editingItem.value = null
  formData.name = ''
  formData.code = ''
  formData.type = ''
  formData.description = ''
  formData.enabled = 1
  drawerVisible.value = true
}

function openEdit(item: WorkCenter) {
  editingItem.value = item
  formData.name = item.name
  formData.code = item.code ?? ''
  formData.type = item.type ?? ''
  formData.description = item.description ?? ''
  formData.enabled = item.enabled
  drawerVisible.value = true
}

async function handleSubmit() {
  if (!formData.name) {
    Message.warning(t('base.请输入名称'))
    return
  }

  submitting.value = true
  try {
    if (editingItem.value) {
      await baseApi.updateWorkCenter(editingItem.value.id, formData)
      Message.success(t('base.保存成功'))
    } else {
      await baseApi.createWorkCenter(formData)
      Message.success(t('base.创建成功'))
    }
    drawerVisible.value = false
    loadData()
  } catch {
    Message.error(t('base.操作失败'))
  } finally {
    submitting.value = false
  }
}

// ---- 删除 ----
const deleteLoadingId = ref<string | null>(null)

async function handleDelete(item: WorkCenter) {
  deleteLoadingId.value = item.id
  try {
    await baseApi.deleteWorkCenter(item.id)
    Message.success(t('base.删除成功'))
    loadData()
  } catch {
    Message.error(t('base.删除失败'))
  } finally {
    deleteLoadingId.value = null
  }
}

// ---- 初始化 ----
onMounted(() => {
  loadData()
})
</script>

<style scoped>
.page-container { padding: 16px; }
.search-bar { display: flex; gap: 8px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
.drawer-footer { padding: 16px 0; text-align: right; }
</style>
