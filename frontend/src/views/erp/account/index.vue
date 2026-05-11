<template>
  <div class="page-container">
    <a-card :bordered="false">
      <template #title>科目管理</template>
      <template #extra><a-button type="primary" @click="openModal(null, null)">新建科目</a-button></template>
      <a-spin :loading="loading">
        <a-tree :data="treeData" :default-expand-all="true" block-node>
          <template #title="nodeData">
            <div style="display:flex;align-items:center;justify-content:space-between;width:100%">
              <span>{{ nodeData.code }} - {{ nodeData.title }}</span>
              <a-space @click.stop>
                <a-link size="mini" @click="openModal(null, nodeData.key as string)">新建子科目</a-link>
                <a-link size="mini" @click="openModal(nodeData as unknown as ErpAccount, null)">{{ $t('common.edit') }}</a-link>
              </a-space>
            </div>
          </template>
        </a-tree>
      </a-spin>
    </a-card>
    <a-modal v-model:visible="modalVisible" :title="editing ? '编辑科目' : '新建科目'" :ok-loading="saving" @ok="handleSave" @cancel="modalVisible = false">
      <a-form :model="formData" layout="vertical">
        <a-form-item :label="$t('erp.account.index.科目编码')" required><a-input v-model="formData.code" :disabled="!!editing" /></a-form-item>
        <a-form-item :label="$t('erp.account.index.科目名称')" required><a-input v-model="formData.name" /></a-form-item>
        <a-form-item :label="$t('erp.account.index.科目类型')" required>
          <a-select v-model="formData.type" :disabled="!!editing">
            <a-option value="ASSET">资产</a-option><a-option value="LIABILITY">负债</a-option>
            <a-option value="EQUITY">权益</a-option><a-option value="INCOME">收入</a-option><a-option value="EXPENSE">费用</a-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="$t('erp.account.index.借贷方向')">
          <a-select v-model="formData.direction"><a-option value="DEBIT">借方</a-option><a-option value="CREDIT">贷方</a-option></a-select>
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
import { erpExtApi, type ErpAccount } from '@/api/erp-ext'
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
  if (!formData.code || !formData.name) { Message.warning('请填写科目编码和名称'); return }
  saving.value = true
  try {
    const data = { ...formData, parentId: parentId.value ?? '' }
    if (editing.value) { await erpExtApi.updateAccount(editing.value.id, data); Message.success('更新成功') }
    else { await erpExtApi.createAccount(data); Message.success('创建成功') }
    modalVisible.value = false; loadData()
  } catch { /* handled */ } finally { saving.value = false }
}
onMounted(loadData)
</script>
<style scoped>.page-container { padding: 16px; }</style>
