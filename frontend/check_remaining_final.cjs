const fs = require('fs')
const path = require('path')

const remaining = []

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
        // Skip pure comments
        if (t.startsWith('//') || t.startsWith('*') || t.startsWith('<!--') || t.startsWith('-->')) return
        // Skip inline code comments (end of line)
        if (t.match(/^\s*(?:const|let|var)\s+\w+\s*=\s*\d+\s*\/\//)) return
        // Skip already i18n'd lines
        const lineWithoutI18n = line.replace(/\$t\([^)]*\)/g, '').replace(/\bt\s*\(\s*['"`][^'"`]*['"`]\)/g, '')
        if (!lineWithoutI18n.match(/[\u4e00-\u9fff]/)) return
        
        remaining.push({ file: fp, line: i+1, text: t.substring(0, 150) })
      })
    }
  })
}

walk('src/views')
console.log(`Remaining (user-visible Chinese): ${remaining.length}\n`)
remaining.forEach(r => console.log(`${r.file.replace(/src\\views\\/, '')}:${r.line}: ${r.text}`))
