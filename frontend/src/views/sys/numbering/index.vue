<template>
  <div class="page-container">
    <a-card :bordered="false" style="margin-bottom: 16px">
      <a-space wrap>
        <a-select v-model="query.businessKey" placeholder="业务模块" allow-clear style="width: 180px">
          <a-option value="PLM_MATERIAL">PLM-物料</a-option>
          <a-option value="PLM_ECR">PLM-变更申请(ECR)</a-option>
          <a-option value="PLM_ECN">PLM-变更通知(ECN)</a-option>
          <a-option value="SCM_PO">SCM-采购订单</a-option>
          <a-option value="WMS_IN">WMS-入库单</a-option>
        </a-select>
        <a-input v-model="query.keyword" placeholder="规则名称/编码" allow-clear style="width: 200px" />
        <a-button type="primary" @click="loadData">查询</a-button>
        <a-button @click="resetQuery">重置</a-button>
      </a-space>
      <template #extra>
        <a-button type="primary" @click="openDrawer(null)">
          <template #icon><icon-plus /></template>
          新建全局规则
        </a-button>
      </template>
    </a-card>

    <a-card :bordered="false">
      <MTable
        :columns="columns"
        :data="tableData"
        :loading="loading"
        :total="total"
        :page-size="query.pageSize"
        @change="onTableChange"
      >
        <template #mode="{ record }">
          <a-tag :color="record.mode === 'AUTO' ? 'arcoblue' : 'orange'">{{ record.mode }}</a-tag>
        </template>
        <template #status="{ record }">
          <a-badge :status="record.status === 'ACTIVE' ? 'success' : 'normal'" :text="record.status" />
        </template>
        <template #action="{ record }">
          <a-space>
            <a-link @click="openDrawer(record)">编辑</a-link>
            <a-popconfirm content="确认删除此规则？" @ok="handleDelete(record.id)">
              <a-link status="danger">删除</a-link>
            </a-popconfirm>
          </a-space>
        </template>
      </MTable>
    </a-card>

    <a-drawer v-model:visible="drawerVisible" :title="formData.id ? '编辑规则' : '新建规则'" :width="600">
      <a-form :model="formData" layout="vertical" @submit="handleSave">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item field="businessKey" label="业务模块" required>
              <a-select v-model="formData.businessKey">
                <a-option value="PLM_MATERIAL">PLM-物料</a-option>
                <a-option value="PLM_ECR">PLM-变更申请(ECR)</a-option>
                <a-option value="PLM_ECN">PLM-变更通知(ECN)</a-option>
                <a-option value="SCM_PO">SCM-采购订单</a-option>
                <a-option value="WMS_IN">WMS-入库单</a-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item field="code" label="规则编码" required>
              <a-input v-model="formData.code" placeholder="如 RULE_ECR_DEFAULT" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item field="name" label="规则名称" required>
          <a-input v-model="formData.name" placeholder="如 ECR自动编号规则" />
        </a-form-item>
        
        <a-divider orientation="left">规则定义</a-divider>
        
        <div v-for="(seg, index) in formData.segments" :key="index" class="segment-item">
          <a-row :gutter="8" align="center">
            <a-col :span="6">
              <a-select v-model="seg.type" placeholder="类型">
                <a-option value="CONST">常量 (CONST)</a-option>
                <a-option value="DATE">日期 (DATE)</a-option>
                <a-option value="SERIAL">流水号 (SERIAL)</a-option>
                <a-option value="FIELD">业务字段 (FIELD)</a-option>
              </a-select>
            </a-col>
            <a-col :span="14">
              <a-input v-if="seg.type === 'CONST'" v-model="seg.value" placeholder="常量内容" />
              <a-select v-else-if="seg.type === 'DATE'" v-model="seg.format" placeholder="日期格式">
                <a-option value="YYYY">年 (YYYY)</a-option>
                <a-option value="YYYYMM">年+月 (YYYYMM)</a-option>
                <a-option value="YYYYMMDD">年月日 (YYYYMMDD)</a-option>
              </a-select>
              <a-input-number v-else-if="seg.type === 'SERIAL'" v-model="seg.length" placeholder="位数" :min="1" :max="10" />
              <a-input v-else-if="seg.type === 'FIELD'" v-model="seg.value" placeholder="业务字段名 (如 categoryCode)" />
            </a-col>
            <a-col :span="4">
              <a-button type="text" status="danger" @click="removeSegment(index)"><icon-delete /></a-button>
            </a-col>
          </a-row>
        </div>
        <a-button type="outline" long @click="addSegment" style="margin-top: 8px">
          <template #icon><icon-plus /></template> 添加段
        </a-button>

        <a-form-item style="margin-top: 24px">
          <a-space>
            <a-button type="primary" html-type="submit" :loading="saving">提交</a-button>
            <a-button @click="drawerVisible = false">取消</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { Message } from '@arco-design/web-vue'
import { baseApi } from '@/api/base'
import MTable from '@/components/MTable/index.vue'
import type { MTableColumn } from '@/components/MTable/index.vue'

const loading = ref(false)
const total = ref(0)
const saving = ref(false)
const drawerVisible = ref(false)
const tableData = ref<any[]>([])
const query = reactive({ businessKey: '', keyword: '', page: 1, pageSize: 20 })

const columns: MTableColumn[] = [
  { key: 'businessKey', title: '业务模块', dataIndex: 'businessKey', width: 150 },
  { key: 'code', title: '规则编码', dataIndex: 'code', width: 150 },
  { key: 'name', title: '规则名称', dataIndex: 'name', width: 180 },
  { key: 'mode', title: '模式', slotName: 'mode', width: 100 },
  { key: 'currentSerial', title: '当前序列', dataIndex: 'currentSerial', width: 100 },
  { key: 'status', title: '状态', slotName: 'status', width: 100 },
  { key: 'action', title: '操作', slotName: 'action', width: 120 },
]

const formData = ref<any>({
  businessKey: '',
  code: '',
  name: '',
  mode: 'AUTO',
  segments: [],
  isDefault: true,
  status: 'ACTIVE'
})

async function loadData() {
  loading.value = true
  try {
    const res = await baseApi.getNumberingRules(query)
    tableData.value = res.list
    total.value = res.total
  } finally {
    loading.value = false
  }
}

function resetQuery() {
  query.businessKey = ''
  query.keyword = ''
  loadData()
}

function onTableChange(e: any) {
  query.page = e.page
  query.pageSize = e.pageSize
  loadData()
}

function openDrawer(rule: any) {
  if (rule) {
    formData.value = { ...rule }
  } else {
    formData.value = {
      businessKey: 'PLM_ECR',
      code: '',
      name: '',
      mode: 'AUTO',
      segments: [{ type: 'CONST', value: 'ECR-' }, { type: 'DATE', format: 'YYYY' }, { type: 'CONST', value: '-' }, { type: 'SERIAL', length: 4 }],
      isDefault: true,
      status: 'ACTIVE'
    }
  }
  drawerVisible.value = true
}

function addSegment() {
  formData.value.segments.push({ type: 'CONST', value: '' })
}

function removeSegment(index: number) {
  formData.value.segments.splice(index, 1)
}

async function handleSave() {
  saving.value = true
  try {
    if (formData.value.id) {
      await baseApi.updateNumberingRule(formData.value.id, formData.value)
      Message.success('更新成功')
    } else {
      await baseApi.createNumberingRule(formData.value)
      Message.success('创建成功')
    }
    drawerVisible.value = false
    loadData()
  } finally {
    saving.value = false
  }
}

async function handleDelete(id: string) {
  await baseApi.deleteNumberingRule(id)
  Message.success('删除成功')
  loadData()
}

onMounted(loadData)
</script>

<style scoped>
.page-container { padding: 16px; }
.segment-item { 
  margin-bottom: 12px; 
  padding: 12px; 
  background: var(--color-fill-1); 
  border-radius: 4px;
}
</style>
