<template>
  <div class="m-table">
    <!-- 工具栏 -->
    <div v-if="showColumnConfig" class="m-table__toolbar">
      <a-popover trigger="click" position="br">
        <a-button size="small" type="text">
          <template #icon><icon-settings /></template>
        </a-button>
        <template #content>
          <div class="m-table__col-config">
            <div
              v-for="col in allColumns"
              :key="col.key"
              class="m-table__col-config-item"
            >
              <a-checkbox
                :model-value="visibleKeys.includes(col.key)"
                @change="(val: boolean | (string | number | boolean)[]) => toggleColumn(col.key, !!val)"
              >
                {{ col.title }}
              </a-checkbox>
            </div>
          </div>
        </template>
      </a-popover>
    </div>

    <!-- 筛选行 -->
    <div v-if="hasFilterable" class="m-table__filters">
      <template v-for="col in visibleColumns" :key="col.key">
        <a-input
          v-if="col.filterable"
          v-model="filterValues[col.key]"
          :placeholder="t('common.search') + ' ' + col.title"
          size="small"
          allow-clear
          :style="{ width: col.width ? col.width + 'px' : '160px' }"
          @input="onFilterInput"
          @clear="onFilterInput"
        />
        <div v-else :style="{ width: col.width ? col.width + 'px' : '100px' }" />
      </template>
    </div>

    <!-- 表格 -->
    <a-table
      :columns="tableColumns"
      :data="data"
      :loading="loading"
      :row-key="rowKey"
      :pagination="false"
      :bordered="{ cell: false }"
      @sort-change="onSortChange"
    >
      <!-- 透传具名插槽 -->
      <template v-for="col in slotColumns" :key="col.slotName" #[col.slotName!]="{ record }">
        <slot :name="col.slotName" :record="record" />
      </template>
    </a-table>

    <!-- 分页 -->
    <div class="m-table__pagination">
      <a-pagination
        :total="total"
        :current="currentPage"
        :page-size="currentPageSize"
        :page-size-options="[10, 20, 50, 100]"
        show-page-size
        show-total
        @change="onPageChange"
        @page-size-change="onPageSizeChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { t, locale } = useI18n()

export interface MTableColumn {
  key: string
  title: string
  dataIndex?: string
  width?: number
  sortable?: boolean
  filterable?: boolean
  render?: (record: Record<string, unknown>) => string
  slotName?: string
  ellipsis?: boolean
}

export interface MTableChangeEvent {
  page: number
  pageSize: number
  sort?: { field: string; order: 'asc' | 'desc' }
  filters?: Record<string, string>
}

const props = withDefaults(defineProps<{
  columns: MTableColumn[]
  data: Record<string, unknown>[]
  loading?: boolean
  total?: number
  pageSize?: number
  rowKey?: string
  showColumnConfig?: boolean
}>(), {
  loading: false,
  total: 0,
  pageSize: 20,
  rowKey: 'id',
  showColumnConfig: true,
})

const emit = defineEmits<{
  change: [event: MTableChangeEvent]
}>()

// 分页状态
const currentPage = ref(1)
const currentPageSize = ref(props.pageSize)

// 排序状态
const sortState = ref<{ field: string; order: 'asc' | 'desc' } | undefined>()

// 筛选状态
const filterValues = ref<Record<string, string>>({})

// 列显示控制
const allColumns = computed(() => props.columns)
const visibleKeys = ref<string[]>(props.columns.map(c => c.key))

watch(() => props.columns, (cols) => {
  // 新增列默认显示
  cols.forEach(c => {
    if (!visibleKeys.value.includes(c.key)) visibleKeys.value.push(c.key)
  })
}, { deep: true })

function toggleColumn(key: string, visible: boolean) {
  if (visible) {
    visibleKeys.value.push(key)
  } else {
    visibleKeys.value = visibleKeys.value.filter(k => k !== key)
  }
}

const visibleColumns = computed(() =>
  props.columns.filter(c => visibleKeys.value.includes(c.key))
)

// 转换为 a-table columns 格式
const tableColumns = computed(() =>
  visibleColumns.value.map(col => {
    // 如果列有自定义 render 或 slotName，直接透传
    if (col.slotName) {
      return {
        title: col.title,
        dataIndex: col.dataIndex ?? col.key,
        key: col.key,
        width: col.width,
        ellipsis: col.ellipsis,
        sortable: col.sortable ? { sortDirections: ['ascend' as const, 'descend' as const] } : undefined,
        slotName: col.slotName,
      }
    }

    return {
      title: col.title,
      dataIndex: col.dataIndex ?? col.key,
      key: col.key,
      width: col.width,
      ellipsis: col.ellipsis,
      sortable: col.sortable ? { sortDirections: ['ascend' as const, 'descend' as const] } : undefined,
      render: col.render
        ? ({ record }: { record: Record<string, unknown> }) => col.render!(record)
        : ({ record }: { record: Record<string, unknown> }) => {
            const val = record[col.dataIndex ?? col.key]
            if (val === null || val === undefined) return ''
            if (val instanceof Date) {
              return val.toLocaleString(locale.value, { hour12: false }).replace(/\//g, '-')
            }
            if (typeof val === 'object') {
              // Date 对象有时被序列化为空对象，尝试检测
              if (Object.keys(val as object).length === 0) return ''
              return Array.isArray(val) ? t('common.items', { count: (val as unknown[]).length }) : JSON.stringify(val)
            }
            // 自动格式化看起来像日期的字符串
            if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
              return val.replace('T', ' ').substring(0, 16)
            }
            return String(val)
          },
    }
  })
)

const hasFilterable = computed(() => visibleColumns.value.some(c => c.filterable))
const slotColumns = computed(() => visibleColumns.value.filter(c => c.slotName))

// 防抖
let filterTimer: ReturnType<typeof setTimeout> | null = null
function onFilterInput() {
  if (filterTimer) clearTimeout(filterTimer)
  filterTimer = setTimeout(() => {
    currentPage.value = 1
    emitChange()
  }, 300)
}

function onSortChange(dataIndex: string, direction: string) {
  if (!direction) {
    sortState.value = undefined
  } else {
    sortState.value = {
      field: dataIndex,
      order: direction === 'ascend' ? 'asc' : 'desc',
    }
  }
  currentPage.value = 1
  emitChange()
}

function onPageChange(page: number) {
  currentPage.value = page
  emitChange()
}

function onPageSizeChange(size: number) {
  currentPageSize.value = size
  currentPage.value = 1
  emitChange()
}

function emitChange() {
  const activeFilters: Record<string, string> = {}
  Object.entries(filterValues.value).forEach(([k, v]) => {
    if (v && v.trim()) activeFilters[k] = v.trim()
  })

  emit('change', {
    page: currentPage.value,
    pageSize: currentPageSize.value,
    sort: sortState.value,
    filters: Object.keys(activeFilters).length ? activeFilters : undefined,
  })
}
</script>

<style scoped>
.m-table {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.m-table__toolbar {
  display: flex;
  justify-content: flex-end;
}

.m-table__filters {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  padding: 4px 0;
}

.m-table__pagination {
  display: flex;
  justify-content: flex-end;
  padding-top: 4px;
}

.m-table__col-config {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 120px;
  padding: 4px 0;
}
</style>
