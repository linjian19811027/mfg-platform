const fs = require('fs')
const path = require('path')

// Show specific remaining Chinese lines by category
const categories = { comment: 0, decoration: 0, tagText: 0, attr: 0, script: 0, other: 0 }
const examples = { comment: [], decoration: [], tagText: [], attr: [], script: [], other: [] }

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
        if (t.startsWith('//') || t.startsWith('*') || t.startsWith('<!--')) {
          if (line.match(/[\u4e00-\u9fff]/)) { categories.comment++; examples.comment.push(`${fp}:${i+1}: ${t.substring(0,80)}`) }
          return
        }
        if (line.includes('$t(') || line.match(/\bt\s*\(\s*['"`]/)) return
        if (!line.match(/[\u4e00-\u9fff]/)) return
        
        // Decoration lines (─── etc)
        if (t.match(/^[─┼┤├┴┬┐└┌┘═║\s]+$/)) { categories.decoration++; return }
        
        // Tag text like >中文<
        if (t.match(/>[^<]*[\u4e00-\u9fff]/) || t.match(/[\u4e00-\u9fff][^<]*</)) {
          categories.tagText++
          if (examples.tagText.length < 5) examples.tagText.push(`${fp}:${i+1}: ${t.substring(0,100)}`)
          return
        }
        
        // HTML attributes with Chinese
        if (t.match(/\w+="[^"]*[\u4e00-\u9fff]/)) {
          categories.attr++
          if (examples.attr.length < 5) examples.attr.push(`${fp}:${i+1}: ${t.substring(0,100)}`)
          return
        }
        
        // Script strings
        if (t.match(/['"`][^'"`]*[\u4e00-\u9fff][^'"`]*['"`]/) && i > 20) {
          categories.script++
          if (examples.script.length < 5) examples.script.push(`${fp}:${i+1}: ${t.substring(0,100)}`)
          return
        }
        
        categories.other++
        if (examples.other.length < 5) examples.other.push(`${fp}:${i+1}: ${t.substring(0,100)}`)
      })
    }
  })
}

walk('src/views')
console.log('=== Remaining Chinese by category ===')
Object.entries(categories).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => {
  console.log(`  ${k}: ${v}`)
  examples[k].slice(0,3).forEach(e => console.log(`    ${e}`))
})
