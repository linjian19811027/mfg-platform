/**
 * 修复前三轮替换引入的 bug + 处理剩余用户可见中文
 * 
 * Bug 修复：
 * 1. ::label="t('...')" → :label="t('...')"  (double colon)
 * 2. $t(t('...')) → $t('...')  (double call)
 * 3. suffix="中文" → :suffix="t('key')" (need bind)
 * 
 * 剩余替换：
 * - 按钮文本 / 链接文本
 * - 表单项 label 
 * - 验证消息 message
 * - alt="中文"
 */
const fs = require('fs')
const path = require('path')

const allKeys = {}

function modPage(fp) {
  const m = fp.replace(/\\/g, '/').match(/src\/views\/(\w+)\/([\w-]+)\//)
  return m ? { mod: m[1], page: m[2] } : { mod: 'common', page: 'misc' }
}

let autoId = 4000
function registerKey(mod, page, key, cn) {
  const full = `${mod}.${page}.${key}`
  if (allKeys[full] && allKeys[full] !== cn) {
    let n = 2; while (allKeys[`${mod}.${page}.${key}${n}`]) n++; key = key + n
  }
  const f2 = `${mod}.${page}.${key}`
  allKeys[f2] = cn
  return f2
}

function cn2key(cn) {
  const map = {
    '详情': 'detail', '变更状态': 'changeStatus', '上传文件': 'uploadFile',
    '银行转账': 'bankTransfer', '现金': 'cash', '票据': 'note',
    '导出清单': 'exportList', '新建排班': 'createSchedule', '批量排班': 'batchSchedule',
    '新增排班': 'addSchedule', '删除': 'delete', '导出 Excel': 'exportExcel',
    '新建配置': 'createConfig', '刷新': 'refresh', '重试': 'retry',
    '新建发料单': 'createIssueOrder', '新建收货单': 'createReceiptOrder',
    '新建结算单': 'createSettlementOrder', '新建外协工单': 'createOutsourcingOrder',
    '导出': 'export', '上传文档': 'uploadDoc', '下载': 'download',
    '新建规则': 'createRule', '选择文件（≤50MB）': 'selectFile50MB',
    '支持 PDF、Word、Excel、图片，单文件不超过 50MB': 'fileTypeHint',
    '确认评估': 'confirmEval', '手动触发': 'manualTrigger', '审批通过': 'approve',
    '新增工序': 'addOperation', '该物料暂无历史版本，将空白新建': 'noHistoryCreateNew',
    '新建顶级': 'createTopLevel', '编辑': 'edit', '新建子组织': 'createSubOrg',
    '新建租户': 'createTenant', '停用': 'disable', '启用': 'enable',
    '全部': 'all', '新建单位': 'createUnit', '换算': 'conversion',
    '追溯': 'trace', '导出PDF报告': 'exportPdf',
    '正向追溯': 'forwardTrace', '反向追溯': 'backwardTrace', '生成报告': 'genReport',
    '手动补录': 'manualEntry', '导出Excel': 'exportExcel',
    '发起评估': 'initiateEval', '计算中': 'calculating',
    '确认冻结在库批次': 'confirmFreezeBatches', '冻结在库批次': 'freezeBatches',
    '预警物料列表': 'alertMaterialList',
    '追溯节点超过 500 个，已截断显示。建议缩小追溯范围。': 'traceNodesTruncated',
    '每种类型只应有一个基准单位，其他单位的换算系数相对于基准单位': 'baseUnitHint',
    '例：1吨 = 1000千克，则换算系数填 1000': 'conversionExample',
    '单次批量最多 500 条，同一员工同一天已有排班将自动跳过。': 'batchScheduleHint',
    '请选择文件': 'pleaseSelectFile', '请输入组织名称': 'inputOrgName',
    '请输入组织编码': 'inputOrgCode', '详见5Why分析': 'see5Why',
    '条码': 'barcode', '二维码': 'qrcode',
    '工序列表': 'opList', '物料': 'material', '批次': 'batch',
    '检验': 'inspection', '库存': 'inventory',
    '此工单有': 'thisWoHas', '添加段': 'addSegment',
    '新建全局规则': 'createGlobalRule', '个': 'unit', '次': 'times',
  }
  if (map[cn]) return map[cn]
  autoId++; return 'r4' + autoId
}

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
  return ranges
}

function processFile(fp) {
  let content = fs.readFileSync(fp, 'utf8')
  const { mod, page } = modPage(fp)
  let changed = false

  // ─── BUG FIXES ───
  
  // Fix ::label → :label (double colon)
  if (content.match(/::label="/)) {
    content = content.replace(/::(label|title|description|placeholder|content|suffix|prefix|ok-text|cancel-text)="/g, ':$1="')
    changed = true
  }
  
  // Fix $t(t('...')) → $t('...')
  if (content.match(/\$t\s*\(\s*t\s*\(/)) {
    content = content.replace(/\$t\s*\(\s*t\s*\(\s*'([^']+)'\s*\)\s*\)/g, "$t('$1')")
    changed = true
  }

  // Fix $t(t("...")) → $t("...")
  if (content.match(/\$t\s*\(\s*t\s*\("/)) {
    content = content.replace(/\$t\s*\(\s*t\s*\(\s*"([^"]+)"\s*\)\s*\)/g, '$t("$1")')
    changed = true
  }

  // ─── REMAINING CHINESE REPLACEMENTS ───
  const lines = content.split('\n')
  const mockRanges = findMockRanges(lines)
  const isMock = i => mockRanges.some(([s, e]) => i >= s && i <= e)

  const out = []
  let inStyle = false

  for (let i = 0; i < lines.length; i++) {
    let l = lines[i]
    const t = l.trim()

    if (t.match(/^<style/)) { inStyle = true; out.push(l); continue }
    if (inStyle) { out.push(l); continue }
    if (t === '</style>') { inStyle = false; out.push(l); continue }
    if (isMock(i)) { out.push(l); continue }
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('<!--') || t.startsWith('-->')) { out.push(l); continue }
    // Skip code inline comments
    if (t.match(/(?:const|let|var)\s+\w+\s*=\s*\d+\s*\/\//)) { out.push(l); continue }
    if (t.match(/\*\/\s*$/)) { out.push(l); continue }
    
    // Skip lines with only comments in catch
    if (t.match(/\{\s*\/\*.*\*\/\s*\}$/)) { out.push(l); continue }
    
    let nl = l
    
    // Check remaining Chinese (excluding already i18n'd parts)
    const lineWithoutI18n = nl.replace(/\$t\([^)]*\)/g, '').replace(/\bt\s*\(\s*['"`][^'"`]*['"`]\)/g, '').replace(/\/\*[^*]*\*\//g, '').replace(/\/\/.*$/g, '')
    if (!lineWithoutI18n.match(/[\u4e00-\u9fff]/)) { out.push(nl); continue }

    // ─── suffix="中文" / prefix="中文" ───
    nl = nl.replace(/(\bsuffix)="([^"]*[\u4e00-\u9fff][^"]*)"/g, (_, attr, cn) => {
      const k = registerKey(mod, page, cn2key(cn), cn)
      changed = true
      return `:${attr}="t('${k}')"`
    })

    // ─── alt="中文" ───
    nl = nl.replace(/(\balt)="([^"]*[\u4e00-\u9fff][^"]*)"/g, (_, attr, cn) => {
      const k = registerKey(mod, page, cn2key(cn), cn)
      changed = true
      return `:${attr}="t('${k}')"`
    })

    // ─── message: '中文' (remaining validation messages) ───
    nl = nl.replace(/message:\s*'([^']*[\u4e00-\u9fff][^']*)'/g, (_, cn) => {
      const k = registerKey(mod, page, cn2key(cn), cn)
      changed = true
      return `message: t('${k}')`
    })

    // ─── <a-option value="XX">中文</a-option> (remaining) ───
    nl = nl.replace(/<a-option\s+value="([^"]+)">([^<]*[\u4e00-\u9fff][^<]*)<\/a-option>/g, (_, val, cn) => {
      const k = registerKey(mod, page, cn2key(cn), cn)
      changed = true
      return `<a-option value="${val}">{{ $t('${k}') }}</a-option>`
    })

    // ─── Simple standalone Chinese text on its own line (button text etc) ───
    // Pattern: line is just Chinese text (possibly in a template)
    const standalone = nl.trim()
    if (standalone.match(/^[\u4e00-\u9fff\d\s\-+\/（）()·:：,，.。!！?？%]+$/) && standalone.length >= 2 && standalone.length <= 30) {
      const k = registerKey(mod, page, cn2key(standalone.trim()), standalone.trim())
      changed = true
      nl = nl.replace(standalone, `{{ $t('${k}') }}`)
    }

    // ─── Remaining >中文< in tags ───
    const nlWithoutI18n2 = nl.replace(/\$t\([^)]*\)/g, '').replace(/\bt\s*\(\s*['"`][^'"`]*['"`]\)/g, '')
    if (nlWithoutI18n2.match(/[\u4e00-\u9fff]/)) {
      nl = nl.replace(/>([^<{}]*[\u4e00-\u9fff][^<{}]*?)</g, (full, cn) => {
        const trimmed = cn.trim()
        if (trimmed.length < 1) return full
        if (trimmed.includes('{{')) return full
        if (trimmed.includes('${')) return full
        if (trimmed.includes('$t(')) return full
        const k = registerKey(mod, page, cn2key(trimmed), trimmed)
        changed = true
        return `>{{ $t('${k}') }}<`
      })
    }

    // ─── Remaining Chinese in single quotes in script ───
    const nlWithoutI18n3 = nl.replace(/\$t\([^)]*\)/g, '').replace(/\bt\s*\(\s*['"`][^'"`]*['"`]\)/g, '')
    if (nlWithoutI18n3.match(/'[^']*[\u4e00-\u9fff][^']*'/)) {
      nl = nl.replace(/'([^']*[\u4e00-\u9fff][^']*)'/g, (_, cn) => {
        // Skip if inside $t() or t()
        if (nl.includes(`t('${cn}')`)) return `'${cn}'`
        const k = registerKey(mod, page, cn2key(cn), cn)
        changed = true
        return `t('${k}')`
      })
    }

    out.push(nl)
  }

  if (changed) {
    let result = out.join('\n')
    // Clean up any remaining issues
    // Fix double $t: $t($t('key')) → $t('key')  
    result = result.replace(/\$t\s*\(\s*\$t\s*\(\s*'([^']+)'\s*\)\s*\)/g, "$t('$1')")
    
    if (!result.includes('useI18n') && result.includes("t('")) {
      const scriptIdx = result.indexOf('<script setup')
      if (scriptIdx >= 0) {
        const afterScript = result.indexOf('\n', scriptIdx) + 1
        result = result.slice(0, afterScript) + 
          "import { useI18n } from 'vue-i18n'\nconst { t } = useI18n()\n" +
          result.slice(afterScript)
      }
    }
    fs.writeFileSync(fp, result, 'utf8')
  }
  return changed
}

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
console.log(`Scanned: ${total}, Modified: ${modified}, New keys: ${Object.keys(allKeys).length}`)

if (Object.keys(allKeys).length > 0) {
  fs.writeFileSync('round4_keys.json', JSON.stringify(allKeys, null, 2), 'utf8')
  console.log('Keys saved to round4_keys.json')
}
