<template>
  <div class="page-container">
    <a-card :bordered="false">
      <div class="action-bar">
        <a-button type="primary" @click="handleCreate">
          <template #icon><icon-plus /></template>
          {{ $t('mes.auto-receipt-config.createConfig') }}
        </a-button>
      </div>

      <a-table :columns="columns" :data="tableData" :loading="loading"
        :pagination="pagination" @page-change="handlePageChange" row-key="id">
        <template #matchType="{ record }">
          <a-tag>{{ record.matchType === 'MATERIAL' ? $t('mes.auto-receipt-config.material') : $t('mes.auto-receipt-config.lbl1268') }}</a-tag>
        </template>
        <template #requireFqc="{ record }">
          <a-tag :color="record.requireFqc ? 'orange' : 'green'">
            {{ record.requireFqc ? $t('mes.auto-receipt-config.lbl1269') : $t('mes.auto-receipt-config.lbl1270') }}
          </a-tag>
        </template>
        <template #enabled="{ record }">
          <a-tag :color="record.enabled ? 'green' : 'gray'">
            {{ record.enabled ? $t('mes.auto-receipt-config.enable') : $t('mes.auto-receipt-config.disable') }}
          </a-tag>
        </template>
        <template #action="{ record }">
          <a-space>
            <a-button type="text" size="small" @click="handleEdit(record)">{{ $t('mes.auto-receipt-config.edit') }}</a-button>
            <a-button type="text" size="small" @click="handleToggle(record)">
              {{ record.enabled ? $t('mes.auto-receipt-config.disable') : $t('mes.auto-receipt-config.enable') }}
            </a-button>
            <a-popconfirm :content="$t('mes.auto-receipt-config.index.确定删除此配置')" @ok="handleDelete(record)">
              <a-button type="text" size="small" status="danger">{{ $t('mes.auto-receipt-config.delete') }}</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </a-table>
    </a-card>

    <a-modal v-model:visible="modalVisible" :title="modalTitle" :ok-loading="submitLoading"
      @ok="handleSubmit" @cancel="modalVisible = false">
      <a-form :model="form" :rules="rules" ref="formRef" layout="vertical">
        <a-form-item :label="$t('mes.auto-receipt-config.index.匹配类型')" field="matchType">
          <a-select v-model="form.matchType">
            <a-option value="MATERIAL">{{ $t('mes.auto-receipt-config.material') }}</a-option>
            <a-option value="CATEGORY">{{ $t('mes.auto-receipt-config.lbl1271') }}</a-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="$t('mes.auto-receipt-config.index.匹配值物料编码或分类代码')" field="matchValue">
          <a-input v-model="form.matchValue" :placeholder="$t('common.placeholder')" />
        </a-form-item>
        <a-form-item :label="$t('mes.auto-receipt-config.index.是否需要FQC检验')">
          <a-switch v-model="form.requireFqc" />
        </a-form-item>
        <a-form-item :label="$t('mes.auto-receipt-config.index.目标仓库ID')">
          <a-input v-model="form.targetWarehouseId" :placeholder="$t('mes.auto-receipt-config.index.可选')" />
        </a-form-item>
        <a-form-item :label="$t('mes.auto-receipt-config.index.目标库位ID')">
          <a-input v-model="form.targetLocationId" :placeholder="$t('mes.auto-receipt-config.index.可选')" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
import { useI18n } from 'vue-i18n'
import { ref, reactive, onMounted } from 'vue'
import { Message } from '@arco-design/web-vue'
import { IconPlus } from '@arco-design/web-vue/es/icon'
import { getAutoReceiptConfigs, createAutoReceiptConfig, updateAutoReceiptConfig, deleteAutoReceiptConfig, toggleAutoReceiptConfig } from '@/api/mes'

const loading = ref(false)
const tableData = ref([])
const pagination = reactive({ current: 1, pageSize: 20, total: 0, showTotal: true })

const columns = [
  { title: t('mes.auto-receipt-config.index.匹配类型'), dataIndex: 'matchType', slotName: 'matchType', width: 100 },
  { title: t('mes.auto-receipt-config.index.匹配值'), dataIndex: 'matchValue', width: 200 },
  { title: t('mes.auto-receipt-config.index.是否需FQC'), dataIndex: 'requireFqc', slotName: 'requireFqc', width: 110 },
  { title: t('mes.auto-receipt-config.index.目标仓库'), dataIndex: 'targetWarehouseId', width: 120 },
  { title: t('mes.auto-receipt-config.index.目标库位'), dataIndex: 'targetLocationId', width: 120 },
  { title: t('mes.auto-receipt-config.index.状态'), dataIndex: 'enabled', slotName: 'enabled', width: 80 },
  { title: t('mes.auto-receipt-config.index.操作'), slotName: 'action', width: 180, fixed: 'right' as const },
]

const modalVisible = ref(false)
const modalTitle = ref(t('mes.auto-receipt-config.lbl1272'))
const submitLoading = ref(false)
const formRef = ref()
const form = reactive({ id: '', matchType: 'MATERIAL', matchValue: '', requireFqc: false, targetWarehouseId: '', targetLocationId: '' })
const rules = {
  matchType: [{ required: true, message: t('mes.auto-receipt-config.select') }],
  matchValue: [{ required: true, message: t('mes.auto-receipt-config.input') }],
}

onMounted(fetchData)

async function fetchData() {
  loading.value = true
  try {
    const res = await getAutoReceiptConfigs({ page: pagination.current, pageSize: pagination.pageSize })
    tableData.value = (res as any).data?.items ?? (res as any).data ?? []
    pagination.total = (res as any).data?.total ?? 0
  } catch (e: any) { Message.error(e.message || t('mes.加载失败')) }
  finally { loading.value = false }
}

function handlePageChange(page: number) { pagination.current = page; fetchData() }

function handleCreate() {
  Object.assign(form, { id: '', matchType: 'MATERIAL', matchValue: '', requireFqc: false, targetWarehouseId: '', targetLocationId: '' })
  modalTitle.value = t('mes.auto-receipt-config.lbl1273')
  modalVisible.value = true
}

function handleEdit(record: any) {
  Object.assign(form, record)
  modalTitle.value = t('mes.auto-receipt-config.lbl1274')
  modalVisible.value = true
}

async function handleSubmit() {
  try {
    await formRef.value?.validate()
    submitLoading.value = true
    if (form.id) {
      await updateAutoReceiptConfig(form.id, form)
      Message.success(t('mes.更新成功'))
    } else {
      await createAutoReceiptConfig(form)
      Message.success(t('mes.创建成功'))
    }
    modalVisible.value = false
    fetchData()
  } catch (e: any) { if (e.message) Message.error(e.message) }
  finally { submitLoading.value = false }
}

async function handleToggle(record: any) {
  try {
    await toggleAutoReceiptConfig(record.id)
    Message.success(t('mes.操作成功'))
    fetchData()
  } catch (e: any) { Message.error(e.message || t('mes.操作失败')) }
}

async function handleDelete(record: any) {
  try {
    await deleteAutoReceiptConfig(record.id)
    Message.success(t('mes.删除成功'))
    fetchData()
  } catch (e: any) { Message.error(e.message || t('mes.删除失败')) }
}
</script>

<style scoped>
.page-container { padding: 16px; }
.action-bar { margin-bottom: 16px; }
</style>
