/**
 * 将 new_keys.json 中的 i18n key 注入到 zh-CN 和 en-US 的模块文件中
 * 
 * new_keys.json 格式: { "module.page.key": "中文原文", ... }
 * locale 文件格式: export default { 'module.page.key': '中文', ... }
 */
const fs = require('fs')
const path = require('path')

const newKeys = JSON.parse(fs.readFileSync('new_keys.json', 'utf8'))

// Group keys by module
const byModule = {}
Object.entries(newKeys).forEach(([fullKey, cn]) => {
  const [mod, page, key] = fullKey.split('.')
  if (!byModule[mod]) byModule[mod] = []
  byModule[mod].push({ fullKey, cn, page, key })
})

console.log(`Total new keys: ${Object.keys(newKeys).length}`)
console.log(`Modules: ${Object.keys(byModule).join(', ')}`)
console.log(`Keys per module:`)
Object.entries(byModule).sort((a,b) => b[1].length - a[1].length).forEach(([mod, keys]) => {
  console.log(`  ${mod}: ${keys.length}`)
})

// Simple English translation hints
const CN_EN_WORDS = {
  '草稿': 'Draft', '已下达': 'Released', '进行中': 'In Progress', '已完成': 'Completed',
  '已关闭': 'Closed', '已批准': 'Approved', '已拒绝': 'Rejected', '审批中': 'Under Review',
  '运行中': 'Running', '空闲': 'Idle', '维保中': 'Under Maintenance', '故障': 'Fault',
  '报废': 'Scrapped', '待检': 'Pending Inspection', '合格': 'Qualified', '不合格': 'Unqualified',
  '待处理': 'Pending', '检验中': 'Inspecting', '已接收': 'Accepted', '有效': 'Valid',
  '已过期': 'Expired', '即将到期': 'Expiring Soon', '正常': 'Normal',
  '查询': 'Query', '新建': 'Create', '查看': 'View', '编辑': 'Edit', '删除': 'Delete',
  '启用': 'Enable', '停用': 'Disable', '保存': 'Save', '取消': 'Cancel', '确认': 'Confirm',
  '提交': 'Submit', '刷新': 'Refresh', '重置': 'Reset', '导出': 'Export', '导入': 'Import',
  '搜索': 'Search', '状态': 'Status', '类型': 'Type', '名称': 'Name', '编码': 'Code',
  '描述': 'Description', '备注': 'Remark', '数量': 'Quantity', '操作': 'Action',
  '序号': 'Index', '详情': 'Detail', '列表': 'List', '生成报表': 'Generate Report',
  '加载失败': 'Load Failed', '暂无数据': 'No Data', '加载中...': 'Loading...',
  '前 10 条': 'Top 10', '条': 'items', '超期预警': 'Overdue Warning',
  '设备故障': 'Equipment Fault', '工单进度': 'Work Order Progress',
  '产量趋势': 'Output Trend', '异常告警': 'Exception Alert', '暂无异常告警': 'No Exceptions',
  '在制品': 'WIP', '在制工单': 'WIP Orders', '排班明细': 'Schedule Details',
  '物料': 'Material', '供应商': 'Supplier', '检验': 'Inspection',
  '数据缺失': 'Data Missing', '导出PDF报告': 'Export PDF Report',
  '反向追溯': 'Backward Trace', '正向追溯': 'Forward Trace',
  '总节点数': 'Total Nodes', '追溯码': 'Trace Code',
  '批次': 'Batch', '生产批号': 'Production Batch',
  '采购': 'Purchase', '生产': 'Production', '退货': 'Return', '调整': 'Adjustment',
  '合格品': 'Qualified', '让步接收': 'Concession', '待定': 'Pending',
  '冻结': 'Frozen', '在检': 'Under Inspection',
  '入库': 'Inbound', '出库': 'Outbound', '移库': 'Transfer',
  '领料': 'Picking', '退料': 'Return Material',
}

function simpleTranslate(cn) {
  if (CN_EN_WORDS[cn]) return CN_EN_WORDS[cn]
  // Try to translate parts
  let result = cn
  Object.entries(CN_EN_WORDS).sort((a,b) => b[0].length - a[0].length).forEach(([zh, en]) => {
    result = result.replace(zh, en)
  })
  // If still has Chinese, just keep as-is (will be Chinese fallback)
  return result || cn
}

// Process each module
let addedZh = 0, addedEn = 0

Object.entries(byModule).forEach(([mod, keys]) => {
  const zhFile = path.join('src', 'locale', 'zh-CN', `${mod}.ts`)
  const enFile = path.join('src', 'locale', 'en-US', `${mod}.ts`)
  
  // Handle zh-CN
  if (fs.existsSync(zhFile)) {
    let content = fs.readFileSync(zhFile, 'utf8')
    
    // Find which keys already exist
    const existingKeys = new Set()
    const keyMatches = content.matchAll(/'([^']+)':/g)
    for (const m of keyMatches) existingKeys.add(m[1])
    
    // Build new entries
    const newEntries = keys.filter(k => !existingKeys.has(k.fullKey))
    if (newEntries.length > 0) {
      // Find the closing } of the export default object
      const lastBrace = content.lastIndexOf('}')
      if (lastBrace >= 0) {
        const entries = newEntries.map(k => `  '${k.fullKey}': '${k.cn.replace(/'/g, "\\'")}'`)
        const insert = entries.join(',\n') + ',\n'
        content = content.slice(0, lastBrace) + insert + content.slice(lastBrace)
        fs.writeFileSync(zhFile, content, 'utf8')
        addedZh += newEntries.length
        console.log(`zh-CN/${mod}.ts: added ${newEntries.length} keys`)
      }
    }
  } else {
    // Create new file
    const entries = keys.map(k => `  '${k.fullKey}': '${k.cn.replace(/'/g, "\\'")}'`)
    const content = `export default {\n${entries.join(',\n')},\n}\n`
    fs.writeFileSync(zhFile, content, 'utf8')
    addedZh += keys.length
    console.log(`zh-CN/${mod}.ts: created with ${keys.length} keys`)
    
    // Also need to register in index.ts
    const zhIndex = path.join('src', 'locale', 'zh-CN', 'index.ts')
    if (fs.existsSync(zhIndex)) {
      let idx = fs.readFileSync(zhIndex, 'utf8')
      if (!idx.includes(`import ${mod} from './${mod}'`)) {
        idx += `\nimport ${mod} from './${mod}'`
        // Need to add to spread in export - find export default line
        idx = idx.replace(/export default \{/, `export default {\n  ...${mod},`)
        fs.writeFileSync(zhIndex, idx, 'utf8')
      }
    }
  }
  
  // Handle en-US
  if (fs.existsSync(enFile)) {
    let content = fs.readFileSync(enFile, 'utf8')
    
    const existingKeys = new Set()
    const keyMatches = content.matchAll(/'([^']+)':/g)
    for (const m of keyMatches) existingKeys.add(m[1])
    
    const newEntries = keys.filter(k => !existingKeys.has(k.fullKey))
    if (newEntries.length > 0) {
      const lastBrace = content.lastIndexOf('}')
      if (lastBrace >= 0) {
        const entries = newEntries.map(k => {
          const en = simpleTranslate(k.cn)
          return `  '${k.fullKey}': '${en.replace(/'/g, "\\'")}'`
        })
        const insert = entries.join(',\n') + ',\n'
        content = content.slice(0, lastBrace) + insert + content.slice(lastBrace)
        fs.writeFileSync(enFile, content, 'utf8')
        addedEn += newEntries.length
        console.log(`en-US/${mod}.ts: added ${newEntries.length} keys`)
      }
    }
  } else {
    // Create new file
    const entries = keys.map(k => {
      const en = simpleTranslate(k.cn)
      return `  '${k.fullKey}': '${en.replace(/'/g, "\\'")}'`
    })
    const content = `export default {\n${entries.join(',\n')},\n}\n`
    fs.writeFileSync(enFile, content, 'utf8')
    addedEn += keys.length
    console.log(`en-US/${mod}.ts: created with ${keys.length} keys`)
    
    // Also register in en-US index.ts
    const enIndex = path.join('src', 'locale', 'en-US', 'index.ts')
    if (fs.existsSync(enIndex)) {
      let idx = fs.readFileSync(enIndex, 'utf8')
      if (!idx.includes(`import ${mod} from './${mod}'`)) {
        idx += `\nimport ${mod} from './${mod}'`
        idx = idx.replace(/export default \{/, `export default {\n  ...${mod},`)
        fs.writeFileSync(enIndex, idx, 'utf8')
      }
    }
  }
})

console.log(`\nTotal added: zh-CN=${addedZh}, en-US=${addedEn}`)
