const fs = require('fs')
const path = require('path')

// 1. Check remaining hardcoded Chinese in Vue files (excluding mock)
let remaining = 0
const byFile = {}

function walk(dir) {
  fs.readdirSync(dir).forEach(f => {
    const fp = path.join(dir, f)
    const st = fs.statSync(fp)
    if (st.isDirectory()) walk(fp)
    else if (f.endsWith('.vue')) {
      const c = fs.readFileSync(fp, 'utf8')
      const lines = c.split('\n')
      
      // Find mock ranges
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
      let fileCount = 0
      lines.forEach((line, i) => {
        if (line.trim().match(/^<style/)) inStyle = true
        if (inStyle) return
        if (line.trim() === '</style>') { inStyle = false; return }
        if (isMock(i)) return
        const t = line.trim()
        if (t.startsWith('//') || t.startsWith('*') || t.startsWith('<!--')) return
        if (line.includes('$t(') || line.match(/\bt\s*\(\s*['"`]/)) return
        if (!line.match(/[\u4e00-\u9fff]/)) return
        
        // Has Chinese but not i18n'd
        fileCount++
      })
      if (fileCount > 0) {
        remaining += fileCount
        byFile[fp] = fileCount
      }
    }
  })
}

walk('src/views')
console.log(`=== Remaining hardcoded Chinese (non-mock) ===`)
console.log(`Files: ${Object.keys(byFile).length}, Lines: ${remaining}`)
const sorted = Object.entries(byFile).sort((a,b) => b[1] - a[1])
sorted.slice(0, 20).forEach(([f, c]) => console.log(`  ${c}: ${f}`))

// 2. Check for duplicate locale keys
const zhDir = path.join('src', 'locale', 'zh-CN')
const allKeys = []
fs.readdirSync(zhDir).forEach(f => {
  if (!f.endsWith('.ts') || f === 'index.ts') return
  const c = fs.readFileSync(path.join(zhDir, f), 'utf8')
  const matches = [...c.matchAll(/'([^']+)':/g)]
  matches.forEach(m => allKeys.push(m[1]))
})
const seen = new Set()
const dupes = []
allKeys.forEach(k => { if (seen.has(k)) dupes.push(k); seen.add(k) })
console.log(`\n=== Duplicate locale keys ===`)
console.log(`Total keys: ${allKeys.length}, Duplicates: ${dupes.length}`)
if (dupes.length > 0) dupes.slice(0, 10).forEach(d => console.log(`  ${d}`))

// 3. Count total i18n calls in Vue files
let tCalls = 0
let $tCalls = 0
function walk2(dir) {
  fs.readdirSync(dir).forEach(f => {
    const fp = path.join(dir, f)
    const st = fs.statSync(fp)
    if (st.isDirectory()) walk2(fp)
    else if (f.endsWith('.vue')) {
      const c = fs.readFileSync(fp, 'utf8')
      const tc = (c.match(/\bt\s*\(\s*['"`]/g) || []).length
      const $tc = (c.match(/\$t\s*\(/g) || []).length
      tCalls += tc
      $tCalls += $tc
    }
  })
}
walk2('src/views')
console.log(`\n=== i18n call counts ===`)
console.log(`t() calls: ${tCalls}`)
console.log(`$t() calls: ${$tCalls}`)
console.log(`Total: ${tCalls + $tCalls}`)
