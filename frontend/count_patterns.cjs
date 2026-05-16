const fs = require('fs')
const path = require('path')

const patterns = {
  placeholder: 0,     // placeholder="中文"
  optionText: 0,      // <a-option value="X">中文</a-option>
  label: 0,           // label: '中文'
  message: 0,         // message: '中文'
  tagText: 0,         // >中文文本<
  titleAttr: 0,       // title="中文"
  descAttr: 0,        // description="中文"
  ternary: 0,         // ternary ? '中文' : '中文'
  statusMap: 0,       // { key: '中文' } in status maps
  fallback: 0,        // e.message : '中文'
  other: 0
}

const examples = {}

function walk(dir) {
  fs.readdirSync(dir).forEach(f => {
    const fp = path.join(dir, f)
    const st = fs.statSync(fp)
    if (st.isDirectory()) walk(fp)
    else if (f.endsWith('.vue')) {
      const c = fs.readFileSync(fp, 'utf8')
      // Skip mock ranges
      const lines = c.split('\n')
      const mockRanges = []
      let inMock = false, mockStart = -1
      lines.forEach((line, i) => {
        if (line.match(/function\s+useMock|\/\/\s*mock\s*data/i)) { inMock = true; mockStart = i }
        if (inMock && i > mockStart + 3 && line.match(/^\}\s*$/)) { mockRanges.push([mockStart, i]); inMock = false }
      })
      const isMock = i => mockRanges.some(([s,e]) => i >= s && i <= e)
      
      let inStyle = false
      lines.forEach((line, i) => {
        if (line.trim().match(/^<style/)) inStyle = true
        if (inStyle) return
        const t = line.trim()
        if (t.startsWith('//') || t.startsWith('*') || t.startsWith('<!--')) return
        if (line.includes('$t(') || line.includes("t('") || line.includes('t("')) return
        if (isMock(i)) return
        if (!line.match(/[\u4e00-\u9fff]/)) return
        
        if (line.match(/placeholder="[^"]*[\u4e00-\u9fff]/)) { patterns.placeholder++; if (!examples.placeholder) examples.placeholder = `${fp}:${i+1}: ${t}` }
        else if (line.match(/<a-option[^>]*>[^<]*[\u4e00-\u9fff]/)) { patterns.optionText++; if (!examples.optionText) examples.optionText = `${fp}:${i+1}: ${t}` }
        else if (line.match(/label:\s*'[^']*[\u4e00-\u9fff]/)) { patterns.label++; if (!examples.label) examples.label = `${fp}:${i+1}: ${t}` }
        else if (line.match(/message:\s*'[^']*[\u4e00-\u9fff]/) || line.match(/message:\s*"[^"]*[\u4e00-\u9fff]/)) { patterns.message++; if (!examples.message) examples.message = `${fp}:${i+1}: ${t}` }
        else if (line.match(/title="[^"]*[\u4e00-\u9fff]/) && !line.match(/<a-table-column/)) { patterns.titleAttr++; if (!examples.titleAttr) examples.titleAttr = `${fp}:${i+1}: ${t}` }
        else if (line.match(/description="[^"]*[\u4e00-\u9fff]/)) { patterns.descAttr++; if (!examples.descAttr) examples.descAttr = `${fp}:${i+1}: ${t}` }
        else if (line.match(/\?\s*'[^']*[\u4e00-\u9fff]/) && line.match(/:\s*'[^']*[\u4e00-\u9fff]/)) { patterns.ternary++; if (!examples.ternary) examples.ternary = `${fp}:${i+1}: ${t}` }
        else if (line.match(/^\s*\w+:\s*'[^']*[\u4e00-\u9fff]/) && !line.match(/(label|message|title|description)/)) {
          // Check if in statusMap context
          const ctx = lines.slice(Math.max(0, i-5), i+1).join('\n')
          if (ctx.match(/statusLabel|statusMap|typeLabel|labelMap|Record<string,\s*string>|=\s*\{/) || line.match(/^\s*(running|idle|maintenance|fault|scrapped|draft|released|in_progress|completed|closed|pending|inspecting|accepted|rejected|active|inactive|EXPIRED|EXPIRING|ACTIVE|INACTIVE|DRAFT|SUBMITTED|APPROVED|REJECTED|CLOSED|running|idle):\s*'/)) {
            patterns.statusMap++; if (!examples.statusMap) examples.statusMap = `${fp}:${i+1}: ${t}`
          } else {
            patterns.other++; if (!examples.other) examples.other = `${fp}:${i+1}: ${t}`
          }
        }
        else if (line.match(/>[^<]*[\u4e00-\u9fff][^<]*</)) { patterns.tagText++; if (!examples.tagText) examples.tagText = `${fp}:${i+1}: ${t}` }
        else { patterns.other++; if (!examples.other && patterns.other <= 3) examples.other = `${fp}:${i+1}: ${t}` }
      })
    }
  })
}

walk('src/views')
console.log('Pattern counts:')
Object.entries(patterns).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => {
  console.log(`  ${k}: ${v}`)
  if (examples[k]) console.log(`    Example: ${examples[k]}`)
})
