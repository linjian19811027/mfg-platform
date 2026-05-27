<template>
  <div class="page-container">
    <a-card :bordered="false">
      <template #title>{{ $t('erp.cost-center.lbl1166') }}</template>
      <template #extra><a-button type="primary" @click="openModal(null, null)">{{ $t('erp.cost-center.lbl1167') }}</a-button></template>
      <a-spin :loading="loading">
        <a-tree :data="treeData" :default-expand-all="true" block-node>
          <template #title="nodeData">
            <div style="display:flex;align-items:center;justify-content:space-between;width:100%">
              <span>{{ nodeData.code }} - {{ nodeData.title }}</span>
              <a-space @click.stop>
                <a-link size="mini" @click="openModal(null, nodeData.key as string)">{{ $t('erp.cost-center.lbl1168') }}</a-link>
                <a-link size="mini" @click="openModal(nodeData as unknown as ErpCostCenter, null)">{{ $t('common.edit') }}</a-link>
              </a-space>
            </div>
          </template>
        </a-tree>
      </a-spin>
    </a-card>
    <a-modal v-model:visible="modalVisible" :title="t('erp.cost-center.lbl1169')" :ok-loading="saving" @ok="handleSave" @cancel="modalVisible = false">
      <a-form :model="formData" layout="vertical">
        <a-form-item :label="$t('common.code')" required><a-input v-model="formData.code" /></a-form-item>
        <a-form-item :label="$t('common.name')" required><a-input v-model="formData.name" /></a-form-item>
        <a-form-item :label="$t('erp.cost-center.index.负责人ID')"><a-input v-model="formData.responsibleId" /></a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>
<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { Message } from '@arco-design/web-vue'
import { erpExtApi, type ErpCostCenter } from '@/api/erp-ext'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
const loading = ref(false); const treeData = ref<any[]>([])
function toTree(list: ErpCostCenter[]): Record<string, unknown>[] {
  return list.map(c => ({ key: c.id, title: c.name, code: c.code, responsibleId: c.responsibleId, children: c.children?.length ? toTree(c.children) : undefined }))
}
async function loadData() {
  loading.value = true
  try { const res = await erpExtApi.getCostCenterTree(); treeData.value = toTree(Array.isArray(res) ? res : []) }
  catch { treeData.value = [] } finally { loading.value = false }
}
const modalVisible = ref(false); const saving = ref(false); const editing = ref<ErpCostCenter | null>(null); const parentId = ref<string | null>(null)
const formData = reactive({ code: '', name: '', responsibleId: '' })
function openModal(item: ErpCostCenter | null, pId: string | null) {
  editing.value = item; parentId.value = pId
  if (item) { formData.code = item.code; formData.name = item.name; formData.responsibleId = item.responsibleId ?? '' }
  else { formData.code = ''; formData.name = ''; formData.responsibleId = '' }
  modalVisible.value = true
}
async function handleSave() {
  if (!formData.code || !formData.name) { Message.warning(t('erp.请填写编码和名称')); return }
  saving.value = true
  try {
    await erpExtApi.createCostCenter({ ...formData, parentId: parentId.value || undefined })
    Message.success(editing.value ? t('erp.cost-center.lbl1170') : t('erp.cost-center.lbl1171')); modalVisible.value = false; loadData()
  } catch { /* handled */ } finally { saving.value = false }
}
onMounted(loadData)
</script>
<style scoped>.page-container { padding: 16px; }</style>
