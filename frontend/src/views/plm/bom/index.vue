<template>
  <div class="page-container">
    <!-- 顶部工具栏 -->
    <a-card :bordered="false" style="margin-bottom: 16px">
      <a-space wrap>
        <a-input
          v-model="query.keyword"
          :placeholder="$t('plm.bom.物料编码名称')"
          allow-clear
          style="width: 200px"
          @keyup.enter="loadData"
        />
        <a-select
          v-model="query.status"
          :placeholder="$t('common.status')"
          allow-clear
          style="width: 120px"
        >
          <a-option value="DRAFT">草稿</a-option>
          <a-option value="ACTIVE">激活</a-option>
          <a-option value="INACTIVE">停用</a-option>
          <a-option value="DRAFT">{{ $t('plm.bom.status.draft') }}</a-option>
          <a-option value="ACTIVE">{{ $t('plm.bom.status.active') }}</a-option>
          <a-option value="INACTIVE">{{ $t('plm.bom.status.inactive') }}</a-option>
          <a-option value="OBSOLETE">{{ $t('plm.bom.status.obsolete') }}</a-option>
        </a-select>
        <a-button type="primary" @click="loadData">{{ $t('common.search') }}</a-button>
        <a-button @click="resetQuery">{{ $t('common.reset') }}</a-button>
      </a-space>
      <template #extra>
        <a-button type="primary" @click="openCreateDrawer">{{ $t('common.create') }} BOM</a-button>
      </template>
    </a-card>

    <!-- BOM 列表 -->
    <a-card :bordered="false">
      <MTable
        :columns="columns"
        :data="tableData"
        :loading="loading"
        :total="total"
        :page-size="query.pageSize"
        @change="onTableChange"
      >
        <template #status="{ record }">
          <a-tag :color="statusColor(record.status as string)">
            {{ statusLabel(record.status as string) }}
          </a-tag>
        </template>
        <template #effectiveDate="{ record }">
          {{ record.effectiveDate ? String(record.effectiveDate).slice(0, 10) : '-' }}
        </template>
        <template #expiryDate="{ record }">
          {{ record.expiryDate ? String(record.expiryDate).slice(0, 10) : '-' }}
        </template>
        <template #action="{ record }">
          <a-space>
            <a-link @click="openDetailDrawer(record as unknown as Bom)">{{ $t('common.view') + $t('common.detail') }}</a-link>
            <a-link @click="openCompareDrawer(record as unknown as Bom)">{{ $t('plm.bom.compare') }}</a-link>
            <!-- 状态操作按钮 -->
            <a-popconfirm
              v-if="record.status === 'DRAFT'"
              :content="$t('plm.bom.确认激活该BOM激活')"
              @ok="handleActivateBom(record.id as string)"
            >
              <a-link :loading="statusLoadingId === record.id">激活</a-link>
            </a-popconfirm>
            <a-popconfirm
              v-if="record.status === 'ACTIVE'"
              :content="$t('plm.bom.确认停用该BOM')"
              @ok="handleDeactivateBom(record.id as string)"
            >
              <a-link :loading="statusLoadingId === record.id">停用</a-link>
            </a-popconfirm>
            <a-popconfirm
              v-if="record.status === 'INACTIVE'"
              :content="$t('plm.bom.确认重新激活该BOM')"
              @ok="handleActivateBom(record.id as string)"
            >
              <a-link :loading="statusLoadingId === record.id">重新激活</a-link>
            </a-popconfirm>
            <a-popconfirm
              v-if="record.status === 'ACTIVE' || record.status === 'INACTIVE'"
              :content="$t('plm.bom.确认废止该BOM此操')"
              @ok="handleObsoleteBom(record.id as string)"
            >
              <a-link status="warning" :loading="statusLoadingId === record.id">废止</a-link>
            </a-popconfirm>
            <a-popconfirm :content="$t('plm.bom.确认删除该BOM')" @ok="handleDelete(record.id as string)">
              <a-link status="danger">{{ $t('common.delete') }}</a-link>
            </a-popconfirm>
          </a-space>
        </template>
      </MTable>
    </a-card>

    <!-- 新建 BOM 抽屉 -->
    <a-drawer
      v-model:visible="createDrawerVisible"
      :title="$t('common.create') + ' BOM'"
      :width="520"
      @cancel="createDrawerVisible = false"
    >
      <a-form :model="createForm" layout="vertical">
        <a-form-item :label="$t('plm.bom.物料')" required>
          <a-select
            v-model="createForm.materialId"
            :placeholder="$t('plm.bom.输入编码或名称搜索物')"
            allow-search
            allow-clear
            :filter-option="false"
            style="width: 100%"
            @search="searchMaterials"
            @change="onCreateMaterialChange"
          >
            <a-option
              v-for="m in materialOptions"
              :key="m.id"
              :value="m.id"
              :label="`${m.code} - ${m.name}`"
            />
          </a-select>
        </a-form-item>
        <a-form-item :label="$t('plm.bom.复制自版本可选')">
          <a-select
            v-model="createForm.copyFromBomId"
            :placeholder="$t('plm.bom.选择历史版本作为模板')"
            allow-clear
            style="width: 100%"
            :disabled="!createForm.materialId || copyVersionOptions.length === 0"
            :loading="copyVersionLoading"
          >
            <a-option
              v-for="opt in copyVersionOptions"
              :key="opt.value"
              :value="opt.value"
              :label="opt.label"
            />
          </a-select>
          <div v-if="createForm.materialId && copyVersionOptions.length === 0 && !copyVersionLoading" style="color: #86909c; font-size: 12px; margin-top: 4px">
            该物料暂无历史版本，将空白新建
          </div>
        </a-form-item>
        <a-form-item :label="$t('plm.bom.生效日期')">
          <a-date-picker v-model="createForm.effectiveDate" style="width: 100%" />
        </a-form-item>
        <a-form-item :label="$t('plm.bom.失效日期')">
          <a-date-picker v-model="createForm.expiryDate" style="width: 100%" />
        </a-form-item>
        <a-form-item style="margin-top: 24px">
          <a-space>
            <a-button type="primary" :loading="submitting" @click="handleCreate">{{ $t('common.save') }}</a-button>
            <a-button @click="createDrawerVisible = false">{{ $t('common.cancel') }}</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-drawer>

    <!-- BOM 明细抽屉 -->
    <a-drawer
      v-model:visible="detailDrawerVisible"
      :title="`${$t('plm.bom.detail')} - ${currentBom?.materialName ?? ''} v${currentBom?.version ?? ''}`"
      :width="760"
      @cancel="detailDrawerVisible = false"
    >
      <div style="margin-bottom: 12px">
        <a-button type="primary" size="small" @click="startAddLine">{{ $t('common.add') + $t('plm.bom.line') }}</a-button>
      </div>

      <!-- 新增行内联表单 -->
      <a-card v-if="showAddLineForm" :bordered="true" style="margin-bottom: 12px; background: #f7f8fa">
        <a-form layout="inline" :model="newLineForm">
          <a-form-item :label="$t('plm.bom.序号')" style="width: 90px">
            <a-input-number v-model="newLineForm.sequence" :min="1" style="width: 65px" />
          </a-form-item>
          <a-form-item :label="$t('plm.bom.子物料')" style="width: 260px">
            <a-select
              v-model="newLineForm.materialId"
              :placeholder="$t('plm.bom.搜索物料')"
              allow-search
              allow-clear
              :filter-option="false"
              style="width: 220px"
              @search="searchLineMaterials"
            >
              <a-option
                v-for="m in lineMaterialOptions"
                :key="m.id"
                :value="m.id"
                :label="`${m.code} - ${m.name}`"
              />
            </a-select>
          </a-form-item>
          <a-form-item :label="$t('plm.bom.数量')" style="width: 110px">
            <a-input-number v-model="newLineForm.quantity" :min="0" :precision="4" style="width: 80px" />
          </a-form-item>
          <a-form-item :label="$t('plm.bom.损耗率')" style="width: 110px">
            <a-input-number v-model="newLineForm.lossRate" :min="0" :max="100" :precision="2" style="width: 80px" />
          </a-form-item>
          <a-form-item>
            <a-space>
              <a-button type="primary" size="small" :loading="addLineLoading" @click="submitAddLine">确认</a-button>
              <a-button size="small" @click="cancelAddLine">{{ $t('common.cancel') }}</a-button>
            </a-space>
          </a-form-item>
        </a-form>
      </a-card>

      <!-- 明细行表格 -->
      <a-table
        :columns="lineColumns"
        :data="bomLines"
        :loading="linesLoading"
        :pagination="false"
        row-key="id"
        :bordered="{ cell: false }"
      >
        <template #lineQuantity="{ record }">
          <a-input-number
            v-if="editingLineId === record.id"
            v-model="editLineForm.quantity"
            :min="0"
            :precision="4"
            style="width: 80px"
          />
          <span v-else>{{ record.quantity }}</span>
        </template>
        <template #lineLossRate="{ record }">
          <a-input-number
            v-if="editingLineId === record.id"
            v-model="editLineForm.lossRate"
            :min="0"
            :max="100"
            :precision="2"
            style="width: 70px"
          />
          <span v-else>{{ record.lossRate }}</span>
        </template>
        <template #lineAction="{ record }">
          <a-space>
            <template v-if="editingLineId === record.id">
              <a-link :loading="editLineLoading" @click="submitEditLine(record as BomLine)">保存</a-link>
              <a-link @click="cancelEditLine">取消</a-link>
            </template>
            <template v-else>
              <a-link @click="startEditLine(record as BomLine)">{{ $t('common.edit') }}</a-link>
              <a-popconfirm :content="$t('plm.bom.确认删除该明细行')" @ok="handleDeleteLine(record as BomLine)">
                <a-link status="danger">{{ $t('common.delete') }}</a-link>
              </a-popconfirm>
            </template>
          </a-space>
        </template>
      </a-table>
    </a-drawer>

    <!-- 版本对比抽屉 -->
    <a-drawer
      v-model:visible="compareDrawerVisible"
      :title="$t('plm.bom.compare')"
      :width="900"
      @cancel="compareDrawerVisible = false"
    >
      <a-space style="margin-bottom: 16px" wrap>
        <span>版本 A：</span>
        <a-select v-model="compareV1" :placeholder="$t('plm.bom.选择版本A')" style="width: 200px" :options="compareBomOptions" @change="runCompare" />
        <span>版本 B：</span>
        <a-select v-model="compareV2" :placeholder="$t('plm.bom.选择版本B')" style="width: 200px" :options="compareBomOptions" @change="runCompare" />
        <a-button type="primary" :loading="compareLoading" @click="runCompare">对比</a-button>
      </a-space>
      <a-table
        :columns="compareColumns"
        :data="compareTableData"
        :loading="compareLoading"
        :pagination="false"
        row-key="materialCode"
        :bordered="{ cell: false }"
        :row-class="compareRowClass"
      >
        <template #cmpQtyV1="{ record }">
          <span :style="record.diffType === 'removed' ? 'text-decoration: line-through; color: #f53f3f' : ''">
            {{ record.qtyV1 ?? '-' }}
          </span>
        </template>
        <template #cmpQtyV2="{ record }">{{ record.qtyV2 ?? '-' }}</template>
        <template #cmpDiff="{ record }">
          <a-tag v-if="record.diffType === 'added'" color="green">新增</a-tag>
          <a-tag v-else-if="record.diffType === 'removed'" color="red">删除</a-tag>
          <a-tag v-else-if="record.diffType === 'modified'" color="orange">变更</a-tag>
          <span v-else>-</span>
        </template>
      </a-table>
    </a-drawer>
    <!-- 在制工单阻断提示 Modal -->
    <a-modal
      v-model:visible="workOrderModalVisible"
      :title="$t('plm.bom.blockedMsg')"
      :footer="false"
      @cancel="workOrderModalVisible = false"
    >
      <p style="margin-bottom: 12px; color: #86909c">以下工单正在使用该 BOM，请先处理完成后再操作：</p>
      <a-table
        :columns="[{ title: t('plm.bom.index.工单号'), dataIndex: 'woNo' }, { title: t('plm.bom.index.状态'), dataIndex: 'status' }]"
        :data="blockedWorkOrders"
        :pagination="false"
        size="small"
      />
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Message } from '@arco-design/web-vue'
import MTable from '@/components/MTable/index.vue'
import type { MTableColumn } from '@/components/MTable/index.vue'
import { plmApi, type Bom, type BomLine, type Material } from '@/api/plm'

const { t } = useI18n()

// ─── 列表 ────────────────────────────────────────────────────
const loading = ref(true) // 初始 true，确保页面首帧就有 loading 状态供 E2E 等待
const tableData = ref<any[]>([])
const total = ref(0)
const query = reactive({ keyword: '', status: '', page: 1, pageSize: 20 })

const columns = computed<MTableColumn[]>(() => [
  { key: 'version', title: t('plm.bom.version'), dataIndex: 'version', width: 90 },
  { key: 'materialCode', title: t('common.code'), dataIndex: 'materialCode', width: 130 },
  { key: 'materialName', title: t('common.name'), dataIndex: 'materialName', width: 160 },
  { key: 'status', title: t('common.status'), slotName: 'status', width: 90 },
  { key: 'effectiveDate', title: t('plm.bom.effectiveDate'), slotName: 'effectiveDate', width: 110 },
  { key: 'expiryDate', title: t('plm.bom.expiryDate'), slotName: 'expiryDate', width: 110 },
  { key: 'action', title: t('common.action'), slotName: 'action', width: 180 },
])

const lineColumns = computed(() => [
  { title: t('plm.bom.sequence'), dataIndex: 'sequence', width: 70 },
  { title: t('common.code'), dataIndex: 'materialCode', width: 140 },
  { title: t('common.name'), dataIndex: 'materialName', width: 160 },
  { title: t('common.quantity'), dataIndex: 'quantity', slotName: 'lineQuantity', width: 110 },
  { title: t('plm.bom.lossRate') + '%', dataIndex: 'lossRate', slotName: 'lineLossRate', width: 95 },
  { title: t('common.action'), slotName: 'lineAction', width: 120 },
])

function statusColor(s: string) {
  if (s === 'ACTIVE') return 'green'
  if (s === 'DRAFT') return 'orange'
  if (s === 'INACTIVE') return 'gray'
  if (s === 'OBSOLETE') return 'red'
  return 'gray'
}
function statusLabel(s: string) {
  if (s === 'ACTIVE') return t('plm.bom.activate')
  if (s === 'DRAFT') return t('common.draft')
  if (s === 'INACTIVE') return t('plm.bom.deactivate')
  if (s === 'OBSOLETE') return t('plm.bom.obsolete')
  return s
}

async function loadData() {
  loading.value = true
  try {
    const params: Record<string, unknown> = { page: query.page, pageSize: query.pageSize }
    if (query.keyword) params.keyword = query.keyword
    if (query.status) params.status = query.status
    const res = await plmApi.getBomList(params)
    tableData.value = (res.list ?? []) as any[]
    total.value = res.total ?? 0
  } catch { /* handled */ } finally {
    loading.value = false
  }
}

function resetQuery() {
  query.keyword = ''; query.status = ''; query.page = 1; loadData()
}
function onTableChange(e: { page: number; pageSize: number }) {
  query.page = e.page; query.pageSize = e.pageSize; loadData()
}
async function handleDelete(id: string) {
  try {
    await plmApi.deleteBom(id)
    Message.success('删除成功')
    loadData()
  } catch { /* handled */ }
}

// ─── BOM 状态操作 ─────────────────────────────────────────────
const statusLoadingId = ref<string | null>(null)
const workOrderModalVisible = ref(false)
const blockedWorkOrders = ref<{ woNo: string; status: string }[]>([])

async function handleActivateBom(id: string) {
  statusLoadingId.value = id
  try {
    await plmApi.activateBom(id)
    Message.success('激活成功')
    loadData()
  } catch (e: unknown) {
    const err = e as { response?: { data?: { workOrders?: { woNo: string; status: string }[] } } }
    const wos = err?.response?.data?.workOrders
    if (wos?.length) { blockedWorkOrders.value = wos; workOrderModalVisible.value = true }
  } finally {
    statusLoadingId.value = null
  }
}

async function handleDeactivateBom(id: string) {
  statusLoadingId.value = id
  try {
    await plmApi.deactivateBom(id)
    Message.success('停用成功')
    loadData()
  } catch (e: unknown) {
    const err = e as { response?: { data?: { workOrders?: { woNo: string; status: string }[] } } }
    const wos = err?.response?.data?.workOrders
    if (wos?.length) { blockedWorkOrders.value = wos; workOrderModalVisible.value = true }
  } finally {
    statusLoadingId.value = null
  }
}

async function handleObsoleteBom(id: string) {
  statusLoadingId.value = id
  try {
    await plmApi.obsoleteBom(id)
    Message.success('废止成功')
    loadData()
  } catch (e: unknown) {
    const err = e as { response?: { data?: { workOrders?: { woNo: string; status: string }[] } } }
    const wos = err?.response?.data?.workOrders
    if (wos?.length) { blockedWorkOrders.value = wos; workOrderModalVisible.value = true }
  } finally {
    statusLoadingId.value = null
  }
}

// ─── 物料搜索（新建 BOM 用）────────────────────────────────────
const materialOptions = ref<Material[]>([])
let matSearchTimer: ReturnType<typeof setTimeout> | null = null

async function searchMaterials(kw: string) {
  if (!kw) { materialOptions.value = []; return }
  if (matSearchTimer) clearTimeout(matSearchTimer)
  matSearchTimer = setTimeout(async () => {
    const res = await plmApi.getMaterials({ keyword: kw, pageSize: 20 })
    materialOptions.value = res.list ?? []
  }, 300)
}

// ─── 新建 BOM ────────────────────────────────────────────────
const createDrawerVisible = ref(false)
const submitting = ref(false)
const createForm = reactive<{ materialId: string; effectiveDate: string; expiryDate: string; copyFromBomId: string }>({
  materialId: '', effectiveDate: '', expiryDate: '', copyFromBomId: '',
})

// 历史版本选项（用于"复制自版本"下拉）
const copyVersionOptions = ref<{ label: string; value: string }[]>([])
const copyVersionLoading = ref(false)

async function onCreateMaterialChange(materialId: unknown) {
  createForm.copyFromBomId = ''
  copyVersionOptions.value = []
  if (!materialId) return
  copyVersionLoading.value = true
  try {
    const res = await plmApi.getBomList({ materialId: materialId as string, pageSize: 50 })
    copyVersionOptions.value = (res.list ?? []).map(b => ({
      label: `v${b.version}（${statusLabel(b.status)}）`,
      value: b.id,
    }))
  } catch { /* handled */ } finally {
    copyVersionLoading.value = false
  }
}

function openCreateDrawer() {
  createForm.materialId = ''; createForm.effectiveDate = ''; createForm.expiryDate = ''; createForm.copyFromBomId = ''
  materialOptions.value = []
  copyVersionOptions.value = []
  createDrawerVisible.value = true
}

async function handleCreate() {
  if (!createForm.materialId) { Message.warning('请选择物料'); return }
  submitting.value = true
  try {
    const bom: Record<string, unknown> = { materialId: createForm.materialId }
    if (createForm.effectiveDate) bom.effectiveDate = createForm.effectiveDate
    if (createForm.expiryDate) bom.expiryDate = createForm.expiryDate
    await plmApi.createBom({
      bom,
      copyFromBomId: createForm.copyFromBomId || undefined,
    })
    Message.success(createForm.copyFromBomId ? '新建成功，已从选定版本复制明细' : '新建成功')
    createDrawerVisible.value = false
    loadData()
  } catch { /* handled */ } finally {
    submitting.value = false
  }
}

// ─── BOM 明细抽屉 ─────────────────────────────────────────────
const detailDrawerVisible = ref(false)
const currentBom = ref<Bom | null>(null)
const bomLines = ref<BomLine[]>([])
const linesLoading = ref(false)

const showAddLineForm = ref(false)
const addLineLoading = ref(false)
const newLineForm = reactive<{ sequence: number; materialId: string; quantity: number; lossRate: number }>({
  sequence: 1, materialId: '', quantity: 1, lossRate: 0,
})

const lineMaterialOptions = ref<Material[]>([])
let lineMaterialTimer: ReturnType<typeof setTimeout> | null = null

async function searchLineMaterials(kw: string) {
  if (!kw) { lineMaterialOptions.value = []; return }
  if (lineMaterialTimer) clearTimeout(lineMaterialTimer)
  lineMaterialTimer = setTimeout(async () => {
    const res = await plmApi.getMaterials({ keyword: kw, pageSize: 20 })
    lineMaterialOptions.value = res.list ?? []
  }, 300)
}

async function openDetailDrawer(bom: Bom) {
  currentBom.value = bom
  detailDrawerVisible.value = true
  showAddLineForm.value = false
  await loadBomLines(bom.id)
}

async function loadBomLines(bomId: string) {
  linesLoading.value = true
  try {
    const res = await plmApi.getBom(bomId)
    bomLines.value = (res as unknown as { lines?: BomLine[] }).lines ?? []
  } catch {
    bomLines.value = []
  } finally {
    linesLoading.value = false
  }
}

function startAddLine() {
  newLineForm.sequence = bomLines.value.length + 1
  newLineForm.materialId = ''; newLineForm.quantity = 1; newLineForm.lossRate = 0
  lineMaterialOptions.value = []
  showAddLineForm.value = true
}

function cancelAddLine() { showAddLineForm.value = false }

async function submitAddLine() {
  if (!currentBom.value) return
  if (!newLineForm.materialId) { Message.warning('请选择子物料'); return }
  if (!newLineForm.quantity) { Message.warning('请填写数量'); return }
  addLineLoading.value = true
  try {
    await plmApi.addBomLine(currentBom.value.id, {
      sequence: newLineForm.sequence,
      materialId: newLineForm.materialId,
      quantity: newLineForm.quantity,
      lossRate: newLineForm.lossRate,
    })
    Message.success('新增成功')
    showAddLineForm.value = false
    await loadBomLines(currentBom.value.id)
  } catch { /* handled */ } finally {
    addLineLoading.value = false
  }
}

async function handleDeleteLine(line: BomLine) {
  if (!currentBom.value) return
  try {
    await plmApi.deleteBomLine(currentBom.value.id, line.id)
    Message.success('删除成功')
    await loadBomLines(currentBom.value.id)
  } catch { /* handled */ }
}

// ─── 明细行行内编辑 ───────────────────────────────────────────
const editingLineId = ref<string | null>(null)
const editLineLoading = ref(false)
const editLineForm = reactive<{ quantity: number; lossRate: number }>({ quantity: 1, lossRate: 0 })

function startEditLine(line: BomLine) {
  editingLineId.value = line.id
  editLineForm.quantity = Number(line.quantity)
  editLineForm.lossRate = Number(line.lossRate)
}

function cancelEditLine() {
  editingLineId.value = null
}

async function submitEditLine(line: BomLine) {
  if (!currentBom.value) return
  editLineLoading.value = true
  try {
    await plmApi.updateBomLine(currentBom.value.id, line.id, {
      quantity: editLineForm.quantity,
      lossRate: editLineForm.lossRate,
    })
    Message.success('保存成功')
    editingLineId.value = null
    await loadBomLines(currentBom.value.id)
  } catch { /* handled */ } finally {
    editLineLoading.value = false
  }
}

// ─── 版本对比 ─────────────────────────────────────────────────
const compareDrawerVisible = ref(false)
const compareLoading = ref(false)
const compareV1 = ref('')
const compareV2 = ref('')
const compareBomOptions = ref<{ label: string; value: string }[]>([])
const compareTableData = ref<any[]>([])

const compareColumns = [
  { title: t('plm.bom.index.子物料编码'), dataIndex: 'materialCode', width: 140 },
  { title: t('plm.bom.index.子物料名称'), dataIndex: 'materialName', width: 160 },
  { title: t('plm.bom.index.版本A数量'), dataIndex: 'qtyV1', slotName: 'cmpQtyV1', width: 110 },
  { title: t('plm.bom.index.版本B数量'), dataIndex: 'qtyV2', slotName: 'cmpQtyV2', width: 110 },
  { title: t('plm.bom.index.差异'), slotName: 'cmpDiff', width: 100 },
]

async function openCompareDrawer(bom: Bom) {
  compareDrawerVisible.value = true
  compareV1.value = ''; compareV2.value = ''; compareTableData.value = []
  try {
    const res = await plmApi.getBomList({ materialId: bom.materialId, pageSize: 100 })
    compareBomOptions.value = (res.list ?? []).map(b => ({
      label: `v${b.version} (${statusLabel(b.status)})`, value: b.id,
    }))
  } catch { compareBomOptions.value = [] }
}

async function runCompare() {
  if (!compareV1.value || !compareV2.value) return
  compareLoading.value = true
  try {
    const res = await plmApi.compareBoms(compareV1.value, compareV2.value)
    const rows: Record<string, unknown>[] = []
    ;(res.added ?? []).forEach(l => rows.push({ ...l, qtyV1: null, qtyV2: l.quantity, diffType: 'added' }))
    ;(res.removed ?? []).forEach(l => rows.push({ ...l, qtyV1: l.quantity, qtyV2: null, diffType: 'removed' }))
    ;(res.modified ?? []).forEach(l => rows.push({ ...l, diffType: 'modified' }))
    compareTableData.value = rows
  } catch { /* handled */ } finally {
    compareLoading.value = false
  }
}

function compareRowClass(record: Record<string, unknown>) {
  if (record.diffType === 'added') return 'compare-row-added'
  if (record.diffType === 'removed') return 'compare-row-removed'
  if (record.diffType === 'modified') return 'compare-row-modified'
  return ''
}

onMounted(loadData)
</script>

<style scoped>
.page-container { padding: 16px; }
:deep(.compare-row-added) td { background-color: #e8ffea !important; }
:deep(.compare-row-removed) td { background-color: #fff1f0 !important; }
:deep(.compare-row-modified) td { background-color: #fffbe6 !important; }
</style>
