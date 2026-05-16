<template>
  <div class="page-container">
    <!-- 顶部面包屑 -->
    <a-page-header
      :title="$t('plm.material.物料详情')"
      :subtitle="material?.name"
      @back="router.back()"
      style="margin-bottom: 16px; padding: 0"
    />

    <!-- 基本信息 -->
    <a-card :title="$t('plm.material.基本信息')" :bordered="false" style="margin-bottom: 16px" :loading="loading">
      <a-descriptions :column="3" bordered>
        <a-descriptions-item :label="$t('plm.material.物料编码')">{{ material?.code }}</a-descriptions-item>
        <a-descriptions-item :label="$t('plm.material.物料名称')">{{ material?.name }}</a-descriptions-item>
        <a-descriptions-item :label="$t('plm.material.物料类型')">{{ material?.type }}</a-descriptions-item>
        <a-descriptions-item :label="$t('plm.material.单位')">{{ material?.unit }}</a-descriptions-item>
        <a-descriptions-item :label="$t('plm.material.规格')">{{ material?.spec || '-' }}</a-descriptions-item>
        <a-descriptions-item :label="$t('common.status')">
          <a-tag :color="statusColor(material?.status)">{{ statusLabel(material?.status) }}</a-tag>
        </a-descriptions-item>
        <a-descriptions-item :label="$t('common.description')" :span="3">{{ material?.description || '-' }}</a-descriptions-item>
      </a-descriptions>
    </a-card>

    <!-- BOM / 工艺路线标签页 -->
    <a-card :bordered="false">
      <a-tabs default-active-key="bom">
        <!-- BOM 标签页 -->
        <a-tab-pane key="bom" title="BOM">
          <div style="margin-bottom: 12px">
            <a-select
              v-model="selectedBomId"
              :placeholder="$t('plm.material.选择BOM')"
              style="width: 280px"
              :loading="bomListLoading"
              @change="onBomSelect"
            >
              <a-option v-for="b in bomList" :key="b.id" :value="b.id">
                {{ b.materialCode }} - {{ b.materialName }}
              </a-option>
            </a-select>
          </div>
          <a-table
            v-if="bomTree"
            :columns="bomColumns"
            :data="[bomTree]"
            :loading="bomTreeLoading"
            row-key="id"
            :pagination="false"
            :bordered="{ cell: false }"
          />
          <a-empty v-else :description="$t('plm.material.请选择BOM查看树形')" />
        </a-tab-pane>

        <!-- 工艺路线标签页 -->
        <a-tab-pane key="routing" :title="$t('plm.material.工艺路线')">
          <a-table
            :columns="routingColumns"
            :data="routingList"
            :loading="routingLoading"
            row-key="id"
            :pagination="false"
            :bordered="{ cell: false }"
          >
            <template #expandRow="{ record }">
              <a-table
                :columns="operationColumns"
                :data="record.operations || []"
                :pagination="false"
                size="small"
                :bordered="{ cell: false }"
              />
            </template>
          </a-table>
        </a-tab-pane>
      </a-tabs>
    </a-card>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
import { useI18n } from 'vue-i18n'
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { plmApi, type Material, type BomNode, type Routing } from '@/api/plm'

const route = useRoute()
const router = useRouter()
const id = route.params.id as string

const loading = ref(false)
const material = ref<Material>()

// BOM
const bomListLoading = ref(false)
const bomTreeLoading = ref(false)
const bomList = ref<BomNode[]>([])
const selectedBomId = ref<string>()
const bomTree = ref<BomNode>()

// 工艺路线
const routingLoading = ref(false)
const routingList = ref<Routing[]>([])

const bomColumns = [
  { title: t('plm.material.detail.物料编码'), dataIndex: 'materialCode', key: 'materialCode' },
  { title: t('plm.material.detail.物料名称'), dataIndex: 'materialName', key: 'materialName' },
  { title: t('plm.material.detail.数量'), dataIndex: 'quantity', key: 'quantity', width: 100 },
  { title: t('plm.material.detail.单位'), dataIndex: 'unit', key: 'unit', width: 80 },
]

const routingColumns = [
  { title: t('plm.material.detail.路线编码'), dataIndex: 'code', key: 'code', width: 140 },
  { title: t('plm.material.detail.路线名称'), dataIndex: 'name', key: 'name' },
  { title: t('plm.material.detail.状态'), dataIndex: 'status', key: 'status', width: 100 },
]

const operationColumns = [
  { title: t('plm.material.detail.序号'), dataIndex: 'seqNo', key: 'seqNo', width: 80 },
  { title: t('plm.material.detail.工序名称'), dataIndex: 'name', key: 'name' },
  { title: t('plm.material.detail.标准工时min'), dataIndex: 'standardTime', key: 'standardTime', width: 140 },
]

function statusColor(status?: string) {
  return status === 'active' ? 'green' : status === 'inactive' ? 'red' : 'gray'
}

function statusLabel(status?: string) {
  return status === 'active' ? t('plm.material.enable') : status === 'inactive' ? t('plm.material.disable') : t('plm.material.draft')
}

async function loadMaterial() {
  loading.value = true
  try {
    material.value = await plmApi.getMaterial(id)
  } finally {
    loading.value = false
  }
}

async function loadBomList() {
  bomListLoading.value = true
  try {
    const res = await plmApi.getBoms(id)
    bomList.value = res.list ?? []
  } finally {
    bomListLoading.value = false
  }
}

async function onBomSelect(bomId: string) {
  bomTreeLoading.value = true
  try {
    bomTree.value = await plmApi.expandBom(bomId)
  } finally {
    bomTreeLoading.value = false
  }
}

async function loadRoutings() {
  routingLoading.value = true
  try {
    const res = await plmApi.getRoutings({ materialId: id, page: 1, pageSize: 100 })
    // 逐个加载工序详情
    const list = res.list ?? []
    const detailed = await Promise.all(list.map(r => plmApi.getRouting(r.id)))
    routingList.value = detailed
  } finally {
    routingLoading.value = false
  }
}

onMounted(() => {
  loadMaterial()
  loadBomList()
  loadRoutings()
})
</script>

<style scoped>
.page-container {
  padding: 16px;
}
</style>
