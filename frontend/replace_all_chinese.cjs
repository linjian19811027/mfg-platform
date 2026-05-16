/**
 * 全面替换 Vue 文件中硬编码中文为 i18n 调用（排除 mock 数据）
 * 生成 new_keys.json 供后续注入 locale 文件
 * 
 * 处理 10 种模式，按优先级匹配避免冲突
 */
const fs = require('fs')
const path = require('path')

// ─── 工具 ────────────────────────────────────────────────────
const allKeys = {}        // { 'module.page.key': '中文' }
const keyByModule = {}    // { module: { page: { key: '中文' } } }

function modPage(fp) {
  const m = fp.replace(/\\/g, '/').match(/src\/views\/(\w+)\/([\w-]+)\//)
  return m ? { mod: m[1], page: m[2] } : { mod: 'common', page: 'misc' }
}

// 中文 → 英文 key 映射表
const CN_EN = {
  '查询': 'query', '新建': 'create', '查看': 'view', '编辑': 'edit', '删除': 'delete',
  '启用': 'enable', '停用': 'disable', '草稿': 'draft', '已下达': 'released',
  '进行中': 'inProgress', '已完成': 'completed', '已关闭': 'closed',
  '已批准': 'approved', '已拒绝': 'rejected', '审批中': 'underReview',
  '运行中': 'running', '空闲': 'idle', '维保中': 'inMaintenance',
  '故障': 'fault', '报废': 'scrapped', '待检': 'uninspected', '合格': 'qualified',
  '不合格': 'unqualified', '待处理': 'pending', '检验中': 'inspecting',
  '已接收': 'accepted', '有效': 'valid', '已过期': 'expired', '即将到期': 'expiring',
  '正常': 'normal', '加载失败': 'loadFailed', '暂无数据': 'noData',
  '保存': 'save', '取消': 'cancel', '确认': 'confirm', '关闭': 'close',
  '提交': 'submit', '撤回': 'withdraw', '刷新': 'refresh', '重置': 'reset',
  '导出': 'export', '导入': 'import', '下载': 'download', '上传': 'upload',
  '搜索': 'search', '筛选': 'filter', '更多': 'more', '展开': 'expand',
  '收起': 'collapse', '全选': 'selectAll', '反选': 'invertSelect',
  '日': 'day', '周': 'week', '月': 'month', '季': 'quarter', '年': 'year',
  '状态': 'status', '类型': 'type', '名称': 'name', '编码': 'code',
  '描述': 'description', '备注': 'remark', '数量': 'quantity',
  '日期': 'date', '时间': 'time', '创建时间': 'createdAt', '更新时间': 'updatedAt',
  '操作': 'action', '序号': 'index', '详情': 'detail', '列表': 'list',
  '生产线': 'productionLine', '工单号': 'workOrderCode', '物料': 'material',
  '计划完成': 'plannedCompletion', '进度': 'progress',
  '请输入名称': 'inputName', '请选择': 'pleaseSelect',
  '生成报表': 'generateReport', '查询台账': 'queryLedger',
  '查询收发存': 'queryMovement', '录入数据点': 'inputDataPoint',
  '前 10 条': 'top10', '条': 'items',
  '工单进度': 'woProgress', '产量趋势': 'outputTrend',
  '异常告警': 'exceptionAlert', '暂无异常告警': 'noException',
  '在制品（WIP）': 'wip', '在制工单': 'wipOrders',
  '排班明细': 'scheduleDetail', '加载中...': 'loading',
}

let autoId = 1000
function cn2key(cn, mod, page) {
  // 已知映射
  if (CN_EN[cn]) return CN_EN[cn]
  // 去掉"请输入/请选择"前缀
  if (cn.match(/^请输入/)) return 'input' + cn.replace(/^请输入/, '').replace(/[^\w]/g, '')
  if (cn.match(/^请选择/)) return 'select' + cn.replace(/^请选择/, '').replace(/[^\w]/g, '')
  // 自动编号
  autoId++
  return 'lbl' + autoId
}

function registerKey(mod, page, key, cn) {
  const full = `${mod}.${page}.${key}`
  if (allKeys[full] && allKeys[full] !== cn) {
    // collision → append number
    let n = 2
    while (allKeys[`${mod}.${page}.${key}${n}`]) n++
    key = key + n
  }
  const f2 = `${mod}.${page}.${key}`
  allKeys[f2] = cn
  if (!keyByModule[mod]) keyByModule[mod] = {}
  if (!keyByModule[mod][page]) keyByModule[mod][page] = {}
  keyByModule[mod][page][key] = cn
  return key
}

// ─── Mock 检测 ────────────────────────────────────────────────
function findMockRanges(lines) {
  const ranges = []
  let inMock = false, start = -1, brace = 0
  lines.forEach((l, i) => {
    if (l.match(/function\s+useMock|function\s+generateMock/i)) { inMock = true; start = i; brace = 0 }
    if (inMock) {
      brace += (l.match(/\{/g) || []).length - (l.match(/\}/g) || []).length
      if (brace <= 0 && i > start + 2) { ranges.push([start, i]); inMock = false }
    }
  })
  // Also mark array literal mocks like workOrders.value = [...]
  let inArrMock = false, arrStart = -1, arrBrace = 0
  lines.forEach((l, i) => {
    if (l.match(/\.\s*value\s*=\s*Array\.from|\.svalue\s*=\s*\[/i)) { inArrMock = true; arrStart = i; arrBrace = 0 }
    if (inArrMock) {
      arrBrace += (l.match(/[\[\{]/g) || []).length - (l.match(/[\]\}]/g) || []).length
      if (arrBrace <= 0 && i > arrStart) { ranges.push([arrStart, i]); inArrMock = false }
    }
  })
  return ranges
}

// ─── 替换函数 ─────────────────────────────────────────────────
function processFile(fp) {
  let content = fs.readFileSync(fp, 'utf8')
  const { mod, page } = modPage(fp)
  const lines = content.split('\n')
  const mockRanges = findMockRanges(lines)
  const isMock = i => mockRanges.some(([s, e]) => i >= s && i <= e)

  let inStyle = false
  let changed = false
  const out = []

  for (let i = 0; i < lines.length; i++) {
    let l = lines[i]
    const t = l.trim()

    // style boundary
    if (t.match(/^<style/)) { inStyle = true; out.push(l); continue }
    if (inStyle) { out.push(l); continue }
    if (t === '</style>') { inStyle = false; out.push(l); continue }

    // skip comments / i18n'd / mock
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('<!--') || t.startsWith('-->')) { out.push(l); continue }
    if (l.includes('$t(') || l.match(/\bt\s*\(\s*['"]/)) { out.push(l); continue }
    if (isMock(i)) { out.push(l); continue }
    if (!l.match(/[\u4e00-\u9fff]/)) { out.push(l); continue }

    let nl = l

    // ─── 1. placeholder="中文" ───
    nl = nl.replace(/placeholder="([^"]*[\u4e00-\u9fff][^"]*)"/g, (_, cn) => {
      const k = registerKey(mod, page, cn2key(cn, mod, page), cn)
      changed = true
      return `:placeholder="t('${mod}.${page}.${k}')"`
    })

    // ─── 2. :placeholder="`中文`" (template literal) ───
    nl = nl.replace(/:placeholder="`([^`]*[\u4e00-\u9fff][^`]*)`"/g, (_, cn) => {
      const k = registerKey(mod, page, cn2key(cn, mod, page), cn)
      changed = true
      return `:placeholder="t('${mod}.${page}.${k}')"`
    })

    // ─── 3. <a-option value="XX">中文</a-option> ───
    nl = nl.replace(/<a-option\s+value="([^"]+)">([^<]*[\u4e00-\u9fff][^<]*)<\/a-option>/g, (_, val, cn) => {
      const k = registerKey(mod, page, cn2key(cn, mod, page), cn)
      changed = true
      return `<a-option value="${val}">{{ $t('${mod}.${page}.${k}') }}</a-option>`
    })
    // also <a-option value="XX" ...>中文</a-option> (with other attrs)
    nl = nl.replace(/<a-option\s+value="([^"]+)"([^>]*)>([^<]*[\u4e00-\u9fff][^<]*)<\/a-option>/g, (_, val, attrs, cn) => {
      const k = registerKey(mod, page, cn2key(cn, mod, page), cn)
      changed = true
      return `<a-option value="${val}"${attrs}>{{ $t('${mod}.${page}.${k}') }}</a-option>`
    })

    // ─── 4. message: '中文' (validation) ───
    nl = nl.replace(/message:\s*'([^']*[\u4e00-\u9fff][^']*)'/g, (_, cn) => {
      const k = registerKey(mod, page, cn2key(cn, mod, page), cn)
      changed = true
      return `message: t('${mod}.${page}.${k}')`
    })

    // ─── 5. label: '中文' ───
    nl = nl.replace(/label:\s*'([^']*[\u4e00-\u9fff][^']*)'/g, (_, cn) => {
      const k = registerKey(mod, page, cn2key(cn, mod, page), cn)
      changed = true
      return `label: t('${mod}.${page}.${k}')`
    })

    // ─── 6. title="中文" ───
    nl = nl.replace(/title="([^"]*[\u4e00-\u9fff][^"]*)"/g, (_, cn) => {
      const k = registerKey(mod, page, cn2key(cn, mod, page), cn)
      changed = true
      return `:title="t('${mod}.${page}.${k}')"`
    })

    // ─── 7. description="中文" ───
    nl = nl.replace(/description="([^"]*[\u4e00-\u9fff][^"]*)"/g, (_, cn) => {
      const k = registerKey(mod, page, cn2key(cn, mod, page), cn)
      changed = true
      return `:description="t('${mod}.${page}.${k}')"`
    })

    // ─── 8. tip="中文" / ok-text="中文" / cancel-text="中文" ───
    nl = nl.replace(/tip="([^"]*[\u4e00-\u9fff][^"]*)"/g, (_, cn) => {
      const k = registerKey(mod, page, cn2key(cn, mod, page), cn)
      changed = true
      return `:tip="t('${mod}.${page}.${k}')"`
    })

    // ─── 9. status map values like  KEY: '中文'  (standalone line) ───
    //    Only match if line is like `  KEY: '中文'` (indented, key: value in object)
    if (!changed || nl === l) {
      const mapMatch = nl.match(/^(\s+)(\w+):\s*'([^']*[\u4e00-\u9fff][^']*)'/)
      if (mapMatch) {
        // skip if already handled (label, message etc)
        const key2 = mapMatch[2].toLowerCase()
        if (!['label', 'message', 'title', 'description', 'placeholder'].includes(key2)) {
          const k = registerKey(mod, page, cn2key(mapMatch[3], mod, page), mapMatch[3])
          nl = `${mapMatch[1]}${mapMatch[2]}: t('${mod}.${page}.${k}')`
          changed = true
        }
      }
    }

    // ─── 10. Template tag text  >中文< ───
    if (!changed || nl === l) {
      // >中文文字< but not >{{ ... }}<
      nl = nl.replace(/>([^<{}]*[\u4e00-\u9fff][^<{}]*?)</g, (full, cn) => {
        const trimmed = cn.trim()
        if (trimmed.length < 2) return full
        // Skip if contains JS expressions
        if (trimmed.includes('{{')) return full
        const k = registerKey(mod, page, cn2key(trimmed, mod, page), trimmed)
        changed = true
        return `>{{ $t('${mod}.${page}.${k}') }}<`
      })
    }

    // ─── 11. Ternary with Chinese in template {{ x ? '中文' : '中文' }} ───
    if (!changed || nl === l) {
      // Simple ternary: condition ? '中文A' : '中文B'
      nl = nl.replace(/\{\{\s*(.+?)\s*\?\s*'([^']*[\u4e00-\u9fff][^']*)'\s*:\s*'([^']*[\u4e00-\u9fff][^']*)'\s*\}\}/g, 
        (_, cond, cnT, cnF) => {
          const kT = registerKey(mod, page, cn2key(cnT, mod, page), cnT)
          const kF = registerKey(mod, page, cn2key(cnF, mod, page), cnF)
          changed = true
          return `{{ ${cond} ? $t('${mod}.${page}.${kT}') : $t('${mod}.${page}.${kF}') }}`
        }
      )
    }

    // ─── 12. String with Chinese in :title="editing ? '编辑' : '新建'" ───
    if (!changed || nl === l) {
      nl = nl.replace(/'([^']*[\u4e00-\u9fff][^']*)'/g, (_, cn) => {
        const k = registerKey(mod, page, cn2key(cn, mod, page), cn)
        changed = true
        return `t('${mod}.${page}.${k}')`
      })
    }

    out.push(nl)
  }

  if (changed) {
    // Add useI18n if not present
    let result = out.join('\n')
    if (!result.includes('useI18n')) {
      // Find <script setup and add after imports
      const scriptIdx = result.indexOf('<script setup')
      if (scriptIdx >= 0) {
        const afterScript = result.indexOf('\n', scriptIdx) + 1
        result = result.slice(0, afterScript) + 
          "import { useI18n } from 'vue-i18n'\n" +
          result.slice(afterScript)
        // Add const { t } = useI18n() after the import
        const lastImport = result.lastIndexOf('\nimport ', afterScript + 100)
        if (lastImport > 0) {
          const endOfLastImport = result.indexOf('\n', lastImport + 1) + 1
          result = result.slice(0, endOfLastImport) + 
            "const { t } = useI18n()\n" +
            result.slice(endOfLastImport)
        }
      }
    }
    fs.writeFileSync(fp, result, 'utf8')
  }

  return changed
}

// ─── 主流程 ──────────────────────────────────────────────────
let total = 0, modified = 0

function walk(dir) {
  fs.readdirSync(dir).forEach(f => {
    const fp = path.join(dir, f)
    const st = fs.statSync(fp)
    if (st.isDirectory()) walk(fp)
    else if (f.endsWith('.vue')) { total++; if (processFile(fp)) modified++ }
  })
}

walk('src/views')
console.log(`Total: ${total}, Modified: ${modified}, Keys: ${Object.keys(allKeys).length}`)

// Save keys
fs.writeFileSync('new_keys.json', JSON.stringify(allKeys, null, 2), 'utf8')
fs.writeFileSync('new_keys_by_module.json', JSON.stringify(keyByModule, null, 2), 'utf8')
console.log('Keys saved.')
