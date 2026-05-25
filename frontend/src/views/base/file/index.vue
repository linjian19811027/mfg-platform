<template>
  <div class="page-container">
    <a-card>
      <!-- 搜索栏 + 操作按钮 -->
      <div class="search-bar">
        <a-input
          v-model="query.fileName"
          :placeholder="$t('base.file.index.文件名')"
          allow-clear
          style="width: 200px"
          @press-enter="handleSearch"
        />
        <a-select
          v-model="query.fileType"
          :placeholder="$t('base.file.index.文件类型')"
          allow-clear
          style="width: 130px"
        >
          <a-option v-for="t in FILE_TYPE_OPTIONS" :key="t.value" :value="t.value">
            {{ t.label }}
          </a-option>
        </a-select>
        <a-range-picker
          v-model="dateRange"
          style="width: 240px"
          :placeholder="[$t('common.start') + $t('common.time'), $t('common.end') + $t('common.time')]"
        />
        <a-button type="primary" @click="handleSearch">{{ $t('common.search') }}</a-button>
        <a-button @click="resetQuery">{{ $t('common.reset') }}</a-button>

        <div style="margin-left: auto">
          <a-upload
            :custom-request="handleUpload"
            :show-file-list="false"
            multiple
            accept="*"
          >
            <template #upload-button>
              <a-button type="primary" :loading="uploading">
                <template #icon><icon-upload /></template>
                {{ $t('base.file.uploadFile') }}
              </a-button>
            </template>
          </a-upload>
        </div>
      </div>

      <!-- 上传进度 -->
      <div v-if="uploadQueue.length > 0" class="upload-progress-bar">
        <div v-for="item in uploadQueue" :key="item.name" class="upload-item">
          <icon-file style="margin-right: 6px; color: var(--color-text-3)" />
          <span class="upload-name">{{ item.name }}</span>
          <a-progress
            :percent="item.percent"
            :status="item.status"
            style="flex: 1; margin: 0 12px"
            size="small"
          />
          <span class="upload-status-text">{{ item.statusText }}</span>
        </div>
      </div>

      <MTable
        :columns="columns"
        :data="list as any[]"
        :loading="loading"
        :total="total"
        @change="onTableChange"
      >
        <template #fileType="{ record }">
          <a-tag :color="getTypeColor(record.fileType as FileType)" size="small">
            <template #icon>
              <component :is="getTypeIcon(record.fileType as FileType)" />
            </template>
            {{ getTypeLabel(record.fileType as FileType) }}
          </a-tag>
        </template>

        <template #fileSize="{ record }">
          <span>{{ formatSize(record.fileSize as number) }}</span>
        </template>

        <template #bizType="{ record }">
          <a-tag color="arcoblue" size="small">{{ record.bizType }}</a-tag>
          <span v-if="record.bizNo" style="margin-left: 4px; font-size: 12px; color: var(--color-text-3)">
            {{ record.bizNo }}
          </span>
        </template>

        <template #action="{ record }">
          <a-space>
            <a-button
              type="text"
              size="small"
              @click="openPreview(record as unknown as FileRecord)"
            >
              {{ $t('base.file.action.preview') }}
            </a-button>
            <a-button
              type="text"
              size="small"
              :loading="downloadingId === record.id"
              @click="handleDownload(record as unknown as FileRecord)"
            >
              {{ $t('base.file.action.download') }}
            </a-button>
            <a-popconfirm
              :content="t('base.file.confirm.delete', { fileName: record.fileName })"
              @ok="handleDelete(record as unknown as FileRecord)"
            >
              <a-button type="text" size="small" status="danger">{{ $t('common.delete') }}</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </MTable>
    </a-card>

    <!-- 文件预览组件 -->
    <FilePreview :file-id="previewFileId" @close="previewFileId = null" />

  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
import { useI18n } from 'vue-i18n'
import { ref, reactive, onMounted } from 'vue'
import { Message } from '@arco-design/web-vue'
import {
  IconUpload, IconFile,
  IconImage, IconFile as IconDoc, IconStorage,
} from '@arco-design/web-vue/es/icon'
import MTable from '@/components/MTable/index.vue'
import type { MTableColumn } from '@/components/MTable/index.vue'
import FilePreview from '@/components/FilePreview/index.vue'
import { fileApi, type FileRecord, type FileType } from '@/api/base'

// ---- 常量 ----

const FILE_TYPE_OPTIONS = [
  { value: 'image',       label: t('base.file.lbl1033'),   color: 'green',      icon: 'IconImage' },
  { value: 'document',    label: t('base.file.lbl1034'),   color: 'arcoblue',   icon: 'IconFile' },
  { value: 'spreadsheet', label: t('base.file.lbl1035'),   color: 'lime',       icon: 'IconStorage' },
  { value: 'pdf',         label: 'PDF',    color: 'red',        icon: 'IconFile' },
  { value: 'other',       label: t('base.file.lbl1036'),   color: 'gray',       icon: 'IconFile' },
]

function getTypeColor(type: FileType): string {
  return FILE_TYPE_OPTIONS.find(t => t.value === type)?.color ?? 'gray'
}

function getTypeLabel(type: FileType): string {
  return FILE_TYPE_OPTIONS.find(t => t.value === type)?.label ?? type
}

function getTypeIcon(type: FileType) {
  const map: Record<FileType, unknown> = {
    image: IconImage,
    document: IconDoc,
    spreadsheet: IconStorage,
    pdf: IconDoc,
    other: IconFile,
  }
  return map[type] ?? IconFile
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

// ---- 列定义 ----

const columns: MTableColumn[] = [
  { key: 'fileName',   title: t('base.file.index.文件名'),     ellipsis: true, width: 220 },
  { key: 'fileType',   title: t('base.file.index.文件类型'),   width: 110,  slotName: 'fileType' },
  { key: 'fileSize',   title: t('base.file.index.文件大小'),   width: 100,  slotName: 'fileSize' },
  { key: 'uploader',   title: t('base.file.index.上传人'),     width: 90 },
  { key: 'uploadedAt', title: t('base.file.index.上传时间'),   width: 160 },
  { key: 'bizType',    title: t('base.file.index.关联业务'),   width: 200,  slotName: 'bizType' },
  { key: 'action',     title: t('base.file.index.操作'),       width: 180,  slotName: 'action' },
]

// ---- 查询状态 ----

const query = reactive({ fileName: '', fileType: '' })
const dateRange = ref<string[]>([])
const list = ref<FileRecord[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const pageSize = ref(20)

async function loadData() {
  loading.value = true
  try {
    const res = await fileApi.getFiles({
      ...query,
      startTime: dateRange.value?.[0] || undefined,
      endTime: dateRange.value?.[1] || undefined,
      page: page.value,
      pageSize: pageSize.value,
    })
    list.value = res.list
    total.value = res.total
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  page.value = 1
  loadData()
}

function resetQuery() {
  query.fileName = ''
  query.fileType = ''
  dateRange.value = []
  page.value = 1
  loadData()
}

function onTableChange(e: { page: number; pageSize: number }) {
  page.value = e.page
  pageSize.value = e.pageSize
  loadData()
}

// ---- 上传 ----

interface UploadQueueItem {
  name: string
  percent: number
  status: 'normal' | 'success' | 'danger'
  statusText: string
}

const uploading = ref(false)
const uploadQueue = ref<UploadQueueItem[]>([])

function handleUpload(option: any): Record<string, unknown> {
  const file = option.fileItem.file
  const queueItem: UploadQueueItem = {
    name: file.name,
    percent: 0,
    status: 'normal',
    statusText: t('base.file.lbl1037')
  }
  uploadQueue.value.push(queueItem)
  uploading.value = true

  // 模拟进度
  const timer = setInterval(() => {
    if (queueItem.percent < 80) {
      queueItem.percent += Math.floor(Math.random() * 20) + 5
      if (queueItem.percent > 80) queueItem.percent = 80
      option.onProgress({ percent: queueItem.percent })
    }
  }, 200)

  ;(async () => {
    try {
      await fileApi.uploadFile(file)
      clearInterval(timer)
      queueItem.percent = 100
      queueItem.status = 'success'
      queueItem.statusText = t('base.file.lbl1038')
      option.onSuccess()
      Message.success(`${file.name} ${t('base.file.uploadSuccess')}`)
      loadData()
    } catch {
      clearInterval(timer)
      queueItem.status = 'danger'
      queueItem.statusText = t('base.file.lbl1039')
      option.onError()
      Message.error(`${file.name} ${t('base.file.uploadFailed')}`)
    } finally {
      uploading.value = uploadQueue.value.some(i => i.status === 'normal')
      // 3秒后清除已完成项
      setTimeout(() => {
        uploadQueue.value = uploadQueue.value.filter(i => i.status === 'normal')
      }, 3000)
    }
  })()

  return { abort: () => { clearInterval(timer) } }
}

// ---- 下载 ----

const downloadingId = ref<string | null>(null)

async function handleDownload(file: FileRecord) {
  downloadingId.value = file.id
  try {
    await fileApi.downloadFile(file)
    Message.success(t('base.下载成功'))
  } catch {
    Message.error(t('base.下载失败'))
  } finally {
    downloadingId.value = null
  }
}

// ---- 删除 ----

async function handleDelete(file: FileRecord) {
  try {
    await fileApi.deleteFile(file.id)
    Message.success(t('base.删除成功'))
    loadData()
  } catch {
    Message.error(t('base.删除失败'))
  }
}

// ---- 文件预览 ----

const previewFileId = ref<string | null>(null)

function openPreview(file: FileRecord) {
  previewFileId.value = file.id
}

// ---- 初始化 ----

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.page-container {
  padding: 16px;
}

.search-bar {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.upload-progress-bar {
  background: var(--color-fill-2);
  border: 1px solid var(--color-border-2);
  border-radius: 6px;
  padding: 10px 14px;
  margin-bottom: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.upload-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.upload-name {
  width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: var(--color-text-2);
}

.upload-status-text {
  font-size: 12px;
  color: var(--color-text-3);
  width: 60px;
  text-align: right;
}

.preview-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 300px;
  background: var(--color-fill-2);
  border-radius: 4px;
  overflow: hidden;
}

.preview-image {
  max-width: 100%;
  max-height: 560px;
  object-fit: contain;
}

.file-info-icon {
  display: flex;
  justify-content: center;
  padding: 24px 0 8px;
}
</style>
