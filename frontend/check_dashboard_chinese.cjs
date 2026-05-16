const fs = require('fs')
const c = fs.readFileSync('src/views/mes/dashboard/index.vue', 'utf8')
const lines = c.split('\n')
lines.forEach((line, i) => {
  // Find any Chinese characters in script section
  if (i > 130 && i < 377 && line.match(/[\u4e00-\u9fff]/)) {
    console.log(`${i+1}: ${line.trim()}`)
  }
})
console.log('\n--- Template Chinese ---')
lines.forEach((line, i) => {
  if (i < 130 && line.match(/[\u4e00-\u9fff]/) && !line.includes('$t(') && !line.includes('t(')) {
    console.log(`${i+1}: ${line.trim()}`)
  }
})
