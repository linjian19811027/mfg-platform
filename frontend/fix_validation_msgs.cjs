// Replace hardcoded Chinese in form validation message: strings with t() calls
const fs = require('fs')
const path = require('path')
const chnPattern = /message:\s*'([\u4e00-\u9fff][\u4e00-\u9fff\w]+)'/g

const fileMap = {
  'src/views/base/batch/index.vue': [
    [228, 167, 42, 224, 184, 139, 230, 150, 176, 231, 138, 182, 230, 128, 129], // 请选择新状态
    [232, 175, 183, 229, 161, 171, 229, 134, 153, 229, 143, 152, 230, 155, 180, 229, 142, 159, 229, 155, 160], // 请填写变更原因
  ],
}

// Simpler approach: just do regex replacement per file
const replacements = [
  // base/batch
  { file: 'src/views/base/batch/index.vue', from: "message: '请选择新状态'", to: "message: t('common.validation.selectRequired')" },
  { file: 'src/views/base/batch/index.vue', from: "message: '请填写变更原因'", to: "message: t('common.validation.inputRequired')" },
  // base/work-center
  { file: 'src/views/base/work-center/index.vue', from: "message: '请输入名称'", to: "message: t('common.validation.inputRequired')" },
  // mes/auto-receipt-config
  { file: 'src/views/mes/auto-receipt-config/index.vue', from: "message: '请选择匹配类型'", to: "message: t('common.validation.selectRequired')" },
  { file: 'src/views/mes/auto-receipt-config/index.vue', from: "message: '请输入匹配值'", to: "message: t('common.validation.inputRequired')" },
  // mes/dashboard needs useI18n added back (was removed earlier)
// Its message: fields are mock data, not form validation
  { file: 'src/views/mes/dashboard/index.vue', from: "message: '计划完工时间已超期 2 天'", to: "message: t('mes.dashboard.overdueWarning')" },
  { file: 'src/views/mes/dashboard/index.vue', from: "message: '拉丝机 #3 报警停机'", to: "message: t('mes.dashboard.equipmentAlarm')" },
  // outsourcing/orders
  { file: 'src/views/outsourcing/orders/index.vue', from: "message: '请输入供应商ID'", to: "message: t('common.validation.inputRequired')" },
  { file: 'src/views/outsourcing/orders/index.vue', from: "message: '请输入工序名称'", to: "message: t('common.validation.inputRequired')" },
  { file: 'src/views/outsourcing/orders/index.vue', from: "message: '请输入物料ID'", to: "message: t('common.validation.inputRequired')" },
  { file: 'src/views/outsourcing/orders/index.vue', from: "message: '请输入计划数量'", to: "message: t('common.validation.inputRequired')" },
  { file: 'src/views/outsourcing/orders/index.vue', from: "message: '请选择计划交期'", to: "message: t('common.validation.selectRequired')" },
  // plm/document
  { file: 'src/views/plm/document/index.vue', from: "message: '请选择对象类型'", to: "message: t('common.validation.selectRequired')" },
  { file: 'src/views/plm/document/index.vue', from: "message: '关联ID不能为空'", to: "message: t('common.validation.inputRequired')" },
  { file: 'src/views/plm/document/index.vue', from: "message: '请选择文件'", to: "message: t('common.validation.selectRequired')" },
  // sys/organization
  { file: 'src/views/sys/organization/index.vue', from: "message: '请输入组织名称'", to: "message: t('common.validation.inputRequired')" },
  { file: 'src/views/sys/organization/index.vue', from: "message: '请输入组织编码'", to: "message: t('common.validation.inputRequired')" },
  { file: 'src/views/sys/organization/index.vue', from: "message: '只能包含字母、数字、横线和下划线'", to: "message: t('common.validation.alphanumericOnly')" },
  // sys/role
  { file: 'src/views/sys/role/index.vue', from: "message: '请输入角色名称'", to: "message: t('common.validation.inputRequired')" },
  { file: 'src/views/sys/role/index.vue', from: "message: '请输入角色编码'", to: "message: t('common.validation.inputRequired')" },
  { file: 'src/views/sys/role/index.vue', from: "message: '请选择角色类型'", to: "message: t('common.validation.selectRequired')" },
  // sys/tenant
  { file: 'src/views/sys/tenant/index.vue', from: "message: '请输入租户名称'", to: "message: t('common.validation.inputRequired')" },
  { file: 'src/views/sys/tenant/index.vue', from: "message: '请输入租户编码'", to: "message: t('common.validation.inputRequired')" },
  { file: 'src/views/sys/tenant/index.vue', from: "message: '请输入联系人'", to: "message: t('common.validation.inputRequired')" },
  // sys/uom
  { file: 'src/views/sys/uom/index.vue', from: "message: '请输入单位名称'", to: "message: t('common.validation.inputRequired')" },
  { file: 'src/views/sys/uom/index.vue', from: "message: '请输入单位符号'", to: "message: t('common.validation.inputRequired')" },
  { file: 'src/views/sys/uom/index.vue', from: "message: '请选择单位类型'", to: "message: t('common.validation.selectRequired')" },
  // traceability/batches
  { file: 'src/views/traceability/batches/index.vue', from: "message: '请输入物料编码'", to: "message: t('common.validation.inputRequired')" },
  { file: 'src/views/traceability/batches/index.vue', from: "message: '请输入物料名称'", to: "message: t('common.validation.inputRequired')" },
  { file: 'src/views/traceability/batches/index.vue', from: "message: '请输入批次号'", to: "message: t('common.validation.inputRequired')" },
  { file: 'src/views/traceability/batches/index.vue', from: "message: '请输入数量'", to: "message: t('common.validation.inputRequired')" },
  { file: 'src/views/traceability/batches/index.vue', from: "message: '请说明补录原因'", to: "message: t('common.validation.inputRequired')" },
]

// Group replacements by file
const byFile = {}
for (const r of replacements) {
  if (!byFile[r.file]) byFile[r.file] = []
  byFile[r.file].push(r)
}

let totalReplaced = 0
for (const [file, reps] of Object.entries(byFile)) {
  let content = fs.readFileSync(file, 'utf8')
  // Check if t() is available in the file (script section)
  const hasT = content.includes('const { t }') || content.includes('useI18n')
  
  for (const r of reps) {
    if (content.includes(r.from)) {
      content = content.replace(r.from, r.to)
      totalReplaced++
    } else {
      console.log(`WARNING: Could not find "${r.from}" in ${file}`)
    }
  }
  
  // If file doesn't have useI18n, add it
  if (!hasT && totalReplaced > 0) {
    // Add import after last import in script setup
    content = content.replace(
      /(<script setup lang="ts">\n)(import .+)/,
      "$1$2\nimport { useI18n } from 'vue-i18n'\nconst { t } = useI18n()"
    )
    console.log(`Added useI18n import to ${file}`)
  }
  
  fs.writeFileSync(file, content, 'utf8')
  console.log(`Updated ${file}`)
}

console.log(`\nTotal replacements: ${totalReplaced}`)
