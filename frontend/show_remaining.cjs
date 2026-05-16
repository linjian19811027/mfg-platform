const fs = require('fs')
const path = require('path')

function walk(dir) {
  fs.readdirSync(dir).forEach(f => {
    const fp = path.join(dir, f)
    const st = fs.statSync(fp)
    if (st.isDirectory()) walk(fp)
    else if (f.endsWith('.vue')) {
      const lines = fs.readFileSync(fp, 'utf8').split('\n')
      lines.forEach((line, i) => {
        if (line.match(/message:\s*['"][\u4e00-\u9fff]/) || line.match(/Message\.(success|error|warning|info)\s*\(\s*['"][\u4e00-\u9fff]/)) {
          console.log(`${fp}:${i+1}: ${line.trim()}`)
        }
      })
    }
  })
}

walk('src/views')
