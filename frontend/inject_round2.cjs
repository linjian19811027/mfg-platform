const fs = require('fs')
const path = require('path')

const newKeys = JSON.parse(fs.readFileSync('round2_keys.json', 'utf8'))

// Group by module
const byModule = {}
Object.entries(newKeys).forEach(([fullKey, cn]) => {
  const [mod, page, ...rest] = fullKey.split('.')
  if (!byModule[mod]) byModule[mod] = []
  byModule[mod].push({ fullKey, cn, page, key: rest.join('.') })
})

console.log(`Keys to add: ${Object.keys(newKeys).length}`)
console.log(`Modules: ${Object.keys(byModule).join(', ')}`)

const CN_EN = {
  '延迟 {n} 天': 'Delayed {n} days',
  '工单树完成度 {pct}%': 'WO Tree {pct}% complete',
  '正常': 'Normal', '异常': 'Abnormal',
  '上传成功': 'Uploaded successfully', '上传失败': 'Upload failed',
  '认证预警清单': 'Cert Expiring List',
  '确认删除该标准工序？删除后使用该工序的路线不受影响。': 'Confirm deleting this standard operation? Routes using it will not be affected.',
  '可用率': 'Availability', '性能率': 'Performance', '良品率': 'Quality Rate',
  '确认将批次': 'Confirm batch',
  '的质量状态变更为': 'quality status changed to',
}

function simpleTranslate(cn) { return CN_EN[cn] || cn }

let addedZh = 0, addedEn = 0

Object.entries(byModule).forEach(([mod, keys]) => {
  const zhFile = path.join('src', 'locale', 'zh-CN', `${mod}.ts`)
  const enFile = path.join('src', 'locale', 'en-US', `${mod}.ts`)

  ;[['zh-CN', zhFile], ['en-US', enFile]].forEach(([lang, fp]) => {
    if (!fs.existsSync(fp)) {
      console.log(`SKIP: ${fp} not found`)
      return
    }
    let content = fs.readFileSync(fp, 'utf8')
    const existingKeys = new Set()
    const keyMatches = content.matchAll(/'([^']+)':/g)
    for (const m of keyMatches) existingKeys.add(m[1])

    const newEntries = keys.filter(k => !existingKeys.has(k.fullKey))
    if (newEntries.length === 0) return

    // Ensure last entry before closing } has comma
    const lastBrace = content.lastIndexOf('}')
    if (lastBrace >= 0) {
      // Check char before } - find last non-whitespace line
      const before = content.slice(0, lastBrace)
      const lastLineEnd = before.lastIndexOf('\n')
      const lastLine = before.slice(lastLineEnd + 1).trimEnd()
      if (lastLine && !lastLine.endsWith(',')) {
        content = content.slice(0, lastLineEnd + 1) + lastLine + ',\n' + content.slice(lastLineEnd + 1 + lastLine.length)
      }
    }

    const entries = newEntries.map(k => {
      const val = lang === 'zh-CN' ? k.cn : simpleTranslate(k.cn)
      return `  '${k.fullKey}': '${val.replace(/'/g, "\\'")}'`
    })
    const insert = entries.join(',\n') + ',\n'
    const lb = content.lastIndexOf('}')
    content = content.slice(0, lb) + insert + content.slice(lb)
    fs.writeFileSync(fp, content, 'utf8')
    if (lang === 'zh-CN') addedZh += newEntries.length
    else addedEn += newEntries.length
    console.log(`${lang}/${mod}.ts: added ${newEntries.length} keys`)
  })
})

console.log(`\nAdded: zh-CN=${addedZh}, en-US=${addedEn}`)
