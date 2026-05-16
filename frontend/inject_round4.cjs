const fs = require('fs')
const path = require('path')

const keys = JSON.parse(fs.readFileSync('round4_keys.json', 'utf8'))
const byMod = {}
Object.entries(keys).forEach(([k, v]) => {
  const [m, p, ...r] = k.split('.')
  if (!byMod[m]) byMod[m] = []
  byMod[m].push({ fullKey: k, cn: v, key: r.join('.') })
})

const CN_EN = {
  '详情': 'Detail', '变更状态': 'Change Status', '上传文件': 'Upload File',
  '银行转账': 'Bank Transfer', '现金': 'Cash', '票据': 'Note',
  '导出清单': 'Export List', '新建排班': 'Create Schedule', '批量排班': 'Batch Schedule',
  '新增排班': 'Add Schedule', '删除': 'Delete', '导出 Excel': 'Export Excel',
  '新建配置': 'Create Config', '刷新': 'Refresh', '重试': 'Retry',
  '新建发料单': 'Create Issue', '新建收货单': 'Create Receipt', '新建结算单': 'Create Settlement',
  '新建外协工单': 'Create Outsource Order', '导出': 'Export', '上传文档': 'Upload Doc',
  '下载': 'Download', '新建规则': 'Create Rule',
  '选择文件（≤50MB）': 'Select File (max 50MB)',
  '支持 PDF、Word、Excel、图片，单文件不超过 50MB': 'Support PDF, Word, Excel, images. Max 50MB per file',
  '确认评估': 'Confirm Eval', '手动触发': 'Manual Trigger', '审批通过': 'Approve',
  '新增工序': 'Add Operation', '该物料暂无历史版本，将空白新建': 'No history, will create blank',
  '新建顶级': 'Create Top', '编辑': 'Edit', '新建子组织': 'Create Sub Org',
  '新建租户': 'Create Tenant', '停用': 'Disable', '启用': 'Enable',
  '全部': 'All', '新建单位': 'Create Unit', '换算': 'Conversion',
  '追溯': 'Trace', '导出PDF报告': 'Export PDF',
  '正向追溯': 'Forward Trace', '反向追溯': 'Backward Trace', '生成报告': 'Gen Report',
  '手动补录': 'Manual Entry', '发起评估': 'Initiate Eval', '计算中': 'Calculating',
  '确认冻结在库批次': 'Confirm Freeze', '冻结在库批次': 'Freeze Batches',
  '预警物料列表': 'Alert Material List',
  '追溯节点超过 500 个，已截断显示。建议缩小追溯范围。': 'Over 500 nodes truncated. Narrow your search.',
  '每种类型只应有一个基准单位，其他单位的换算系数相对于基准单位': 'One base unit per type. Others relative to it.',
  '例：1吨 = 1000千克，则换算系数填 1000': 'E.g. 1 ton = 1000 kg, factor = 1000',
  '单次批量最多 500 条，同一员工同一天已有排班将自动跳过。': 'Max 500 per batch. Duplicates auto-skipped.',
  '请选择文件': 'Please select file', '请输入组织名称': 'Input org name',
  '请输入组织编码': 'Input org code', '详见5Why分析': 'See 5Why Analysis',
  '条码': 'Barcode', '二维码': 'QR Code', '工序列表': 'Operation List',
  '物料': 'Material', '批次': 'Batch', '检验': 'Inspection', '库存': 'Inventory',
  '此工单有': 'This WO has', '添加段': 'Add Segment', '新建全局规则': 'Create Global Rule',
  '个': 'unit', '次': 'times',
}
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
