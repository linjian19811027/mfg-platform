const fs = require('fs')
const path = require('path')
let found = 0

function walk(dir) {
  fs.readdirSync(dir).forEach(f => {
    const fp = path.join(dir, f)
    const st = fs.statSync(fp)
    if (st.isDirectory()) walk(fp)
    else if (f.endsWith('.vue')) {
      const c = fs.readFileSync(fp, 'utf8')
      const m1 = c.match(/Message\.(success|error|warning|info)\s*\(\s*['"][\u4e00-\u9fff]/g)
      if (m1) { found += m1.length; console.log(fp + ': ' + m1.length + ' hardcoded Message calls') }
      const m2 = c.match(/message:\s*['"][\u4e00-\u9fff]/g)
      if (m2) { found += m2.length; console.log(fp + ': ' + m2.length + ' hardcoded message: strings') }
    }
  })
}

walk('src/views')
console.log('Total remaining hardcoded Chinese: ' + found)
