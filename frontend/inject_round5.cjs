const fs = require('fs')
const path = require('path')

// New keys added in round 5 manual edits
const newKeys = {
  'hr.workHours.exportExcel': '导出 Excel',
  'outsourcing.orders.createIssue': '新建发料单',
  'outsourcing.orders.createReceipt': '新建收货单',
  'outsourcing.orders.createSettlement': '新建结算单',
  'plm.document.selectFile': '选择文件（≤50MB）',
  'plm.document.fileHint': '支持 PDF、Word、Excel、图片，单文件不超过 50MB',
  'plm.routing.copyHint': '将复制路线「{name}」的所有工序到新路线（状态为草稿）',
  'qms.capa.overdue': '逾期 {days} 天',
  'sys.auditLog.exportExcel': '导出 Excel',
  'sys.monitor.uptimeDays': '{d}天 {h}时',
  'sys.monitor.uptimeHours': '{h}时 {m}分',
  'sys.monitor.uptimeMinutes': '{m}分',
  'sys.numbering.addSegment': '添加段',
  'sys.organization.edit': '编辑',
  'sys.organization.createSubOrg': '新建子组织',
  'sys.uom.conversionRelation': '换算关系：1 {name}（{symbol}）',
  'sys.uom.conversionExample': '例：1吨 = 1000千克，则换算系数填 1000',
  'traceability.backward.exportPdf': '导出PDF报告',
  'traceability.batches.exportExcel': '导出Excel',
  'traceability.forward.exportPdf': '导出PDF报告',
  'traceability.forward.material': '物料',
  'traceability.forward.batch': '批次',
  'traceability.forward.inspection': '检验',
  'traceability.forward.inventory': '库存',
}

const CN_EN = {
  '导出 Excel': 'Export Excel', '新建发料单': 'Create Issue',
  '新建收货单': 'Create Receipt', '新建结算单': 'Create Settlement',
  '选择文件（≤50MB）': 'Select File (max 50MB)',
  '支持 PDF、Word、Excel、图片，单文件不超过 50MB': 'Support PDF, Word, Excel, images. Max 50MB per file',
  '将复制路线「{name}」的所有工序到新路线（状态为草稿）': 'Will copy all operations from route "{name}" to new route (draft status)',
  '逾期 {days} 天': '{days} days overdue',
  '{d}天 {h}时': '{d}d {h}h', '{h}时 {m}分': '{h}h {m}m', '{m}分': '{m}m',
  '添加段': 'Add Segment', '编辑': 'Edit', '新建子组织': 'Create Sub Org',
  '换算关系：1 {name}（{symbol}）': 'Conversion: 1 {name} ({symbol})',
  '例：1吨 = 1000千克，则换算系数填 1000': 'E.g. 1 ton = 1000 kg, factor = 1000',
  '导出PDF报告': 'Export PDF Report', '导出Excel': 'Export Excel',
  '物料': 'Material', '批次': 'Batch', '检验': 'Inspection', '库存': 'Inventory',
}

const byMod = {}
Object.entries(newKeys).forEach(([k, v]) => {
  const [m, p, ...r] = k.split('.')
  if (!byMod[m]) byMod[m] = []
  byMod[m].push({ fullKey: k, cn: v })
})

function tr(cn) { return CN_EN[cn] || cn }

let az = 0, ae = 0
Object.entries(byMod).forEach(([mod, ks]) => {
  [['zh-CN', path.join('src', 'locale', 'zh-CN', mod + '.ts')],
   ['en-US', path.join('src', 'locale', 'en-US', mod + '.ts')]].forEach(([lang, fp]) => {
    if (!fs.existsSync(fp)) return
    let c = fs.readFileSync(fp, 'utf8')
    const ex = new Set()
    for (const m of c.matchAll(/'([^']+)':/g)) ex.add(m[1])
    const ne = ks.filter(k => !ex.has(k.fullKey))
    if (!ne.length) return
    // Ensure trailing comma before closing brace
    const lb = c.lastIndexOf('}')
    const bef = c.slice(0, lb)
    const ln = bef.lastIndexOf('\n')
    const ll = bef.slice(ln + 1).trimEnd()
    if (ll && !ll.endsWith(',')) {
      c = c.slice(0, ln + 1) + ll + ',\n' + c.slice(ln + 1 + ll.length)
    }
    const lb2 = c.lastIndexOf('}')
    const entries = ne.map(k => {
      const val = lang === 'zh-CN' ? k.cn : tr(k.cn)
      return "  '" + k.fullKey + "': '" + val.replace(/'/g, "\\'") + "'"
    })
    c = c.slice(0, lb2) + entries.join(',\n') + ',\n' + c.slice(lb2)
    fs.writeFileSync(fp, c, 'utf8')
    if (lang === 'zh-CN') az += ne.length; else ae += ne.length
    console.log(lang + '/' + mod + '.ts: +' + ne.length)
  })
})
console.log('Added: zh=' + az + ', en=' + ae)
