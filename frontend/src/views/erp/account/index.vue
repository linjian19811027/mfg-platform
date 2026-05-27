<template>
  <div class="page-container">
    <a-card :bordered="false">
      <template #title>{{ $t('erp.account.lbl1150') }}</template>
      <template #extra><a-button type="primary" @click="openModal(null, null)">{{ $t('erp.account.lbl1151') }}</a-button></template>
      <a-spin :loading="loading">
        <a-tree :data="treeData" :default-expand-all="true" block-node>
          <template #title="nodeData">
            <div style="display:flex;align-items:center;justify-content:space-between;width:100%">
              <span>{{ nodeData.code }} - {{ nodeData.title }}</span>
              <a-space @click.stop>
                <a-link size="mini" @click="openModal(null, nodeData.key as string)">{{ $t('erp.account.lbl1152') }}</a-link>
                <a-link size="mini" @click="openModal(nodeData as unknown as ErpAccount, null)">{{ $t('common.edit') }}</a-link>
              </a-space>
            </div>
          </template>
        </a-tree>
      </a-spin>
    </a-card>
    <a-modal v-model:visible="modalVisible" :title="t('erp.account.lbl1153')" :ok-loading="saving" @ok="handleSave" @cancel="modalVisible = false">
      <a-form :model="formData" layout="vertical">
        <a-form-item :label="$t('erp.account.index.科目编码')" required><a-input v-model="formData.code" :disabled="!!editing" /></a-form-item>
        <a-form-item :label="$t('erp.account.index.科目名称')" required><a-input v-model="formData.name" /></a-form-item>
        <a-form-item :label="$t('erp.account.index.科目类型')" required>
          <a-select v-model="formData.type" :disabled="!!editing">
            <a-option value="ASSET">{{ $t('erp.account.lbl1154') }}</a-option><a-option value="LIABILITY">{{ $t('erp.account.lbl1155') }}</a-option>
            <a-option value="EQUITY">{{ $t('erp.account.lbl1156') }}</a-option><a-option value="INCOME">{{ $t('erp.account.lbl1157') }}</a-option><a-option value="EXPENSE">{{ $t('erp.account.lbl1158') }}</a-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="$t('erp.account.index.借贷方向')">
          <a-select v-model="formData.direction"><a-option value="DEBIT">{{ $t('erp.account.lbl1159') }}</a-option><a-option value="CREDIT">{{ $t('erp.account.lbl1160') }}</a-option></a-select>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>
<script setup lang="ts">


import { ref, reactive, onMounted } from 'vue'
import { Message } from '@arco-design/web-vue'
import { erpExtApi, type ErpAccount } from '@/api/erp-ext'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
const loading = ref(false); const treeData = ref<any[]>([])
function toTree(list: ErpAccount[]): Record<string, unknown>[] {
  return list.map(a => ({ key: a.id, title: a.name, code: a.code, type: a.type, direction: a.direction, children: a.children?.length ? toTree(a.children) : undefined }))
}
async function loadData() {
  loading.value = true
  try { const res = await erpExtApi.getAccountTree(); treeData.value = toTree(Array.isArray(res) ? res : []) }
  catch { treeData.value = [] } finally { loading.value = false }
}
const modalVisible = ref(false); const saving = ref(false); const editing = ref<ErpAccount | null>(null); const parentId = ref<string | null>(null)
const formData = reactive({ code: '', name: '', type: 'ASSET', direction: 'DEBIT' })
function openModal(item: ErpAccount | null, pId: string | null) {
  editing.value = item; parentId.value = pId
  if (item) { formData.code = item.code; formData.name = item.name; formData.type = item.type; formData.direction = item.direction ?? '' }
  else { formData.code = ''; formData.name = ''; formData.type = 'ASSET'; formData.direction = 'DEBIT' }
  modalVisible.value = true
}
async function handleSave() {
  if (!formData.code || !formData.name) { Message.warning(t('erp.请填写科目编码和名称')); return }
  saving.value = true
  try {
    const data = { ...formData, parentId: parentId.value ?? '' }
    if (editing.value) { await erpExtApi.updateAccount(editing.value.id, data); Message.success(t('erp.更新成功')) }
    else { await erpExtApi.createAccount(data); Message.success(t('erp.创建成功')) }
    modalVisible.value = false; loadData()
  } catch { /* handled */ } finally { saving.value = false }
}
onMounted(loadData)
</script>
<style scoped>.page-container { padding: 16px; }</style>
