const fs = require('fs')
const path = require('path')

function walk(dir) {
  const results = []
  fs.readdirSync(dir).forEach(f => {
    const fp = path.join(dir, f)
    const st = fs.statSync(fp)
    if (st.isDirectory()) walk(fp).forEach(r => results.push(r))
    else if (f.endsWith('.vue')) {
      const c = fs.readFileSync(fp, 'utf8')
      const lines = c.split('\n')
      const issues = []

      // Find mock data ranges (function useMockData or similar)
      let inMock = false
      let mockStart = -1
      lines.forEach((line, i) => {
        if (line.match(/function\s+useMock|function\s+generateMock|\/\/\s*mock/i)) {
          inMock = true
          mockStart = i
        }
        if (inMock && i > mockStart + 2 && line.match(/^\}\s*$/)) {
          inMock = false
        }
        lines[i] = { text: line, inMock }
      })

      lines.forEach((line, i) => {
        const trimmed = line.text.trim()
        // Skip comments
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*') || trimmed.startsWith('<!--') || trimmed.startsWith('-->')) return
        // Skip i18n calls
        if (line.text.includes('$t(') || line.text.includes("t('") || line.text.includes('t("')) return
        // Skip mock data
        if (line.inMock) return
        // Skip style section
        if (trimmed === '<style' || trimmed.startsWith('<style')) {
          // mark remaining as style
          for (let j = i; j < lines.length; j++) lines[j].inStyle = true
          return
        }
        if (line.inStyle) return

        // Find Chinese text (2+ consecutive Chinese chars, or Chinese in quotes)
        const chineseInQuotes = line.text.match(/['"`][^'"`]*[\u4e00-\u9fff][^'"`]*['"`]/g)
        const chineseInTag = line.text.match(/>[^<]*[\u4e00-\u9fff][^<]*</g)
        const chineseInAttr = line.text.match(/(?:placeholder|title|label|description|message|name|content|text|tip|header|footer|ok-text|cancel-text|confirm-text)[:\s]*['"`][^'"`]*[\u4e00-\u9fff][^'"`]*['"`]/gi)
        const chineseInObject = line.text.match(/['"`][\u4e00-\u9fff]+['"`]\s*:/g) // object keys

        if (chineseInQuotes || chineseInTag) {
          // Filter out decoration (─── etc)
          const hasRealContent = line.text.match(/[\u4e00-\u9fff]{2,}/)
          if (hasRealContent && !line.text.match(/^[\s─┼┤├┴┬┐└┌┘═║]*$/)) {
            issues.push({ line: i + 1, text: trimmed.substring(0, 120) })
          }
        }
      })

      if (issues.length > 0) {
        results.push({ file: fp, issues })
      }
    }
  })
  return results
}

const results = walk('src/views')
let total = 0
results.forEach(r => total += r.issues.length)
console.log(`Files: ${results.length}, Lines: ${total}\n`)

// Categorize
const categories = { template: 0, validation: 0, scriptString: 0, statusMap: 0 }
results.forEach(r => {
  r.issues.forEach(issue => {
    if (issue.text.match(/message:\s*['"`]/)) categories.validation++
    else if (issue.text.match(/<[a-z]/) || issue.text.match(/<\/[a-z]/)) categories.template++
    else if (issue.text.match(/:\s*['"`].*[\u4e00-\u9fff]/)) categories.statusMap++
    else categories.scriptString++
  })
})
console.log('Categories:')
console.log(`  Template text: ${categories.template}`)
console.log(`  Validation message: ${categories.validation}`)
console.log(`  Status/label map: ${categories.statusMap}`)
console.log(`  Other script strings: ${categories.scriptString}\n`)

// Show all
results.sort((a, b) => b.issues.length - a.issues.length)
results.forEach(r => {
  console.log(`\n${r.file} (${r.issues.length} lines):`)
  r.issues.slice(0, 8).forEach(i => console.log(`  L${i.line}: ${i.text}`))
  if (r.issues.length > 8) console.log(`  ... and ${r.issues.length - 8} more`)
})
