/**
 * 修复 replace_all_chinese.cjs 引入的语法错误：
 * 1. 对象字面量中缺少逗号 (KEY: t('xxx') 后缺逗号)
 * 2. 模板中错误的替换 (在 a-link 标签内部等)
 * 3. 多余的 t() 替换 (在 template 中不该用 t() 的地方)
 */
const fs = require('fs')
const path = require('path')

function fixFile(fp) {
  let content = fs.readFileSync(fp, 'utf8')
  let changed = false

  // ─── Fix 1: Object literal missing commas ───
  // Pattern: `  KEY: t('xxx')\n  KEY2:` → add comma after t('xxx')
  // This handles: lines ending with t('...') followed by another property
  const lines = content.split('\n')
  for (let i = 0; i < lines.length - 1; i++) {
    const cur = lines[i]
    const next = lines[i + 1]
    // Current line ends with t('xxx') and next line starts with whitespace + identifier:
    if (cur.match(/\bt\(['"][^'"]+['"]\)\s*$/) && next.match(/^\s+\w+:/)) {
      // Check we're not already ending with comma
      if (!cur.trimEnd().endsWith(',')) {
        lines[i] = cur.trimEnd() + ','
        changed = true
      }
    }
  }
  content = lines.join('\n')

  // ─── Fix 2: Template tag text replacements that broke HTML ───
  // >{{ $t('key') }}< inside tags where it shouldn't be
  // e.g. <a-link ...>{{ $t('qms.final-inspection.lbl1489') }}</a-link> is actually fine
  // But: <a-link @click="openResultModal(record as Record<string, unknown>{{ $t('key') }}</a-link>
  // This is a broken line where the > tag close was consumed

  // Fix broken template where > was consumed by the >中文< pattern
  // Pattern: `unknown>{{ $t('key') }}</a-link>` should be `unknown>">{{ $t('key') }}</a-link>`
  // Actually, let's find specific broken patterns
  content = content.replace(/Record<string,\s*unknown>\{\{\s*\$t\(/g, (m) => {
    changed = true
    return 'Record<string, unknown>>{{ $t('
  })

  // ─── Fix 3: Multiple t() calls in a single attribute that broke ───
  // :title="editing ? t('key1') : t('key2')" is fine
  // But :title="t('key1')" when it was :title="editing ? '编辑' : '新建'" needs special handling
  // Pattern 12 may have broken this - let's check

  // ─── Fix 4: Comma in label arrays ───
  // { value: 'XX', label: t('key') color: 'red' } → missing comma before color
  content = content.replace(/(label:\s*t\(['"][^'"]+['"]\))(\s+\w+:)/g, (_, before, after) => {
    changed = true
    return before + ',' + after
  })

  // ─── Fix 5: Missing commas between label entries in arrays ───
  // { value: 'A', label: t('keyA') }, { value: 'B', label: t('keyB') } — this should be fine
  // But { value: 'A', label: t('keyA') } { value: 'B' — missing comma between objects
  content = content.replace(/\}\s+\{/g, '}, {')

  // ─── Fix 6: Tooltip in echarts - t() inside template strings ───
  // These are fine: `${t('key')}` 

  if (changed) {
    fs.writeFileSync(fp, content, 'utf8')
  }
  return changed
}

let total = 0, modified = 0
function walk(dir) {
  fs.readdirSync(dir).forEach(f => {
    const fp = path.join(dir, f)
    const st = fs.statSync(fp)
    if (st.isDirectory()) walk(fp)
    else if (f.endsWith('.vue')) { total++; if (fixFile(fp)) modified++ }
  })
}

walk('src/views')
console.log(`Scanned: ${total}, Fixed: ${modified}`)
