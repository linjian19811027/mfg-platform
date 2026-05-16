const fs = require('fs')
const path = require('path')

const specific = []

function walk(dir) {
  fs.readdirSync(dir).forEach(f => {
    const fp = path.join(dir, f)
    const st = fs.statSync(fp)
    if (st.isDirectory()) walk(fp)
    else if (f.endsWith('.vue')) {
      const c = fs.readFileSync(fp, 'utf8')
      const lines = c.split('\n')
      
      const mockRanges = []
      let inMock = false, mockStart = -1, brace = 0
      lines.forEach((line, i) => {
        if (line.match(/function\s+useMock|function\s+generateMock/i)) { inMock = true; mockStart = i; brace = 0 }
        if (inMock) {
          brace += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length
          if (brace <= 0 && i > mockStart + 2) { mockRanges.push([mockStart, i]); inMock = false }
        }
      })
      const isMock = i => mockRanges.some(([s,e]) => i >= s && i <= e)
      
      let inStyle = false
      lines.forEach((line, i) => {
        if (line.trim().match(/^<style/)) inStyle = true
        if (inStyle) return
        if (line.trim() === '</style>') { inStyle = false; return }
        if (isMock(i)) return
        const t = line.trim()
        if (t.startsWith('//') || t.startsWith('*') || t.startsWith('<!--')) return
        if (line.includes('$t(') || line.match(/\bt\s*\(\s*['"`]/)) return
        if (!line.match(/[\u4e00-\u9fff]/)) return
        
        specific.push({ file: fp, line: i+1, text: t.substring(0, 120) })
      })
    }
  })
}

walk('src/views')
console.log(`Total remaining: ${specific.length}\n`)

// Categorize precisely
const cats = {}
specific.forEach(s => {
  let cat = 'other'
  if (s.text.match(/\w+="[^"]*[\u4e00-\u9fff]/)) cat = 'html-attr'
  else if (s.text.match(/>[^<]*[\u4e00-\u9fff]/) || s.text.match(/[\u4e00-\u9fff][^<]*</)) cat = 'tag-mixed'
  else if (s.text.match(/`[^`]*[\u4e00-\u9fff]/)) cat = 'template-literal'
  else if (s.text.match(/'[^']*[\u4e00-\u9fff]/)) cat = 'single-quote'
  else if (s.text.match(/"[^"]*[\u4e00-\u9fff]/)) cat = 'double-quote'
  cats[cat] = (cats[cat] || 0) + 1
})
console.log('Categories:')
Object.entries(cats).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => console.log(`  ${k}: ${v}`))

// Show samples per category
;['html-attr', 'tag-mixed', 'template-literal', 'single-quote', 'double-quote', 'other'].forEach(cat => {
  const items = specific.filter(s => {
    if (cat === 'html-attr') return s.text.match(/\w+="[^"]*[\u4e00-\u9fff]/)
    if (cat === 'tag-mixed') return s.text.match(/>[^<]*[\u4e00-\u9fff]/) || s.text.match(/[\u4e00-\u9fff][^<]*</)
    if (cat === 'template-literal') return s.text.match(/`[^`]*[\u4e00-\u9fff]/)
    if (cat === 'single-quote') return s.text.match(/'[^']*[\u4e00-\u9fff]/)
    if (cat === 'double-quote') return s.text.match(/"[^"]*[\u4e00-\u9fff]/)
    return true
  })
  if (items.length > 0) {
    console.log(`\n--- ${cat} (samples) ---`)
    items.slice(0, 5).forEach(s => console.log(`  ${s.file.replace(/^src\\views\\/, '')}:${s.line}: ${s.text}`))
  }
})
