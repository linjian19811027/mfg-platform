/**
 * 修复 locale 文件中缺少逗号的问题
 * 模式: 'key': 'value'\n  'newkey':  → 'key': 'value',\n  'newkey':
 * 即：如果一行以 'value' 结尾（没有逗号），且下一行以 'key': 开头，则补逗号
 */
const fs = require('fs')
const path = require('path')

function fixLocaleFile(fp) {
  let content = fs.readFileSync(fp, 'utf8')
  const lines = content.split('\n')
  let changed = false
  
  for (let i = 0; i < lines.length - 1; i++) {
    const cur = lines[i].trimEnd()
    const next = lines[i + 1].trim()
    
    // Current line ends with 'string' (no comma) and next line starts with 'key':
    if (cur.match(/'[^']*'\s*$/) && next.match(/^'[a-zA-Z0-9._-]+'\s*:/)) {
      lines[i] = cur + ','
      changed = true
    }
  }
  
  if (changed) {
    fs.writeFileSync(fp, lines.join('\n'), 'utf8')
  }
  return changed
}

let total = 0, fixed = 0
function walk(dir) {
  fs.readdirSync(dir).forEach(f => {
    const fp = path.join(dir, f)
    const st = fs.statSync(fp)
    if (st.isDirectory()) walk(fp)
    else if (f.endsWith('.ts')) { total++; if (fixLocaleFile(fp)) fixed++ }
  })
}

walk('src/locale')
console.log(`Scanned: ${total}, Fixed: ${fixed}`)
