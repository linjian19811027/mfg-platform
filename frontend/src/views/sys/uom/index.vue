<template>
  <div class="page-container">
    <div class="uom-layout">
      <!-- 左侧分类面板 -->
      <a-card class="category-panel" :body-style="{ padding: '8px 0' }">
        <div class="category-title">{{ $t('sys.uom.lbl1793') }}</div>
        <a-menu
          :selected-keys="[selectedType]"
          @menu-item-click="onTypeClick"
        >
          <a-menu-item key="all">
            <template #icon><icon-apps /></template>
            {{ $t('sys.uom.all') }}
          </a-menu-item>
          <a-menu-item v-for="cat in UOM_CATEGORIES" :key="cat.value">
            <template #icon><component :is="cat.icon" /></template>
            {{ cat.label }}
          </a-menu-item>
        </a-menu>
      </a-card>

      <!-- 右侧单位列表 -->
      <a-card class="list-panel">
        <!-- 搜索栏 -->
        <div class="search-bar">
          <a-input
            v-model="query.name"
            :placeholder="$t('sys.uom.index.单位名称符号')"
            allow-clear
            style="width: 200px"
            @press-enter="handleSearch"
          />
          <a-button type="primary" @click="handleSearch">{{ $t('common.search') }}</a-button>
          <a-button @click="resetQuery">{{ $t('common.reset') }}</a-button>
          <a-button style="margin-left: auto" type="primary" @click="openCreate">
            <template #icon><icon-plus /></template>
            {{ $t('sys.uom.createUnit') }}
          </a-button>
        </div>

        <MTable
          :columns="columns"
          :data="list as any[]"
          :loading="loading"
          :total="total"
          @change="onTableChange"
        >
          <template #isBase="{ record }">
            <a-tag :color="record.isBase ? 'green' : 'arcoblue'" size="small">
              {{ record.isBase ? $t('sys.uom.lbl1794') : $t('sys.uom.lbl1795') }}
            </a-tag>
          </template>
          <template #type="{ record }">
            <span>{{ getTypeName(record.type as string) }}</span>
          </template>
          <template #conversionFactor="{ record }">
            <span v-if="record.isBase" style="color: var(--color-text-3)">—</span>
            <span v-else>{{ record.conversionFactor ?? t('sys.uom.lbl1796') }}</span>
          </template>
          <template #status="{ record }">
            <a-tag :color="record.status === 'active' ? 'green' : 'red'" size="small">
              {{ record.status === 'active' ? $t('sys.uom.enable') : $t('sys.uom.disable') }}
            </a-tag>
          </template>
          <template #action="{ record }">
            <a-space>
              <a-button type="text" size="small" @click="openEdit(record as unknown as Uom)">{{ $t('sys.uom.edit') }}</a-button>
              <a-button
                v-if="!record.isBase"
                type="text"
                size="small"
                status="warning"
                @click="openConversion(record as unknown as Uom)"
              >
                {{ $t('sys.uom.conversion') }}
              </a-button>
              <a-popconfirm
                :content="$t('sys.uom.index.确认删除该计量单位')"
                @ok="handleDelete(record as unknown as Uom)"
              >
                <a-button type="text" size="small" status="danger" :loading="deleteLoadingId === record.id">{{ $t('sys.uom.delete') }}</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </MTable>
      </a-card>
    </div>

    <!-- 新建/编辑抽屉 -->
    <a-drawer
      v-model:visible="drawerVisible"
      :title="t('sys.uom.lbl1797')"
      :width="480"
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
          :label="$t('sys.uom.index.单位名称')"
          :rules="[{ required: true, message: t('sys.uom.input') }]"
          validate-trigger="blur"
        >
          <a-input v-model="formData.name" :placeholder="$t('sys.uom.index.如千克米升')" />
        </a-form-item>
        <a-form-item
          field="symbol"
          :label="$t('sys.uom.index.单位符号')"
          :rules="[{ required: true, message: t('sys.uom.input2') }]"
          validate-trigger="blur"
        >
          <a-input v-model="formData.symbol" :placeholder="$t('sys.uom.index.如kgmL')" />
        </a-form-item>
        <a-form-item
          field="type"
          :label="$t('sys.uom.index.单位类型')"
          :rules="[{ required: true, message: t('sys.uom.select') }]"
        >
          <a-select v-model="formData.type" :placeholder="$t('sys.uom.index.请选择类型')">
            <a-option v-for="cat in UOM_CATEGORIES" :key="cat.value" :value="cat.value">
              {{ cat.label }}
            </a-option>
          </a-select>
        </a-form-item>
        <a-form-item field="isBase" :label="$t('sys.uom.index.是否基准单位')">
          <a-switch v-model="formData.isBase" />
          <span style="margin-left: 8px; color: var(--color-text-3); font-size: 12px">
            {{ $t('sys.uom.baseUnitHint') }}
          </span>
        </a-form-item>
        <a-form-item field="description" :label="$t('common.description')">
          <a-textarea v-model="formData.description" :placeholder="$t('sys.uom.index.可选备注')" :max-length="200" show-word-limit />
        </a-form-item>
        <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px">
          <a-button @click="drawerVisible = false">{{ $t('common.cancel') }}</a-button>
          <a-button type="primary" html-type="submit" :loading="submitting">{{ $t('common.save') }}</a-button>
        </div>
      </a-form>
    </a-drawer>

    <!-- 换算系数 Modal -->
    <a-modal
      v-model:visible="conversionVisible"
      :title="$t('sys.uom.index.配置换算系数')"
      :width="440"
      @cancel="conversionVisible = false"
    >
      <div v-if="conversionUom" class="conversion-form">
        <a-alert type="info" style="margin-bottom: 16px">
          <template #content>
            {{ $t('sys.uom.conversionRelation', { name: conversionUom.name, symbol: conversionUom.symbol }) }}
            = ? <strong>{{ getBaseUnitName(conversionUom.type) }}</strong>
          </template>
        </a-alert>
        <a-form :model="{ conversionFactor }" layout="vertical">
          <a-form-item :label="$t('sys.uom.index.换算系数')">
            <a-input-number
              v-model="conversionFactor"
              :min="0.000001"
              :precision="6"
              :placeholder="$t('sys.uom.index.请输入换算系数')"
              style="width: 100%"
            />
            <div style="margin-top: 4px; color: var(--color-text-3); font-size: 12px">
              {{ $t('sys.uom.conversionExample') }}
            </div>
          </a-form-item>
        </a-form>
      </div>
      <template #footer>
        <a-button @click="conversionVisible = false">{{ $t('common.cancel') }}</a-button>
        <a-button type="primary" :loading="conversionSubmitting" @click="handleSaveConversion">{{ $t('common.save') }}</a-button>
      </template>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
import { useI18n } from 'vue-i18n'
import { ref, reactive, onMounted } from 'vue'
import { Message } from '@arco-design/web-vue'
import MTable from '@/components/MTable/index.vue'
import type { MTableColumn } from '@/components/MTable/index.vue'
import { uomApi, type Uom, type UomType, type UomFormData } from '@/api/sys'

// ---- 分类定义 ----
const UOM_CATEGORIES = [
  { value: 'length', label: t('sys.uom.lbl1798'), icon: 'icon-minus' },
  { value: 'weight', label: t('sys.uom.lbl1799'), icon: 'icon-download' },
  { value: 'volume', label: t('sys.uom.lbl1800'), icon: 'icon-storage' },
  { value: 'time', label: t('sys.uom.time'), icon: 'icon-clock-circle' },
  { value: 'quantity', label: t('sys.uom.quantity'), icon: 'icon-list' },
  { value: 'area', label: t('sys.uom.lbl1801'), icon: 'icon-expand' },
] as const

const TYPE_LABEL_MAP: Record<string, string> = {
  length: t('sys.uom.lbl1802'),
  weight: t('sys.uom.lbl1803'),
  volume: t('sys.uom.lbl1804'),
  time: t('sys.uom.time'),
  quantity: t('sys.uom.quantity'),
  area: t('sys.uom.lbl1805')
}

function getTypeName(type: string) {
  return TYPE_LABEL_MAP[type] ?? type
}

function getBaseUnitName(type: string) {
  const base = list.value.find(u => u.type === type && u.isBase)
  return base ? `${base.name}（${base.symbol}）` : t('sys.uom.lbl1806')
}

// ---- 列定义 ----
const columns: MTableColumn[] = [
  { key: 'name', title: t('sys.uom.index.单位名称'), width: 120 },
  { key: 'symbol', title: t('sys.uom.index.单位符号'), width: 100 },
  { key: 'type', title: t('sys.uom.index.单位类型'), width: 100, slotName: 'type' },
  { key: 'isBase', title: t('sys.uom.index.基准单位'), width: 100, slotName: 'isBase' },
  { key: 'conversionFactor', title: t('sys.uom.index.换算系数'), width: 120, slotName: 'conversionFactor' },
  { key: 'description', title: t('sys.uom.index.描述'), ellipsis: true },
  { key: 'status', title: t('sys.uom.index.状态'), width: 80, slotName: 'status' },
  { key: 'action', title: t('sys.uom.index.操作'), width: 180, slotName: 'action' },
]

// ---- 列表状态 ----
const selectedType = ref<string>('all')
const query = reactive({ name: '' })
const list = ref<Uom[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const pageSize = ref(20)

function onTypeClick(key: string) {
  selectedType.value = key
  page.value = 1
  loadData()
}

async function loadData() {
  loading.value = true
  try {
    const params: Record<string, unknown> = {
      ...query,
      page: page.value,
      pageSize: pageSize.value,
    }
    if (selectedType.value !== 'all') params.type = selectedType.value
    const res = await uomApi.getUoms(params as Parameters<typeof uomApi.getUoms>[0])
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

// ---- 新建/编辑抽屉 ----
const drawerVisible = ref(false)
const editingUom = ref<Uom | null>(null)
const formRef = ref()
const formData = reactive<UomFormData & { description?: string }>({
  name: '',
  symbol: '',
  type: 'quantity',
  isBase: false,
  description: '',
})
const submitting = ref(false)

function openCreate() {
  editingUom.value = null
  Object.assign(formData, {
    name: '',
    symbol: '',
    type: selectedType.value !== 'all' ? selectedType.value : 'quantity',
    isBase: false,
    description: '',
  })
  drawerVisible.value = true
}

function openEdit(uom: Uom) {
  editingUom.value = uom
  Object.assign(formData, {
    name: uom.name,
    symbol: uom.symbol,
    type: uom.type,
    isBase: uom.isBase,
    description: uom.description ?? '',
  })
  drawerVisible.value = true
}

async function handleSubmit() {
  const valid = await formRef.value?.validate()
  if (valid) return
  submitting.value = true
  try {
    const payload: UomFormData = {
      name: formData.name,
      symbol: formData.symbol,
      type: formData.type as UomType,
      isBase: formData.isBase,
      description: formData.description,
    }
    if (editingUom.value) {
      await uomApi.updateUom(editingUom.value.id, payload)
      Message.success(t('sys.保存成功'))
    } else {
      await uomApi.createUom(payload)
      Message.success(t('sys.创建成功'))
    }
    drawerVisible.value = false
    loadData()
  } catch {
    Message.error(t('sys.操作失败'))
  } finally {
    submitting.value = false
  }
}

// ---- 删除 ----
const deleteLoadingId = ref<string | null>(null)

async function handleDelete(uom: Uom) {
  deleteLoadingId.value = uom.id
  try {
    await uomApi.deleteUom(uom.id)
    Message.success(t('sys.删除成功'))
    loadData()
  } catch {
    Message.error(t('sys.删除失败'))
  } finally {
    deleteLoadingId.value = null
  }
}

// ---- 换算系数 Modal ----
const conversionVisible = ref(false)
const conversionUom = ref<Uom | null>(null)
const conversionFactor = ref<number>(1)
const conversionSubmitting = ref(false)

function openConversion(uom: Uom) {
  conversionUom.value = uom
  conversionFactor.value = uom.conversionFactor ?? 1
  conversionVisible.value = true
}

async function handleSaveConversion() {
  if (!conversionUom.value) return
  conversionSubmitting.value = true
  try {
    await uomApi.setConversion(conversionUom.value.id, conversionFactor.value)
    Message.success(t('sys.换算系数已保存'))
    conversionVisible.value = false
    loadData()
  } catch {
    Message.error(t('sys.保存失败'))
  } finally {
    conversionSubmitting.value = false
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
  height: 100%;
}

.uom-layout {
  display: flex;
  gap: 16px;
  height: 100%;
}

.category-panel {
  width: 200px;
  flex-shrink: 0;
}

.category-title {
  padding: 8px 16px 4px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-2);
}

.list-panel {
  flex: 1;
  min-width: 0;
}

.search-bar {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.conversion-form {
  padding: 4px 0;
}
</style>
