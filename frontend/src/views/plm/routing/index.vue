<template>
  <div class="page-container">
    <!-- 顶部工具栏 -->
    <a-card :bordered="false" style="margin-bottom: 16px">
      <a-space wrap>
        <a-input
          v-model="query.keyword"
          :placeholder="$t('plm.routing.路线编码名称')"
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
          <a-option value="ACTIVE">{{ $t('plm.routing.lbl1420') }}</a-option>
          <a-option value="DRAFT">{{ $t('plm.routing.draft') }}</a-option>
          <a-option value="OBSOLETE">{{ $t('plm.routing.lbl1421') }}</a-option>
        </a-select>
        <a-button type="primary" @click="loadData">{{ $t('common.search') }}</a-button>
        <a-button @click="resetQuery">{{ $t('common.reset') }}</a-button>
      </a-space>
      <template #extra>
        <a-button type="primary" @click="openCreateDrawer">{{ $t('plm.routing.lbl1422') }}</a-button>
      </template>
    </a-card>

    <!-- 路线列表 -->
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
        <template #action="{ record }">
          <a-space>
            <a-link @click="openOpsDrawer(record as unknown as Routing)">{{ $t('plm.routing.lbl1423') }}</a-link>
            <a-popconfirm
              v-if="record.status === 'DRAFT'"
              :content="$t('plm.routing.确认激活该路线激活后')"
              @ok="handleActivate(record as unknown as Routing)"
            >
              <a-link :loading="activatingId === record.id">{{ $t('plm.routing.lbl1424') }}</a-link>
            </a-popconfirm>
            <a-popconfirm
              v-if="record.status === 'ACTIVE'"
              :content="$t('plm.routing.确认废止该路线此操作')"
              @ok="handleRetire(record.id as string)"
            >
              <a-link status="warning" :loading="retiringId === record.id">{{ $t('plm.routing.lbl1425') }}</a-link>
            </a-popconfirm>
            <a-link @click="openCopyModal(record as unknown as Routing)">{{ $t('plm.routing.lbl1426') }}</a-link>
            <a-popconfirm
              :content="$t('plm.routing.确认删除该路线')"
              @ok="handleDelete(record.id as string)"
            >
              <a-link status="danger">{{ $t('common.delete') }}</a-link>
            </a-popconfirm>
          </a-space>
        </template>
      </MTable>
    </a-card>

    <!-- 新建路线抽屉 -->
    <a-drawer
      v-model:visible="createDrawerVisible"
      :title="$t('plm.routing.新建路线')"
      :width="520"
      @cancel="createDrawerVisible = false"
    >
      <a-form :model="createForm" layout="vertical">
        <a-form-item :label="$t('plm.routing.路线编码')" required>
          <a-input v-model="createForm.code" :placeholder="$t('plm.routing.请输入路线编码')" />
        </a-form-item>
        <a-form-item :label="$t('plm.routing.路线名称')" required>
          <a-input v-model="createForm.name" :placeholder="$t('plm.routing.请输入路线名称')" />
        </a-form-item>
        <a-form-item :label="$t('plm.routing.物料')" required>
          <a-select
            v-model="createForm.materialId"
            :placeholder="$t('plm.routing.输入编码或名称搜索物')"
            allow-search
            allow-clear
            :filter-option="false"
            style="width: 100%"
            @search="searchCreateMaterials"
          >
            <a-option
              v-for="m in createMatOptions"
              :key="m.id"
              :value="m.id"
              :label="`${m.code} - ${m.name}`"
            />
          </a-select>
        </a-form-item>
        <a-form-item :label="$t('plm.routing.版本')">
          <a-input v-model="createForm.version" :placeholder="$t('plm.routing.如V10')" />
        </a-form-item>
        <a-form-item style="margin-top: 24px">
          <a-space>
            <a-button type="primary" :loading="submitting" @click="handleCreate">{{ $t('common.save') }}</a-button>
            <a-button @click="createDrawerVisible = false">{{ $t('common.cancel') }}</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-drawer>

    <!-- 工序详情抽屉 -->
    <a-drawer
      v-model:visible="opsDrawerVisible"
      :title="`${currentRouting?.name ?? ''} - ${$t('plm.routing.index.工序列表')}`"
      :width="760"
      @cancel="opsDrawerVisible = false"
    >
      <div style="margin-bottom: 12px">
        <a-button
          type="primary"
          size="small"
          :disabled="currentRouting?.status === 'ACTIVE'"
          @click="startAddOp"
        >
          {{ $t('plm.routing.addOperation') }}
        </a-button>
      </div>

      <!-- 新增工序内联表单 -->
      <a-card v-if="showAddOpForm" :bordered="true" style="margin-bottom: 12px; background: #f7f8fa">
        <a-form layout="inline" :model="newOpForm">
          <a-form-item :label="$t('plm.routing.序号')" style="width: 90px">
            <a-input-number v-model="newOpForm.seqNo" :min="1" style="width: 65px" />
          </a-form-item>
          <a-form-item :label="$t('plm.routing.工序名称')" style="width: 160px">
            <a-select
              v-model="selectedStdOpId"
              :placeholder="$t('plm.routing.选择标准工序')"
              allow-search
              allow-clear
              :filter-option="false"
              style="width: 160px"
              @search="searchStdOps"
              @change="onStdOpChange"
            >
              <a-option
                v-for="op in stdOpOptions"
                :key="op.id"
                :value="op.id"
                :label="`${op.code} - ${op.name}`"
              />
            </a-select>
          </a-form-item>
          <a-form-item :label="$t('plm.routing.工作中心')" style="width: 200px">
            <WorkCenterSelect v-model="newOpForm.workcenterId" @change="(node) => newOpForm.workcenterName = node?.name" style="width: 160px" />
          </a-form-item>
          <a-form-item :label="$t('plm.routing.标准工时')" style="width: 120px">
            <a-input-number v-model="newOpForm.standardTime" :min="0" :precision="1" style="width: 80px" />
          </a-form-item>
          <a-form-item :label="$t('plm.routing.准备时间')" style="width: 120px">
            <a-input-number v-model="newOpForm.setupTime" :min="0" :precision="1" style="width: 80px" />
          </a-form-item>
          <a-form-item :label="$t('common.description')" style="width: 180px">
            <a-input v-model="newOpForm.description" :placeholder="$t('plm.routing.描述')" style="width: 140px" />
          </a-form-item>
          <a-form-item>
            <a-space>
              <a-button type="primary" size="small" :loading="addOpLoading" @click="submitAddOp">{{ $t('plm.routing.confirm') }}</a-button>
              <a-button size="small" @click="cancelAddOp">{{ $t('common.cancel') }}</a-button>
            </a-space>
          </a-form-item>
        </a-form>
      </a-card>

      <!-- 工序表格（行内编辑） -->
      <a-table
        :columns="opColumns"
        :data="operations"
        :loading="opsLoading"
        :pagination="false"
        row-key="id"
        :bordered="{ cell: false }"
      >
        <template #seqNo="{ record }">
          <a-input-number
            v-if="editingOpId === record.id"
            v-model="editOpForm.seqNo"
            :min="1"
            style="width: 60px"
          />
          <span v-else>{{ record.sequence }}</span>
        </template>
        <template #name="{ record }">
          <a-input
            v-if="editingOpId === record.id"
            v-model="editOpForm.name"
            style="width: 110px"
          />
          <span v-else>{{ record.name }}</span>
        </template>
        <template #workcenterName="{ record }">
          <WorkCenterSelect
            v-if="editingOpId === record.id"
            v-model="editOpForm.workcenterId"
            @change="(node) => editOpForm.workcenterName = node?.name"
            style="width: 150px"
          />
          <span v-else>{{ record.workcenterName ?? '-' }}</span>
        </template>
        <template #standardTime="{ record }">
          <a-input-number
            v-if="editingOpId === record.id"
            v-model="editOpForm.standardTime"
            :min="0"
            :precision="1"
            style="width: 75px"
          />
          <span v-else>{{ record.standardTime != null ? record.standardTime : '-' }}</span>
        </template>
        <template #setupTime="{ record }">
          <a-input-number
            v-if="editingOpId === record.id"
            v-model="editOpForm.setupTime"
            :min="0"
            :precision="1"
            style="width: 75px"
          />
          <span v-else>{{ record.setupTime != null ? record.setupTime : '-' }}</span>
        </template>
        <template #description="{ record }">
          <a-input
            v-if="editingOpId === record.id"
            v-model="editOpForm.description"
            style="width: 120px"
          />
          <span v-else>{{ record.description ?? '-' }}</span>
        </template>
        <template #opAction="{ record }">
          <template v-if="editingOpId === record.id">
            <a-space>
              <a-link :loading="editOpLoading" @click="submitEditOp(record as RoutingOperation)">{{ $t('plm.routing.save') }}</a-link>
              <a-link @click="cancelEditOp">{{ $t('plm.routing.cancel') }}</a-link>
            </a-space>
          </template>
          <template v-else>
            <a-space>
              <a-link
                :disabled="currentRouting?.status === 'ACTIVE'"
                @click="startEditOp(record as RoutingOperation)"
              >{{ $t('common.edit') }}</a-link>
              <a-popconfirm
                :content="$t('plm.routing.确认删除该工序')"
                :disabled="currentRouting?.status === 'ACTIVE'"
                @ok="handleDeleteOp(record as RoutingOperation)"
              >
                <a-link
                  status="danger"
                  :disabled="currentRouting?.status === 'ACTIVE'"
                >{{ $t('common.delete') }}</a-link>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-drawer>

    <!-- 复制路线弹窗 -->
    <a-modal
      v-model:visible="copyModalVisible"
      :title="$t('plm.routing.复制路线')"
      :ok-loading="copyLoading"
      @ok="handleCopy"
      @cancel="copyModalVisible = false"
    >
      <a-form :model="{copyTargetMaterialId}" layout="vertical">
        <a-form-item :label="$t('plm.routing.目标物料可选留空则复')">
          <a-select
            v-model="copyTargetMaterialId"
            :placeholder="$t('plm.routing.搜索目标物料')"
            allow-search
            allow-clear
            :filter-option="false"
            style="width: 100%"
            @search="searchCopyMaterials"
          >
            <a-option
              v-for="m in copyMatOptions"
              :key="m.id"
              :value="m.id"
              :label="`${m.code} - ${m.name}`"
            />
          </a-select>
        </a-form-item>
        <p style="color: #86909c; font-size: 13px; margin: 0">
          {{ $t('plm.routing.copyHint', { name: copySourceRouting?.name }) }}
        </p>
      </a-form>
    </a-modal>
    <!-- 在制工单阻断提示 Modal -->
    <a-modal
      v-model:visible="workOrderModalVisible"
      :title="$t('plm.routing.操作被拒绝存在在制工')"
      :footer="false"
      @cancel="workOrderModalVisible = false"
    >
      <p style="margin-bottom: 12px; color: #86909c">{{ $t('plm.routing.lbl1427') }}</p>
      <a-table
        :columns="[{ title: t('plm.routing.index.工单号'), dataIndex: 'woNo' }, { title: t('plm.routing.index.状态'), dataIndex: 'status' }]"
        :data="blockedWorkOrders"
        :pagination="false"
        size="small"
      />
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { ref, reactive, onMounted } from 'vue'
import { Message } from '@arco-design/web-vue'
import MTable from '@/components/MTable/index.vue'
import type { MTableColumn } from '@/components/MTable/index.vue'
import { plmApi, type Routing, type RoutingOperation, type Material, type StandardOperation } from '@/api/plm'
import WorkCenterSelect from '@/components/BusinessSelect/WorkCenterSelect.vue'

// ─── 列表状态 ────────────────────────────────────────────────
const loading = ref(true) // 初始 true，确保页面首帧就有 loading 状态
const tableData = ref<any[]>([])
const total = ref(0)
const query = reactive({ keyword: '', status: '', page: 1, pageSize: 20 })

const columns: MTableColumn[] = [
  { key: 'code', title: t('plm.routing.index.编码'), dataIndex: 'code', width: 120 },
  { key: 'name', title: t('plm.routing.index.名称'), dataIndex: 'name', width: 160 },
  { key: 'materialName', title: t('plm.routing.index.物料名称'), dataIndex: 'materialName', width: 160 },
  { key: 'version', title: t('plm.routing.index.版本'), dataIndex: 'version', width: 90 },
  { key: 'status', title: t('plm.routing.index.状态'), slotName: 'status', width: 90 },
  { key: 'action', title: t('plm.routing.index.操作'), slotName: 'action', width: 220 },
]

const opColumns = [
  { title: t('plm.routing.index.序号'), dataIndex: 'sequence', slotName: 'seqNo', width: 65 },
  { title: t('plm.routing.index.工序名称'), dataIndex: 'name', slotName: 'name', width: 130 },
  { title: t('plm.routing.index.工作中心'), dataIndex: 'workcenterName', slotName: 'workcenterName', width: 120 },
  { title: t('plm.routing.index.标准工时min'), dataIndex: 'standardTime', slotName: 'standardTime', width: 120 },
  { title: t('plm.routing.index.准备时间min'), dataIndex: 'setupTime', slotName: 'setupTime', width: 120 },
  { title: t('plm.routing.index.描述'), dataIndex: 'description', slotName: 'description', width: 140 },
  { title: t('plm.routing.index.操作'), slotName: 'opAction', width: 120 },
]

function statusColor(status: string) {
  if (status === 'ACTIVE') return 'green'
  if (status === 'DRAFT') return 'orange'
  if (status === 'OBSOLETE') return 'red'
  return 'gray'
}

function statusLabel(status: string) {
  if (status === 'ACTIVE') return t('plm.routing.lbl1428')
  if (status === 'DRAFT') return t('plm.routing.draft')
  if (status === 'OBSOLETE') return t('plm.routing.lbl1429')
  return status
}

async function loadData() {
  loading.value = true
  try {
    const params: Record<string, unknown> = { page: query.page, pageSize: query.pageSize }
    if (query.keyword) params.keyword = query.keyword
    if (query.status) params.status = query.status
    const res = await plmApi.getRoutingList(params)
    tableData.value = (res.list ?? []) as any[]
    total.value = res.total ?? 0
  } catch {
    // handled by interceptor
  } finally {
    loading.value = false
  }
}

function resetQuery() {
  query.keyword = ''
  query.status = ''
  query.page = 1
  loadData()
}

function onTableChange(e: { page: number; pageSize: number }) {
  query.page = e.page
  query.pageSize = e.pageSize
  loadData()
}

// ─── 激活 ────────────────────────────────────────────────────
const activatingId = ref<string | null>(null)

async function handleActivate(routing: Routing) {
  activatingId.value = routing.id
  try {
    await plmApi.activateRouting(routing.id)
    Message.success(t('plm.激活成功'))
    loadData()
  } catch {
    // handled
  } finally {
    activatingId.value = null
  }
}

// ─── 废止 ────────────────────────────────────────────────────
const retiringId = ref<string | null>(null)
const workOrderModalVisible = ref(false)
const blockedWorkOrders = ref<{ woNo: string; status: string }[]>([])

async function handleRetire(id: string) {
  retiringId.value = id
  try {
    await plmApi.retireRouting(id)
    Message.success(t('plm.废止成功'))
    loadData()
  } catch (e: unknown) {
    const err = e as { response?: { data?: { workOrders?: { woNo: string; status: string }[] } } }
    const wos = err?.response?.data?.workOrders
    if (wos?.length) { blockedWorkOrders.value = wos; workOrderModalVisible.value = true }
  } finally {
    retiringId.value = null
  }
}

// ─── 删除 ────────────────────────────────────────────────────
async function handleDelete(id: string) {
  try {
    await plmApi.deleteRouting(id)
    Message.success(t('plm.删除成功'))
    loadData()
  } catch {
    // handled
  }
}

// ─── 新建路线 ─────────────────────────────────────────────────
const createDrawerVisible = ref(false)
const submitting = ref(false)
const createForm = reactive({ code: '', name: '', materialId: '', version: '' })

// 物料搜索
const createMatOptions = ref<Material[]>([])
let createMatTimer: ReturnType<typeof setTimeout> | null = null
async function searchCreateMaterials(kw: string) {
  if (!kw) { createMatOptions.value = []; return }
  if (createMatTimer) clearTimeout(createMatTimer)
  createMatTimer = setTimeout(async () => {
    const res = await plmApi.getMaterials({ keyword: kw, pageSize: 20 })
    createMatOptions.value = res.list ?? []
  }, 300)
}

function openCreateDrawer() {
  Object.assign(createForm, { code: '', name: '', materialId: '', version: '' })
  createMatOptions.value = []
  createDrawerVisible.value = true
}

async function handleCreate() {
  if (!createForm.code) { Message.warning(t('plm.请输入路线编码')); return }
  if (!createForm.name) { Message.warning(t('plm.请输入路线名称')); return }
  if (!createForm.materialId) { Message.warning(t('plm.请选择物料')); return }
  submitting.value = true
  try {
    await plmApi.createRouting({ routing: { ...createForm } })
    Message.success(t('plm.新建成功'))
    createDrawerVisible.value = false
    loadData()
  } catch { /* handled */ } finally {
    submitting.value = false
  }
}

// ─── 工序抽屉 ─────────────────────────────────────────────────
const opsDrawerVisible = ref(false)
const currentRouting = ref<Routing | null>(null)
const operations = ref<RoutingOperation[]>([])
const opsLoading = ref(false)

// 新增工序
const showAddOpForm = ref(false)
const addOpLoading = ref(false)
const newOpForm = reactive<any>({
  seqNo: undefined, name: '', workcenterId: '', workcenterName: '', standardTime: undefined, setupTime: undefined, description: '',
})

// 编辑工序
const editingOpId = ref<string | null>(null)
const editOpLoading = ref(false)
const editOpForm = reactive<any>({
  id: '', seqNo: undefined, name: '', workcenterId: '', workcenterName: '', standardTime: undefined, setupTime: undefined, description: '',
})

async function openOpsDrawer(routing: Routing) {
  currentRouting.value = routing
  opsDrawerVisible.value = true
  showAddOpForm.value = false
  editingOpId.value = null
  await loadOperations(routing.id)
}

async function loadOperations(routingId: string) {
  opsLoading.value = true
  try {
    const res = await plmApi.getRouting(routingId)
    operations.value = res.operations ?? []
  } catch {
    operations.value = []
  } finally {
    opsLoading.value = false
  }
}

function startAddOp() {
  showAddOpForm.value = true
  selectedStdOpId.value = undefined
  Object.assign(newOpForm, { seqNo: undefined, name: '', workcenterId: '', workcenterName: '', standardTime: undefined, setupTime: undefined, description: '' })
}

function cancelAddOp() {
  showAddOpForm.value = false
}

// 标准工序搜索
const selectedStdOpId = ref<string | undefined>(undefined)
const stdOpOptions = ref<StandardOperation[]>([])
let stdOpTimer: ReturnType<typeof setTimeout> | null = null
async function searchStdOps(kw: string) {
  if (!kw) { stdOpOptions.value = []; return }
  if (stdOpTimer) clearTimeout(stdOpTimer)
  stdOpTimer = setTimeout(async () => {
    const res = await plmApi.getStandardOperations({ keyword: kw, pageSize: 20 })
    stdOpOptions.value = res.items ?? []
  }, 300)
}

function onStdOpChange(val: any) {
  if (!val) {
    // 清空时重置
    newOpForm.name = ''
    newOpForm.workcenterId = ''
    newOpForm.workcenterName = ''
    newOpForm.standardTime = undefined
    newOpForm.setupTime = undefined
    newOpForm.description = ''
    return
  }
  const selected = stdOpOptions.value.find(o => o.id === val)
  if (selected) {
    newOpForm.name = selected.name
    newOpForm.workcenterId = selected.workCenterId ?? ''
    newOpForm.workcenterName = selected.workCenterName ?? ''
    newOpForm.standardTime = selected.stdHours != null ? Number(selected.stdHours) : undefined
    newOpForm.setupTime = selected.setupTime != null ? Number(selected.setupTime) : undefined
    newOpForm.description = selected.description ?? ''
  }
}

async function submitAddOp() {
  if (!currentRouting.value) return
  if (!newOpForm.name) {
    Message.warning(t('plm.请填写工序名称'))
    return
  }
  addOpLoading.value = true
  try {
    await plmApi.addOperation(currentRouting.value.id, { ...newOpForm })
    Message.success(t('plm.新增成功'))
    showAddOpForm.value = false
    await loadOperations(currentRouting.value.id)
  } catch {
    // handled
  } finally {
    addOpLoading.value = false
  }
}

function startEditOp(record: RoutingOperation) {
  editingOpId.value = record.id
  Object.assign(editOpForm, {
    id: record.id,
    seqNo: record.seqNo,
    name: record.name,
    workcenterId: record.workcenterId,
    workcenterName: record.workcenterName,
    standardTime: record.standardTime != null ? Number(record.standardTime) : undefined,
    setupTime: record.setupTime != null ? Number(record.setupTime) : undefined,
    description: record.description,
  })
}

function cancelEditOp() {
  editingOpId.value = null
}

async function submitEditOp(op: RoutingOperation) {
  editOpLoading.value = true
  try {
    await plmApi.updateOperation(op.id, { ...editOpForm })
    Message.success(t('plm.保存成功'))
    editingOpId.value = null
    if (currentRouting.value) await loadOperations(currentRouting.value.id)
  } catch {
    // handled
  } finally {
    editOpLoading.value = false
  }
}

async function handleDeleteOp(op: RoutingOperation) {
  try {
    await plmApi.deleteOperation(op.id)
    Message.success(t('plm.删除成功'))
    if (currentRouting.value) await loadOperations(currentRouting.value.id)
  } catch {
    // handled
  }
}

// ─── 复制路线 ─────────────────────────────────────────────────
const copyModalVisible = ref(false)
const copyLoading = ref(false)
const copySourceRouting = ref<Routing | null>(null)
const copyTargetMaterialId = ref('')
const copyMatOptions = ref<Material[]>([])
let copyMatTimer: ReturnType<typeof setTimeout> | null = null

async function searchCopyMaterials(kw: string) {
  if (!kw) { copyMatOptions.value = []; return }
  if (copyMatTimer) clearTimeout(copyMatTimer)
  copyMatTimer = setTimeout(async () => {
    const res = await plmApi.getMaterials({ keyword: kw, pageSize: 20 })
    copyMatOptions.value = res.list ?? []
  }, 300)
}

function openCopyModal(routing: Routing) {
  copySourceRouting.value = routing
  copyTargetMaterialId.value = ''
  copyMatOptions.value = []
  copyModalVisible.value = true
}

async function handleCopy() {
  if (!copySourceRouting.value) return
  copyLoading.value = true
  try {
    const data: Record<string, unknown> = {}
    if (copyTargetMaterialId.value) data.targetMaterialId = copyTargetMaterialId.value
    await plmApi.copyRouting(copySourceRouting.value.id, data)
    Message.success(t('plm.复制成功，新路线已创建为草稿状态'))
    copyModalVisible.value = false
    loadData()
  } catch { /* handled */ } finally {
    copyLoading.value = false
  }
}

onMounted(loadData)
</script>

<style scoped>
.page-container {
  padding: 16px;
}
</style>
