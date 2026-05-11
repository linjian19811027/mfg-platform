<template>
  <div class="trace-page">
    <!-- 搜索区 -->
    <div class="search-bar no-print">
      <a-input
        v-model="batchNo"
        :placeholder="$t('traceability.index.输入批次号')"
        style="width: 220px"
        allow-clear
        @press-enter="handleSearch"
      />
      <a-radio-group v-model="direction" type="button">
        <a-radio value="forward">正向追溯（成品→原料）</a-radio>
        <a-radio value="backward">反向追溯（原料→成品）</a-radio>
      </a-radio-group>
      <a-button type="primary" :loading="loading" @click="handleSearch">{{ $t('common.search') }}</a-button>
      <a-button :disabled="!treeData.length" @click="exportPdf">导出 PDF</a-button>
    </div>

    <!-- 主体 -->
    <a-spin :loading="loading" style="width:100%">
      <div v-if="treeData.length" class="trace-body">
        <!-- 左侧追溯树 -->
        <div class="tree-panel print-area">
          <a-card :title="$t('traceability.index.追溯树')" :bordered="false">
            <a-tree
              :data="treeData"
              :default-expand-all="true"
              block-node
              @select="onNodeSelect"
            >
              <template #title="nodeData">
                <span :class="{ 'node-failed': nodeData.failed }">
                  {{ nodeData.title }}
                </span>
              </template>
            </a-tree>
          </a-card>
        </div>

        <!-- 右侧详情面板 -->
        <div class="detail-panel no-print">
          <a-card :title="$t('traceability.index.节点详情')" :bordered="false">
            <template v-if="selectedNode">
              <a-alert
                v-if="selectedNode.error"
                type="error"
                :content="selectedNode.error"
                style="margin-bottom: 12px"
              />
              <a-descriptions :data="descItems" bordered :column="1" />
            </template>
            <a-empty v-else :description="$t('traceability.index.点击左侧节点查看详情')" />
          </a-card>
        </div>
      </div>

      <a-empty v-else-if="!loading && searched" :description="$t('traceability.index.未找到追溯数据')" style="padding: 60px 0" />
      <a-empty v-else-if="!loading" :description="$t('traceability.index.请输入批次号后查询')" style="padding: 60px 0" />
    </a-spin>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
import { useI18n } from 'vue-i18n'
import { ref, computed } from 'vue'
import { Message } from '@arco-design/web-vue'
import type { TreeNodeData } from '@arco-design/web-vue'
import request from '@/utils/request'

interface TraceabilityNode {
  batchId: string
  batchNo?: string
  materialId?: string
  sourceType?: string
  quantity?: number
  producedAt?: string
  qualityStatus?: string
  error?: string
  children?: TraceabilityNode[]
  usedIn?: TraceabilityNode[]
}

// 扩展 TreeNodeData，附带原始节点数据
interface TraceTreeNode extends TreeNodeData {
  key: string
  title: string
  failed: boolean
  raw: TraceabilityNode
  children?: TraceTreeNode[]
}

const batchNo = ref('')
const direction = ref<'forward' | 'backward'>('forward')
const loading = ref(false)
const searched = ref(false)
const treeData = ref<TraceTreeNode[]>([])
const selectedNode = ref<TraceabilityNode | null>(null)

// batchId → 原始节点映射，用于点击时取详情
const nodeMap = new Map<string, TraceabilityNode>()

function nodeToTreeData(node: TraceabilityNode): TraceTreeNode {
  nodeMap.set(node.batchId, node)
  const subNodes = [...(node.children || []), ...(node.usedIn || [])]
  const label = [
    node.batchNo || node.batchId,
    node.materialId ? `(${node.materialId})` : '',
    node.sourceType ? `[${node.sourceType}]` : '',
  ].filter(Boolean).join(' ')

  return {
    key: node.batchId,
    title: label,
    failed: node.qualityStatus === 'FAILED',
    raw: node,
    children: subNodes.length ? subNodes.map(nodeToTreeData) : undefined,
  }
}

async function handleSearch() {
  if (!batchNo.value.trim()) {
    Message.warning('请输入批次号')
    return
  }
  loading.value = true
  searched.value = true
  nodeMap.clear()
  selectedNode.value = null
  treeData.value = []

  try {
    // 先按批次号查 batchId
    const batchRes = await request.get<{ list: { id: string }[] }>('/v1/base/batches', {
      params: { batchNo: batchNo.value.trim() },
    })
    const batchData = (batchRes as any).data ?? batchRes
    const batches = batchData?.list ?? (batchData as { id: string }[])
    const batchId = Array.isArray(batches) ? batches[0]?.id : (batchData as { id: string })?.id

    if (!batchId) {
      Message.warning('未找到对应批次')
      return
    }

    const endpoint =
      direction.value === 'forward'
        ? `/v1/conversion/traceability/forward/${batchId}`
        : `/v1/conversion/traceability/backward/${batchId}`

    const rootRes = await request.get<TraceabilityNode>(endpoint)
    const root = (rootRes as any).data ?? rootRes as unknown as TraceabilityNode
    if (root) {
      treeData.value = [nodeToTreeData(root)]
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '查询失败'
    Message.error(msg)
  } finally {
    loading.value = false
  }
}

function onNodeSelect(keys: (string | number)[]) {
  const key = keys[0] as string
  if (key) {
    selectedNode.value = nodeMap.get(key) ?? null
  }
}

const sourceTypeLabel: Record<string, string> = {
  PURCHASE: '采购',
  PRODUCTION: '生产',
}

const qualityLabel: Record<string, string> = {
  PASSED: '合格',
  FAILED: '不合格',
  PENDING: '待检',
}

const descItems = computed(() => {
  const n = selectedNode.value
  if (!n) return []
  return [
    { label: '批次号', value: n.batchNo || '-' },
    { label: '批次 ID', value: n.batchId },
    { label: '物料 ID', value: n.materialId || '-' },
    { label: '来源类型', value: sourceTypeLabel[n.sourceType ?? ''] || n.sourceType || '-' },
    { label: '数量', value: n.quantity != null ? String(n.quantity) : '-' },
    { label: '生产时间', value: n.producedAt ? n.producedAt.replace('T', ' ').slice(0, 19) : '-' },
    { label: '质量状态', value: qualityLabel[n.qualityStatus ?? ''] || n.qualityStatus || '-' },
  ]
})

function exportPdf() {
  window.print()
}
</script>

<style scoped>
.trace-page {
  padding: 16px;
  min-height: 100%;
}

.search-bar {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.trace-body {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.tree-panel {
  flex: 0 0 40%;
  min-width: 0;
}

.detail-panel {
  flex: 1;
  min-width: 0;
}

/* 质量不合格节点高亮 */
:deep(.node-failed) {
  color: #f53f3f;
  font-weight: 600;
}

/* 打印样式 */
@media print {
  .no-print {
    display: none !important;
  }

  .trace-page {
    padding: 0;
  }

  .trace-body {
    display: block;
  }

  .tree-panel {
    width: 100%;
  }

  :deep(.arco-card-header) {
    padding: 8px 0;
  }
}
</style>
