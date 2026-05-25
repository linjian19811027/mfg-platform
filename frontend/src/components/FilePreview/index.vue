<template>
  <a-modal
    v-model:visible="visible"
    :title="fileInfo?.originalName || '文件预览'"
    :width="previewWidth"
    :footer="showFooter"
    :mask-closable="true"
    @cancel="handleClose"
  >
    <template #title>
      <div style="display: flex; align-items: center; gap: 8px">
        <span>{{ fileInfo?.originalName || '文件预览' }}</span>
        <a-tag v-if="fileInfo?.mimeType" size="small">{{ fileInfo.mimeType }}</a-tag>
      </div>
    </template>

    <div class="preview-container" v-loading="loading">
      <!-- PDF 预览 -->
      <div v-if="previewType === 'pdf'" class="pdf-preview">
        <div class="pdf-toolbar">
          <a-button size="mini" :disabled="currentPage <= 1" @click="currentPage--; renderPdfPage()">
            <template #icon><icon-left /></template>
          </a-button>
          <span class="pdf-page-info">{{ currentPage }} / {{ totalPages }}</span>
          <a-button size="mini" :disabled="currentPage >= totalPages" @click="currentPage++; renderPdfPage()">
            <template #icon><icon-right /></template>
          </a-button>
          <a-button size="mini" @click="pdfScale = Math.max(0.5, pdfScale - 0.2); renderPdfPage()">-</a-button>
          <span>{{ Math.round(pdfScale * 100) }}%</span>
          <a-button size="mini" @click="pdfScale = Math.min(3, pdfScale + 0.2); renderPdfPage()">+</a-button>
        </div>
        <canvas ref="pdfCanvasRef" class="pdf-canvas"></canvas>
      </div>

      <!-- 图片预览 -->
      <div v-else-if="previewType === 'image'" class="image-preview">
        <div class="image-toolbar">
          <a-button size="mini" @click="imgScale = Math.max(0.2, imgScale - 0.3)">-</a-button>
          <span>{{ Math.round(imgScale * 100) }}%</span>
          <a-button size="mini" @click="imgScale = Math.min(5, imgScale + 0.3)">+</a-button>
          <a-button size="mini" @click="imgRotation = (imgRotation + 90) % 360">
            <template #icon><icon-refresh /></template>
          </a-button>
          <a-button size="mini" @click="imgScale = 1; imgRotation = 0">{{ $t('common.reset') || '重置' }}</a-button>
        </div>
        <div class="image-wrapper">
          <img
            :src="previewUrl"
            :style="{ transform: `scale(${imgScale}) rotate(${imgRotation}deg)`, transition: 'transform 0.2s' }"
            @load="loading = false"
          />
        </div>
      </div>

      <!-- 文本/代码预览 -->
      <div v-else-if="previewType === 'text'" class="text-preview">
        <div class="text-toolbar" v-if="editable">
          <a-button size="mini" type="primary" :loading="saving" @click="saveTextContent">
            {{ $t('common.save') || '保存' }}
          </a-button>
          <a-tag v-if="isDirty" color="orange">未保存</a-tag>
        </div>
        <div ref="editorRef" class="editor-container"></div>
      </div>

      <!-- CSV/Excel 表格预览 -->
      <div v-else-if="previewType === 'table'" class="table-preview">
        <a-table :columns="tableColumns" :data="tableData" :pagination="{ pageSize: 50 }" size="small" />
      </div>

      <!-- Word 文档预览 -->
      <div v-else-if="previewType === 'word'" class="word-preview">
        <div v-html="wordHtml" class="word-content"></div>
      </div>

      <!-- 不支持的类型 -->
      <div v-else class="unsupported-preview">
        <a-empty :description="`不支持预览此文件类型: ${fileInfo?.mimeType || '未知'}`">
          <a-button type="primary" @click="downloadFile">{{ $t('common.download') || '下载文件' }}</a-button>
        </a-empty>
      </div>
    </div>

    <template #footer>
      <div style="display: flex; justify-content: space-between; align-items: center">
        <div v-if="fileInfo">
          <span style="color: var(--color-text-3); font-size: 12px">
            {{ formatSize(Number(fileInfo.sizeBytes)) }} · v{{ fileInfo.version }} · {{ fileInfo.createdAt?.substring(0, 19) }}
          </span>
        </div>
        <a-space>
          <a-button @click="downloadFile">{{ $t('common.download') || '下载' }}</a-button>
          <a-button @click="handleClose">{{ $t('common.close') || '关闭' }}</a-button>
        </a-space>
      </div>
    </template>
  </a-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { Message } from '@arco-design/web-vue'
import { request } from '@/utils/request'

interface FileInfo {
  id: string
  originalName: string
  mimeType?: string
  sizeBytes?: string
  version?: number
  createdAt?: string
}

const props = defineProps<{
  fileId: string | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const visible = ref(false)
const loading = ref(false)
const saving = ref(false)
const fileInfo = ref<FileInfo | null>(null)
const previewUrl = ref('')
const previewType = ref<'pdf' | 'image' | 'text' | 'table' | 'word' | 'unsupported'>('unsupported')
const isDirty = ref(false)
const editable = ref(false)

// PDF state
const pdfCanvasRef = ref<HTMLCanvasElement | null>(null)
const currentPage = ref(1)
const totalPages = ref(1)
const pdfScale = ref(1.5)
let pdfDoc: any = null

// Image state
const imgScale = ref(1)
const imgRotation = ref(0)

// Text/Code state
const editorRef = ref<HTMLDivElement | null>(null)
let editorView: any = null

// Table state
const tableColumns = ref<any[]>([])
const tableData = ref<any[]>([])

// Word state
const wordHtml = ref('')

const previewWidth = computed(() => {
  if (previewType.value === 'text') return '80vw'
  if (previewType.value === 'table') return '90vw'
  return '70vw'
})

const showFooter = computed(() => {
  return previewType.value !== 'unsupported'
})

const TEXT_EXTENSIONS = ['txt', 'csv', 'json', 'xml', 'html', 'css', 'js', 'ts', 'sql', 'md', 'yml', 'yaml', 'ini', 'conf', 'log']
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp']
const EXCEL_EXTENSIONS = ['xlsx', 'xls']

function getFileExtension(name: string): string {
  return (name.split('.').pop() || '').toLowerCase()
}

function detectPreviewType(file: FileInfo): typeof previewType.value {
  const ext = getFileExtension(file.originalName)
  const mime = (file.mimeType || '').toLowerCase()

  if (mime.includes('pdf') || ext === 'pdf') return 'pdf'
  if (mime.startsWith('image/') || IMAGE_EXTENSIONS.includes(ext)) return 'image'
  if (mime.includes('spreadsheet') || mime.includes('excel') || EXCEL_EXTENSIONS.includes(ext)) return 'table'
  if (mime.includes('wordprocessingml') || ext === 'docx') return 'word'
  if (mime.startsWith('text/') || TEXT_EXTENSIONS.includes(ext)) return 'text'
  if (mime.includes('json') || mime.includes('xml')) return 'text'
  return 'unsupported'
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

async function openPreview(fileId: string) {
  visible.value = true
  loading.value = true
  isDirty.value = false

  try {
    // 获取文件元数据
    const file = await request.get<FileInfo>(`/v1/files/${fileId}`)
    fileInfo.value = file
    previewType.value = detectPreviewType(file)
    editable.value = previewType.value === 'text'

    const baseUrl = '/api'
    previewUrl.value = `${baseUrl}/v1/files/${fileId}/preview`

    await nextTick()

    switch (previewType.value) {
      case 'pdf':
        await loadPdf()
        break
      case 'image':
        // 图片通过 img src 直接加载
        break
      case 'text':
        await loadTextEditor(fileId)
        break
      case 'table':
        await loadExcelPreview(fileId)
        break
      case 'word':
        await loadWordPreview(fileId)
        break
      default:
        loading.value = false
    }
  } catch (e: any) {
    Message.error(e.message || '加载文件失败')
    loading.value = false
  }
}

async function loadPdf() {
  try {
    const pdfjsLib = await import('pdfjs-dist')
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

    const loadingTask = pdfjsLib.getDocument(previewUrl.value)
    pdfDoc = await loadingTask.promise
    totalPages.value = pdfDoc.numPages
    currentPage.value = 1
    loading.value = false
    await renderPdfPage()
  } catch (e) {
    loading.value = false
    previewType.value = 'unsupported'
  }
}

async function renderPdfPage() {
  if (!pdfDoc || !pdfCanvasRef.value) return
  const page = await pdfDoc.getPage(currentPage.value)
  const viewport = page.getViewport({ scale: pdfScale.value })
  const canvas = pdfCanvasRef.value
  canvas.height = viewport.height
  canvas.width = viewport.width
  const ctx = canvas.getContext('2d')
  await page.render({ canvasContext: ctx, viewport }).promise
}

async function loadTextEditor(fileId: string) {
  try {
    const res = await request.get<{ content: string; mimeType?: string }>(`/v1/files/${fileId}/content`)
    const content = res.content || ''

    const { EditorView, basicSetup } = await import('codemirror')
    const { EditorState } = await import('@codemirror/state')
    const { oneDark } = await import('@codemirror/theme-one-dark')
    const { json } = await import('@codemirror/lang-json')
    const { sql } = await import('@codemirror/lang-sql')
    const { xml } = await import('@codemirror/lang-xml')

    const ext = getFileExtension(fileInfo.value?.originalName || '')
    const extensions = [basicSetup, EditorView.lineWrapping, oneDark]

    if (ext === 'json') extensions.push(json())
    else if (ext === 'sql') extensions.push(sql())
    else if (ext === 'xml' || ext === 'html') extensions.push(xml())

    extensions.push(
      EditorView.updateListener.of((update) => {
        if (update.docChanged) isDirty.value = true
      }),
    )

    const state = EditorState.create({ doc: content, extensions })
    editorView = new EditorView({ state, parent: editorRef.value! })
    loading.value = false
  } catch (e) {
    loading.value = false
    previewType.value = 'unsupported'
  }
}

async function loadExcelPreview(fileId: string) {
  try {
    const XLSX = await import('xlsx')
    const resp = await fetch(`/api/v1/files/${fileId}/preview`)
    const buffer = await resp.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][]

    if (jsonData.length > 0) {
      tableColumns.value = (jsonData[0] as any[]).map((col: any, i: number) => ({
        title: String(col || `列${i + 1}`),
        dataIndex: String(i),
      }))
      tableData.value = jsonData.slice(1).map((row: any[], i: number) => {
        const obj: Record<string, any> = { _rowId: i }
        ;(jsonData[0] as any[]).forEach((_: any, j: number) => {
          obj[String(j)] = row[j] ?? ''
        })
        return obj
      })
    }
    loading.value = false
  } catch (e) {
    loading.value = false
    previewType.value = 'unsupported'
  }
}

async function loadWordPreview(fileId: string) {
  try {
    const mammoth = await import('mammoth')
    const resp = await fetch(`/api/v1/files/${fileId}/preview`)
    const buffer = await resp.arrayBuffer()
    const result = await mammoth.convertToHtml({ arrayBuffer: buffer })
    wordHtml.value = result.value
    loading.value = false
  } catch (e) {
    loading.value = false
    previewType.value = 'unsupported'
  }
}

async function saveTextContent() {
  if (!fileInfo.value || !editorView) return
  saving.value = true
  try {
    const content = editorView.state.doc.toString()
    await request.put(`/v1/files/${fileInfo.value.id}/content`, { content })
    isDirty.value = false
    Message.success('保存成功')
  } catch (e: any) {
    Message.error(e.message || '保存失败')
  } finally {
    saving.value = false
  }
}

function downloadFile() {
  if (!fileInfo.value) return
  window.open(`/api/v1/files/${fileInfo.value.id}/download`, '_blank')
}

function handleClose() {
  if (isDirty.value) {
    if (!confirm('有未保存的修改，确定关闭吗？')) return
  }
  if (editorView) {
    editorView.destroy()
    editorView = null
  }
  visible.value = false
  emit('close')
}

watch(() => props.fileId, (newId) => {
  if (newId) openPreview(newId)
})
</script>

<style scoped>
.preview-container {
  min-height: 300px;
  max-height: 70vh;
  overflow: auto;
}

/* PDF */
.pdf-preview { display: flex; flex-direction: column; align-items: center; }
.pdf-toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.pdf-page-info { font-size: 13px; color: var(--color-text-2); min-width: 60px; text-align: center; }
.pdf-canvas { border: 1px solid var(--color-border); border-radius: 4px; }

/* Image */
.image-preview { display: flex; flex-direction: column; align-items: center; }
.image-toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.image-wrapper { overflow: auto; max-height: 65vh; display: flex; justify-content: center; }
.image-wrapper img { max-width: 100%; object-fit: contain; }

/* Text */
.text-preview { display: flex; flex-direction: column; }
.text-toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.editor-container { border: 1px solid var(--color-border); border-radius: 4px; overflow: auto; max-height: 60vh; }
.editor-container :deep(.cm-editor) { min-height: 300px; }

/* Table */
.table-preview { overflow: auto; max-height: 65vh; }

/* Word */
.word-preview { max-height: 65vh; overflow: auto; }
.word-content { padding: 16px; line-height: 1.6; }
.word-content :deep(table) { border-collapse: collapse; width: 100%; }
.word-content :deep(td), .word-content :deep(th) { border: 1px solid var(--color-border); padding: 6px 8px; }

/* Unsupported */
.unsupported-preview { display: flex; align-items: center; justify-content: center; min-height: 200px; }
</style>
