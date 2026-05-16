const fs = require('fs')
const path = require('path')
let total = 0
const byFile = {}

function walk(dir) {
  fs.readdirSync(dir).forEach(f => {
    const fp = path.join(dir, f)
    const st = fs.statSync(fp)
    if (st.isDirectory()) walk(fp)
    else if (f.endsWith('.vue')) {
      const c = fs.readFileSync(fp, 'utf8')
      const lines = c.split('\n')
      let count = 0
      lines.forEach((line, i) => {
        // Skip comments (// or /* or <!--)
        const trimmed = line.trim()
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return
        // Skip i18n calls
        if (line.includes('$t(') || line.includes("t('") || line.includes('t("')) return
        // Find Chinese characters
        const chinese = line.match(/[\u4e00-\u9fff]/g)
        if (chinese) {
          // Filter out decoration chars like ───
          const realChinese = line.match(/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]{2,}/g)
          if (realChinese) {
            // Skip if only in CSS/style section
            count++
          }
        }
      })
      if (count > 0) {
        byFile[fp] = count
        total += count
      }
    }
  })
}

walk('src/views')
const sorted = Object.entries(byFile).sort((a, b) => b[1] - a[1])
console.log(`Files with hardcoded Chinese: ${sorted.length}`)
console.log(`Total lines with Chinese (excluding i18n calls): ${total}`)
console.log('\nTop files:')
sorted.slice(0, 20).forEach(([f, c]) => console.log(`  ${c} lines: ${f}`))
