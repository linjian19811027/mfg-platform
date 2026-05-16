/**
 * 第二轮替换：处理更复杂的中文模式
 * 1. 混合标签文本: 延迟 {{ record.delayDays }} 天 → {{ $t('key', {n: record.delayDays}) }}
 * 2. HTML 属性中文: checked-text="正常" → :checked-text="t('key')"
 * 3. 模板字符串中文: `${file.name} 上传成功` → `${file.name} ${t('key')}`
 * 4. content="中文" / content="确认中文？" 属性
 * 5. :content="`中文 ${expr} 中文`" 绑定
 */
const fs = require('fs')
const path = require('path')

const allKeys = {}

function modPage(fp) {
  const m = fp.replace(/\\/g, '/').match(/src\/views\/(\w+)\/([\w-]+)\//)
  return m ? { mod: m[1], page: m[2] } : { mod: 'common', page: 'misc' }
}

let autoId = 2000
function registerKey(mod, page, key, cn) {
  const full = `${mod}.${page}.${key}`
  if (allKeys[full] && allKeys[full] !== cn) {
    let n = 2
    while (allKeys[`${mod}.${page}.${key}${n}`]) n++
    key = key + n
  }
  const f2 = `${mod}.${page}.${key}`
  allKeys[f2] = cn
  return f2
}

const CN_EN = {
  '正常': 'normal', '异常': 'abnormal', '延迟': 'delay', '天': 'days',
  '可用率': 'availability', '性能率': 'performance', '良品率': 'quality',
  'OEE': 'oee', '上传成功': 'uploadSuccess', '上传失败': 'uploadFailed',
  '确认删除该标准工序删除后使用该工序的路线不受影响': 'confirmDeleteOp',
  '认证预警清单': 'certExpiringList', '反向追溯': 'backwardTrace',
  '确认将批次': 'confirmChangeBatch', '的质量状态变更为': 'qualityStatusChangeTo',
}

function cn2key(cn) {
  if (CN_EN[cn]) return CN_EN[cn]
  autoId++
  return 'r2' + autoId
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
    // Skip comments
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('<!--') || t.startsWith('-->')) { out.push(l); continue }
    // Skip already i18n'd
    if (l.includes('$t(') || l.match(/\bt\s*\(\s*['"`]/)) { out.push(l); continue }
    if (!l.match(/[\u4e00-\u9fff]/)) { out.push(l); continue }

    let nl = l

    // ─── 1. HTML attributes with Chinese ───
    // checked-text="正常", unchecked-text="异常"
    nl = nl.replace(/(checked-text)="([^"]*[\u4e00-\u9fff][^"]*)"/g, (_, attr, cn) => {
      const k = registerKey(mod, page, cn2key(cn), cn)
      changed = true
      return `:${attr}="t('${k}')"`
    })
    nl = nl.replace(/(unchecked-text)="([^"]*[\u4e00-\u9fff][^"]*)"/g, (_, attr, cn) => {
      const k = registerKey(mod, page, cn2key(cn), cn)
      changed = true
      return `:${attr}="t('${k}')"`
    })
    
    // content="中文" (static attribute)
    nl = nl.replace(/(\bcontent)="([^"]*[\u4e00-\u9fff][^"]*)"/g, (_, attr, cn) => {
      // Skip if already :content
      if (nl.includes(':content=')) return _
      const k = registerKey(mod, page, cn2key(cn), cn)
      changed = true
      return `:${attr}="t('${k}')"`
    })

    // ─── 2. Mixed tag text: 中文 {{ expr }} 中文 ───
    // Pattern: >中文文字{{ expr }}中文文字<
    // Convert to: >{{ $t('key', {var: expr}) }}<
    // Simple cases first: >中文文字 {{ expr }}<
    nl = nl.replace(/>([^<{}]*?)([\u4e00-\u9fff][^<{}]*?)\{\{\s*([^}]+)\s*\}\}([^<]*?)</g, (full, pre, cnBefore, expr, post) => {
      // pre might be empty, post might have more Chinese
      const fullCn = (cnBefore + ' {}' + post.replace(/>$/, '')).trim()
      const exprName = expr.trim().split('.').pop().replace(/\s.*$/, '')
      const cnOnly = (cnBefore + post.replace(/[\s>]/g, '')).trim()
      if (!cnOnly.match(/[\u4e00-\u9fff]/)) return full // no Chinese left
      const k = registerKey(mod, page, cn2key(cnOnly), cnOnly)
      changed = true
      // Simple approach: just wrap Chinese parts
      const before = cnBefore.trim()
      const after = post.replace(/>$/, '').trim()
      let result = '>'
      if (before) result += `{{ $t('${k}', {${exprName}: ${expr.trim()}}) }}`
      else result += `{{ $t('${k}', {${exprName}: ${expr.trim()}}) }}`
      result += '<'
      return result
    })

    // ─── 3. Template literal strings in script ───
    // `${file.name} 上传成功` → `${file.name} ${t('key')}`
    nl = nl.replace(/`([^`]*[\u4e00-\u9fff][^`]*)`/g, (full, inner) => {
      // Only in script section (check by line context)
      if (i < 5 || !lines[i-1] && !lines[i].includes('const') && !lines[i].includes('Message') && !lines[i].includes('a.download') && !lines[i].includes('return')) {
        // Likely in template, skip
        return full
      }
      // Replace Chinese parts with ${t('key')}
      let result = inner
      result = result.replace(/([\u4e00-\u9fff][\u4e00-\u9fff\d\s（）()\-_:：,，.。!！?？%/]+)(?=[^}]*`)/g, (cn) => {
        const trimmed = cn.trim()
        if (!trimmed) return cn
        const k = registerKey(mod, page, cn2key(trimmed), trimmed)
        changed = true
        return `\${t('${k}')}`
      })
      return '`' + result + '`'
    })

    // ─── 4. :content="`中文 ${expr} 中文`" ───
    // Already handled by template literal pattern above

    // ─── 5. Simple tag text remaining: >中文< ───
    if (!changed || nl === l) {
      nl = nl.replace(/>([^<{}]*[\u4e00-\u9fff][^<{}]*?)</g, (full, cn) => {
        const trimmed = cn.trim()
        if (trimmed.length < 2) return full
        if (trimmed.includes('{{')) return full
        const k = registerKey(mod, page, cn2key(trimmed), trimmed)
        changed = true
        return `>{{ $t('${k}') }}<`
      })
    }

    out.push(nl)
  }

  if (changed) {
    let result = out.join('\n')
    // Add useI18n if needed
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

// Save new keys for locale injection
if (Object.keys(allKeys).length > 0) {
  fs.writeFileSync('round2_keys.json', JSON.stringify(allKeys, null, 2), 'utf8')
  console.log('Keys saved to round2_keys.json')
}
