/**
 * 第三轮：处理剩余的用户可见硬编码中文
 * 
 * 精确模式：
 * 1. <a-form-item label="中文" ...> → <a-form-item :label="t('key')" ...>
 * 2. {{ expr }} 天 / {{ expr }} 条 → {{ $t('key', {n: expr}) }}
 * 3. 单字标签 高/中/低/简 → $t('key')
 * 4. 模板字符串中的中文 → ${t('key')}
 * 5. content="`中文 ${expr} 中文`" → :content="t('key', {...})"
 */
const fs = require('fs')
const path = require('path')

const allKeys = {}

function modPage(fp) {
  const m = fp.replace(/\\/g, '/').match(/src\/views\/(\w+)\/([\w-]+)\//)
  return m ? { mod: m[1], page: m[2] } : { mod: 'common', page: 'misc' }
}

let autoId = 3000
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
    '工序编码': 'opCode', '工序名称': 'opName', '默认工作中心': 'defaultWorkCenter',
    '标准工时 (分钟)': 'standardDuration', '工序描述': 'opDesc',
    '高': 'high', '中': 'medium', '低': 'low', '简': 'zh', '繁': 'tw', 'En': 'en',
    '天': 'days', '条': 'items', '件': 'pieces', '工序列表': 'opList',
    '上传成功': 'uploadSuccess', '上传失败': 'uploadFailed',
    '认证预警清单': 'certExpiringList', '外协工单': 'outsourceOrder',
    '覆盖率': 'coverageRate', '确认将批次': 'confirmBatch',
    '的质量状态变更为': 'qualityStatusChangeTo',
    '接口不存在时静默忽略': 'silentlyIgnore',
    '删除后使用该工序的路线不受影响': 'deleteOpRouteNote',
    '确认删除该标准工序？': 'confirmDeleteOp',
    '当前库存': 'currentStock', '最小库存': 'minStock', '最大库存': 'maxStock',
    '安全库存': 'safetyStock', '再订购点': 'reorderPoint',
    '编号规则': 'numberingRule', '编号前缀': 'numberingPrefix',
    '当前值': 'currentValue', '步长': 'stepSize',
    '上级组织': 'parentOrg', '组织类型': 'orgType',
    '租户名称': 'tenantName', '联系人': 'contactPerson',
    '联系电话': 'contactPhone', '到期时间': 'expireTime',
    '排班日期': 'scheduleDate', '班次': 'shiftName',
    '计划人数': 'plannedStaff', '实际人数': 'actualStaff',
    '组别': 'group', '父级编码': 'parentCode',
  }
  if (map[cn]) return map[cn]
  autoId++; return 'r3' + autoId
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
  const lines = content.split('\n')
  const mockRanges = findMockRanges(lines)
  const isMock = i => mockRanges.some(([s, e]) => i >= s && i <= e)

  let changed = false
  const out = []
  let inStyle = false

  for (let i = 0; i < lines.length; i++) {
    let l = lines[i]
    const t = l.trim()

    if (t.match(/^<style/)) { inStyle = true; out.push(l); continue }
    if (inStyle) { out.push(l); continue }
    if (t === '</style>') { inStyle = false; out.push(l); continue }
    if (isMock(i)) { out.push(l); continue }
    // Skip comments (but NOT inline comments in code)
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('<!--') || t.startsWith('-->')) { out.push(l); continue }
    // Skip already i18n'd lines
    if (l.includes('$t(') || l.match(/\bt\s*\(\s*['"`]/)) {
      // But check for remaining Chinese on the same line
      if (!l.replace(/\$t\([^)]*\)/g, '').replace(/\bt\s*\(\s*['"`][^'"`]*['"`]\)/g, '').match(/[\u4e00-\u9fff]/)) {
        out.push(l); continue
      }
    }
    if (!l.match(/[\u4e00-\u9fff]/)) { out.push(l); continue }
    // Skip pure code comments at end of line (// 中文)
    if (t.match(/^\s*\w+\s*=\s*\d+\s*\/\/\s*[\u4e00-\u9fff]/)) { out.push(l); continue }
    // Skip const/let with inline Chinese comments
    if (t.match(/^(?:const|let|var)\s+\w+\s*=\s*\d+\s*\/\//)) { out.push(l); continue }

    let nl = l

    // ─── 1. label="中文" attribute (form-item, tab-pane etc) ───
    nl = nl.replace(/(\blabel)="([^"]*[\u4e00-\u9fff][^"]*)"/g, (_, attr, cn) => {
      const k = registerKey(mod, page, cn2key(cn), cn)
      changed = true
      return `:${attr}="t('${k}')"`
    })

    // ─── 2. title="中文" attribute (static, not already bound) ───
    nl = nl.replace(/(\btitle)="([^"]*[\u4e00-\u9fff][^"]*)"/g, (_, attr, cn) => {
      if (nl.includes(':title=')) return _
      const k = registerKey(mod, page, cn2key(cn), cn)
      changed = true
      return `:${attr}="t('${k}')"`
    })

    // ─── 3. ok-text="中文" / cancel-text="中文" ───
    nl = nl.replace(/(ok-text)="([^"]*[\u4e00-\u9fff][^"]*)"/g, (_, attr, cn) => {
      const k = registerKey(mod, page, cn2key(cn), cn)
      changed = true
      return `:${attr}="t('${k}')"`
    })
    nl = nl.replace(/(cancel-text)="([^"]*[\u4e00-\u9fff][^"]*)"/g, (_, attr, cn) => {
      const k = registerKey(mod, page, cn2key(cn), cn)
      changed = true
      return `:${attr}="t('${k}')"`
    })

    // ─── 4. Mixed template text: {{ expr }} 天/条 ───
    // {{ record.daysLeft }} 天 → {{ $t('key', {n: record.daysLeft}) }}
    nl = nl.replace(/\{\{\s*([^}]+)\s*\}\}\s*([\u4e00-\u9fff]+)/g, (_, expr, cn) => {
      const k = registerKey(mod, page, cn2key(cn.trim()), cn.trim())
      const varName = expr.trim().split('.').pop().replace(/\s.*$/, '').replace(/[^a-zA-Z0-9_]/g, 'n')
      changed = true
      return `{{ $t('${k}', {${varName}: ${expr.trim()}}) }}`
    })
    // 中文 {{ expr }} pattern
    nl = nl.replace(/([\u4e00-\u9fff]+)\s*\{\{\s*([^}]+)\s*\}\}/g, (full, cn, expr) => {
      const k = registerKey(mod, page, cn2key(cn.trim()), cn.trim())
      const varName = expr.trim().split('.').pop().replace(/[^a-zA-Z0-9_]/g, 'n')
      changed = true
      return `{{ $t('${k}', {${varName}: ${expr.trim()}}) }}`
    })

    // ─── 5. Single Chinese word in tag: >高< >中< >低< >简< ───
    nl = nl.replace(/>([\u4e00-\u9fff]{1,2})<\/a-tag>/g, (_, cn) => {
      const k = registerKey(mod, page, cn2key(cn), cn)
      changed = true
      return `>{{ $t('${k}') }}</a-tag>`
    })
    nl = nl.replace(/>([\u4e00-\u9fff]{1,2})<\/a-radio>/g, (_, cn) => {
      const k = registerKey(mod, page, cn2key(cn), cn)
      changed = true
      return `>{{ $t('${k}') }}</a-radio>`
    })
    nl = nl.replace(/>([\u4e00-\u9fff]{1,3})<\/span>/g, (_, cn) => {
      // Skip if part of $t
      if (nl.includes('$t(')) return _
      const k = registerKey(mod, page, cn2key(cn), cn)
      changed = true
      return `>{{ $t('${k}') }}</span>`
    })

    // ─── 6. Template literals in script ───
    // `${file.name} 上传成功` → `${file.name} ${t('key')}`
    nl = nl.replace(/`([^`]*[\u4e00-\u9fff][^`]*)`/g, (full, inner) => {
      // Replace Chinese text within template literal
      let result = inner
      // Match Chinese words/phrases not inside ${}
      result = result.replace(/([\u4e00-\u9fff][\u4e00-\u9fff\s\d（）()\-_:：,，.。!！?？%]*[\u4e00-\u9fff])/g, (cn) => {
        const trimmed = cn.trim()
        if (!trimmed) return cn
        const k = registerKey(mod, page, cn2key(trimmed), trimmed)
        changed = true
        return `\${t('${k}')}`
      })
      return '`' + result + '`'
    })

    // ─── 7. Simple >中文< tag text (remaining) ───
    if (!changed || nl === l) {
      nl = nl.replace(/>([^<{}]*[\u4e00-\u9fff][^<{}]*?)</g, (full, cn) => {
        const trimmed = cn.trim()
        if (trimmed.length < 1) return full
        if (trimmed.includes('{{')) return full
        if (trimmed.includes('${')) return full
        const k = registerKey(mod, page, cn2key(trimmed), trimmed)
        changed = true
        return `>{{ $t('${k}') }}<`
      })
    }

    // ─── 8. String with Chinese in script (remaining) ───
    if (!changed || nl === l) {
      nl = nl.replace(/'([^']*[\u4e00-\u9fff][^']*)'/g, (_, cn) => {
        const k = registerKey(mod, page, cn2key(cn), cn)
        changed = true
        return `t('${k}')`
      })
    }

    out.push(nl)
  }

  if (changed) {
    let result = out.join('\n')
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
  fs.writeFileSync('round3_keys.json', JSON.stringify(allKeys, null, 2), 'utf8')
  console.log('Keys saved to round3_keys.json')
}
