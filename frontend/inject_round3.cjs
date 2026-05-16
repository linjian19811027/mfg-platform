const fs = require('fs')
const path = require('path')

const newKeys = JSON.parse(fs.readFileSync('round3_keys.json', 'utf8'))
const byModule = {}
Object.entries(newKeys).forEach(([fullKey, cn]) => {
  const [mod, page, ...rest] = fullKey.split('.')
  if (!byModule[mod]) byModule[mod] = []
  byModule[mod].push({ fullKey, cn, page, key: rest.join('.') })
})

const CN_EN = {
  '高': 'High', '中': 'Medium', '低': 'Low', '简': 'ZH', '繁': 'TW',
  '天': ' days', '条': ' items', '件': ' pieces',
  '工序编码': 'Operation Code', '工序名称': 'Operation Name',
  '默认工作中心': 'Default Work Center', '标准工时 (分钟)': 'Std Duration (min)',
  '工序描述': 'Operation Desc', '工序列表': 'Operation List',
  '上传成功': 'Uploaded successfully', '上传失败': 'Upload failed',
  '认证预警清单': 'Cert Expiring List', '外协工单': 'Outsource Order',
  '覆盖率': 'Coverage Rate', '当前库存': 'Current Stock',
  '最小库存': 'Min Stock', '最大库存': 'Max Stock',
  '安全库存': 'Safety Stock', '再订购点': 'Reorder Point',
  '确认将批次': 'Confirm batch',
  '的质量状态变更为': 'quality status change to',
}
function tr(cn) { return CN_EN[cn] || cn }

let addedZh = 0, addedEn = 0
Object.entries(byModule).forEach(([mod, keys]) => {
  [['zh-CN', path.join('src','locale','zh-CN',`${mod}.ts`)],
   ['en-US', path.join('src','locale','en-US',`${mod}.ts`)]].forEach(([lang, fp]) => {
    if (!fs.existsSync(fp)) return
    let content = fs.readFileSync(fp, 'utf8')
    const existingKeys = new Set()
    for (const m of content.matchAll(/'([^']+)':/g)) existingKeys.add(m[1])
    const newEntries = keys.filter(k => !existingKeys.has(k.fullKey))
    if (!newEntries.length) return
    // Ensure last key has comma
    const lb = content.lastIndexOf('}')
    const before = content.slice(0, lb)
    const lastNl = before.lastIndexOf('\n')
    const lastLine = before.slice(lastNl+1).trimEnd()
    if (lastLine && !lastLine.endsWith(',')) {
      content = content.slice(0, lastNl+1) + lastLine + ',\n' + content.slice(lastNl+1+lastLine.length)
    }
    const lb2 = content.lastIndexOf('}')
    const entries = newEntries.map(k => {
      const val = lang === 'zh-CN' ? k.cn : tr(k.cn)
      return `  '${k.fullKey}': '${val.replace(/'/g,"\\'")}'`
    })
    content = content.slice(0, lb2) + entries.join(',\n') + ',\n' + content.slice(lb2)
    fs.writeFileSync(fp, content, 'utf8')
    if (lang === 'zh-CN') addedZh += newEntries.length; else addedEn += newEntries.length
    console.log(`${lang}/${mod}.ts: +${newEntries.length}`)
  })
})
console.log(`Added: zh=${addedZh}, en=${addedEn}`)
