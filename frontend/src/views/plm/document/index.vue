<template>
  <div class="page-container">
    <!-- 顶部工具栏 -->
    <a-card :bordered="false" style="margin-bottom: 16px">
      <a-space wrap>
        <a-select
          v-model="query.refType"
          :placeholder="$t('plm.document.对象类型')"
          allow-clear
          style="width: 140px"
        >
          <a-option value="MATERIAL">物料</a-option>
          <a-option value="BOM">BOM</a-option>
          <a-option value="ROUTING">工艺路线</a-option>
        </a-select>
        <a-input
          v-model="query.keyword"
          :placeholder="$t('plm.document.文件名搜索')"
          allow-clear
          style="width: 200px"
          @keyup.enter="loadData"
        />
        <a-button type="primary" @click="loadData">{{ $t('common.search') }}</a-button>
        <a-button @click="resetQuery">{{ $t('common.reset') }}</a-button>
      </a-space>
      <template #extra>
        <a-button type="primary" @click="openUploadDrawer">
          <template #icon><icon-upload /></template>
          上传文档
        </a-button>
      </template>
    </a-card>

    <!-- 列表 -->
    <a-card :bordered="false">
      <MTable
        :columns="columns"
        :data="tableData"
        :loading="loading"
        :total="total"
        :page-size="query.pageSize"
        @change="onTableChange"
      >
        <template #refType="{ record }">
          <a-tag :color="refTypeColor(record.refType as string)">
            {{ refTypeLabel(record.refType as string) }}
          </a-tag>
        </template>
        <template #fileSize="{ record }">
          {{ formatSize(record.fileSize as number) }}
        </template>
        <template #action="{ record }">
          <a-space>
            <a-link
              v-if="record.downloadUrl"
              :href="record.downloadUrl as string"
              target="_blank"
            >
              下载
            </a-link>
            <a-popconfirm
              :content="$t('plm.document.确认删除该文档')"
              @ok="handleDelete(record.id as string)"
            >
              <a-link status="danger">{{ $t('common.delete') }}</a-link>
            </a-popconfirm>
          </a-space>
        </template>
      </MTable>
    </a-card>

    <!-- 上传抽屉 -->
    <a-drawer
      v-model:visible="uploadDrawerVisible"
      :title="$t('plm.document.上传文档')"
      :width="520"
      @cancel="uploadDrawerVisible = false"
    >
      <a-form ref="uploadFormRef" :model="uploadForm" layout="vertical">
        <a-form-item
          :label="$t('plm.document.对象类型')"
          field="refType"
          :rules="[{ required: true, message: '请选择对象类型' }]"
        >
          <a-select v-model="uploadForm.refType" :placeholder="$t('plm.document.请选择对象类型')">
            <a-option value="MATERIAL">物料</a-option>
            <a-option value="BOM">BOM</a-option>
            <a-option value="ROUTING">工艺路线</a-option>
          </a-select>
        </a-form-item>
        <a-form-item
          :label="$t('plm.document.关联ID')"
          field="refId"
          :rules="[{ required: true, message: '关联ID不能为空' }]"
        >
          <a-input v-model="uploadForm.refId" :placeholder="$t('plm.document.请输入关联对象的ID')" />
        </a-form-item>
        <a-form-item :label="$t('plm.document.选择文件')" field="file" :rules="[{ required: true, message: '请选择文件' }]">
          <a-upload
            :limit="1"
            accept=".pdf,.doc,.docx,.xlsx,.jpg,.png"
            :auto-upload="false"
            @change="onFileChange"
          >
            <template #upload-button>
              <a-button>
                <template #icon><icon-upload /></template>
                选择文件（≤50MB）
              </a-button>
            </template>
          </a-upload>
          <div style="margin-top: 4px; color: var(--color-text-3); font-size: 12px">
            支持 PDF、Word、Excel、图片，单文件不超过 50MB
          </div>
        </a-form-item>
      </a-form>

      <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--color-border)">
        <a-button @click="uploadDrawerVisible = false">{{ $t('common.cancel') }}</a-button>
        <a-button type="primary" :loading="uploading" @click="handleUpload">上传</a-button>
      </div>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
import { useI18n } from 'vue-i18n'
import { ref, reactive, onMounted } from 'vue'
import { Message } from '@arco-design/web-vue'
import MTable from '@/components/MTable/index.vue'
import type { MTableColumn } from '@/components/MTable/index.vue'
import { plmApi } from '@/api/plm'

// ─── 列表 ────────────────────────────────────────────────────
const loading = ref(false)
const tableData = ref<any[]>([])
const total = ref(0)
const query = reactive({ keyword: '', refType: '', page: 1, pageSize: 20 })

const columns: MTableColumn[] = [
  { key: 'fileName', title: t('plm.document.index.文件名'), dataIndex: 'fileName', width: 200, ellipsis: true },
  { key: 'refType', title: t('plm.document.index.关联类型'), slotName: 'refType', width: 110 },
  { key: 'refId', title: t('plm.document.index.关联ID'), dataIndex: 'refId', width: 160, ellipsis: true },
  { key: 'fileSize', title: t('plm.document.index.文件大小'), slotName: 'fileSize', width: 100 },
  { key: 'uploadedBy', title: t('plm.document.index.上传人'), dataIndex: 'uploadedBy', width: 100 },
  { key: 'createdAt', title: t('plm.document.index.上传时间'), dataIndex: 'createdAt', width: 160 },
  { key: 'action', title: t('plm.document.index.操作'), slotName: 'action', width: 120 },
]

function refTypeColor(type: string) {
  if (type === 'MATERIAL') return 'blue'
  if (type === 'BOM') return 'orange'
  if (type === 'ROUTING') return 'purple'
  return 'gray'
}

function refTypeLabel(type: string) {
  if (type === 'MATERIAL') return '物料'
  if (type === 'BOM') return 'BOM'
  if (type === 'ROUTING') return '工艺路线'
  return type
}

function formatSize(bytes: number): string {
  if (!bytes) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

async function loadData() {
  loading.value = true
  try {
    const params: Record<string, unknown> = { page: query.page, pageSize: query.pageSize }
    if (query.keyword) params.keyword = query.keyword
    if (query.refType) params.refType = query.refType
    const res = await plmApi.getDocuments(params)
    tableData.value = (res.list ?? []) as any[]
    total.value = res.total ?? 0
  } catch {
    // handled
  } finally {
    loading.value = false
  }
}

function resetQuery() {
  query.keyword = ''
  query.refType = ''
  query.page = 1
  loadData()
}

function onTableChange(e: { page: number; pageSize: number }) {
  query.page = e.page
  query.pageSize = e.pageSize
  loadData()
}

async function handleDelete(id: string) {
  try {
    await plmApi.deleteDocument(id)
    Message.success('删除成功')
    loadData()
  } catch {
    // handled
  }
}

// ─── 上传抽屉 ─────────────────────────────────────────────────
const uploadDrawerVisible = ref(false)
const uploading = ref(false)
const uploadFormRef = ref()
const uploadForm = reactive({ refType: '', refId: '', file: null as File | null })

function onFileChange(_: unknown, fileList: { file: File }[]) {
  uploadForm.file = fileList.length ? fileList[fileList.length - 1].file : null
}

function openUploadDrawer() {
  uploadForm.refType = ''
  uploadForm.refId = ''
  uploadForm.file = null
  uploadDrawerVisible.value = true
}

async function handleUpload() {
  try {
    await uploadFormRef.value?.validate()
  } catch {
    return
  }
  if (!uploadForm.file) {
    Message.warning('请选择文件')
    return
  }
  const fileSizeMB = uploadForm.file.size / 1024 / 1024
  if (fileSizeMB > 50) {
    Message.error('文件大小不能超过 50MB')
    return
  }
  uploading.value = true
  try {
    const fd = new FormData()
    fd.append('file', uploadForm.file)
    fd.append('refType', uploadForm.refType)
    fd.append('refId', uploadForm.refId)
    await plmApi.uploadDocument(fd)
    Message.success('上传成功')
    uploadDrawerVisible.value = false
    loadData()
  } catch {
    // handled
  } finally {
    uploading.value = false
  }
}

onMounted(loadData)
</script>

<style scoped>
.page-container {
  padding: 16px;
}
</style>
